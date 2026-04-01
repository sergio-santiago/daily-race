import { Race } from '../entities/race.entity';
import { StartingGridEntry } from '../entities/starting-grid-entry.entity';
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

  createLiveRaceMessage(
    grid: StartingGridEntry[],
    greenLight: Date,
  ): Promise<string>;
  editLiveRaceMessage(
    messageId: string,
    grid: StartingGridEntry[],
    greenLight: Date,
  ): Promise<void>;
  editLiveRaceMessageAsFinal(
    messageId: string,
    race: Race,
  ): Promise<void>;
}
