/**
 * DTOs duplicados desde el backend (`packages/backend/src/api/live-race.dto.ts`).
 * V1 sin paquete shared — duplicacion aceptable mientras el contrato sea pequeño.
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
  startTime: string;
  greenLight: string;
  diffSeconds: number;
  points: number;
  isFalseStart: boolean;
  isWorstOnGrid: boolean;
}

export interface LiveRaceSnapshotDto {
  status: 'IDLE' | 'LIVE';
  fetchedAt: string;
  meetingCode: string | null;
  greenLight: string | null;
  participantCount: number;
  grid: GridEntryDto[];
  lastUpdatedAt: string | null;
}

export type GridEntryRole =
  | 'podium-gold'
  | 'podium-silver'
  | 'podium-bronze'
  | 'busted-clean'
  | 'busted-false-start'
  | 'false-start'
  | 'rezagado'
  | 'normal';

export function classifyEntry(
  entry: GridEntryDto,
  cleanGridSize: number,
): GridEntryRole {
  if (entry.isFalseStart) {
    return entry.isWorstOnGrid ? 'busted-false-start' : 'false-start';
  }
  if (entry.position === 1) return 'podium-gold';
  if (entry.position === 2) return 'podium-silver';
  if (entry.position === 3) return 'podium-bronze';
  if (entry.isWorstOnGrid) return 'busted-clean';
  if (cleanGridSize > 0) {
    const threshold = cleanGridSize - Math.floor(cleanGridSize * 0.1);
    if (entry.position > threshold) return 'rezagado';
  }
  return 'normal';
}

export function formatDiffShort(diffSeconds: number): string {
  const abs = Math.abs(diffSeconds);
  const sign = diffSeconds < 0 ? '-' : '+';
  if (abs < 60) {
    return `${sign}${abs.toFixed(3)}`;
  }
  const min = Math.floor(abs / 60);
  const sec = abs % 60;
  return `${sign}${min}:${sec.toFixed(3).padStart(6, '0')}`;
}
