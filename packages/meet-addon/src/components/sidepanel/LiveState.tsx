import { useMemo } from 'react';
import type { LiveRaceSnapshotDto } from '@/lib/types';
import { GridRow } from '../grid/GridRow';
import { PodiumGrid } from '../grid/PodiumGrid';
import { StatusPill } from '../ui/StatusPill';
import styles from './SidePanelLayout.module.css';

interface Props {
  snapshot: LiveRaceSnapshotDto;
  currentUserEmail?: string;
}

export function LiveState({ snapshot, currentUserEmail }: Props) {
  const cleanGridSize = useMemo(
    () => snapshot.grid.filter((e) => !e.isFalseStart).length,
    [snapshot.grid],
  );

  const greenLightLabel = snapshot.greenLight
    ? new Date(snapshot.greenLight).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Madrid',
      })
    : '—';

  const sortedGrid = useMemo(() => {
    const clean = snapshot.grid
      .filter((e) => !e.isFalseStart)
      .sort((a, b) => a.position - b.position);
    const fs = snapshot.grid
      .filter((e) => e.isFalseStart)
      .sort((a, b) => b.position - a.position);
    return [...clean, ...fs];
  }, [snapshot.grid]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.title}>Daily Race</div>
        <div className={styles.subtitle}>
          <StatusPill variant="live">EN DIRECTO</StatusPill>{' '}
          <span style={{ marginLeft: 8 }}>Green light · {greenLightLabel}</span>
        </div>
      </header>

      <PodiumGrid grid={snapshot.grid} />

      <div className={styles.section}>
        <div className={styles.sectionHeader}>Parrilla</div>
        {sortedGrid.length === 0 && (
          <div className={styles.muted}>Sin pilotos en pista</div>
        )}
        {sortedGrid.map((entry) => (
          <GridRow
            key={entry.driver.id}
            entry={entry}
            cleanGridSize={cleanGridSize}
            highlight={
              !!currentUserEmail && entry.driver.email === currentUserEmail
            }
          />
        ))}
      </div>
    </div>
  );
}
