import { Module } from '@nestjs/common';
import { MEET_PROVIDER } from '../../core/ports/meet.provider.port';
import { CALENDAR_PROVIDER } from '../../core/ports/calendar.provider.port';
import { AUTH_PROVIDER } from '../../core/ports/auth.provider.port';
import { GoogleAuthService } from './google-auth.service';
import { GoogleMeetOAuthAdapter } from './meet-oauth.adapter';
import { GoogleCalendarOAuthAdapter } from './calendar-oauth.adapter';
import { GoogleMeetServiceAccountAdapter } from './meet-service-account.adapter';
import { GoogleCalendarServiceAccountAdapter } from './calendar-service-account.adapter';
import { ServiceAccountAuthProvider } from './service-account-auth.provider';

const isServiceAccount =
  process.env.GOOGLE_AUTH_MODE === 'service-account';

@Module({
  providers: [
    // SA providers — always safe, no external credentials needed
    ServiceAccountAuthProvider,
    GoogleMeetServiceAccountAdapter,
    GoogleCalendarServiceAccountAdapter,

    // OAuth providers — only in oauth mode (require GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)
    ...(isServiceAccount
      ? []
      : [GoogleAuthService, GoogleMeetOAuthAdapter, GoogleCalendarOAuthAdapter]),

    {
      provide: MEET_PROVIDER,
      useExisting: isServiceAccount
        ? GoogleMeetServiceAccountAdapter
        : GoogleMeetOAuthAdapter,
    },
    {
      provide: CALENDAR_PROVIDER,
      useExisting: isServiceAccount
        ? GoogleCalendarServiceAccountAdapter
        : GoogleCalendarOAuthAdapter,
    },
    {
      provide: AUTH_PROVIDER,
      useExisting: isServiceAccount
        ? ServiceAccountAuthProvider
        : GoogleAuthService,
    },
  ],
  exports: [MEET_PROVIDER, CALENDAR_PROVIDER, AUTH_PROVIDER],
})
export class GoogleModule {}
