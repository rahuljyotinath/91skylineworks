/**
 * Fetches Northeast India earthquake events from USGS for SEO pre-render.
 */

const USGS_BASE = 'https://earthquake.usgs.gov';
const NE_DAYS = 90;
const NE_BBOX = {
  minLat: 22.0,
  maxLat: 29.8,
  minLon: 88.0,
  maxLon: 97.8,
};

export function buildUsgsNeUrl() {
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

function isInNeBbox(event) {
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

function normalizeFeature(feature) {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates || [];
  const lon = coords[0];
  const lat = coords[1];
  if (lat == null || lon == null) return null;

  return {
    id: feature.id || props.code || `${props.time}-${lat}-${lon}`,
    mag: props.mag ?? null,
    magType: props.magType || '—',
    place: props.place || 'Unknown location',
    time: props.time,
    depth: coords[2] ?? null,
    lat,
    lon,
    url: props.url || null,
  };
}

async function fetchUsgsEvents(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': '91SkylineWorks/1.0 (seo-prerender; contact@91skylineworks.com)',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`USGS HTTP ${res.status}`);
  }

  const data = await res.json();
  return (data.features || [])
    .map(normalizeFeature)
    .filter(Boolean)
    .sort((a, b) => (b.time || 0) - (a.time || 0));
}

export function formatEventTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
    timeZoneName: 'short',
  });
}

export async function fetchNeEarthquakes({ limit = 20 } = {}) {
  const events = (await fetchUsgsEvents(buildUsgsNeUrl())).filter(isInNeBbox);

  return {
    events: events.slice(0, limit),
    fetchedAt: Date.now(),
    source: 'USGS',
    backfilled: false,
  };
}
