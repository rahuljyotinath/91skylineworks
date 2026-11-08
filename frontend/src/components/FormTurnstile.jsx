import { useEffect, useRef } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    if (document.querySelector('script[data-turnstile]')) {
      const check = () => (window.turnstile ? resolve() : setTimeout(check, 50));
      check();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.appendChild(script);
  });
}

export default function FormTurnstile({ onToken, action = 'contact' }) {
  const hostRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (!SITE_KEY || !hostRef.current) return undefined;

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return;
        widgetRef.current = window.turnstile.render(hostRef.current, {
          sitekey: SITE_KEY,
          action,
          callback: (token) => onToken?.(token),
          'expired-callback': () => onToken?.(''),
          'error-callback': () => onToken?.(''),
        });
      })
      .catch(() => onToken?.(''));

    return () => {
      cancelled = true;
      if (widgetRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [onToken, action]);

  if (!SITE_KEY) return null;

  return <div className="form-turnstile" ref={hostRef} aria-hidden={false} />;
}

export function turnstileRequired() {
  return Boolean(SITE_KEY);
}
