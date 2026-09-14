import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CustomerActivityProvider, useCustomerActivity } from '../context/CustomerActivityContext';
import DeliveryAdminDashboard from './admin/DeliveryAdminDashboard';
import RiderDashboard from './rider/RiderDashboard';
import { syncCustomerOrders } from '../utils/customerProfileSync';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

const order = {
  id: 'ORD-1', label: 'Lunch', source: 'Jollibee', section: 'food',
  status: 'pending_rider', createdAt: '2026-09-14T01:00:00Z', items: []
};
const signIn = (id, role) => {
  sessionStorage.setItem('otuzanAuthenticated', 'token');
  sessionStorage.setItem('otuzanUser', JSON.stringify({ id, role }));
};
const saved = () => JSON.parse(localStorage.getItem('otuzanCustomerActivity'));
let actions;
const Observer = () => {
  actions = useCustomerActivity();
  return <output data-testid="status">{actions.orders[0]?.status}</output>;
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('otuzanCustomerActivity', JSON.stringify({ orders: [order], cart: [], notifications: [] }));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ riders: [{ id: 7, name: 'Rider Seven' }, { id: 8, name: 'Rider Eight' }] }) });
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete global.fetch;
});

test.each(['admin', 'driver'])('saved profile refreshes %s cards and detail views without changing assignment', async (role) => {
  signIn(role === 'admin' ? 1 : 7, role);
  const linked = { ...order, customerId: 42, customerName: 'Old Name', customerAddress: 'Old Address', assignedRider: { id: 7 } };
  localStorage.setItem('otuzanCustomerActivity', JSON.stringify({ orders: [linked], cart: [], notifications: [] }));
  render(<CustomerActivityProvider>{role === 'admin' ? <DeliveryAdminDashboard /> : <RiderDashboard />}</CustomerActivityProvider>);
  if (role === 'admin') await screen.findByRole('option', { name: 'Rider Seven' });
  else fireEvent.click(screen.getByRole('button', { name: /View Order/ }));
  act(() => syncCustomerOrders({ id: 42, role: 'customer', username: 'Updated Full Name', address: 'Updated Address', email: 'updated@example.com' }));
  expect(screen.queryByText('Old Name')).not.toBeInTheDocument();
  expect(screen.getAllByText('Updated Full Name').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Updated Address').length).toBeGreaterThan(0);
  if (role === 'driver') expect(within(screen.getByRole('dialog')).getByText('Updated Full Name')).toBeInTheDocument();
  expect(saved().orders[0]).toMatchObject({ customerId: 42, assignedRider: { id: 7 }, status: 'pending_rider' });
});

test('profile sync never replaces another customer or an unlinked legacy order', () => {
  const other = { ...order, customerId: 99, customerName: 'Same Name', customerAddress: 'Same Address' };
  const legacy = { ...order, id: 'legacy', customerName: 'Same Name', customerAddress: 'Same Address' };
  localStorage.setItem('otuzanCustomerActivity', JSON.stringify({ orders: [other, legacy] }));
  syncCustomerOrders({ id: 42, role: 'customer', username: 'Updated Name', address: 'Updated Address' });
  expect(saved().orders).toEqual([other, legacy]);
});

test('direct and cart orders retain the signed-in customer account ID', () => {
  signIn(42, 'customer');
  localStorage.setItem('otuzanCustomerProfile', JSON.stringify({ id: 42, username: 'Full Name', address: 'Address', email: 'customer@example.com' }));
  render(<CustomerActivityProvider><Observer /></CustomerActivityProvider>);
  act(() => actions.placeOrder({ source: 'Shop', items: [] }));
  expect(saved().orders[0]).toMatchObject({ customerId: 42, customerName: 'Full Name', customerEmail: 'customer@example.com' });
  act(() => actions.addToCart({ id: 'item', source: 'Shop', name: 'Food' }));
  act(() => actions.placeCartOrder());
  expect(saved().orders[0]).toMatchObject({ customerId: 42, customerName: 'Full Name' });
});

test('admin explicitly assigns an active delivery and only the selected rider sees it', async () => {
  localStorage.setItem('otuzanCustomerActivity', JSON.stringify({ orders: [{ ...order, status: 'out_for_delivery' }], cart: [], notifications: [] }));
  signIn(1, 'admin');
  const admin = render(<CustomerActivityProvider><DeliveryAdminDashboard /></CustomerActivityProvider>);
  await screen.findByRole('option', { name: 'Rider Seven' });
  expect(screen.queryByLabelText('Order status')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Mark delivered/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Assigned rider'), { target: { value: '7' } });
  expect(saved().orders[0].assignedRider).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
  expect(saved().orders[0]).toMatchObject({ status: 'out_for_delivery', assignedRider: { id: 7, name: 'Rider Seven' } });
  expect(screen.getByRole('status')).toHaveTextContent('Assigned to Rider Seven');
  expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Assigned rider'), { target: { value: '8' } });
  expect(saved().orders[0].assignedRider.id).toBe(7);
  admin.unmount();
  signIn(8, 'driver');
  const other = render(<CustomerActivityProvider><RiderDashboard /></CustomerActivityProvider>);
  expect(screen.queryByText('ORD-1')).not.toBeInTheDocument();
  other.unmount();
  signIn(7, 'driver');
  render(<CustomerActivityProvider><RiderDashboard /></CustomerActivityProvider>);
  expect(screen.getByText('ORD-1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /View Order/ }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark Delivered' }));
  expect(saved().orders[0].status).toBe('delivered');
  expect(saved().notifications[0].title).toBe('Order delivered');
});

test('admin can cancel an assigned order', async () => {
  signIn(1, 'admin');
  render(<CustomerActivityProvider><DeliveryAdminDashboard /></CustomerActivityProvider>);
  await screen.findByRole('option', { name: 'Rider Seven' });
  fireEvent.change(screen.getByLabelText('Assigned rider'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
  expect(saved().orders[0]).toMatchObject({ status: 'cancelled', assignedRider: { id: 7 } });
  expect(saved().notifications[0].message).not.toContain('by the rider');
});

test('rider sees only own assignments and loses an open order when reassigned in another tab', () => {
  signIn(7, 'driver');
  const own = { ...order, assignedRider: { id: 7 } };
  const other = { ...order, id: 'OTHER', assignedRider: { id: 8 } };
  localStorage.setItem('otuzanCustomerActivity', JSON.stringify({ orders: [own, other, { ...order, id: 'UNASSIGNED' }] }));
  render(<CustomerActivityProvider><RiderDashboard /></CustomerActivityProvider>);
  expect(screen.getByText('ORD-1')).toBeInTheDocument();
  expect(screen.queryByText('OTHER')).not.toBeInTheDocument();
  expect(screen.queryByText('UNASSIGNED')).not.toBeInTheDocument();
  expect(screen.getByText('1 pending')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /View Order/ }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  act(() => window.dispatchEvent(new StorageEvent('storage', {
    key: 'otuzanCustomerActivity', newValue: JSON.stringify({ orders: [{ ...own, assignedRider: { id: 8 } }, other] })
  })));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('ORD-1')).not.toBeInTheDocument();
  expect(screen.getByText('0 pending')).toBeInTheDocument();
});

test('missing rider identity reveals no orders', () => {
  render(<CustomerActivityProvider><RiderDashboard /></CustomerActivityProvider>);
  expect(screen.queryByText('ORD-1')).not.toBeInTheDocument();
});

test('status actions preserve a just-written assignment and reject another rider', () => {
  signIn(1, 'admin');
  render(<CustomerActivityProvider><Observer /></CustomerActivityProvider>);
  act(() => {
    actions.assignOrderToRider('ORD-1', { id: 7, name: 'Seven' });
    actions.updateOrderStatus('ORD-1', 'preparing');
  });
  expect(saved().orders[0]).toMatchObject({ status: 'preparing', assignedRider: { id: 7 } });
  signIn(8, 'driver');
  act(() => actions.updateOrderStatus('ORD-1', 'delivered'));
  expect(saved().orders[0].status).toBe('preparing');
  signIn(7, 'driver');
  act(() => actions.updateOrderStatus('ORD-1', 'out_for_delivery'));
  expect(saved().orders[0].status).toBe('out_for_delivery');
});

test('backend rider lookup failure prevents assigning an unavailable rider', async () => {
  signIn(1, 'admin');
  global.fetch.mockRejectedValue(new Error('offline'));
  render(<CustomerActivityProvider><DeliveryAdminDashboard /></CustomerActivityProvider>);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to load registered riders'));
  expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  expect(saved().orders[0].assignedRider).toBeUndefined();
});
