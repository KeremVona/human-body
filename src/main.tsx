import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { preloadGltf } from './scene/gltfCache';

const skeletalUrl = document
  .querySelector('meta[name="atlas-skeletal"]')
  ?.getAttribute('content');
if (skeletalUrl) {
  preloadGltf(skeletalUrl);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
