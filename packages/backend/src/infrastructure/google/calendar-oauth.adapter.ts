import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import {
  CalendarProviderPort,
  CalendarEventData,
} from '../../core/ports/calendar.provider.port';
import { GoogleAuthService } from './google-auth.service';

@Injectable()
export class GoogleCalendarOAuthAdapter implements CalendarProviderPort {
  private readonly logger = new Logger(GoogleCalendarOAuthAdapter.name);
  private readonly calendarId: string;

  constructor(
    private readonly authService: GoogleAuthService,
    config: ConfigService,
  ) {
    this.calendarId = config.get('GOOGLE_CALENDAR_ID', 'primary');
  }

  private get calendar() {
    return google.calendar({
      version: 'v3',
      auth: this.authService.getOAuth2Client(),
    });
  }

  async getDailyEvent(
    meetingCode: string,
    date?: Date,
  ): Promise<CalendarEventData | null> {
    if (!this.authService.isAuthenticated()) {
      this.logger.warn('Not authenticated. Visit /auth/google to start OAuth flow.');
      return null;
    }

    const target = date ?? new Date();
    const startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    try {
      const res = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50,
      });

      const events = res.data.items ?? [];
      const match = events.find((e) => this.extractMeetingCode(e) === meetingCode);

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
