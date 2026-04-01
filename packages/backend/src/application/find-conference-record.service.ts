import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  MEET_PROVIDER,
  MeetProviderPort,
  ConferenceRecordData,
} from '../core/ports/meet.provider.port';
import { CalendarEventData } from '../core/ports/calendar.provider.port';

const CONFERENCE_RECORDS_LIMIT = 25;

@Injectable()
export class FindConferenceRecordService {
  private readonly logger = new Logger(FindConferenceRecordService.name);

  constructor(
    @Inject(MEET_PROVIDER)
    private readonly meetProvider: MeetProviderPort,
  ) {}

  async findForEvent(
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

  async findActiveForEvent(
    event: CalendarEventData,
  ): Promise<ConferenceRecordData | null> {
    const records = await this.meetProvider.getConferenceRecords(
      event.meetingCode!,
      CONFERENCE_RECORDS_LIMIT,
    );

    const targetDate = event.scheduledStart;
    const record = records.find(
      (r) =>
        !r.endTime &&
        r.startTime &&
        this.isSameDay(r.startTime, targetDate) &&
        Math.abs(r.startTime.getTime() - targetDate.getTime()) <
          30 * 60 * 1000,
    );

    if (!record) {
      this.logger.debug(
        `No active conference record for ${targetDate.toISOString().slice(0, 10)}`,
      );
    }

    return record ?? null;
  }

  async findByName(
    meetingCode: string,
    name: string,
  ): Promise<ConferenceRecordData | null> {
    const records = await this.meetProvider.getConferenceRecords(
      meetingCode,
      CONFERENCE_RECORDS_LIMIT,
    );
    return records.find((r) => r.name === name) ?? null;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    );
  }
}
