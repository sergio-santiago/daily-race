import { Race } from '../entities/race.entity';
import { StartingGridEntry } from '../entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../entities/championship-standing.entity';
import { SeasonSummary } from '../entities/season-summary.entity';

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

export interface NotificationPort {
  publishRaceResults(race: Race): Promise<void>;
  publishChampionshipStandings(
    standings: ChampionshipStanding[],
    races: Race[],
  ): Promise<void>;
  /** Relevo de temporada, justo antes de la primera clasificacion de la nueva */
  publishSeasonChange(summary: SeasonSummary): Promise<void>;

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
