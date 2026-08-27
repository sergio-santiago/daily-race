import { DEFAULT_TIMEZONE } from '../../core/constants';

// Las fechas se componen a mano en lugar de delegar el patron completo a
// toLocaleDateString: con es-ES, Intl ignora day/month '2-digit' y devuelve
// "1/9" en vez de "01/09", con lo que las etiquetas del eje dejaban de alinear.
// Aqui solo se usa Intl para extraer las partes en la zona horaria correcta.

const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function parts(date: Date): { day: number; month: number; hour: string; minute: string } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: DEFAULT_TIMEZONE,
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const found: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    found[part.type] = part.value;
  }
  return {
    day: Number(found.day),
    month: Number(found.month),
    hour: found.hour === '24' ? '00' : found.hour,
    minute: found.minute,
  };
}

/** 10:00 */
export function formatClock(date: Date): string {
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
}

/** 26/08 */
export function formatDayMonth(date: Date): string {
  const p = parts(date);
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}`;
}

/** 26 ago */
export function formatDayMonthName(date: Date): string {
  const p = parts(date);
  return `${p.day} ${MONTHS[p.month - 1]}`;
}
