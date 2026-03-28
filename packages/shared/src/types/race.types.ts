export enum RaceStatus {
  SCHEDULED = 'SCHEDULED',
  FINISHED = 'FINISHED',
  PROCESSED = 'PROCESSED',
}

export interface Race {
  id: string;
  conferenceRecordName: string;
  meetingCode: string;
  greenLight: Date;
  endTime: Date;
  status: RaceStatus;
  processedAt: Date | null;
  createdAt: Date;
}
