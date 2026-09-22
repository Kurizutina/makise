import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomerMenu from './CustomerMenu';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
const user = { id: 7, username: 'Saved Name', email: 'saved@example.com', address: 'Saved Address', role: 'customer', contact: '09123456789' };
const openEditor = async () => {
  render(<CustomerMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Open customer menu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Profile' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled());
};
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  sessionStorage.setItem('otuzanAuthenticated', 'test-token');
  sessionStorage.setItem('otuzanUser', JSON.stringify(user));
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ user }) });
});
afterEach(() => { delete global.fetch; localStorage.clear(); sessionStorage.clear(); });

test('loads database values and caches only the confirmed server response after save', async () => {
  localStorage.setItem('otuzanCustomerActivity', JSON.stringify({ orders: [{ id: 'order', customerId: user.id, customerName: user.username, assignedRider: { id: 8 } }] }));
  const updated = { ...user, username: 'New Full Name', email: 'new@example.com', address: 'New Address' };
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ user: updated }) });
  await openEditor();
  expect(screen.getByLabelText('Full name')).toHaveValue('Saved Name');
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: updated.username } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: updated.email } });
  fireEvent.change(screen.getByLabelText('Delivery address'), { target: { value: updated.address } });
  fireEvent.change(screen.getByPlaceholderText('Leave blank to keep current password'), { target: { value: 'changed123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await screen.findByText('Profile updated successfully.');
  const request = global.fetch.mock.calls[1][1];
  expect(request.method).toBe('PATCH');
  expect(request.headers.Authorization).toBe('Bearer test-token');
  expect(JSON.parse(request.body)).toMatchObject({ username: updated.username, password: 'changed123' });
  expect(JSON.parse(localStorage.getItem('otuzanCustomerProfile'))).toEqual(updated);
  expect(JSON.parse(sessionStorage.getItem('otuzanUser'))).toEqual(updated);
  expect(localStorage.getItem('otuzanCustomerAddress:new@example.com')).toBe('New Address');
  expect(screen.getByPlaceholderText('Leave blank to keep current password')).toHaveValue('');
  expect(JSON.parse(localStorage.getItem('otuzanCustomerActivity')).orders[0]).toMatchObject({ customerName: updated.username, customerAddress: updated.address, assignedRider: { id: 8 } });
});

test('failed save displays server error and keeps persisted profile unchanged', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'email is already registered' }) });
  await openEditor();
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Unsaved Name' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('email is already registered');
  expect(screen.queryByText('Profile updated successfully.')).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('otuzanCustomerProfile'))).toEqual(user);
  expect(JSON.parse(global.fetch.mock.calls[1][1].body)).not.toHaveProperty('password');
});

test('expired session prevents editing a cached profile', async () => {
  global.fetch.mockReset().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'authentication required' }) });
  render(<CustomerMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Open customer menu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Profile' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please sign in again');
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
});
