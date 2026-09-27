import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import RiderDashboard from './rider/RiderDashboard';
import DeliveryAdminDashboard from './admin/DeliveryAdminDashboard';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../context/CustomerActivityContext', () => ({
  getOrderDisplayLabel: (order) => order.label,
  calculateEstimatedWaitMinutes: () => 40,
  useCustomerActivity: () => ({
    orders: [
      { id: 'live-1', assignedRider: { id: 1 }, label: 'Lunch', source: "Manuela's", section: 'food', status: 'pending_rider', createdAt: '2026-09-13T01:00:00Z', customerName: 'Ana Cruz', customerAddress: '12 Mabini Street, Muñoz', items: [] }
    ],
    updateOrderStatus: jest.fn(), assignOrderToRider: jest.fn()
  })
}));

// History now fetches its own page straight from GET /api/admin/orders
// (see DeliveryAdminDashboard.jsx's HistoryTab) instead of reading from the
// shared, 50-order-capped useBackendOrders list - so these fixtures are raw
// backend Order shapes (what OrderController::indexAll actually returns),
// not the pre-converted local-order shape the old test used.
// Laravel serializes OrderDate as a naive "Y-m-d H:i:s" string with no 'Z' -
// toUtcIso (used by toLocalOrderShape) assumes exactly that shape and just
// appends 'Z', so these fixtures must match it rather than using a
// pre-formed ISO string (which would get a second, invalid 'Z' appended).
const naiveDatetime = (isoString) => isoString.slice(0, 19).replace('T', ' ');

const buildBackendOrder = (overrides) => ({
  OrderID: 1, UserID: 1, TotalPrice: 200, ServiceFee: 0,
  OrderDate: '2026-09-12 01:00:00', DeliveryAddress: null, DeliveryStatus: 'delivered',
  items: [], user: null, rider: null, payments: [], queuePosition: null,
  ...overrides
});

const historyOrder = buildBackendOrder({
  OrderID: 501, OrderDate: '2026-09-12 01:00:00', DeliveryStatus: 'delivered',
  DeliveryAddress: '34 Rizal Street, San Jose', user: { UserID: 2, UserName: 'Ben Santos', Contact: '09170000000' }
});
const legacyOrder = buildBackendOrder({ OrderID: 502, OrderDate: '2026-09-11 01:00:00', DeliveryStatus: 'cancelled' });
const todayOrder = buildBackendOrder({
  OrderID: 503, OrderDate: naiveDatetime(new Date().toISOString()), DeliveryStatus: 'delivered',
  DeliveryAddress: '5 Luna Street', user: { UserID: 3, UserName: 'Cara Reyes', Contact: '09171111111' }
});

// History's date filter now goes over the wire as a real `date` query param
// (OrderController::indexAll) rather than being filtered client-side, so
// this mock filters by it too - otherwise every date pick would return the
// same three fixtures regardless of what was actually asked for.
const mockFetchForHistory = () => {
  global.fetch = jest.fn((url) => {
    const href = String(url);
    if (href.includes('/api/admin/orders')) {
      const requestedDate = new URL(href).searchParams.get('date');
      const orderManilaDate = (order) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(`${order.OrderDate}Z`));
      const data = [historyOrder, legacyOrder, todayOrder].filter((order) => !requestedDate || orderManilaDate(order) === requestedDate);
      return Promise.resolve({ ok: true, json: async () => ({ data, current_page: 1, last_page: 1, total: data.length }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ riders: [] }) });
  });
};

test('rider cards and order details display the saved customer identity', () => {
  sessionStorage.setItem('otuzanAuthenticated', 'test-token');
  sessionStorage.setItem('otuzanUser', JSON.stringify({ id: 1, role: 'driver' }));
  render(<RiderDashboard />);
  const card = screen.getByText('live-1').closest('article');
  expect(within(card).getByText('Ana Cruz')).toBeInTheDocument();
  expect(within(card).getByText('12 Mabini Street, Muñoz')).toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: /View Order/ }));
  expect(within(screen.getByRole('dialog')).getByText('Ana Cruz')).toBeInTheDocument();
  expect(within(screen.getByRole('dialog')).getByText('12 Mabini Street, Muñoz')).toBeInTheDocument();
});

afterEach(() => { sessionStorage.clear(); delete global.fetch; });

test('admin live orders and history display names, addresses, and missing-data fallbacks', async () => {
  mockFetchForHistory();
  render(<DeliveryAdminDashboard />);
  expect(screen.getByText('Ana Cruz')).toBeInTheDocument();
  expect(screen.getByText('12 Mabini Street, Muñoz')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  const row = await screen.findByText('BACKEND-501');
  const rowElement = row.closest('tr');
  expect(within(rowElement).getByText('Ben Santos')).toBeInTheDocument();
  expect(within(rowElement).getByText('34 Rizal Street, San Jose')).toBeInTheDocument();
  expect(screen.getByText('Name not provided')).toBeInTheDocument();
  expect(screen.getByText('Address not provided')).toBeInTheDocument();
});

test('admin History tab filters by an exact date, server-side, without hiding anything by default', async () => {
  mockFetchForHistory();
  render(<DeliveryAdminDashboard />);
  fireEvent.click(screen.getByRole('button', { name: 'History' }));

  // Default view ('All dates') must not change existing behavior - every
  // past delivered/cancelled order still shows up.
  await screen.findByText('BACKEND-501');
  expect(screen.getByText('BACKEND-502')).toBeInTheDocument();
  expect(screen.getByText('BACKEND-503')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  await waitFor(() => expect(screen.queryByText('BACKEND-501')).not.toBeInTheDocument());
  expect(screen.getByText('BACKEND-503')).toBeInTheDocument();
  expect(screen.queryByText('BACKEND-502')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Pick an exact date'), { target: { value: '2026-09-12' } });
  await waitFor(() => expect(screen.queryByText('BACKEND-503')).not.toBeInTheDocument());
  expect(screen.getByText('BACKEND-501')).toBeInTheDocument();
  expect(screen.queryByText('BACKEND-502')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'All dates' }));
  await waitFor(() => expect(screen.getByText('BACKEND-502')).toBeInTheDocument());
  expect(screen.getByText('BACKEND-501')).toBeInTheDocument();
  expect(screen.getByText('BACKEND-503')).toBeInTheDocument();
});
