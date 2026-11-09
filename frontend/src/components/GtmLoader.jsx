import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../utils/analytics';

const GTM_ID = import.meta.env.VITE_GTM_ID;
const CONSENT_KEY = '91sw_consent';
const CONSENT_EVENT = '91sw_consent_change';

function consentGranted() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

function injectGtm(id) {
  if (document.getElementById('gtm-script') || document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.id = 'gtm-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  document.head.appendChild(script);

  if (!document.getElementById('gtm-noscript')) {
    const noscript = document.createElement('noscript');
    noscript.id = 'gtm-noscript';
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.prepend(noscript);
  }
}

function scheduleGtmLoad(id) {
  const load = () => injectGtm(id);
  if (typeof requestIdleCallback === 'function') {
    return { kind: 'idle', id: requestIdleCallback(load, { timeout: 4000 }) };
  }
  return { kind: 'timeout', id: window.setTimeout(load, 2000) };
}

export default function GtmLoader() {
  const location = useLocation();

  useEffect(() => {
    if (!GTM_ID) return undefined;

    let pending;

    const tryLoad = () => {
      if (!consentGranted()) return;
      pending = scheduleGtmLoad(GTM_ID);
    };

    tryLoad();
    const onConsent = () => tryLoad();
    window.addEventListener(CONSENT_EVENT, onConsent);

    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsent);
      if (!pending) return;
      if (pending.kind === 'idle' && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(pending.id);
      } else if (pending.kind === 'timeout') {
        clearTimeout(pending.id);
      }
    };
  }, []);

  useEffect(() => {
    if (!GTM_ID) return;
    trackEvent('page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);

  return null;
}
