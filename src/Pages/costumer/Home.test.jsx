import { fireEvent, render, screen, within } from '@testing-library/react';
import Home from './Home';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useLocation: () => ({ state: null }) }));
jest.mock('../../context/CustomerActivityContext', () => ({ useCustomerActivity: () => ({ addToCart: jest.fn(), placeOrder: jest.fn() }) }));
jest.mock('../../components/home/Header/Header', () => ({ services, selectedService, onServiceChange, onSearch }) => (
  <nav><input aria-label="Search brands" onChange={(event) => onSearch(event.target.value)} />{services.map((service) => <button key={service.ServiceID} onClick={() => onServiceChange(service.ServiceID)} aria-pressed={selectedService === service.ServiceID}>{service.ServiceName}</button>)}</nav>
));
jest.mock('../../components/home/Footer/Footer', () => () => null);
jest.mock('../../components/home/FoodandItem/FoodandItemsSection/FoodandItemsSection', () => ({ brands, emptyMessage, onBrandSelect }) => (
  <div data-testid="brand-grid">{brands.map((brand) => <button key={brand.id} onClick={() => onBrandSelect(brand)}>{brand.name}</button>)}{!brands.length && emptyMessage && <p role="status">{emptyMessage}</p>}</div>
));

afterEach(() => { delete global.fetch; mockNavigate.mockClear(); });

test('home shows API brands and opens the current database product catalog', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ services: [
    { ServiceID: 1, ServiceName: 'Food Delivery', ServiceType: 'food', brands: [
      { BrandID: 4, BrandName: "Manuela's", ImagePath: null, products_count: 185 },
      { BrandID: 3, BrandName: 'Others (Food Delivery)', ImagePath: null, products_count: 0 },
      { BrandID: 1, BrandName: 'Jollibee', ImagePath: null, products_count: 0 },
    ] },
    { ServiceID: 2, ServiceName: 'Item Delivery', ServiceType: 'item', brands: [
      { BrandID: 2, BrandName: 'Jolly Mart', ImagePath: null, products_count: 1 },
    ] },
  ] }) });
  render(<Home />);
  // Home now opens on a distinct "Home" view (hero + Best Sellers) - the
  // brand grid only renders once a service tab is picked, via Home.jsx's
  // isHome toggle (Sean's "created home page", 9/24). Pick a service first
  // to reach the same grid this test previously saw by default.
  fireEvent.click(await screen.findByRole('button', { name: 'Food Delivery' }));
  fireEvent.click(await screen.findByRole('button', { name: "Manuela's" }));
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/brands/4');
  expect(screen.getByRole('button', { name: 'Jollibee' })).toBeInTheDocument();
  expect(within(screen.getByTestId('brand-grid')).getAllByRole('button').map((button) => button.textContent)).toEqual([
    "Manuela's", 'Jollibee', 'Others'
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Item Delivery' }));
  expect(screen.queryByRole('button', { name: "Manuela's" })).not.toBeInTheDocument();
});

test('search shows matching brands from every service and an empty state', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ services: [
    { ServiceID: 1, ServiceName: 'Food Delivery', ServiceType: 'food', brands: [{ BrandID: 1, BrandName: 'Jollibee', ImagePath: null, products_count: 1 }] },
    { ServiceID: 2, ServiceName: 'Item Delivery', ServiceType: 'item', brands: [{ BrandID: 2, BrandName: 'Jolly Mart', ImagePath: null, products_count: 1 }] },
  ] }) });
  render(<Home />);
  await screen.findByRole('button', { name: 'Food Delivery' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Search brands' }), { target: { value: 'jol' } });
  expect((await within(screen.getByTestId('brand-grid')).findAllByRole('button')).map((button) => button.textContent)).toEqual(['Jollibee', 'Jolly Mart']);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search brands' }), { target: { value: 'missing' } });
  expect(screen.getByRole('status')).toHaveTextContent('No brands match your search');
});
