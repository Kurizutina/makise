import { fireEvent, render, screen, within } from '@testing-library/react';
import RiderDashboard from './rider/RiderDashboard';
import DeliveryAdminDashboard from './admin/DeliveryAdminDashboard';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../context/CustomerActivityContext', () => ({
  getOrderDisplayLabel: (order) => order.label,
  calculateEstimatedWaitMinutes: () => 40,
  useCustomerActivity: () => ({
    orders: [
      { id: 'live-1', label: 'Lunch', source: "Manuela's", section: 'food', status: 'pending_rider', createdAt: '2026-09-13T01:00:00Z', customerName: 'Ana Cruz', customerAddress: '12 Mabini Street, Muñoz', items: [] },
      { id: 'history-1', label: 'Dinner', source: 'Jollibee', section: 'food', status: 'delivered', createdAt: '2026-09-12T01:00:00Z', customerName: 'Ben Santos', customerAddress: '34 Rizal Street, San Jose', items: [] },
      { id: 'legacy-1', label: 'Old order', source: 'Jollibee', section: 'food', status: 'cancelled', createdAt: '2026-09-11T01:00:00Z', items: [] }
    ],
    updateOrderStatus: jest.fn(), assignOrderToRider: jest.fn()
  })
}));

test('rider cards and order details display the saved customer identity', () => {
  render(<RiderDashboard />);
  const card = screen.getByText('live-1').closest('article');
  expect(within(card).getByText('Ana Cruz')).toBeInTheDocument();
  expect(within(card).getByText('12 Mabini Street, Muñoz')).toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: /View Order/ }));
  expect(within(screen.getByRole('dialog')).getByText('Ana Cruz')).toBeInTheDocument();
  expect(within(screen.getByRole('dialog')).getByText('12 Mabini Street, Muñoz')).toBeInTheDocument();
});

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
