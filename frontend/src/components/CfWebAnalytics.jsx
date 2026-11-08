import { useEffect } from 'react';

const BEACON_TOKEN = import.meta.env.VITE_CF_BEACON_TOKEN;

/**
 * Cloudflare Web Analytics (privacy-friendly). Token from Dashboard → Analytics → Web Analytics.
 */
export default function CfWebAnalytics() {
  useEffect(() => {
    if (!BEACON_TOKEN || document.querySelector('script[data-cf-beacon]')) return;
    const script = document.createElement('script');
    script.defer = true;
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.dataset.cfBeacon = JSON.stringify({ token: BEACON_TOKEN });
    document.head.appendChild(script);
  }, []);

  return null;
}
