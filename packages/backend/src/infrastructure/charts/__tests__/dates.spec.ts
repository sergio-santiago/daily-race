import { formatClock, formatDayMonth, formatDayMonthName } from '../dates';

describe('formato de fechas', () => {
  // Las horas llegan en UTC y se muestran en la zona del equipo
  const summer = new Date('2026-08-26T07:00:00Z');
  const winter = new Date('2026-01-09T08:30:00Z');

  it('formatClock pasa a la zona horaria de la daily', () => {
    expect(formatClock(summer)).toBe('09:00');
    expect(formatClock(winter)).toBe('09:30');
  });

  it('formatDayMonth rellena con ceros para que el eje alinee', () => {
    // Intl con es-ES devolveria "9/1", que rompe la alineacion de las etiquetas
    expect(formatDayMonth(winter)).toBe('09/01');
    expect(formatDayMonth(summer)).toBe('26/08');
  });

  it('formatDayMonthName usa abreviaturas de tres letras', () => {
    expect(formatDayMonthName(summer)).toBe('26 ago');
    expect(formatDayMonthName(new Date('2026-09-03T07:00:00Z'))).toBe('3 sep');
  });

  it('resuelve la medianoche como 00 y no como 24', () => {
    expect(formatClock(new Date('2026-08-25T22:00:00Z'))).toBe('00:00');
  });
});
