import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Marca de que una temporada ya fue anunciada. Solo guarda el hecho, no las
 * estadisticas: esas se calculan de las carreras, que no se borran nunca, y
 * duplicarlas aqui crearia dos versiones de la verdad que se pueden
 * desincronizar en cuanto se corrija una carrera.
 *
 * El unique de season_label es lo que hace idempotente el anuncio: el cron
 * dispara cada 5 segundos y dos ticks pueden solaparse, asi que la garantia
 * tiene que estar en la base y no en la memoria del proceso.
 */
@Entity('season_announcements')
@Unique(['seasonLabel'])
export class SeasonAnnouncementOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  seasonLabel: string;

  @CreateDateColumn({ type: 'timestamptz' })
  announcedAt: Date;
}
