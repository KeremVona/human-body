import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { fetchGltfBuffer, preloadGltf } from './scene/gltfCache';
import { startPreloads } from './scene/preloadOrder';

void startPreloads(document, (url) => {
  preloadGltf(url);
  return fetchGltfBuffer(url);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
