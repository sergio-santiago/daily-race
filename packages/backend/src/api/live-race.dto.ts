/**
 * DTOs serializables consumidos por el endpoint `/api/live-race/current`.
 * El paquete `meet-addon` duplica estos tipos en su client (V1 sin shared lib).
 */

export interface DriverDto {
  id: string;
  googleId: string;
  displayName: string;
  email: string | null;
}

export interface GridEntryDto {
  position: number;
  driver: DriverDto;
  startTime: string; // ISO 8601
  greenLight: string; // ISO 8601
  diffSeconds: number;
  points: number;
  isFalseStart: boolean;
  isWorstOnGrid: boolean;
}

export interface LiveRaceSnapshotDto {
  status: 'IDLE' | 'LIVE';
  fetchedAt: string; // ISO 8601
  meetingCode: string | null;
  greenLight: string | null; // ISO 8601 or null when IDLE
  participantCount: number;
  grid: GridEntryDto[];
  lastUpdatedAt: string | null; // ISO 8601 or null
}
