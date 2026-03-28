export interface StartingGridEntry {
  id: string;
  raceId: string;
  driverId: string;
  startTime: Date;
  greenLightTime: Date;
  position: number;
  points: number;
  isFalseStart: boolean;
  isLastOnGrid: boolean;
}
