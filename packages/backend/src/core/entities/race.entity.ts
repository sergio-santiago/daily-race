import { StartingGridEntry } from './starting-grid-entry.entity';

export enum RaceStatus {
  SCHEDULED = 'SCHEDULED',
  FINISHED = 'FINISHED',
  PROCESSED = 'PROCESSED',
}

export class Race {
  constructor(
    public readonly id: string,
    public readonly conferenceRecordName: string,
    public readonly meetingCode: string,
    public readonly greenLight: Date,
    public readonly endTime: Date,
    public readonly status: RaceStatus,
    public readonly startingGrid: StartingGridEntry[],
    public readonly processedAt: Date | null,
  ) {}

  get isProcessed(): boolean {
    return this.status === RaceStatus.PROCESSED;
  }
}
