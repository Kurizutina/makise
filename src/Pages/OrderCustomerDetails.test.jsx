import { fireEvent, render, screen, within } from '@testing-library/react';
import RiderDashboard from './rider/RiderDashboard';
import DeliveryAdminDashboard from './admin/DeliveryAdminDashboard';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../context/CustomerActivityContext', () => ({
  getOrderDisplayLabel: (order) => order.label,
  calculateEstimatedWaitMinutes: () => 40,
  useCustomerActivity: () => ({
    orders: [
      { id: 'live-1', assignedRider: { id: 1 }, label: 'Lunch', source: "Manuela's", section: 'food', status: 'pending_rider', createdAt: '2026-09-13T01:00:00Z', customerName: 'Ana Cruz', customerAddress: '12 Mabini Street, Muñoz', items: [] },
      { id: 'history-1', label: 'Dinner', source: 'Jollibee', section: 'food', status: 'delivered', createdAt: '2026-09-12T01:00:00Z', customerName: 'Ben Santos', customerAddress: '34 Rizal Street, San Jose', items: [] },
      { id: 'legacy-1', label: 'Old order', source: 'Jollibee', section: 'food', status: 'cancelled', createdAt: '2026-09-11T01:00:00Z', items: [] },
      { id: 'today-1', label: 'Snack', source: 'Jollibee', section: 'food', status: 'delivered', createdAt: new Date().toISOString(), customerName: 'Cara Reyes', customerAddress: '5 Luna Street', items: [] }
    ],
    updateOrderStatus: jest.fn(), assignOrderToRider: jest.fn()
  })
}));

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

afterEach(() => sessionStorage.clear());

test('admin live orders and history display names, addresses, and missing-data fallbacks', () => {
  render(<DeliveryAdminDashboard />);
  expect(screen.getByText('Ana Cruz')).toBeInTheDocument();
  expect(screen.getByText('12 Mabini Street, Muñoz')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  const row = screen.getByText('history-1').closest('tr');
  expect(within(row).getByText('Ben Santos')).toBeInTheDocument();
  expect(within(row).getByText('34 Rizal Street, San Jose')).toBeInTheDocument();
  expect(screen.getByText('Name not provided')).toBeInTheDocument();
  expect(screen.getByText('Address not provided')).toBeInTheDocument();
});

test('admin History tab separates today from previous without hiding anything by default', () => {
  render(<DeliveryAdminDashboard />);
  fireEvent.click(screen.getByRole('button', { name: 'History' }));

  // Default view ('All dates') must not change existing behavior - every
  // past delivered/cancelled order still shows up.
  expect(screen.getByText('history-1')).toBeInTheDocument();
  expect(screen.getByText('legacy-1')).toBeInTheDocument();
  expect(screen.getByText('today-1')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  expect(screen.getByText('today-1')).toBeInTheDocument();
  expect(screen.queryByText('history-1')).not.toBeInTheDocument();
  expect(screen.queryByText('legacy-1')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(screen.getByText('history-1')).toBeInTheDocument();
  expect(screen.getByText('legacy-1')).toBeInTheDocument();
  expect(screen.queryByText('today-1')).not.toBeInTheDocument();
});
