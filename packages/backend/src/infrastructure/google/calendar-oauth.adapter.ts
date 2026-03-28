import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { GoogleCalendarBaseAdapter } from './calendar-base.adapter';
import { GoogleAuthService } from './google-auth.service';

@Injectable()
export class GoogleCalendarOAuthAdapter extends GoogleCalendarBaseAdapter {
  private readonly calendarId: string;

  constructor(
    private readonly authService: GoogleAuthService,
    config: ConfigService,
  ) {
    super();
    this.calendarId = config.get('GOOGLE_CALENDAR_ID', 'primary');
  }

  protected getCalendarClient(): calendar_v3.Calendar {
    return google.calendar({
      version: 'v3',
      auth: this.authService.getOAuth2Client(),
    });
  }

  protected getCalendarId(): string {
    return this.calendarId;
  }

  protected checkAuth(): boolean {
    if (!this.authService.isAuthenticated()) {
      this.logger.warn('Not authenticated. Visit /auth/google to start OAuth flow.');
      return false;
    }
    return true;
  }
}
