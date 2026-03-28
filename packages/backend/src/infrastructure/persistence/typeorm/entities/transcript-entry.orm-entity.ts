import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { RaceOrmEntity } from './race.orm-entity';

@Entity('transcript_entries')
export class TranscriptEntryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  raceId: string;

  @ManyToOne(() => RaceOrmEntity, (race) => race.transcriptEntries)
  @JoinColumn({ name: 'race_id' })
  race: RaceOrmEntity;

  @Column()
  speakerName: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
