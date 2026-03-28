import { Logger } from '@nestjs/common';
import { calendar_v3 } from 'googleapis';
import {
  CalendarProviderPort,
  CalendarEventData,
} from '../../core/ports/calendar.provider.port';

export abstract class GoogleCalendarBaseAdapter implements CalendarProviderPort {
  protected readonly logger = new Logger(this.constructor.name);

  protected abstract getCalendarClient(): calendar_v3.Calendar;
  protected abstract getCalendarId(): string;
  protected abstract checkAuth(): boolean;

  async getDailyEvent(
    meetingCode: string,
    date?: Date,
  ): Promise<CalendarEventData | null> {
    if (!this.checkAuth()) return null;

    const target = date ?? new Date();
    const startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    try {
      const res = await this.getCalendarClient().events.list({
        calendarId: this.getCalendarId(),
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50,
      });

      const events = res.data.items ?? [];
      const match = events.find(
        (e) => this.extractMeetingCode(e) === meetingCode,
      );

      if (!match) return null;
      return this.mapEvent(match);
    } catch (error) {
      this.logger.error(`Failed to fetch calendar events: ${error}`);
      return null;
    }
  }

  private mapEvent(event: calendar_v3.Schema$Event): CalendarEventData {
    return {
      eventId: event.id!,
      title: event.summary ?? '',
      scheduledStart: new Date(event.start?.dateTime ?? event.start?.date!),
      scheduledEnd: new Date(event.end?.dateTime ?? event.end?.date!),
      meetingCode: this.extractMeetingCode(event),
    };
  }

  private extractMeetingCode(event: calendar_v3.Schema$Event): string | null {
    const hangoutLink = event.hangoutLink;
    if (hangoutLink) {
      const match = hangoutLink.match(/meet\.google\.com\/(.+)$/);
      if (match) return match[1];
    }
    return event.conferenceData?.conferenceId ?? null;
  }
}
