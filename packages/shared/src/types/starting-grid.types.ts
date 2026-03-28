export interface StartingGridEntry {
  id: string;
  raceId: string;
  driverId: string;
  startTime: Date;
  greenLight: Date;
  position: number;
  points: number;
  isFalseStart: boolean;
  isLastOnGrid: boolean;
}
