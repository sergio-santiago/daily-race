import styles from './SidePanelLayout.module.css';
import { StatusPill } from '../ui/StatusPill';

export function IdleState() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.title}>Daily Race</div>
        <div className={styles.subtitle}>F1 dentro de tu daily</div>
      </header>
      <div className={styles.idle}>
        <div className={styles.idleIcon} aria-hidden="true">
          🏎️
        </div>
        <StatusPill variant="idle">Sin carrera activa</StatusPill>
        <div className={styles.idleTitle}>La parrilla esta en boxes</div>
        <p className={styles.idleBody}>
          Cuando empiece la daily, esta vista se actualizara en tiempo real
          con tu posicion, los puntos y el podio del dia.
        </p>
      </div>
    </div>
  );
}
