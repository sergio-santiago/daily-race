/** Zona horaria de referencia */
export const DEFAULT_TIMEZONE = 'Europe/Madrid';

/** Meeting code fijo de la daily de Secture */
export const DAILY_MEETING_CODE = 'wye-iwfu-jch';

/** Rango de fechas para consultas "all time" */
export const ALL_TIME_START = new Date(2020, 0, 1);
export const ALL_TIME_END = new Date(2099, 11, 31);

/**
 * Mes en el que arranca la temporada, con la cuenta de Date (0 = enero), o sea
 * septiembre. La temporada va del 1 de septiembre al 31 de agosto siguiente.
 */
export const SEASON_START_MONTH = 8;

/**
 * Arranque de la temporada a la que pertenece una fecha.
 *
 * El campeonato solo cuenta las carreras a partir de aqui, asi que esta funcion
 * es el reinicio: cada 1 de septiembre devuelve una fecha nueva y la
 * clasificacion vuelve a empezar sin que nadie toque nada. Las carreras de las
 * temporadas anteriores siguen en la base y dejan de sumar.
 *
 * Se construye con el constructor local a proposito, igual que ALL_TIME_START:
 * el contenedor corre con TZ=Europe/Madrid, o sea que el corte es la medianoche
 * del 1 de septiembre en la hora del equipo.
 */
export function seasonStart(now: Date = new Date()): Date {
  const year =
    now.getMonth() >= SEASON_START_MONTH
      ? now.getFullYear()
      : now.getFullYear() - 1;
  return new Date(year, SEASON_START_MONTH, 1);
}

/** Arranque de la temporada anterior a la de `now` */
export function previousSeasonStart(now: Date = new Date()): Date {
  const current = seasonStart(now);
  return new Date(current.getFullYear() - 1, SEASON_START_MONTH, 1);
}

/**
 * Ultimo instante de la temporada anterior a la de `now`, un milisegundo antes
 * del corte. Se resta ese milisegundo porque el Between del repositorio incluye
 * los dos extremos: sin esto, una carrera que cayese exactamente en el corte
 * contaria en las dos temporadas.
 */
export function previousSeasonEnd(now: Date = new Date()): Date {
  return new Date(seasonStart(now).getTime() - 1);
}

/**
 * Etiqueta de la temporada a la que pertenece una fecha, "2026-2027". Va en el
 * mensaje de cambio de temporada, que es lo unico que la nombra en voz alta.
 */
export function seasonLabel(now: Date = new Date()): string {
  const start = seasonStart(now).getFullYear();
  return `${start}-${start + 1}`;
}
