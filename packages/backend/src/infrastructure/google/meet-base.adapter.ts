import { Logger } from '@nestjs/common';
import { meet_v2 } from 'googleapis';
import {
  MeetProviderPort,
  ConferenceRecordData,
  MeetParticipantData,
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
}
