import { Race } from '../entities/race.entity';
import { ChampionshipStanding } from '../entities/championship-standing.entity';
import { TranscriptEntryData } from './transcript.repository.port';

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

export interface NotificationPort {
  publishRaceResults(race: Race): Promise<void>;
  publishChampionshipStandings(
    standings: ChampionshipStanding[],
    racesCount: number,
  ): Promise<void>;
  publishTranscript(
    race: Race,
    entries: TranscriptEntryData[],
  ): Promise<void>;
}
