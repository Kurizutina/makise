import { fireEvent, render, screen, within } from '@testing-library/react';
import { CustomerActivityProvider } from '../../context/CustomerActivityContext';
import ManuelasMenu from './ManuelasMenu';
import { manuelasMenuData } from '../../components/home/ManuelasMenu/manuelasMenuData';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

beforeEach(() => localStorage.clear());

test('renders its first menu page and keeps serving sizes separate in the cart', () => {
  render(<CustomerActivityProvider><ManuelasMenu /></CustomerActivityProvider>);

  const productCards = () => document.querySelectorAll('.jollibee-product-card');
  expect(productCards().length).toBeLessThan(manuelasMenuData.length);

  const card = screen.getByRole('heading', { name: 'Chicken Caldereta' }).closest('article');
  fireEvent.click(within(card).getByRole('button', { name: 'Add to Cart' }));
  fireEvent.change(within(card).getByRole('combobox'), { target: { value: '1' } });
  fireEvent.click(within(card).getByRole('button', { name: 'Add to Cart' }));

  const cart = screen.getByRole('complementary');
  expect(within(cart).getByText('Chicken Caldereta — 20 pax')).toBeInTheDocument();
  expect(within(cart).getByText('Chicken Caldereta — 30 pax')).toBeInTheDocument();
  expect(within(cart).getByText('₱5,200')).toBeInTheDocument();
});

test('show more expands a menu category without mounting the whole catalogue initially', () => {
  render(<CustomerActivityProvider><ManuelasMenu /></CustomerActivityProvider>);

  const initialCards = document.querySelectorAll('.jollibee-product-card').length;
  fireEvent.click(screen.getAllByRole('button', { name: /Show .* more/ })[0]);
  expect(document.querySelectorAll('.jollibee-product-card').length).toBeGreaterThan(initialCards);
});
