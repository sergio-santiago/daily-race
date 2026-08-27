/**
 * Tokens de diseño F1 unificados con docs/ux-design-google.md.
 * Coordinados con los hex de `infrastructure/formatting/color-tokens.ts` del backend.
 */

export const COLOR = {
  LIVE: '#E10600',
  RACE: '#0066CC',
  CHAMPIONSHIP: '#FFD700',

  PODIUM_GOLD: '#FFD700',
  PODIUM_SILVER: '#C0C0C0',
  PODIUM_BRONZE: '#CD7F32',
  BUSTED: '#1C1C1E',
  FALSE_START: '#FF6B35',
  REZAGADO: '#FFB300',

  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: '#B8BAC9',
  TEXT_TERTIARY: '#6E708A',
  DIFF_LATE: '#FF6B35',
  DIFF_FALSE_START: '#FF3030',
  POINTS_POSITIVE: '#2ECC71',
  POINTS_NEGATIVE: '#E74C3C',

  BG_ASPHALT: '#15151E',
  SURFACE: '#1E1E2E',
  SURFACE_ELEVATED: '#2A2A3E',
  BORDER_SUBTLE: '#383850',
} as const;

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const FONT = {
  display: '"Titillium Web", "Inter", system-ui, sans-serif',
  ui: '"Inter", "Roboto", system-ui, sans-serif',
  mono: '"JetBrains Mono", "Roboto Mono", "SFMono-Regular", monospace',
} as const;

export function colorForRole(
  role:
    | 'podium-gold'
    | 'podium-silver'
    | 'podium-bronze'
    | 'busted-clean'
    | 'busted-false-start'
    | 'false-start'
    | 'rezagado'
    | 'normal',
): string {
  switch (role) {
    case 'podium-gold':
      return COLOR.PODIUM_GOLD;
    case 'podium-silver':
      return COLOR.PODIUM_SILVER;
    case 'podium-bronze':
      return COLOR.PODIUM_BRONZE;
    case 'busted-clean':
    case 'busted-false-start':
      return COLOR.BUSTED;
    case 'false-start':
      return COLOR.FALSE_START;
    case 'rezagado':
      return COLOR.REZAGADO;
    default:
      return COLOR.TEXT_PRIMARY;
  }
}

export function emojiForRole(
  role:
    | 'podium-gold'
    | 'podium-silver'
    | 'podium-bronze'
    | 'busted-clean'
    | 'busted-false-start'
    | 'false-start'
    | 'rezagado'
    | 'normal',
): string | null {
  switch (role) {
    case 'podium-gold':
      return '🏆';
    case 'podium-silver':
      return '🥈';
    case 'podium-bronze':
      return '🥉';
    case 'busted-clean':
    case 'busted-false-start':
      return '💀';
    case 'false-start':
      return '⛔';
    case 'rezagado':
      return '🐢';
    default:
      return null;
  }
}
