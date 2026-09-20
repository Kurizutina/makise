import { fireEvent, render, screen, within } from '@testing-library/react';
import { CustomerActivityProvider } from '../../context/CustomerActivityContext';
import ManuelasMenu from './ManuelasMenu';
import { manuelasMenuData } from '../../components/home/ManuelasMenu/manuelasMenuData';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

beforeEach(() => localStorage.clear());

test('renders every individual dish and keeps serving sizes separate in cart and checkout', () => {
  render(<CustomerActivityProvider><ManuelasMenu /></CustomerActivityProvider>);
  expect(screen.getAllByRole('article')).toHaveLength(manuelasMenuData.length);
  const card = screen.getByRole('heading', { name: 'Chicken Caldereta' }).closest('article');
  fireEvent.click(within(card).getByRole('button', { name: 'Add to Cart' }));
  fireEvent.change(within(card).getByRole('combobox'), { target: { value: '1' } });
  fireEvent.click(within(card).getByRole('button', { name: 'Add to Cart' }));
  const cart = screen.getByRole('complementary');
  const selects = within(cart).getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'clsu-main-campus' } });
  fireEvent.change(selects[1], { target: { value: 'student' } });
  expect(within(cart).getByText('Chicken Caldereta — 20 pax')).toBeInTheDocument();
  expect(within(cart).getByText('Chicken Caldereta — 30 pax')).toBeInTheDocument();
  expect(within(cart).getByText('₱5,200')).toBeInTheDocument();
  fireEvent.click(within(cart).getByRole('button', { name: 'Place Order (2)' }));
  const saved = JSON.parse(localStorage.getItem('otuzanCustomerActivity'));
  expect(saved.cart).toHaveLength(0);
  expect(saved.orders[0].source).toBe("Manuela's");
  expect(saved.orders[0].items.map(({ price, servingSize }) => ({ price, servingSize }))).toEqual([
    { price: 2100, servingSize: '20 pax' }, { price: 3100, servingSize: '30 pax' }
  ]);
});

test('direct orders use the selected serving size and printed price', () => {
  render(<CustomerActivityProvider><ManuelasMenu /></CustomerActivityProvider>);
  const card = screen.getByRole('heading', { name: 'Crispy Sisig' }).closest('article');
  fireEvent.change(within(card).getByRole('combobox'), { target: { value: '4' } });
  fireEvent.click(within(card).getByRole('button', { name: 'Add to Cart' }));
  const cart = screen.getByRole('complementary');
  const selects = within(cart).getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'clsu-main-campus' } });
  fireEvent.change(selects[1], { target: { value: 'student' } });
  fireEvent.click(within(cart).getByRole('button', { name: 'Place Order (1)' }));
  const saved = JSON.parse(localStorage.getItem('otuzanCustomerActivity'));
  expect(saved.orders[0].items[0]).toMatchObject({
    name: 'Crispy Sisig — XL bilao (22 pax)', price: 1200, quantity: 1
  });
});
