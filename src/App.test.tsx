import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./scene/AtlasCanvas', () => ({ AtlasCanvas: () => null }));
vi.mock('./data/manifest', () => ({
  loadManifest: () => new Promise(() => {}),
  bundleUrl: (file: string) => `/models/${file}`,
}));

it('renders the full-bleed viewer shell', () => {
  render(<App />);
  const main = screen.getByRole('main', { name: 'Anatomy viewer' });
  expect(main).toHaveClass('h-dvh', 'w-full');
});
