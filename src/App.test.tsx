import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./scene/AtlasCanvas', () => ({ AtlasCanvas: () => null }));
vi.mock('./data/manifest', () => ({
  loadManifest: () => new Promise(() => {}),
  bundleUrl: (file: string) => `/models/${file}`,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

it('renders the full-bleed viewer shell while booting', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  render(<App />);
  const main = screen.getByRole('main', { name: 'Anatomy viewer' });
  expect(main).toHaveClass('h-dvh', 'w-full');
});

it('shows an error alert if bootstrap fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 500 })),
  );
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Couldn't start the atlas. Please reload.",
  );
});
