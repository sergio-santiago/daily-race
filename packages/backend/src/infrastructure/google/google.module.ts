import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MEET_PROVIDER } from '../../core/ports/meet.provider.port';
import { CALENDAR_PROVIDER } from '../../core/ports/calendar.provider.port';
import { AUTH_PROVIDER } from '../../core/ports/auth.provider.port';
import { GoogleAuthService } from './google-auth.service';
import { GoogleMeetOAuthAdapter } from './meet-oauth.adapter';
import { GoogleCalendarOAuthAdapter } from './calendar-oauth.adapter';
import { GoogleMeetServiceAccountAdapter } from './meet-service-account.adapter';
import { GoogleCalendarServiceAccountAdapter } from './calendar-service-account.adapter';
import { ServiceAccountAuthProvider } from './service-account-auth.provider';

@Module({
  providers: [
    GoogleAuthService,
    GoogleMeetOAuthAdapter,
    GoogleCalendarOAuthAdapter,
    GoogleMeetServiceAccountAdapter,
    GoogleCalendarServiceAccountAdapter,
    ServiceAccountAuthProvider,
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
    {
      provide: AUTH_PROVIDER,
      useFactory: (
        config: ConfigService,
        oauth: GoogleAuthService,
        sa: ServiceAccountAuthProvider,
      ) => (config.get('GOOGLE_AUTH_MODE') === 'service-account' ? sa : oauth),
      inject: [ConfigService, GoogleAuthService, ServiceAccountAuthProvider],
    },
  ],
  exports: [MEET_PROVIDER, CALENDAR_PROVIDER, AUTH_PROVIDER, GoogleAuthService],
})
export class GoogleModule {}
