import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import SiteFooter from '../components/SiteFooter';
import WhatsAppCTA from '../components/WhatsAppCTA';
import FloatingContactFab from '../components/FloatingContactFab';
import ConsentBanner from '../components/ConsentBanner';
import CfWebAnalytics from '../components/CfWebAnalytics';
import GtmLoader from '../components/GtmLoader';
import useContent from '../hooks/useContent';
import { LocaleProvider } from '../context/LocaleContext';

export default function AppLayout({ locale = 'en' }) {
  const { content, error, loading } = useContent(locale);

  if (loading) {
    return <div className="loading-screen">[ INITIALIZING DIGITAL TERMINAL... ]</div>;
  }

  if (error || !content) {
    return (
      <div className="error-screen">
        <p>Content array offline: {error}</p>
        <p style={{ marginTop: '1rem', color: 'var(--muted)', fontSize: '.85rem' }}>
          Start MariaDB (docker compose up -d) and API (cd backend && npm run dev)
        </p>
      </div>
    );
  }

  return (
    <LocaleProvider locale={locale}>
      <GtmLoader />
      <CfWebAnalytics />
      <Header content={content} locale={locale} />
      <main>
        <Outlet context={{ content, locale }} />
      </main>
      <SiteFooter content={content} />
      <WhatsAppCTA content={content} />
      <FloatingContactFab contact={content.contact} />
      <ConsentBanner />
    </LocaleProvider>
  );
}
