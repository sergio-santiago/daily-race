import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { GoogleCalendarBaseAdapter } from './calendar-base.adapter';

@Injectable()
export class GoogleCalendarServiceAccountAdapter extends GoogleCalendarBaseAdapter {
  private readonly calendar: calendar_v3.Calendar;
  private readonly calId: string;

  constructor(config: ConfigService) {
    super();
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.getOrThrow('GOOGLE_CLIENT_EMAIL'),
        private_key: config
          .getOrThrow<string>('GOOGLE_PRIVATE_KEY')
          .replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });
    this.calendar = google.calendar({ version: 'v3', auth });
    this.calId = config.get('GOOGLE_CALENDAR_ID', 'primary');
  }

  protected getCalendarClient(): calendar_v3.Calendar {
    return this.calendar;
  }

  protected getCalendarId(): string {
    return this.calId;
  }

  protected checkAuth(): boolean {
    return true;
  }
}
