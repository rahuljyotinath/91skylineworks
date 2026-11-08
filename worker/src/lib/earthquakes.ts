const NE_BBOX = { minLat: 22.0, maxLat: 29.8, minLon: 88.0, maxLon: 97.8 };

type QuakeEvent = {
  id: string;
  mag: number | null;
  magType: string;
  place: string;
  time: number | null;
  updated: number | null;
  depth: number | null;
  lat: number;
  lon: number;
  url: string | null;
  tsunami: boolean;
  alert: string | null;
  sig: number | null;
  status: string | null;
  type: string;
};

function isInNeBBox(event: QuakeEvent): boolean {
  return (
    event.lat >= NE_BBOX.minLat &&
    event.lat <= NE_BBOX.maxLat &&
    event.lon >= NE_BBOX.minLon &&
    event.lon <= NE_BBOX.maxLon
  );
}

function usgsUrl(scope: string): string {
  const base = 'https://earthquake.usgs.gov';
  if (scope === 'global') return `${base}/earthquakes/feed/v1.0/summary/all_day.geojson`;
  if (scope === 'significant') return `${base}/earthquakes/feed/v1.0/summary/significant_month.geojson`;
  const end = new Date().toISOString();
  const start = new Date(Date.now() - 90 * 864e5).toISOString();
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
  return `${base}/fdsnws/event/1/query?${params}`;
}

function normalizeFeature(feature: Record<string, unknown>): QuakeEvent | null {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const coords = ((feature.geometry as { coordinates?: number[] })?.coordinates ?? []) as number[];
  if (coords.length < 2) return null;
  const [lon, lat, depth] = coords;
  const time = props.time as number | undefined;
  return {
    id: String(feature.id ?? props.code ?? `${time}-${lat}-${lon}`),
    mag: (props.mag as number) ?? null,
    magType: String(props.magType ?? '—'),
    place: String(props.place ?? 'Unknown location'),
    time: time ?? null,
    updated: (props.updated as number) ?? null,
    depth: depth ?? null,
    lat,
    lon,
    url: (props.url as string) ?? null,
    tsunami: (props.tsunami ?? 0) === 1,
    alert: (props.alert as string) ?? null,
    sig: (props.sig as number) ?? null,
    status: (props.status as string) ?? null,
    type: String(props.type ?? 'earthquake'),
  };
}

const CACHE_TTL_MS = 300_000;

export async function fetchEarthquakes(scope: string, cache: Cache): Promise<Record<string, unknown>> {
  const cacheKey = new Request(`https://cache.91skylineworks.local/earthquakes-${scope}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = (await cached.json()) as Record<string, unknown>;
    const age = Date.now() - Number(data.fetchedAtMs ?? 0);
    if (age < CACHE_TTL_MS) return data;
  }

  const url = usgsUrl(scope);
  const res = await fetch(url, {
    headers: { 'User-Agent': '91SkylineWorks/1.0 (seismic-feed; contact@91skylineworks.com)' },
  });

  if (!res.ok) {
    if (cached) {
      const stale = (await cached.json()) as Record<string, unknown>;
      return { ...stale, stale: true };
    }
    throw new Error('USGS feed unavailable');
  }

  const data = (await res.json()) as { features?: Record<string, unknown>[] };
  let events: QuakeEvent[] = [];
  for (const feature of data.features ?? []) {
    const normalized = normalizeFeature(feature);
    if (normalized) events.push(normalized);
  }
  if (scope === 'ne') events = events.filter(isInNeBBox);
  events.sort((a, b) => (b.time ?? 0) - (a.time ?? 0));

  const payload = {
    events,
    fetchedAt: Date.now(),
    fetchedAtMs: Date.now(),
    source: 'USGS',
    scope,
    backfilled: false,
  };

  const response = new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${CACHE_TTL_MS / 1000}` },
  });
  await cache.put(cacheKey, response.clone());

  return payload;
}
