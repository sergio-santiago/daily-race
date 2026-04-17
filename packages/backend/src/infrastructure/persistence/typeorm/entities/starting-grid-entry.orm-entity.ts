import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { RaceOrmEntity } from './race.orm-entity';
import { DriverOrmEntity } from './driver.orm-entity';

@Entity('starting_grid_entries')
@Unique(['raceId', 'driverId'])
export class StartingGridEntryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  raceId: string;

  @ManyToOne(() => RaceOrmEntity, (race) => race.startingGrid)
  @JoinColumn({ name: 'race_id' })
  race: RaceOrmEntity;

  @Column()
  @Index()
  driverId: string;

  @ManyToOne(() => DriverOrmEntity)
  @JoinColumn({ name: 'driver_id' })
  driver: DriverOrmEntity;

  @Column({ type: 'smallint' })
  position: number;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  greenLight: Date;

  @Column({ type: 'integer' })
  points: number;

  @Column({ type: 'boolean', default: false })
  isFalseStart: boolean;

  @Column({ type: 'boolean', default: false })
  isWorstOnGrid: boolean;
}
