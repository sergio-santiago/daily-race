/**
 * Paleta unificada Daily Race · F1 oficial-inspired.
 * Coordinada con docs/ux-design-google.md.
 *
 * Los formatters de Discord, Google Chat y el frontend del Meet Add-on
 * leen estos tokens (cada uno en su forma: hex string, integer 0xRRGGBB,
 * o variable CSS).
 */

export const COLOR_HEX = {
  // Identidad por estado
  LIVE: '#E10600', // rojo Ferrari (era 0xe74c3c)
  RACE: '#0066CC', // azul pista (era 0x3498db)
  CHAMPIONSHIP: '#FFD700', // oro

  // Posiciones
  PODIUM_GOLD: '#FFD700',
  PODIUM_SILVER: '#C0C0C0',
  PODIUM_BRONZE: '#CD7F32',
  BUSTED: '#1C1C1E',
  FALSE_START: '#FF6B35',
  REZAGADO: '#FFB300',

  // Texto
  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: '#B8BAC9',
  TEXT_TERTIARY: '#6E708A',
  DIFF_LATE: '#FF6B35',
  DIFF_FALSE_START: '#FF3030',
  POINTS_POSITIVE: '#2ECC71',
  POINTS_NEGATIVE: '#E74C3C',

  // Surfaces (Meet add-on)
  BG_ASPHALT: '#15151E',
  SURFACE: '#1E1E2E',
  SURFACE_ELEVATED: '#2A2A3E',
  BORDER_SUBTLE: '#383850',
} as const;

/** Convierte un hex "#RRGGBB" a integer 0xRRGGBB usado por Discord embeds. */
export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Discord embed colors (mantener compatibles con el formatter actual). */
export const DISCORD_EMBED_COLOR = {
  RACE: 0x3498db, // se mantiene el azul Discord historico para no cambiar UX
  CHAMPIONSHIP: 0xffd700,
  LIVE: 0xe74c3c,
} as const;
