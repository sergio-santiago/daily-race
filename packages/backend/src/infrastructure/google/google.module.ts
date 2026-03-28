import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MEET_PROVIDER } from '../../core/ports/meet.provider.port';
import { CALENDAR_PROVIDER } from '../../core/ports/calendar.provider.port';
import { GoogleAuthService } from './google-auth.service';
import { GoogleMeetOAuthAdapter } from './meet-oauth.adapter';
import { GoogleCalendarOAuthAdapter } from './calendar-oauth.adapter';
import { GoogleMeetServiceAccountAdapter } from './meet-service-account.adapter';
import { GoogleCalendarServiceAccountAdapter } from './calendar-service-account.adapter';

@Module({
  providers: [
    GoogleAuthService,
    GoogleMeetOAuthAdapter,
    GoogleCalendarOAuthAdapter,
    GoogleMeetServiceAccountAdapter,
    GoogleCalendarServiceAccountAdapter,
    {
      provide: MEET_PROVIDER,
      useFactory: (
        config: ConfigService,
        oauth: GoogleMeetOAuthAdapter,
        sa: GoogleMeetServiceAccountAdapter,
      ) => (config.get('GOOGLE_AUTH_MODE') === 'service-account' ? sa : oauth),
      inject: [
        ConfigService,
        GoogleMeetOAuthAdapter,
        GoogleMeetServiceAccountAdapter,
      ],
    },
    {
      provide: CALENDAR_PROVIDER,
      useFactory: (
        config: ConfigService,
        oauth: GoogleCalendarOAuthAdapter,
        sa: GoogleCalendarServiceAccountAdapter,
      ) => (config.get('GOOGLE_AUTH_MODE') === 'service-account' ? sa : oauth),
      inject: [
        ConfigService,
        GoogleCalendarOAuthAdapter,
        GoogleCalendarServiceAccountAdapter,
      ],
    },
  ],
  exports: [MEET_PROVIDER, CALENDAR_PROVIDER, GoogleAuthService],
})
export class GoogleModule {}
