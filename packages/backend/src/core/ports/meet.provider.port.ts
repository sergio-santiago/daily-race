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

export interface MeetTranscriptEntryData {
  speakerName: string;
  text: string;
  startTime: Date;
  endTime: Date;
}

export interface MeetConferenceProvider {
  getConferenceRecords(
    meetingCode: string,
    limit?: number,
  ): Promise<ConferenceRecordData[]>;
}

export interface MeetParticipantProvider {
  getParticipants(
    conferenceRecordName: string,
  ): Promise<MeetParticipantData[]>;
}

export interface MeetTranscriptProvider {
  getTranscriptEntries(
    conferenceRecordName: string,
  ): Promise<MeetTranscriptEntryData[]>;
}

export interface MeetProviderPort
  extends MeetConferenceProvider,
    MeetParticipantProvider,
    MeetTranscriptProvider {}
