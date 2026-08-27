import styles from './StatusPill.module.css';

interface Props {
  variant: 'live' | 'final' | 'idle';
  children: React.ReactNode;
}

export function StatusPill({ variant, children }: Props) {
  return (
    <span className={`${styles.pill} ${styles[variant]}`}>
      {variant === 'live' && (
        <span className="live-pulse" aria-hidden="true"></span>
      )}
      {children}
    </span>
  );
}
