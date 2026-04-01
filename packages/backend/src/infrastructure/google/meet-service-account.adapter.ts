import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, meet_v2 } from 'googleapis';
import { GoogleMeetBaseAdapter } from './meet-base.adapter';
import { ConferenceRecordData } from '../../core/ports/meet.provider.port';

@Injectable()
export class GoogleMeetServiceAccountAdapter extends GoogleMeetBaseAdapter {
  private readonly meetClients: meet_v2.Meet[];

  constructor(config: ConfigService) {
    super();
    const emails = config
      .getOrThrow<string>('GOOGLE_IMPERSONATE_EMAILS')
      .split(',')
      .map((e) => e.trim());

    this.meetClients = emails.map((email) => {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: config.getOrThrow('GOOGLE_CLIENT_EMAIL'),
          private_key: config
            .getOrThrow<string>('GOOGLE_PRIVATE_KEY')
            .replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/meetings.space.readonly'],
        clientOptions: { subject: email },
      });
      return google.meet({ version: 'v2', auth });
    });
  }

  protected getMeetClient(): meet_v2.Meet {
    return this.meetClients[0];
  }

  protected checkAuth(): boolean {
    return true;
  }

  override async getConferenceRecords(
    meetingCode: string,
    limit = 1,
  ): Promise<ConferenceRecordData[]> {
    const seen = new Set<string>();
    const allRecords: ConferenceRecordData[] = [];

    for (const client of this.meetClients) {
      try {
        const res = await client.conferenceRecords.list({
          filter: `space.meeting_code="${meetingCode}"`,
          pageSize: limit,
        });

        for (const r of res.data.conferenceRecords ?? []) {
          if (r.name && !seen.has(r.name)) {
            seen.add(r.name);
            allRecords.push({
              name: r.name,
              meetingCode,
              startTime: r.startTime ? new Date(r.startTime) : null,
              endTime: r.endTime ? new Date(r.endTime) : null,
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch conference records: ${error}`);
      }
    }

    return allRecords;
  }
}
