import { DEFAULT_TIMEZONE } from '../../core/constants';

/** Proporcion del fondo de parrilla considerada "rezagado" (ultimo X%). */
export const REZAGADO_RATIO = 0.1;

/** Caracter de elipsis usado al truncar nombres. */
export const ELLIPSIS = '…';

/** Emojis de podio para P1/P2/P3 (rank o posicion en parrilla limpia). */
export const PODIUM_EMOJI = {
  GOLD: '\u{1F3C6}',
  SILVER: '\u{1F948}',
  BRONZE: '\u{1F949}',
} as const;

/** Emojis de estado de parrilla. */
export const GRID_EMOJI = {
  /** Peor del dia (busted). */
  BUSTED: '\u{1F480}',
  /** False start no busted. */
  FALSE_START: '\u{26D4}',
  /** Rezagado (ultimo 10% de la parrilla limpia). */
  REZAGADO: '\u{1F422}',
  /** Marcador del semaforo verde en la parrilla. */
  GREEN_LIGHT: '\u{1F6A5}',
  /** Bandera a cuadros (race finalizada). */
  CHECKERED: '\u{1F3C1}',
  /** Trofeo (championship). */
  TROPHY: '\u{1F3C6}',
  /** Coche (contador de pilotos). */
  CAR: '\u{1F3CE}\u{FE0F}',
  /** Sirena (contador de false starts). */
  WARNING: '\u{1F6A8}',
  /** Circulo rojo (live). */
  LIVE: '\u{1F534}',
  /** Calendario (header de fecha). */
  CALENDAR: '\u{1F5D3}\u{FE0F}',
} as const;

/**
 * Formatea una fecha al formato largo en espanol.
 * Ej: "lunes, 28 de abril de 2026"
 */
export function formatRaceDate(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  });
}

/**
 * Formatea una hora a HH:mm:ss en zona horaria local.
 * Ej: "09:30:15"
 */
export function formatRaceTime(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone,
  });
}

/**
 * Formatea un delta de segundos como tiempo legible, sin padding.
 * - <60s: "+5.123" o "-15.500"
 * - >=60s: "+1:30.500" o "-2:00.000"
 */
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

/**
 * Trunca un nombre a `max` caracteres usando elipsis.
 * NO aplica padding (el caller decide si paddear para layouts monoespaciados).
 */
export function truncateName(name: string, max: number): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + ELLIPSIS;
}

/**
 * Devuelve el emoji de podio para un rank/posicion limpia, o null si no aplica.
 */
export function podiumEmoji(positionOrRank: number): string | null {
  if (positionOrRank === 1) return PODIUM_EMOJI.GOLD;
  if (positionOrRank === 2) return PODIUM_EMOJI.SILVER;
  if (positionOrRank === 3) return PODIUM_EMOJI.BRONZE;
  return null;
}

/**
 * Determina si una posicion (1-indexed) esta en el ultimo `REZAGADO_RATIO`%
 * de la parrilla limpia (sin contar false starts).
 */
export function isRezagado(position: number, cleanGridSize: number): boolean {
  if (cleanGridSize <= 0) return false;
  return position > cleanGridSize - Math.floor(cleanGridSize * REZAGADO_RATIO);
}

/**
 * Tipo agnostico que describe el "rol visual" de una entrada de parrilla.
 * Usable por cualquier formatter (Discord, Cards V2, Meet add-on).
 */
export type GridEntryVisualRole =
  | 'podium-gold'
  | 'podium-silver'
  | 'podium-bronze'
  | 'busted-clean'
  | 'busted-false-start'
  | 'false-start'
  | 'rezagado'
  | 'normal';

export interface VisualRoleInput {
  position: number;
  isFalseStart: boolean;
  isWorstOnGrid: boolean;
  cleanGridSize?: number;
}

/**
 * Calcula el rol visual de una entrada para que cada formatter
 * decida como pintarla (emoji, color, layout).
 */
export function gridEntryVisualRole(input: VisualRoleInput): GridEntryVisualRole {
  if (input.isFalseStart) {
    return input.isWorstOnGrid ? 'busted-false-start' : 'false-start';
  }
  if (input.position === 1) return 'podium-gold';
  if (input.position === 2) return 'podium-silver';
  if (input.position === 3) return 'podium-bronze';
  if (input.isWorstOnGrid) return 'busted-clean';
  if (
    input.cleanGridSize !== undefined &&
    isRezagado(input.position, input.cleanGridSize)
  ) {
    return 'rezagado';
  }
  return 'normal';
}
