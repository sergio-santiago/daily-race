import { useMemo } from 'react';
import { GridRow } from '../grid/GridRow';
import { PodiumGrid } from '../grid/PodiumGrid';
import { StatusPill } from '../ui/StatusPill';
import { formatDiffShort, type LiveRaceSnapshotDto } from '@/lib/types';
import styles from './MainStageLayout.module.css';

interface Props {
  snapshot: LiveRaceSnapshotDto;
  now: Date;
}

export function MainStageBoard({ snapshot, now }: Props) {
  const cleanGridSize = useMemo(
    () => snapshot.grid.filter((e) => !e.isFalseStart).length,
    [snapshot.grid],
  );

  const sortedGrid = useMemo(() => {
    const clean = snapshot.grid
      .filter((e) => !e.isFalseStart)
      .sort((a, b) => a.position - b.position);
    const fs = snapshot.grid
      .filter((e) => e.isFalseStart)
      .sort((a, b) => b.position - a.position);
    return [...clean, ...fs];
  }, [snapshot.grid]);

  const greenLight = snapshot.greenLight ? new Date(snapshot.greenLight) : null;
  const greenLightLabel = greenLight
    ? greenLight.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Madrid',
      })
    : '—';

  const dateLabel = greenLight
    ? greenLight.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Europe/Madrid',
      })
    : '';

  const nowLabel = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Madrid',
  });

  const busted = snapshot.grid.find((e) => e.isWorstOnGrid);
  const pole = snapshot.grid.find((e) => !e.isFalseStart && e.position === 1);
  const falseStarts = snapshot.grid.filter((e) => e.isFalseStart).length;

  return (
    <div className={styles.shell}>
      <div className={styles.left}>
        <header className={styles.banner}>
          <div>
            <div className={styles.title}>Daily Race</div>
            <div className={styles.dateline}>{dateLabel}</div>
          </div>
          <div>
            <StatusPill variant="live">EN DIRECTO</StatusPill>
            <div className={styles.clock}>{nowLabel}</div>
          </div>
        </header>

        <div>
          {sortedGrid.map((entry) => (
            <GridRow
              key={entry.driver.id}
              entry={entry}
              cleanGridSize={cleanGridSize}
            />
          ))}
        </div>
      </div>

      <div className={styles.right}>
        <PodiumGrid grid={snapshot.grid} />

        <div className={styles.statsCard}>
          <div className={styles.statsTitle}>Estadisticas</div>

          <div className={styles.statRow}>
            <span aria-hidden="true">🚥</span>
            <span className={styles.label}>Green light</span>
            <span className={styles.value}>{greenLightLabel}</span>
          </div>

          <div className={styles.statRow}>
            <span aria-hidden="true">🏎️</span>
            <span className={styles.label}>Pilotos</span>
            <span className={styles.value}>{snapshot.participantCount}</span>
          </div>

          <div className={styles.statRow}>
            <span aria-hidden="true">🚨</span>
            <span className={styles.label}>False starts</span>
            <span className={styles.value}>{falseStarts}</span>
          </div>

          {pole && (
            <div className={styles.statRow}>
              <span aria-hidden="true">⚡</span>
              <span className={styles.label}>Pole</span>
              <span className={styles.value}>
                {pole.driver.displayName} · {formatDiffShort(pole.diffSeconds)}
              </span>
            </div>
          )}

          {busted && (
            <div className={styles.statRow}>
              <span aria-hidden="true">💀</span>
              <span className={styles.label}>Busted</span>
              <span className={styles.value}>
                {busted.driver.displayName} · {formatDiffShort(busted.diffSeconds)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
