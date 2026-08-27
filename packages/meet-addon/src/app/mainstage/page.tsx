'use client';

import { useEffect, useState } from 'react';
import { useLiveSnapshot } from '@/lib/use-live-snapshot';
import { useAddonSession } from '@/lib/meet-sdk';
import { MainStageBoard } from '@/components/mainstage/MainStageBoard';
import { StatusPill } from '@/components/ui/StatusPill';
import styles from '@/components/mainstage/MainStageLayout.module.css';

export default function MainStagePage() {
  const { snapshot, loading, error } = useLiveSnapshot();
  useAddonSession('main-stage');
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading && !snapshot) {
    return (
      <div className={styles.idle}>
        <div className={styles.idleTitle}>Conectando con la pista…</div>
      </div>
    );
  }

  if (!snapshot || snapshot.status === 'IDLE') {
    return (
      <div className={styles.idle}>
        <span aria-hidden="true" style={{ fontSize: 64 }}>
          🏁
        </span>
        <StatusPill variant="idle">Sin carrera activa</StatusPill>
        <div className={styles.idleTitle}>Daily Race</div>
        <div className={styles.idleSub}>
          La parrilla aparecera aqui en cuanto empiece la daily. Mientras tanto,
          que cada uno revise su set-up.
        </div>
        {error && (
          <div style={{ color: 'var(--color-diff-false-start)', fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  return <MainStageBoard snapshot={snapshot} now={now} />;
}
