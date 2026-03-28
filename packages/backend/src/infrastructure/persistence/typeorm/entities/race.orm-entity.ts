import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { StartingGridEntryOrmEntity } from './starting-grid-entry.orm-entity';

@Entity('races')
export class RaceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  conferenceRecordName: string;

  @Column()
  meetingCode: string;

  @Column({ type: 'timestamptz' })
  @Index()
  greenLight: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({ default: 'PROCESSED' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => StartingGridEntryOrmEntity, (entry) => entry.race, {
    cascade: true,
  })
  startingGrid: StartingGridEntryOrmEntity[];
}
