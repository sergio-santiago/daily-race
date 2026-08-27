'use client';

import { useLiveSnapshot } from '@/lib/use-live-snapshot';
import { useAddonSession } from '@/lib/meet-sdk';
import { IdleState } from '@/components/sidepanel/IdleState';
import { LiveState } from '@/components/sidepanel/LiveState';
import styles from '@/components/sidepanel/SidePanelLayout.module.css';

export default function SidePanelPage() {
  const { snapshot, loading, error } = useLiveSnapshot();
  // Inicializa el SDK del Meet Add-on en contexto side-panel.
  // Si no estamos en Meet (testeo standalone), `inMeet` es false y la UI
  // funciona igualmente — V1 no usa frame-to-frame ni startActivity todavia.
  useAddonSession('side-panel');

  if (loading && !snapshot) {
    return (
      <div className={styles.shell}>
        <div className={styles.muted}>Conectando con la pista…</div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className={styles.shell}>
        <div className={styles.errorBanner}>
          {error ?? 'No se pudo conectar con Daily Race'}
        </div>
      </div>
    );
  }

  if (snapshot.status === 'IDLE') {
    return <IdleState />;
  }

  return (
    <>
      {error && <div className={styles.errorBanner}>{error}</div>}
      <LiveState snapshot={snapshot} />
    </>
  );
}
