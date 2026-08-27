// Sistema visual de las graficas: identidad Secture cruzada con el lenguaje
// de una retransmision de Formula 1.
//
// Secture aporta la superficie (#111111), la tinta crema (#EAE2D6), el gris
// #DADADA y el hexagono del isotipo. La F1 aporta los badges de posicion, la
// bandera de cuadros, los metales del podio y el rojo, que aqui es solo color
// de estado (salida en falso) y no el protagonista.
//
// Reparto tipografico, con motivo funcional: los numeros van en Titillium
// (la unica con cifras tabulares, ademas de ser la fuente historica de la F1) y
// los nombres en Inter, la de Secture. Los titulares usan Titillium en su peso
// Black, que es el que da el tono de retransmision deportiva.

export const T = {
  // ── Superficie ───────────────────────────────────────────
  bgTop: '#16161a',
  bgBottom: '#0c0c0e',
  panel: 'rgba(234,226,214,0.030)',
  panelAlt: 'rgba(234,226,214,0.014)',
  hairline: 'rgba(234,226,214,0.10)',
  hairlineSoft: 'rgba(234,226,214,0.055)',

  // ── Tinta ────────────────────────────────────────────────
  ink: '#ffffff',
  ink2: '#dadada',
  ink3: 'rgba(218,218,218,0.62)',
  ink4: 'rgba(218,218,218,0.34)',
  ink5: 'rgba(218,218,218,0.18)',

  // ── Acento Secture ───────────────────────────────────────
  cream: '#eae2d6',
  creamDim: 'rgba(234,226,214,0.42)',

  // ── Estado (F1) ──────────────────────────────────────────
  red: '#e10600',
  redSoft: '#ff5a52',
  redDeep: '#5c0a06',

  // ── Metales del podio ────────────────────────────────────
  // Oro, plata y bronce de verdad: la crema de Secture y la plata quedaban
  // demasiado cerca y no se distinguia al primero del segundo. La crema sigue
  // siendo el acento del resto de la pieza (titulos, cifras, lineas finas), y
  // aqui manda el metal.
  podium: [
    { light: '#ffeeae', mid: '#e9be4e', dark: '#a3761b', ink: '#2b1f04' },
    { light: '#eef0f3', mid: '#c3c7cc', dark: '#8b9096', ink: '#191b1d' },
    { light: '#e0a878', mid: '#bd7644', dark: '#8a5228', ink: '#1d1006' },
  ],

  // Serie de lineas del campeonato: oro para el lider, igual que su badge, y
  // despues tonos de saturacion media que se separan entre si y sobre el fondo
  series: [
    '#e9be4e',
    '#6ea8d8',
    '#7cbfa0',
    '#c79bd8',
    '#e0a35c',
    '#88c8c4',
    '#d98f9c',
    '#a9b48a',
  ],
  seriesDim: 'rgba(218,218,218,0.16)',

  font: {
    num: 'Titillium Web',
    name: 'Inter',
    display: 'Titillium Web',
  },
} as const;

export type Metal = (typeof T.podium)[number];

export function metalFor(position: number): Metal | null {
  return position >= 1 && position <= 3 ? T.podium[position - 1] : null;
}

export const METAL_ID = ['gold', 'silver', 'bronze'] as const;

export function metalId(position: number): string {
  return METAL_ID[position - 1];
}

export function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
