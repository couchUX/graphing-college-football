import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted so the typeface ships with the bundle: no CDN request, no
// render-blocking stylesheet, no flash of a fallback face. This emits a woff2
// per script, but each @font-face carries a unicode-range, so a browser only
// fetches the latin subset (~44KB) — the rest are build artifacts that are
// never requested. The variable package has no per-subset entry point to
// import instead.
import '@fontsource-variable/inter-tight';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
