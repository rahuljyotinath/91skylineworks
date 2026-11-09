import { useEffect, useState } from 'react';
import { trackEvent } from '../utils/analytics';

const STORAGE_KEY = '91sw_consent';

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const setConsent = (granted) => {
    localStorage.setItem(STORAGE_KEY, granted ? 'granted' : 'denied');
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'consent_update',
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
    });
    trackEvent('consent_choice', { consent: granted ? 'accept' : 'reject' });
    window.dispatchEvent(new Event('91sw_consent_change'));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="consent-banner" role="dialog" aria-label="Cookie consent">
      <div className="wrap consent-banner-inner">
        <p>
          We use analytics cookies to understand how visitors use the site and improve our service.
        </p>
        <div className="consent-banner-actions">
          <button type="button" className="btn-conversion btn-conversion--call" onClick={() => setConsent(false)}>
            Reject
          </button>
          <button type="button" className="btn-conversion btn-conversion--inspection" onClick={() => setConsent(true)}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
