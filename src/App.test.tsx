import { render, screen } from '@testing-library/react';
import App from './App';

it('renders the full-bleed viewer shell', () => {
  render(<App />);
  const main = screen.getByRole('main', { name: 'Anatomy viewer' });
  expect(main).toHaveClass('h-dvh', 'w-full');
});
