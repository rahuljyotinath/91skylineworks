import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/archivo/latin-400.css';
import '@fontsource/archivo/latin-600.css';
import './styles/global.css';
import './styles/landing.css';
import './styles/conversion-cta.css';
import App from './App.jsx';

function loadDeferredFonts() {
  import('@fontsource/archivo-black/latin-400.css');
  import('@fontsource/spline-sans-mono/latin-400.css');
}

function Root() {
  useEffect(() => {
    document.body.classList.add('app-ready');
    const run = () => loadDeferredFonts();
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 2500 });
    } else {
      setTimeout(run, 500);
    }
  }, []);

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
