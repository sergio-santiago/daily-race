'use client';

import { useEffect, useRef, useState } from 'react';

const CLOUD_PROJECT_NUMBER = process.env.NEXT_PUBLIC_MEET_CLOUD_PROJECT_NUMBER ?? '';

type SidePanelClient = unknown;
type MainStageClient = unknown;

interface AddonSession {
  createSidePanelClient(): Promise<SidePanelClient>;
  createMainStageClient(): Promise<MainStageClient>;
}

interface SDK {
  meet: {
    addon: {
      createAddonSession(args: { cloudProjectNumber: string }): Promise<AddonSession>;
    };
  };
}

/**
 * Carga perezosa del Meet Add-on SDK. Solo se importa en el navegador y solo
 * cuando hay un cloudProjectNumber configurado. En dev/local sin SDK, devuelve
 * `null` para que la UI funcione fuera de Meet (testeable directamente).
 */
async function loadSdk(): Promise<SDK | null> {
  if (typeof window === 'undefined') return null;
  if (!CLOUD_PROJECT_NUMBER) return null;
  try {
    const mod = await import('@googleworkspace/meet-addons/meet.addons');
    return mod as unknown as SDK;
  } catch {
    return null;
  }
}

export type MeetContext = 'side-panel' | 'main-stage' | 'standalone';

/** Hook para inicializar el SDK del add-on en el contexto correcto. */
export function useAddonSession(context: MeetContext): {
  session: AddonSession | null;
  ready: boolean;
  inMeet: boolean;
} {
  const [session, setSession] = useState<AddonSession | null>(null);
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (context === 'standalone') {
      setReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      const sdk = await loadSdk();
      if (cancelled) return;
      if (!sdk) {
        setReady(true);
        return;
      }
      try {
        const s = await sdk.meet.addon.createAddonSession({
          cloudProjectNumber: CLOUD_PROJECT_NUMBER,
        });
        if (cancelled) return;
        setSession(s);
        setReady(true);
      } catch {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [context]);

  return { session, ready, inMeet: session !== null };
}
