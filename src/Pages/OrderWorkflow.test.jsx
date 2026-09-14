import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CustomerActivityProvider, useCustomerActivity } from '../context/CustomerActivityContext';
import DeliveryAdminDashboard from './admin/DeliveryAdminDashboard';
import RiderDashboard from './rider/RiderDashboard';

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

test('admin assigns a registered rider and updates status through delivery immediately and after remount', async () => {
  signIn(1, 'admin');
  const view = render(<CustomerActivityProvider><DeliveryAdminDashboard /><Observer /></CustomerActivityProvider>);
  await screen.findByRole('option', { name: 'Rider Seven' });
  fireEvent.change(screen.getByLabelText('Assigned rider'), { target: { value: '7' } });
  expect(saved().orders[0].assignedRider).toEqual({ id: 7, name: 'Rider Seven' });
  for (const status of ['preparing', 'out_for_delivery', 'delivered']) {
    fireEvent.change(screen.getByLabelText('Order status'), { target: { value: status } });
    expect(screen.getByTestId('status')).toHaveTextContent(status);
    expect(saved().orders[0]).toMatchObject({ status, assignedRider: { id: 7 } });
  }
  expect(saved().notifications[0].title).toBe('Order delivered');
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(within(screen.getByText('ORD-1').closest('tr')).getByText('delivered')).toBeInTheDocument();
  view.unmount();
  render(<CustomerActivityProvider><Observer /></CustomerActivityProvider>);
  expect(screen.getByTestId('status')).toHaveTextContent('delivered');
});

test('admin can cancel an assigned order', async () => {
  signIn(1, 'admin');
  render(<CustomerActivityProvider><DeliveryAdminDashboard /></CustomerActivityProvider>);
  await screen.findByRole('option', { name: 'Rider Seven' });
  fireEvent.change(screen.getByLabelText('Assigned rider'), { target: { value: '7' } });
  fireEvent.change(screen.getByLabelText('Order status'), { target: { value: 'cancelled' } });
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

test('backend rider lookup failure leaves status updates available', async () => {
  signIn(1, 'admin');
  global.fetch.mockRejectedValue(new Error('offline'));
  render(<CustomerActivityProvider><DeliveryAdminDashboard /></CustomerActivityProvider>);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to load registered riders'));
  fireEvent.change(screen.getByLabelText('Order status'), { target: { value: 'delivered' } });
  expect(saved().orders[0].status).toBe('delivered');
});
