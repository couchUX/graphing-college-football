import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted so the typeface ships with the bundle: no CDN request, no
// render-blocking stylesheet, no flash of a fallback face.
import '@fontsource-variable/inter-tight';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
