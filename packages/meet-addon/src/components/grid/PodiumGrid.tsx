import { formatDiffShort, type GridEntryDto } from '@/lib/types';
import styles from './PodiumGrid.module.css';

interface Props {
  grid: GridEntryDto[];
}

/**
 * Podio top 3 con la cima del podio (P1) elevada en el centro.
 * Si hay menos de 3 pilotos limpios, renderiza solo los disponibles.
 */
export function PodiumGrid({ grid }: Props) {
  const cleanGrid = grid
    .filter((e) => !e.isFalseStart && e.position <= 3)
    .sort((a, b) => a.position - b.position);

  if (cleanGrid.length === 0) return null;

  const p1 = cleanGrid.find((e) => e.position === 1);
  const p2 = cleanGrid.find((e) => e.position === 2);
  const p3 = cleanGrid.find((e) => e.position === 3);

  return (
    <div className={styles.podium}>
      <div>
        {p2 && <Step entry={p2} medal="🥈" tier="silver" />}
      </div>
      <div>
        {p1 && <Step entry={p1} medal="🏆" tier="gold" />}
      </div>
      <div>
        {p3 && <Step entry={p3} medal="🥉" tier="bronze" />}
      </div>
    </div>
  );
}

function Step({
  entry,
  medal,
  tier,
}: {
  entry: GridEntryDto;
  medal: string;
  tier: 'gold' | 'silver' | 'bronze';
}) {
  return (
    <div className={`${styles.step} ${styles[tier]}`}>
      <span className={styles.medal} aria-hidden="true">
        {medal}
      </span>
      <span className={styles.name}>{entry.driver.displayName}</span>
      <span className={styles.points}>{entry.points} pts</span>
      <span className={styles.diff}>{formatDiffShort(entry.diffSeconds)}</span>
    </div>
  );
}
