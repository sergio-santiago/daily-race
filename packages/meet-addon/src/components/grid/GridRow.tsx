import { classifyEntry, formatDiffShort, type GridEntryDto } from '@/lib/types';
import { emojiForRole } from '@/lib/theme';
import styles from './GridRow.module.css';

interface Props {
  entry: GridEntryDto;
  cleanGridSize: number;
  highlight?: boolean;
}

export function GridRow({ entry, cleanGridSize, highlight }: Props) {
  const role = classifyEntry(entry, cleanGridSize);
  const positionClass =
    role === 'podium-gold'
      ? styles.gold
      : role === 'podium-silver'
        ? styles.silver
        : role === 'podium-bronze'
          ? styles.bronze
          : role === 'busted-clean' || role === 'busted-false-start'
            ? styles.busted
            : role === 'false-start'
              ? styles.falseStart
              : '';

  const emoji = emojiForRole(role);
  const positionLabel = emoji ?? entry.position;

  const pointsClass =
    entry.points > 0 ? styles.positive : entry.points < 0 ? styles.negative : '';

  const diffClass = entry.isFalseStart
    ? styles.falseStart
    : role === 'busted-clean' || role === 'rezagado'
      ? styles.late
      : '';

  return (
    <div className={`${styles.row} ${highlight ? styles.highlight : ''}`}>
      <div className={`${styles.position} ${positionClass}`}>
        <span aria-label={`Posicion ${entry.position}`}>{positionLabel}</span>
      </div>
      <div className={styles.driver}>
        <div className={styles.name}>{entry.driver.displayName}</div>
        {entry.isFalseStart && <div className={styles.label}>False start</div>}
        {!entry.isFalseStart && entry.isWorstOnGrid && (
          <div className={styles.label}>Busted</div>
        )}
      </div>
      <div className={`${styles.points} ${pointsClass}`}>
        {entry.points > 0 ? '+' : ''}
        {entry.points}
      </div>
      <div className={`${styles.diff} ${diffClass}`}>
        {formatDiffShort(entry.diffSeconds)}
      </div>
    </div>
  );
}
