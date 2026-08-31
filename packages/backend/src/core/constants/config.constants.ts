/** Zona horaria de referencia */
export const DEFAULT_TIMEZONE = 'Europe/Madrid';

/** Meeting code fijo de la daily de Secture */
export const DAILY_MEETING_CODE = 'wye-iwfu-jch';

/** Rango de fechas para consultas "all time" */
export const ALL_TIME_START = new Date(2020, 0, 1);
export const ALL_TIME_END = new Date(2099, 11, 31);

/**
 * Arranque de la temporada en curso. El campeonato solo cuenta las carreras a
 * partir de aqui, asi que mover esta fecha reinicia la clasificacion sin borrar
 * nada: las carreras anteriores siguen en la base y dejan de sumar.
 *
 * Se construye con el constructor local a proposito, igual que ALL_TIME_START:
 * el contenedor corre con TZ=Europe/Madrid, o sea que esto es la medianoche del
 * 1 de septiembre en la hora del equipo, que es lo que se acordo.
 */
export const SEASON_START = new Date(2026, 8, 1);
