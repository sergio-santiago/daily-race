export const TRANSCRIPT_REPOSITORY = Symbol('TRANSCRIPT_REPOSITORY');

export interface TranscriptEntryData {
  speakerName: string;
  text: string;
  startTime: Date;
  endTime: Date;
}

export interface TranscriptRepositoryPort {
  saveAll(raceId: string, entries: TranscriptEntryData[]): Promise<void>;
}
