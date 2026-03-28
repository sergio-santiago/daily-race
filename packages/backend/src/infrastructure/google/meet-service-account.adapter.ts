import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, meet_v2 } from 'googleapis';
import { GoogleMeetBaseAdapter } from './meet-base.adapter';

@Injectable()
export class GoogleMeetServiceAccountAdapter extends GoogleMeetBaseAdapter {
  private readonly meet: meet_v2.Meet;

  constructor(config: ConfigService) {
    super();
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.getOrThrow('GOOGLE_CLIENT_EMAIL'),
        private_key: config
          .getOrThrow<string>('GOOGLE_PRIVATE_KEY')
          .replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/meetings.space.readonly'],
    });
    this.meet = google.meet({ version: 'v2', auth });
  }

  protected getMeetClient(): meet_v2.Meet {
    return this.meet;
  }

  protected checkAuth(): boolean {
    return true;
  }
}
