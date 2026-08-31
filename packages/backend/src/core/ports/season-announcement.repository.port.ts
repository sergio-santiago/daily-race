export const SEASON_ANNOUNCEMENT_REPOSITORY = Symbol(
  'SEASON_ANNOUNCEMENT_REPOSITORY',
);

export interface SeasonAnnouncementRepositoryPort {
  /**
   * Registra que una temporada queda anunciada y dice si el registro es nuevo.
   *
   * Devuelve false cuando ya estaba, y eso es lo que corta el duplicado: la
   * decision la toma el unique de la base en una sola operacion, sin leer antes
   * y escribir despues, que es la carrera que dos ticks solapados del cron
   * perderian.
   */
  claim(seasonLabel: string): Promise<boolean>;
}
