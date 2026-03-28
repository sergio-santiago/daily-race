import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import {
  MeetProviderPort,
  ConferenceRecordData,
  MeetParticipantData,
  MeetTranscriptEntryData,
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

  async getTranscriptEntries(
    conferenceRecordName: string,
  ): Promise<MeetTranscriptEntryData[]> {
    try {
      const transcriptsRes = await this.meet.conferenceRecords.transcripts.list({
        parent: conferenceRecordName,
      });

      const transcripts = transcriptsRes.data.transcripts ?? [];
      if (transcripts.length === 0) return [];

      const allEntries: MeetTranscriptEntryData[] = [];

      for (const transcript of transcripts) {
        if (!transcript.name) continue;

        let pageToken: string | undefined;
        do {
          const entriesRes =
            await this.meet.conferenceRecords.transcripts.entries.list({
              parent: transcript.name,
              pageSize: 100,
              pageToken,
            });

          for (const entry of entriesRes.data.transcriptEntries ?? []) {
            if (!entry.text || !entry.startTime || !entry.endTime) continue;

            const speakerName = await this.resolveSpeaker(entry.participant);

            allEntries.push({
              speakerName,
              text: entry.text,
              startTime: new Date(entry.startTime),
              endTime: new Date(entry.endTime),
            });
          }

          pageToken = entriesRes.data.nextPageToken ?? undefined;
        } while (pageToken);
      }

      this.logger.log(
        `Fetched ${allEntries.length} transcript entries from ${conferenceRecordName}`,
      );
      return allEntries;
    } catch (error) {
      this.logger.warn(`Could not fetch transcripts: ${error}`);
      return [];
    }
  }

  private async resolveSpeaker(
    participantName: string | null | undefined,
  ): Promise<string> {
    if (!participantName) return 'Unknown';
    try {
      const res = await this.meet.conferenceRecords.participants.get({
        name: participantName,
      });
      return res.data.signedinUser?.displayName ?? 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private extractUserId(userResourceName: string | null | undefined): string {
    if (!userResourceName) return '';
    return userResourceName;
  }
}
