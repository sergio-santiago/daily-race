import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MonitorLiveRaceUseCase } from '../../application/monitor-live-race.use-case';

@Injectable()
export class RacePollScheduler {
  private readonly logger = new Logger(RacePollScheduler.name);

  constructor(private readonly monitorLiveRace: MonitorLiveRaceUseCase) {}

  /**
   * El cron dispara cada 5 segundos sin esperar a que termine el tick anterior,
   * asi que dos ticks pueden solaparse. El monitor no es reentrante: al cerrar la
   * carrera lee y escribe los flags de notificacion pendiente a traves de varios
   * await, de modo que dos ticks solapados los leen los dos a false y publican el
   * campeonato dos veces.
   *
   * Solaparse dejo de ser teorico cuando el adaptador de Discord empezo a
   * reintentar los 429 respetando el retry_after, porque eso puede dormir hasta
   * diez segundos dentro de la peticion: un solo 429 ya cruza el tick.
   *
   * Saltarse un tick no cuesta nada, el siguiente llega en 5 segundos y el estado
   * del monitor es el mismo.
   */
  private running = false;

  @Cron('*/5 * 8-11 * * 1-5', { timeZone: 'Europe/Madrid' })
  async pollForRace(): Promise<void> {
    if (this.running) {
      this.logger.debug('Previous poll still running, skipping this tick');
      return;
    }

    this.running = true;
    this.logger.debug('Polling for daily race...');
    try {
      await this.monitorLiveRace.execute();
    } catch (error) {
      this.logger.error(`Live race monitoring failed: ${error}`);
    } finally {
      this.running = false;
    }
  }
}
