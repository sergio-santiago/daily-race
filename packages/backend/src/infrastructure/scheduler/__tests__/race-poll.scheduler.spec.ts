import { RacePollScheduler } from '../race-poll.scheduler';
import { MonitorLiveRaceUseCase } from '../../../application/monitor-live-race.use-case';

describe('RacePollScheduler', () => {
  const monitor = (execute: unknown): MonitorLiveRaceUseCase =>
    ({ execute }) as unknown as MonitorLiveRaceUseCase;

  it('llama al monitor en cada tick', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const scheduler = new RacePollScheduler(monitor(execute));

    await scheduler.pollForRace();
    await scheduler.pollForRace();

    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('se salta el tick si el anterior todavia no ha terminado', async () => {
    // El cron dispara cada 5 s sin esperar, y el adaptador de Discord puede
    // dormir hasta 10 s reintentando un 429: dos ticks solapados publicaban el
    // campeonato dos veces para una sola carrera
    let liberar: () => void = () => {};
    const enCurso = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const execute = jest.fn().mockReturnValue(enCurso);
    const scheduler = new RacePollScheduler(monitor(execute));

    const primero = scheduler.pollForRace();
    await scheduler.pollForRace();
    await scheduler.pollForRace();

    expect(execute).toHaveBeenCalledTimes(1);

    liberar();
    await primero;

    // Terminado el anterior, el siguiente tick vuelve a entrar
    await scheduler.pollForRace();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('libera el cerrojo cuando el monitor lanza', async () => {
    const execute = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue(undefined);
    const scheduler = new RacePollScheduler(monitor(execute));

    await scheduler.pollForRace();
    await scheduler.pollForRace();

    expect(execute).toHaveBeenCalledTimes(2);
  });
});
