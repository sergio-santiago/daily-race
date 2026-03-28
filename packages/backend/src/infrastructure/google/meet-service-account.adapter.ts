import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import {
  MeetProviderPort,
  ConferenceRecordData,
  MeetParticipantData,
} from '../../core/ports/meet.provider.port';

@Injectable()
export class GoogleMeetServiceAccountAdapter implements MeetProviderPort {
  private readonly logger = new Logger(GoogleMeetServiceAccountAdapter.name);
  private readonly meet;

  constructor(private readonly config: ConfigService) {
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

  async getConferenceRecords(
    meetingCode: string,
    limit = 1,
  ): Promise<ConferenceRecordData[]> {
    try {
      const res = await this.meet.conferenceRecords.list({
        filter: `space.meeting_code="${meetingCode}"`,
        pageSize: limit,
      });

      return (res.data.conferenceRecords ?? [])
        .filter((r) => r.name)
        .map((r) => ({
          name: r.name!,
          meetingCode,
          startTime: r.startTime ? new Date(r.startTime) : null,
          endTime: r.endTime ? new Date(r.endTime) : null,
        }));
    } catch (error) {
      this.logger.error(`Failed to fetch conference records: ${error}`);
      return [];
    }
  }

  async getParticipants(
    conferenceRecordName: string,
  ): Promise<MeetParticipantData[]> {
    const allParticipants: MeetParticipantData[] = [];
    let pageToken: string | undefined;

    do {
      const res = await this.meet.conferenceRecords.participants.list({
        parent: conferenceRecordName,
        pageSize: 100,
        pageToken,
      });

      const participants = res.data.participants ?? [];
      for (const p of participants) {
        if (!p.signedinUser?.displayName || !p.earliestStartTime) continue;

        allParticipants.push({
          googleParticipantId: this.extractUserId(p.signedinUser.user),
          displayName: p.signedinUser.displayName,
          email: null,
          earliestStartTime: new Date(p.earliestStartTime),
        });
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return allParticipants;
  }

  private extractUserId(userResourceName: string | null | undefined): string {
    if (!userResourceName) return '';
    return userResourceName;
  }
}
