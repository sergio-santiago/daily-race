import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  MEET_PROVIDER,
  MeetProviderPort,
  ConferenceRecordData,
} from '../core/ports/meet.provider.port';
import {
  CALENDAR_PROVIDER,
  CalendarProviderPort,
  CalendarEventData,
} from '../core/ports/calendar.provider.port';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../core/ports/race.repository.port';
import {
  DRIVER_REPOSITORY,
  DriverRepositoryPort,
} from '../core/ports/driver.repository.port';
import {
  STARTING_GRID_REPOSITORY,
  StartingGridRepositoryPort,
} from '../core/ports/starting-grid.repository.port';
import {
  NOTIFICATION_PORT,
  NotificationPort,
} from '../core/ports/notification.port';
import { Race, RaceStatus } from '../core/entities/race.entity';
import { StartingGridEntry } from '../core/entities/starting-grid-entry.entity';
import { BuildStartingGridUseCase } from './build-starting-grid.use-case';
import { GetChampionshipStandingsUseCase } from './get-championship-standings.use-case';
import { ConfigService } from '@nestjs/config';
import { DAILY_MEETING_CODE } from '@daily-race/shared';

const CONFERENCE_RECORDS_LIMIT = 25;
const ALL_TIME_START = new Date(2020, 0, 1);
const ALL_TIME_END = new Date(2099, 11, 31);

@Injectable()
export class ProcessRaceUseCase {
  private readonly logger = new Logger(ProcessRaceUseCase.name);
  private readonly meetingCode: string;

  constructor(
    @Inject(MEET_PROVIDER)
    private readonly meetProvider: MeetProviderPort,
    @Inject(CALENDAR_PROVIDER)
    private readonly calendarProvider: CalendarProviderPort,
    @Inject(RACE_REPOSITORY)
    private readonly raceRepository: RaceRepositoryPort,
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepositoryPort,
    @Inject(STARTING_GRID_REPOSITORY)
    private readonly startingGridRepository: StartingGridRepositoryPort,
    @Inject(NOTIFICATION_PORT)
    private readonly notification: NotificationPort,
    private readonly buildStartingGrid: BuildStartingGridUseCase,
    private readonly getChampionship: GetChampionshipStandingsUseCase,
    config: ConfigService,
  ) {
    this.meetingCode = config.get('DAILY_MEETING_CODE', DAILY_MEETING_CODE);
  }

  async execute(date?: Date): Promise<Race | null> {
    const calendarEvent = await this.calendarProvider.getDailyEvent(
      this.meetingCode,
      date,
    );
    if (!calendarEvent?.meetingCode) {
      this.logger.debug('No daily event found on calendar');
      return null;
    }

    const record = await this.findConferenceRecord(calendarEvent);
    if (!record) return null;

    const alreadyProcessed =
      await this.raceRepository.existsByConferenceRecordName(record.name);
    if (alreadyProcessed) {
      this.logger.debug('Race already processed');
      return null;
    }

    const participants = await this.meetProvider.getParticipants(record.name);
    if (participants.length === 0) {
      this.logger.warn('Conference record has no participants');
      return null;
    }

    const race = await this.buildAndSaveRace(calendarEvent, record, participants);

    await this.publishResults(race);

    this.logger.log(
      `Race processed: ${race.startingGrid.length} drivers, P1: ${race.startingGrid[0]?.driver.displayName}`,
    );

    return race;
  }

  private async findConferenceRecord(
    event: CalendarEventData,
  ): Promise<ConferenceRecordData | null> {
    const records = await this.meetProvider.getConferenceRecords(
      event.meetingCode!,
      CONFERENCE_RECORDS_LIMIT,
    );

    const targetDate = event.scheduledStart;
    const record = records.find(
      (r) =>
        r.endTime &&
        r.startTime &&
        this.isSameDay(r.startTime, targetDate) &&
        r.endTime > event.scheduledStart,
    );

    if (!record) {
      this.logger.debug(
        `No finished conference record for ${targetDate.toISOString().slice(0, 10)}`,
      );
    }

    return record ?? null;
  }

  private async buildAndSaveRace(
    event: CalendarEventData,
    record: ConferenceRecordData,
    participants: Awaited<ReturnType<MeetProviderPort['getParticipants']>>,
  ): Promise<Race> {
    const greenLight = event.scheduledStart;
    const grid = this.buildStartingGrid.execute({ participants, greenLight });

    const resolvedGrid = await this.resolveDrivers(grid);

    const savedRace = await this.raceRepository.save(
      new Race(
        '',
        record.name,
        event.meetingCode!,
        greenLight,
        record.endTime!,
        RaceStatus.PROCESSED,
        resolvedGrid,
        new Date(),
      ),
    );

    await this.startingGridRepository.saveAll(savedRace.id, resolvedGrid);

    return new Race(
      savedRace.id,
      savedRace.conferenceRecordName,
      savedRace.meetingCode,
      savedRace.greenLight,
      savedRace.endTime,
      savedRace.status,
      resolvedGrid,
      savedRace.processedAt,
    );
  }

  private async resolveDrivers(
    grid: StartingGridEntry[],
  ): Promise<StartingGridEntry[]> {
    return Promise.all(
      grid.map(async (entry) => {
        const savedDriver = await this.driverRepository.upsert(entry.driver);
        return new StartingGridEntry(
          entry.position,
          savedDriver,
          entry.startTime,
          entry.greenLight,
          entry.points,
          entry.isFalseStart,
          entry.isLastOnGrid,
        );
      }),
    );
  }

  private async publishResults(race: Race): Promise<void> {
    await this.notification.publishRaceResults(race);

    const standings = await this.getChampionship.execute();
    const allRaces = await this.raceRepository.findByDateRange(
      ALL_TIME_START,
      ALL_TIME_END,
    );
    await this.notification.publishChampionshipStandings(
      standings,
      allRaces.length,
    );
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    );
  }
}
