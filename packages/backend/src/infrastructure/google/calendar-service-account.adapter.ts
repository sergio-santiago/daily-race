import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { GoogleCalendarBaseAdapter } from './calendar-base.adapter';
import { CalendarEventData } from '../../core/ports/calendar.provider.port';

@Injectable()
export class GoogleCalendarServiceAccountAdapter extends GoogleCalendarBaseAdapter {
  private readonly calendarClients: calendar_v3.Calendar[];
  private readonly calId: string;
  private activeClientIndex = 0;

  constructor(config: ConfigService) {
    super();
    const emails = config
      .getOrThrow<string>('GOOGLE_IMPERSONATE_EMAILS')
      .split(',')
      .map((e) => e.trim());

    this.calendarClients = emails.map((email) => {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: config.getOrThrow('GOOGLE_CLIENT_EMAIL'),
          private_key: config
            .getOrThrow<string>('GOOGLE_PRIVATE_KEY')
            .replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        clientOptions: { subject: email },
      });
      return google.calendar({ version: 'v3', auth });
    });

    this.calId = config.get('GOOGLE_CALENDAR_ID', 'primary');
  }

  protected getCalendarClient(): calendar_v3.Calendar {
    return this.calendarClients[this.activeClientIndex];
  }

  protected getCalendarId(): string {
    return this.calId;
  }

  protected checkAuth(): boolean {
    return true;
  }

  override async getDailyEvent(
    meetingCode: string,
    date?: Date,
  ): Promise<CalendarEventData | null> {
    for (let i = 0; i < this.calendarClients.length; i++) {
      this.activeClientIndex = i;
      const result = await super.getDailyEvent(meetingCode, date);
      if (result) return result;
    }
    this.activeClientIndex = 0;
    return null;
  }
}
