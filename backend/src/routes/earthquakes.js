import { Router } from "express";

const router = Router();

const NE_BBOX = {
  minLat: 22.0,
  maxLat: 29.8,
  minLon: 88.0,
  maxLon: 97.8,
};

const NE_DAYS = 90;

const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

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

function buildUsgsUrl(scope) {
  const base = "https://earthquake.usgs.gov";
  if (scope === "global") {
    return `${base}/earthquakes/feed/v1.0/summary/all_day.geojson`;
  }
  if (scope === "significant") {
    return `${base}/earthquakes/feed/v1.0/summary/significant_month.geojson`;
  }

  const end = new Date().toISOString();
  const start = new Date(Date.now() - NE_DAYS * 24 * 3600 * 1000).toISOString();
  const params = new URLSearchParams({
    format: "geojson",
    starttime: start,
    endtime: end,
    minlatitude: String(NE_BBOX.minLat),
    maxlatitude: String(NE_BBOX.maxLat),
    minlongitude: String(NE_BBOX.minLon),
    maxlongitude: String(NE_BBOX.maxLon),
    minmagnitude: "2.5",
    orderby: "time",
  });
  return `${base}/fdsnws/event/1/query?${params.toString()}`;
}

function normalizeFeature(feature) {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates || [];
  if (coords.length < 2) return null;

  const [lon, lat, depth] = coords;
  return {
    id: feature.id || props.code || `${props.time}-${lat}-${lon}`,
    mag: props.mag ?? null,
    magType: props.magType || "—",
    place: props.place || "Unknown location",
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
    type: props.type || "earthquake",
  };
}

async function fetchScopeEvents(scope) {
  const cached = cache.get(scope);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached;
  }

  const url = buildUsgsUrl(scope);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "91SkylineWorks/1.0 (seismic-feed; contact@91skylineworks.com)",
    },
  });

  if (!response.ok) {
    if (cached) return { ...cached, stale: true };
    throw new Error("USGS feed unavailable");
  }

  const data = await response.json();
  let events = (data.features || [])
    .map(normalizeFeature)
    .filter(Boolean)
    .sort((a, b) => (b.time || 0) - (a.time || 0));

  if (scope === "ne") {
    events = events.filter(isInNeBbox);
  }

  const payload = {
    events,
    fetchedAt: Date.now(),
    source: "USGS",
    scope,
    backfilled: false,
  };

  cache.set(scope, payload);
  return payload;
}

router.get("/", async (req, res) => {
  const scope = req.query.scope || "ne";
  const allowed = ["ne", "global", "significant"];
  if (!allowed.includes(scope)) {
    return res.status(400).json({ error: "Invalid scope" });
  }

  try {
    const payload = await fetchScopeEvents(scope);
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
