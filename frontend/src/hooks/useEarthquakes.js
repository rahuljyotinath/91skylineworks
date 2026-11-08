import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEarthquakes } from '../lib/earthquakes';

const POLL_MS = 5 * 60 * 1000;

export default function useEarthquakes(scope = 'ne', { enabled = true } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [source, setSource] = useState('USGS');
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchEarthquakes(scope);
      if (!mounted.current) return;
      setEvents(data.events);
      setFetchedAt(data.fetchedAt);
      setSource(data.source);
    } catch (err) {
      if (!mounted.current) return;
      setError(err.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [load, enabled]);

  return { events, loading, error, fetchedAt, source, refresh: load };
}
