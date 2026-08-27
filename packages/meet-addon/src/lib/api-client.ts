import type { LiveRaceSnapshotDto } from './types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

if (!BACKEND_URL) {
  // En SSR (build), permite que el bundle se construya sin la variable.
  // En runtime se chequea explicitamente al hacer fetch.
}

/**
 * Lee el snapshot actual del live race desde el backend de Daily Race.
 * Sin auth (V1). En V2, anyadir Bearer con el token de Google Identity Services.
 */
export async function fetchLiveSnapshot(
  signal?: AbortSignal,
): Promise<LiveRaceSnapshotDto> {
  if (!BACKEND_URL) {
    throw new Error('NEXT_PUBLIC_BACKEND_URL no configurada');
  }
  const res = await fetch(`${BACKEND_URL}/api/live-race/current`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });
  if (!res.ok) {
    throw new Error(`Daily Race API responded ${res.status}`);
  }
  return (await res.json()) as LiveRaceSnapshotDto;
}
