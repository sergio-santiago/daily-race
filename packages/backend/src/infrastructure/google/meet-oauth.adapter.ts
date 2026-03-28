import { Injectable } from '@nestjs/common';
import { google, meet_v2 } from 'googleapis';
import { GoogleMeetBaseAdapter } from './meet-base.adapter';
import { GoogleAuthService } from './google-auth.service';

@Injectable()
export class GoogleMeetOAuthAdapter extends GoogleMeetBaseAdapter {
  constructor(private readonly authService: GoogleAuthService) {
    super();
  }

  protected getMeetClient(): meet_v2.Meet {
    return google.meet({
      version: 'v2',
      auth: this.authService.getOAuth2Client(),
    });
  }

  protected checkAuth(): boolean {
    if (!this.authService.isAuthenticated()) {
      this.logger.warn('Not authenticated. Visit /auth/google to start OAuth flow.');
      return false;
    }
    return true;
  }
}
