export const NE_BBOX = {
  minLat: 22.0,
  maxLat: 29.8,
  minLon: 88.0,
  maxLon: 97.8,
};

export const GUWAHATI_CENTER = [26.1445, 91.7362];

export const SCOPES = ['ne', 'global', 'significant'];

const USGS_BASE = 'https://earthquake.usgs.gov';
const NE_DAYS = 90;

export function isInNeBbox(event) {
  const lat = event?.lat;
  const lon = event?.lon;
  if (lat == null || lon == null) return false;
  return (
    lat >= NE_BBOX.minLat &&
    lat <= NE_BBOX.maxLat &&
    lon >= NE_BBOX.minLon &&
    lon <= NE_BBOX.maxLon
  );
}

export function filterNeEvents(events) {
  return (events || []).filter(isInNeBbox);
}

export function buildUsgsUrl(scope) {
  if (scope === 'global') {
    return `${USGS_BASE}/earthquakes/feed/v1.0/summary/all_day.geojson`;
  }
  if (scope === 'significant') {
    return `${USGS_BASE}/earthquakes/feed/v1.0/summary/significant_month.geojson`;
  }

  const end = new Date().toISOString();
  const start = new Date(Date.now() - NE_DAYS * 24 * 3600 * 1000).toISOString();
  const params = new URLSearchParams({
    format: 'geojson',
    starttime: start,
    endtime: end,
    minlatitude: String(NE_BBOX.minLat),
    maxlatitude: String(NE_BBOX.maxLat),
    minlongitude: String(NE_BBOX.minLon),
    maxlongitude: String(NE_BBOX.maxLon),
    minmagnitude: '2.5',
    orderby: 'time',
  });
  return `${USGS_BASE}/fdsnws/event/1/query?${params.toString()}`;
}

export function magColor(mag) {
  if (mag == null || Number.isNaN(mag)) return '#9a9183';
  if (mag >= 6) return '#ff6b6b';
  if (mag >= 4.5) return '#f5a623';
  if (mag >= 3) return '#cf8511';
  return '#5a8f5e';
}

export function magRadius(mag) {
  if (mag == null || Number.isNaN(mag)) return 6;
  if (mag >= 6) return 18;
  if (mag >= 4.5) return 14;
  if (mag >= 3) return 10;
  return 7;
}

export function timeAgo(ms) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(ms) {
  return new Date(ms).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function normalizeFeature(feature) {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates || [];
  const lon = coords[0];
  const lat = coords[1];
  const depth = coords[2];

  return {
    id: feature.id || props.code || `${props.time}-${lat}-${lon}`,
    mag: props.mag ?? null,
    magType: props.magType || '—',
    place: props.place || 'Unknown location',
    time: props.time,
    updated: props.updated,
    depth: depth ?? null,
    lat,
    lon,
    url: props.url || null,
    tsunami: props.tsunami === 1,
    alert: props.alert || null,
    sig: props.sig ?? null,
    status: props.status || null,
    type: props.type || 'earthquake',
  };
}

export function normalizeGeoJson(data) {
  const features = Array.isArray(data?.features) ? data.features : [];
  return features
    .map(normalizeFeature)
    .filter((e) => e.lat != null && e.lon != null)
    .sort((a, b) => (b.time || 0) - (a.time || 0));
}

export async function fetchEarthquakes(scope = 'ne') {
  const params = new URLSearchParams({ scope });
  const res = await fetch(`/api/earthquakes?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const events = scope === 'ne' ? filterNeEvents(data.events || []) : data.events || [];
  return {
    events,
    fetchedAt: data.fetchedAt || Date.now(),
    source: data.source || 'USGS',
    backfilled: false,
  };
}
