import { Race } from '../entities/race.entity';

export const RACE_REPOSITORY = Symbol('RACE_REPOSITORY');

export interface RaceRepositoryPort {
  save(race: Race): Promise<Race>;
  findById(id: string): Promise<Race | null>;
  findByConferenceRecordName(name: string): Promise<Race | null>;
  findByDateRange(start: Date, end: Date): Promise<Race[]>;
  existsByConferenceRecordName(name: string): Promise<boolean>;
}
