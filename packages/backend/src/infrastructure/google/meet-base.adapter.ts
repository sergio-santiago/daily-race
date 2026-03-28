import { Logger } from '@nestjs/common';
import { meet_v2 } from 'googleapis';
import {
  MeetProviderPort,
  ConferenceRecordData,
  MeetParticipantData,
  MeetTranscriptEntryData,
} from '../../core/ports/meet.provider.port';

export abstract class GoogleMeetBaseAdapter implements MeetProviderPort {
  protected readonly logger = new Logger(this.constructor.name);

  protected abstract getMeetClient(): meet_v2.Meet;
  protected abstract checkAuth(): boolean;

  async getConferenceRecords(
    meetingCode: string,
    limit = 1,
  ): Promise<ConferenceRecordData[]> {
    if (!this.checkAuth()) return [];

    try {
      const res = await this.getMeetClient().conferenceRecords.list({
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
    if (!this.checkAuth()) return [];

    const allParticipants: MeetParticipantData[] = [];
    let pageToken: string | undefined;

    do {
      const res =
        await this.getMeetClient().conferenceRecords.participants.list({
          parent: conferenceRecordName,
          pageSize: 100,
          pageToken,
        });

      const participants = res.data.participants ?? [];
      for (const p of participants) {
        if (!p.signedinUser?.displayName || !p.earliestStartTime) continue;

        allParticipants.push({
          googleParticipantId: p.signedinUser.user ?? '',
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
    if (!this.checkAuth()) return [];

    try {
      const meet = this.getMeetClient();
      const transcriptsRes =
        await meet.conferenceRecords.transcripts.list({
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
            await meet.conferenceRecords.transcripts.entries.list({
              parent: transcript.name,
              pageSize: 100,
              pageToken,
            });

          for (const entry of entriesRes.data.transcriptEntries ?? []) {
            if (!entry.text || !entry.startTime || !entry.endTime) continue;

            const speakerName = await this.resolveSpeaker(
              meet,
              entry.participant,
            );

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
    meet: meet_v2.Meet,
    participantName: string | null | undefined,
  ): Promise<string> {
    if (!participantName) return 'Unknown';
    try {
      const res = await meet.conferenceRecords.participants.get({
        name: participantName,
      });
      return res.data.signedinUser?.displayName ?? 'Unknown';
    } catch {
      return 'Unknown';
    }
  }
}
