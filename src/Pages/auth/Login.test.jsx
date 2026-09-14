import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Login from './Login';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  mockNavigate.mockClear();
  global.fetch = jest.fn();
});
afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  delete global.fetch;
});
const submit = () => {
  render(<Login />);
  fireEvent.click(screen.getByRole('button', { name: 'Rider' }));
  fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'rider@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } });
  fireEvent.change(screen.getByPlaceholderText('Rider Access Code'), { target: { value: 'DRIVER2024' } });
  fireEvent.click(screen.getByRole('button', { name: /Verify & Log in/ }));
};
test('rider login keeps the backend token and account ID and uses the backend driver role', async () => {
  const user = { id: 7, role: 'driver', username: 'Seven', email: 'rider@example.com' };
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ token: 'signed-token', user }) });
  submit();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/rider/orders', { replace: true }));
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).role).toBe('driver');
  expect(sessionStorage.getItem('otuzanAuthenticated')).toBe('signed-token');
  expect(JSON.parse(sessionStorage.getItem('otuzanUser'))).toEqual(user);
});
test('failed login does not grant access or replace the error with success', async () => {
  global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'invalid credentials' }) });
  submit();
  expect(await screen.findByText('invalid credentials')).toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('otuzanAuthenticated')).toBeNull();
});
