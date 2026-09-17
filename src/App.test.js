import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./routes/AppRoutes', () => () => <div>Otu-Zan routes</div>);

test('renders the application shell', () => {
  render(<App />);
  expect(screen.getByText('Otu-Zan routes')).toBeInTheDocument();
});
