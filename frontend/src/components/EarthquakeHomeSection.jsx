import { lazy, Suspense, useMemo, useState } from 'react';
import LocalizedLink from './LocalizedLink';
import useEarthquakes from '../hooks/useEarthquakes';
import useInView from '../hooks/useInView';
import EarthquakeList from './EarthquakeList';
import './Earthquakes.css';

const EarthquakeMap = lazy(() => import('./EarthquakeMap'));

export default function EarthquakeHomeSection({ copy = {}, limit = 5 }) {
  const [selectedId, setSelectedId] = useState(null);
  const [sectionRef, inView] = useInView();
  const { events, loading, error } = useEarthquakes('ne', {
    enabled: inView,
  });
  const items = useMemo(() => events.slice(0, limit), [events, limit]);

  return (
    <div className="earthquake-home" ref={sectionRef}>
      {copy.homeIntro && <p className="earthquake-home-intro">{copy.homeIntro}</p>}
      {!inView ? (
        <div className="earthquake-status">Scroll to load regional seismic map…</div>
      ) : loading && items.length === 0 ? (
        <div className="earthquake-status">Loading recent tremors near Guwahati…</div>
      ) : error && items.length === 0 ? (
        <div className="earthquake-status is-error">Map offline: {error}</div>
      ) : (
        <div className="earthquake-home-layout">
          <Suspense fallback={<div className="earthquake-map-placeholder">Loading map…</div>}>
            <EarthquakeMap
              events={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              locationNote={copy.locationNote}
              compact
            />
          </Suspense>
          <EarthquakeList
            events={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      )}
      {copy.disclaimer && <p className="earthquake-disclaimer">{copy.disclaimer}</p>}
      <div className="page-preview-link">
        <LocalizedLink to="/earthquakes" className="btn btn--ghost">
          View full seismic map <span className="arrow">→</span>
        </LocalizedLink>
      </div>
    </div>
  );
}
