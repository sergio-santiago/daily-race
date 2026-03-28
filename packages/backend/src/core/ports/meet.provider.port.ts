export const MEET_PROVIDER = Symbol('MEET_PROVIDER');

export interface MeetParticipantData {
  googleParticipantId: string;
  displayName: string;
  email: string | null;
  earliestStartTime: Date;
}

export interface ConferenceRecordData {
  name: string;
  meetingCode: string;
  startTime: Date | null;
  endTime: Date | null;
}

export interface MeetProviderPort {
  getConferenceRecords(
    meetingCode: string,
    limit?: number,
  ): Promise<ConferenceRecordData[]>;
  getParticipants(
    conferenceRecordName: string,
  ): Promise<MeetParticipantData[]>;
}
