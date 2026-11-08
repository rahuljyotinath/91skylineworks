import { useMemo, useState } from 'react';
import useEarthquakes from '../hooks/useEarthquakes';
import { timeAgo } from '../lib/earthquakes';
import EarthquakeMap from './EarthquakeMap';
import EarthquakeList from './EarthquakeList';
import EarthquakeDetail from './EarthquakeDetail';
import './Earthquakes.css';

const TABS = [
  { id: 'ne', label: 'Northeast India' },
  { id: 'global', label: 'Latest worldwide' },
  { id: 'significant', label: 'Significant' },
];

export default function EarthquakeFeed({ copy = {}, defaultScope = 'ne', compact = false }) {
  const [scope, setScope] = useState(defaultScope);
  const [selectedId, setSelectedId] = useState(null);
  const { events, loading, error, fetchedAt, source } = useEarthquakes(scope);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) || null,
    [events, selectedId]
  );

  const handleScopeChange = (next) => {
    setScope(next);
    setSelectedId(null);
  };

  if (loading && events.length === 0) {
    return <div className="earthquake-status">[ LOADING USGS SEISMIC CATALOG... ]</div>;
  }

  if (error && events.length === 0) {
    return <div className="earthquake-status is-error">Feed offline: {error}</div>;
  }

  return (
    <div className="earthquake-feed">
      {!compact && (
        <div className="earthquake-feed-header">
          <div className="earthquake-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`earthquake-tab${scope === tab.id ? ' is-active' : ''}`}
                onClick={() => handleScopeChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {fetchedAt && (
            <div className="earthquake-meta">
              {source} · updated {timeAgo(fetchedAt)}
            </div>
          )}
        </div>
      )}

      <div className="earthquake-layout">
        <EarthquakeMap
          events={events}
          selectedId={selectedId}
          onSelect={setSelectedId}
          locationNote={copy.locationNote}
        />
        <div className="earthquake-side">
          <EarthquakeList
            events={events}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <EarthquakeDetail event={selected} />
        </div>
      </div>

      {copy.disclaimer && <p className="earthquake-disclaimer">{copy.disclaimer}</p>}
    </div>
  );
}
