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

test('a customer sees notifications only for orders linked to their account', () => {
  signIn(42, 'customer');
  const ownOrder = { ...order, customerId: 42, id: 'OWN-ORDER' };
  const otherOrder = { ...order, customerId: 99, id: 'OTHER-ORDER' };
  localStorage.setItem('otuzanCustomerActivity', JSON.stringify({
    orders: [ownOrder, otherOrder],
    cart: [],
    notifications: [
      { id: 'OWN-NOTIFICATION', orderId: 'OWN-ORDER' },
      { id: 'OTHER-NOTIFICATION', orderId: 'OTHER-ORDER' }
    ]
  }));
  render(<CustomerActivityProvider><Observer /></CustomerActivityProvider>);
  expect(actions.orders).toEqual([ownOrder]);
  expect(actions.notifications).toEqual([{ id: 'OWN-NOTIFICATION', orderId: 'OWN-ORDER' }]);
});

test('a cart belongs only to the customer who added its items', () => {
  signIn(42, 'customer');
  const firstCustomer = render(<CustomerActivityProvider><Observer /></CustomerActivityProvider>);
  act(() => actions.addToCart({ id: 'burger', source: 'Shop', name: 'Burger' }));
  expect(actions.cart).toHaveLength(1);

  // Another signed-in account using the same browser must not inherit the
  // first account's browser-local cart.
  firstCustomer.unmount();
  sessionStorage.setItem('otuzanUser', JSON.stringify({ id: 99, role: 'customer' }));
  const otherCustomer = render(<CustomerActivityProvider><Observer /></CustomerActivityProvider>);
  expect(actions.cart).toEqual([]);
  otherCustomer.unmount();
});

// Regression test for a real cross-user privacy leak (found live, 9/23):
// otuzanCustomerActivity's localStorage blob isn't scoped per account, and
// useCustomerActivity() used to have no explicit branch for "no session" -
// it fell through to the same unfiltered `return context` used for admin.
// A guest (or a customer who just logged out) on the same browser could see
// whichever customer's orders/notifications were last synced there.
test('a guest (no session) sees no orders or notifications, even when some are cached locally', () => {
  const someonesOrder = { ...order, customerId: 42, id: 'SOMEONES-ORDER' };
  localStorage.setItem('otuzanCustomerActivity', JSON.stringify({
    orders: [someonesOrder],
    cart: [],
    notifications: [{ id: 'SOMEONES-NOTIFICATION', orderId: 'SOMEONES-ORDER' }]
  }));
  render(<CustomerActivityProvider><Observer /></CustomerActivityProvider>);
  expect(actions.orders).toEqual([]);
  expect(actions.notifications).toEqual([]);
});

test('direct and cart orders retain the signed-in customer account ID', async () => {
  signIn(42, 'customer');
  localStorage.setItem('otuzanCustomerProfile', JSON.stringify({ id: 42, username: 'Full Name', address: 'Address', email: 'customer@example.com' }));
  render(<CustomerActivityProvider><Observer /></CustomerActivityProvider>);
  // Explicit daytime timestamp - calculateDeliveryFee applies a night
  // surcharge past a cutoff time, and both calls below default to the real
  // wall-clock time when orderTime isn't passed, which made this test flaky
  // whenever the suite happened to run late at night.
  // 02:00 UTC lands well before the earliest night-surcharge cutoff
  // (18:30) across every real-world UTC offset (-12 to +14), not just this
  // machine's own timezone. Each order also needs a distinct, increasing
  // timestamp: persist()'s mergeById sorts by time descending so the
  // newest order lands at orders[0], and the seeded baseline order fixes
  // its own timestamp at 2026-09-14 - both test orders must sort after
  // that, and after each other in placement order.
  act(() => actions.placeOrder({ source: 'Shop', items: [], deliveryLocation: 'villa-javier', orderTime: '2026-09-15T02:00:00.000Z' }));
  expect(saved().orders[0]).toMatchObject({ customerId: 42, customerName: 'Full Name', customerEmail: 'customer@example.com', serviceFee: 75, deliveryLocationName: 'Villa Javier' });
  act(() => actions.addToCart({ id: 'item', source: 'Shop', name: 'Food', details: { deliveryLocation: 'bukang-liwayway' } }));
  // The rapid-repeat-click guard (guardOrderPlacement's isPlacingOrderRef,
  // added by the adversarial QA pass) blocks a second order placement for
  // 1200ms after the first - real, correct anti-duplicate-order behavior,
  // but this test places two orders back to back on purpose, so it has to
  // clear the same cooldown a real customer would between separate orders.
  await new Promise((resolve) => setTimeout(resolve, 1250));
  act(() => actions.placeCartOrder(null, undefined, undefined, '2026-09-15T02:00:01.000Z'));
  expect(saved().orders[0]).toMatchObject({ customerId: 42, customerName: 'Full Name', serviceFee: 75, deliveryLocationName: 'Bukang Liwayway' });
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

// updateOrderStatus now returns a Promise (origin/kurizu's optimistic-update
// architecture - RiderDashboard's updateProgress awaits it to roll back on
// rejection). A sync act(() => ...) wrapping a thenable return leaves
// React's act-scope open without ever being awaited closed, which doesn't
// fail this test itself but corrupts the NEXT test's ability to render at
// all - found live (9/26) chasing a mystifying failure in an unrelated,
// later-running test with no thrown error and no stack trace to follow.
test('status actions preserve a just-written assignment and reject another rider', async () => {
  signIn(1, 'admin');
  render(<CustomerActivityProvider><Observer /></CustomerActivityProvider>);
  await act(async () => {
    actions.assignOrderToRider('ORD-1', { id: 7, name: 'Seven' });
    await actions.updateOrderStatus('ORD-1', 'preparing');
  });
  expect(saved().orders[0]).toMatchObject({ status: 'preparing', assignedRider: { id: 7 } });
  signIn(8, 'driver');
  await act(async () => actions.updateOrderStatus('ORD-1', 'delivered'));
  expect(saved().orders[0].status).toBe('preparing');
  signIn(7, 'driver');
  await act(async () => actions.updateOrderStatus('ORD-1', 'out_for_delivery'));
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

test('revenue tab renders the backend-aggregated total, not a locally-derived one', async () => {
  signIn(1, 'admin');
  // Revenue used to be summed client-side from whatever page of orders the
  // dashboard already had loaded (capped, per_page=50) - now it's a real
  // fetch to OrderController::revenue, which aggregates every order.
  // Route the shared fetch mock by URL so this test can hand back a
  // deliberately different number from what any local order implies,
  // proving the tab renders the backend's figure, not a recomputed one.
  global.fetch.mockImplementation((url) => Promise.resolve({
    ok: true,
    json: async () => (String(url).includes('/api/admin/revenue')
      ? { total: 65, byService: { food: 65, item: 0, bills: 0 }, daily: [], orderCount: 1 }
      : { riders: [] })
  }));
  render(<CustomerActivityProvider><DeliveryAdminDashboard /></CustomerActivityProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Revenue' }));
  const revenueCard = await screen.findByText('Total recorded revenue');
  expect(revenueCard.parentElement).toHaveTextContent('₱65.00');
});
