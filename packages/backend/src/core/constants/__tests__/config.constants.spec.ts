import {
  previousSeasonEnd,
  previousSeasonStart,
  seasonLabel,
  seasonStart,
} from '../config.constants';

/**
 * La regla anual es el reinicio automatico: cada 1 de septiembre devuelve una
 * fecha nueva y la clasificacion vuelve a cero sin que nadie toque el codigo.
 * Si estas fechas se mueven, el campeonato se reinicia el dia que no toca.
 */
describe('temporadas', () => {
  describe('seasonStart', () => {
    it('arranca el 1 de septiembre del mismo ano en otono', () => {
      expect(seasonStart(new Date(2026, 8, 1, 0, 0))).toEqual(
        new Date(2026, 8, 1),
      );
      expect(seasonStart(new Date(2026, 11, 24))).toEqual(new Date(2026, 8, 1));
    });

    it('sigue en la temporada del ano anterior antes de septiembre', () => {
      // Un 31 de agosto pertenece a la temporada que se abrio el septiembre
      // pasado, que es justo el dia en que esto se puso en marcha
      expect(seasonStart(new Date(2027, 7, 31, 23, 59))).toEqual(
        new Date(2026, 8, 1),
      );
      expect(seasonStart(new Date(2027, 0, 15))).toEqual(new Date(2026, 8, 1));
    });

    it('cambia de temporada al cruzar la medianoche del 1 de septiembre', () => {
      const ultimoInstante = new Date(2027, 7, 31, 23, 59, 59, 999);
      const primerInstante = new Date(2027, 8, 1, 0, 0, 0, 0);

      expect(seasonStart(ultimoInstante)).toEqual(new Date(2026, 8, 1));
      expect(seasonStart(primerInstante)).toEqual(new Date(2027, 8, 1));
    });
  });

  describe('temporada anterior', () => {
    it('va del septiembre anterior al instante justo antes del corte', () => {
      const now = new Date(2027, 8, 15);

      expect(previousSeasonStart(now)).toEqual(new Date(2026, 8, 1));
      expect(previousSeasonEnd(now)).toEqual(
        new Date(new Date(2027, 8, 1).getTime() - 1),
      );
    });

    it('no solapa con la temporada en curso', () => {
      // El Between del repositorio incluye los dos extremos, asi que el fin de
      // la anterior tiene que quedar estrictamente antes del arranque de la
      // nueva o una carrera contaria en las dos
      const now = new Date(2027, 8, 15);

      expect(previousSeasonEnd(now).getTime()).toBeLessThan(
        seasonStart(now).getTime(),
      );
    });
  });

  describe('seasonLabel', () => {
    it('nombra la temporada con los dos anos que abarca', () => {
      expect(seasonLabel(new Date(2026, 8, 1))).toBe('2026-2027');
      expect(seasonLabel(new Date(2027, 7, 31))).toBe('2026-2027');
      expect(seasonLabel(new Date(2027, 8, 1))).toBe('2027-2028');
    });
  });
});
