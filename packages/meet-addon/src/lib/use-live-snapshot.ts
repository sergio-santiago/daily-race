'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchLiveSnapshot } from './api-client';
import type { LiveRaceSnapshotDto } from './types';

const POLL_INTERVAL_MS = 2500;

/**
 * Polling al backend cada 2.5s. Devuelve el ultimo snapshot, errores y un
 * indicador de loading inicial.
 *
 * Tolera errores transitorios sin propagar (los muestra como `error` pero
 * mantiene el ultimo snapshot valido en `snapshot`).
 */
export function useLiveSnapshot(): {
  snapshot: LiveRaceSnapshotDto | null;
  loading: boolean;
  error: string | null;
} {
  const [snapshot, setSnapshot] = useState<LiveRaceSnapshotDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let abort: AbortController | null = null;

    const tick = async () => {
      abort?.abort();
      abort = new AbortController();
      try {
        const data = await fetchLiveSnapshot(abort.signal);
        if (!isMountedRef.current) return;
        setSnapshot(data);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMountedRef.current) setLoading(false);
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    void tick();

    return () => {
      isMountedRef.current = false;
      if (timer) clearTimeout(timer);
      abort?.abort();
    };
  }, []);

  return { snapshot, loading, error };
}
