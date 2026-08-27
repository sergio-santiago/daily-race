import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscordWebhookAdapter } from '../webhook.adapter';
import { DiscordFormatterService } from '../discord-formatter.service';
import { ChampionshipEvolutionChartService } from '../../charts/championship-evolution-chart.service';
import { RaceGapChartService } from '../../charts/race-gap-chart.service';
import { Race, RaceStatus } from '../../../core/entities/race.entity';
import { Driver } from '../../../core/entities/driver.entity';
import { StartingGridEntry } from '../../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../../core/entities/championship-standing.entity';

// El pegamento de la feature: aqui se decide si la grafica viaja como adjunto,
// si el mensaje sale igual cuando el render falla y si un 429 de Discord se
// lleva por delante el mensaje del dia.

const RACE_DAY = 'https://discord.test/webhooks/race';
const CHAMPIONSHIP = 'https://discord.test/webhooks/champ';
const GREEN_LIGHT = new Date('2026-08-26T07:00:00Z');

/** sleep es el unico punto de espera del adapter, y aqui no se espera nada */
class TestAdapter extends DiscordWebhookAdapter {
  readonly waits: number[] = [];

  protected sleep(ms: number): Promise<void> {
    this.waits.push(ms);
    return Promise.resolve();
  }
}

const entry = (
  position: number,
  name: string,
  diffSeconds: number,
  points = 1,
  worst = false,
): StartingGridEntry =>
  new StartingGridEntry(
    position,
    new Driver(`d${position}`, `g${position}`, name, null),
    new Date(GREEN_LIGHT.getTime() + diffSeconds * 1000),
    GREEN_LIGHT,
    points,
    false,
    worst,
  );

const race = (entries: StartingGridEntry[]): Race =>
  new Race(
    'race-1',
    'conferenceRecords/1',
    'abc-defg-hij',
    GREEN_LIGHT,
    new Date(GREEN_LIGHT.getTime() + 15 * 60 * 1000),
    RaceStatus.PROCESSED,
    entries,
    GREEN_LIGHT,
  );

const grid = [
  entry(1, 'Pilar Hidalgo', 0.036, 25),
  entry(2, 'Yaiza Moreno', 0.046, 18),
  entry(3, 'Luis Gimeno', 0.104, 15),
  entry(4, 'Zoe Reyes', 835.343, 1, true),
];

const standings = [
  new ChampionshipStanding(
    new Driver('d1', 'g1', 'Pilar Hidalgo', null),
    68, 3, 0, 1, 1, 2, 3,
  ),
  new ChampionshipStanding(
    new Driver('d2', 'g2', 'Yaiza Moreno', null),
    58, 3, 0, 2, 2, 1, 3,
  ),
];

const ok = (body: unknown = { id: '999' }): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const fail = (
  status: number,
  body = '',
  headers: Record<string, string> = {},
): Response => new Response(body, { status, headers });

describe('DiscordWebhookAdapter', () => {
  let fetchMock: jest.Mock;
  let raceChart: { renderPng: jest.Mock };
  let championshipChart: { renderPng: jest.Mock };
  let adapter: TestAdapter;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(ok());
    global.fetch = fetchMock as unknown as typeof fetch;
    raceChart = { renderPng: jest.fn().mockReturnValue(PNG) };
    championshipChart = { renderPng: jest.fn().mockReturnValue(PNG) };
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const config = {
      getOrThrow: (key: string) =>
        key === 'DISCORD_WEBHOOK_RACE_DAY' ? RACE_DAY : CHAMPIONSHIP,
    } as unknown as ConfigService;

    adapter = new TestAdapter(
      config,
      new DiscordFormatterService(),
      championshipChart as unknown as ChampionshipEvolutionChartService,
      raceChart as unknown as RaceGapChartService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Cuerpo enviado en la llamada n a fetch, ya interpretado */
  const sent = (call = 0): { payload: Record<string, unknown>; file: File | null } => {
    const init = fetchMock.mock.calls[call][1] as RequestInit;
    if (typeof init.body === 'string') {
      return { payload: JSON.parse(init.body) as Record<string, unknown>, file: null };
    }
    const form = init.body as FormData;
    return {
      payload: JSON.parse(form.get('payload_json') as string) as Record<string, unknown>,
      file: form.get('files[0]') as File,
    };
  };

  describe('grafica adjunta', () => {
    it('publica el mensaje igual cuando el render de la grafica lanza', async () => {
      raceChart.renderPng.mockImplementation(() => {
        throw new Error('resvg: no font loaded');
      });

      await adapter.publishRaceResults(race(grid));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const { payload, file } = sent();
      expect(file).toBeNull();
      expect(payload.attachments).toBeUndefined();
      const embeds = payload.embeds as { image?: unknown }[];
      expect(embeds[0].image).toBeUndefined();
      expect(embeds[0]).toHaveProperty('description');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Race gap chart render failed'),
      );
    });

    it('publica el mensaje igual cuando el grid no da para grafica', async () => {
      raceChart.renderPng.mockReturnValue(null);

      await adapter.publishRaceResults(race(grid));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const { payload, file } = sent();
      expect(file).toBeNull();
      expect((payload.embeds as { image?: unknown }[])[0].image).toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
    });

    it('manda la grafica como adjunto y la referencia en el ultimo embed', async () => {
      await adapter.publishRaceResults(race(grid));

      const { payload, file } = sent();
      const embeds = payload.embeds as { image?: { url: string } }[];
      expect(embeds[embeds.length - 1].image).toEqual({
        url: 'attachment://race-gaps.png',
      });
      expect(payload.attachments).toEqual([{ id: 0, filename: 'race-gaps.png' }]);
      expect(file).not.toBeNull();
      expect(file!.name).toBe('race-gaps.png');
      expect(file!.size).toBe(PNG.length);
      expect(file!.type).toBe('image/png');
    });

    it('adjunta la grafica del campeonato con su propio nombre de fichero', async () => {
      await adapter.publishChampionshipStandings(standings, [race(grid)]);

      const { payload, file } = sent();
      const embeds = payload.embeds as { image?: { url: string } }[];
      expect(embeds[embeds.length - 1].image).toEqual({
        url: 'attachment://championship-evolution.png',
      });
      expect(payload.attachments).toEqual([
        { id: 0, filename: 'championship-evolution.png' },
      ]);
      expect(file!.name).toBe('championship-evolution.png');
    });

    it('publica el campeonato igual cuando su grafica lanza', async () => {
      championshipChart.renderPng.mockImplementation(() => {
        throw new Error('resvg: no font loaded');
      });

      await adapter.publishChampionshipStandings(standings, [race(grid)]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const { payload, file } = sent();
      expect(file).toBeNull();
      expect((payload.embeds as { image?: unknown }[])[0].image).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Championship chart render failed'),
      );
    });

    it('no manda nada si no hay clasificacion que publicar', async () => {
      await adapter.publishChampionshipStandings([], []);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(championshipChart.renderPng).not.toHaveBeenCalled();
    });

    it('cuelga la imagen solo del ultimo embed cuando la tabla se trocea', async () => {
      const many = Array.from({ length: 260 }, (_, i) =>
        entry(i + 1, `Piloto Con Nombre Largo ${i}`, i + 0.5),
      );
      await adapter.publishRaceResults(race(many));

      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
      const last = fetchMock.mock.calls.length - 1;
      for (let call = 0; call < last; call++) {
        const { payload, file } = sent(call);
        expect(file).toBeNull();
        expect((payload.embeds as { image?: unknown }[])[0].image).toBeUndefined();
      }
      const { payload, file } = sent(last);
      expect(file!.name).toBe('race-gaps.png');
      expect((payload.embeds as { image?: { url: string } }[])[0].image).toEqual({
        url: 'attachment://race-gaps.png',
      });
    });
  });

  describe('mensaje en directo', () => {
    it('devuelve el id que contesta Discord al crear el mensaje', async () => {
      fetchMock.mockResolvedValue(ok({ id: '1234567890' }));

      const id = await adapter.createLiveRaceMessage(grid, GREEN_LIGHT);

      expect(id).toBe('1234567890');
      expect(fetchMock.mock.calls[0][0]).toBe(`${RACE_DAY}?wait=true`);
    });

    it('vacia attachments al editar sin fichero para no acumular imagenes', async () => {
      // Sin grafica el PATCH tiene que decirle a Discord que se quede sin
      // adjuntos: si no, la imagen de la edicion anterior se queda pegada
      raceChart.renderPng.mockReturnValue(null);

      await adapter.editLiveRaceMessage('42', grid, GREEN_LIGHT);

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('PATCH');
      expect(fetchMock.mock.calls[0][0]).toBe(`${RACE_DAY}/messages/42`);
      const { payload, file } = sent();
      expect(file).toBeNull();
      expect(payload.attachments).toEqual([]);
    });

    it('sustituye el adjunto anterior cuando la edicion si trae grafica', async () => {
      await adapter.editLiveRaceMessage('42', grid, GREEN_LIGHT);

      const { payload, file } = sent();
      expect(file!.name).toBe('race-gaps.png');
      // Con fichero, attachments referencia el nuevo, no la lista vacia
      expect(payload.attachments).toEqual([{ id: 0, filename: 'race-gaps.png' }]);
    });

    it('cierra el mensaje en directo con la grafica final', async () => {
      await adapter.editLiveRaceMessageAsFinal('42', race(grid));

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('PATCH');
      expect(raceChart.renderPng).toHaveBeenCalledWith(
        grid,
        GREEN_LIGHT,
        expect.not.objectContaining({ live: true }),
      );
      const { file } = sent();
      expect(file!.name).toBe('race-gaps.png');
    });

    it('marca la grafica como en directo mientras la carrera esta abierta', async () => {
      await adapter.editLiveRaceMessage('42', grid, GREEN_LIGHT);

      expect(raceChart.renderPng).toHaveBeenCalledWith(grid, GREEN_LIGHT, {
        live: true,
      });
    });
  });

  describe('reintentos', () => {
    it('reintenta un 429 respetando el retry_after del cuerpo', async () => {
      fetchMock
        .mockResolvedValueOnce(
          fail(429, JSON.stringify({ retry_after: 0.75, global: false })),
        )
        .mockResolvedValueOnce(ok());

      await adapter.publishRaceResults(race(grid));

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(adapter.waits).toEqual([750]);
    });

    it('lee el retry_after de la cabecera si el cuerpo no lo trae', async () => {
      fetchMock
        .mockResolvedValueOnce(fail(429, 'rate limited', { 'retry-after': '2' }))
        .mockResolvedValueOnce(ok());

      await adapter.publishRaceResults(race(grid));

      expect(adapter.waits).toEqual([2000]);
    });

    it('reintenta los 5xx transitorios con backoff exponencial', async () => {
      fetchMock
        .mockResolvedValueOnce(fail(502, 'bad gateway'))
        .mockResolvedValueOnce(fail(503, 'unavailable'))
        .mockResolvedValueOnce(ok());

      await adapter.publishRaceResults(race(grid));

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(adapter.waits).toEqual([500, 1000]);
    });

    it('no reintenta indefinidamente: se rinde al tercer intento', async () => {
      fetchMock.mockResolvedValue(fail(429, JSON.stringify({ retry_after: 0.1 })));

      await expect(adapter.publishRaceResults(race(grid))).rejects.toThrow(
        'Discord webhook failed: 429',
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(adapter.waits).toHaveLength(2);
    });

    it('no reintenta un 400: el cuerpo no va a cambiar', async () => {
      fetchMock.mockResolvedValue(
        fail(400, JSON.stringify({ errors: { embeds: 'demasiado largo' } })),
      );

      await expect(adapter.publishRaceResults(race(grid))).rejects.toThrow(
        'Discord webhook failed: 400',
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(adapter.waits).toHaveLength(0);
    });

    it('registra el cuerpo del error, que es donde Discord senala el campo', async () => {
      fetchMock.mockResolvedValue(
        fail(400, JSON.stringify({ errors: { embeds: 'demasiado largo' } })),
      );

      await expect(adapter.publishRaceResults(race(grid))).rejects.toThrow();
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('demasiado largo'),
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining('intento 1/3'));
    });

    it('reconstruye el multipart en cada intento', async () => {
      // Un FormData ya enviado no se puede reutilizar, asi que cada intento
      // tiene que traer su propio cuerpo con el fichero dentro
      fetchMock
        .mockResolvedValueOnce(fail(500, 'boom'))
        .mockResolvedValueOnce(ok());

      await adapter.publishRaceResults(race(grid));

      for (const call of [0, 1]) {
        const { file } = sent(call);
        expect(file!.size).toBe(PNG.length);
      }
      expect(sent(0).file).not.toBe(sent(1).file);
    });

    it('reintenta tambien la edicion del mensaje en directo', async () => {
      fetchMock
        .mockResolvedValueOnce(fail(429, JSON.stringify({ retry_after: 0.05 })))
        .mockResolvedValueOnce(ok());

      await adapter.editLiveRaceMessage('42', grid, GREEN_LIGHT);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      // El suelo de espera evita reintentar en el mismo instante
      expect(adapter.waits).toEqual([50]);
    });

    it('acota la espera del retry_after a diez segundos', async () => {
      fetchMock
        .mockResolvedValueOnce(fail(429, JSON.stringify({ retry_after: 600 })))
        .mockResolvedValueOnce(ok());

      await adapter.publishRaceResults(race(grid));

      expect(adapter.waits).toEqual([10_000]);
    });
  });
});
