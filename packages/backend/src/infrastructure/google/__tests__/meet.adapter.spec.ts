import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { meet_v2 } from 'googleapis';
import { GoogleMeetBaseAdapter } from '../meet-base.adapter';
import { GoogleMeetServiceAccountAdapter } from '../meet-service-account.adapter';
import { ConferenceRecordData } from '../../../core/ports/meet.provider.port';

/**
 * Lo que se prueba aqui es una sola cosa, y no es cosmetica: un fallo al consultar
 * los conference records NO puede parecerse a "esta reunion no existe". Cuando se
 * parecian, el monitor tiraba el estado de la carrera en curso y al tick siguiente
 * abria un segundo mensaje en directo del mismo dia, dejando el primero congelado.
 */

class TestAdapter extends GoogleMeetBaseAdapter {
  constructor(
    private readonly client: meet_v2.Meet,
    private readonly authed = true,
  ) {
    super();
  }
  protected getMeetClient(): meet_v2.Meet {
    return this.client;
  }
  protected checkAuth(): boolean {
    return this.authed;
  }
}

function clientThat(behaviour: () => unknown): meet_v2.Meet {
  return {
    conferenceRecords: { list: jest.fn(async () => behaviour()) },
  } as unknown as meet_v2.Meet;
}

describe('GoogleMeetBaseAdapter.getConferenceRecords', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it('propaga el fallo en vez de devolver una lista vacia', async () => {
    const adapter = new TestAdapter(
      clientThat(() => {
        throw new Error('429 Too Many Requests');
      }),
    );

    await expect(adapter.getConferenceRecords('wye-iwfu-jch')).rejects.toThrow(
      '429 Too Many Requests',
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it('devuelve vacio cuando la reunion de verdad no tiene registros', async () => {
    const adapter = new TestAdapter(
      clientThat(() => ({ data: { conferenceRecords: [] } })),
    );

    await expect(
      adapter.getConferenceRecords('wye-iwfu-jch'),
    ).resolves.toEqual([]);
  });

  it('devuelve vacio sin llamar a Meet cuando no hay autenticacion', async () => {
    const list = jest.fn();
    const adapter = new TestAdapter(
      { conferenceRecords: { list } } as unknown as meet_v2.Meet,
      false,
    );

    await expect(
      adapter.getConferenceRecords('wye-iwfu-jch'),
    ).resolves.toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it('mapea los registros que devuelve Meet', async () => {
    const adapter = new TestAdapter(
      clientThat(() => ({
        data: {
          conferenceRecords: [
            {
              name: 'conferenceRecords/abc',
              startTime: '2026-03-27T09:30:00.000Z',
              endTime: '2026-03-27T09:55:00.000Z',
            },
            { startTime: '2026-03-27T09:30:00.000Z' },
          ],
        },
      })),
    );

    const records = await adapter.getConferenceRecords('wye-iwfu-jch');

    // El segundo se descarta por no tener name
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual<ConferenceRecordData>({
      name: 'conferenceRecords/abc',
      meetingCode: 'wye-iwfu-jch',
      startTime: new Date('2026-03-27T09:30:00.000Z'),
      endTime: new Date('2026-03-27T09:55:00.000Z'),
    });
  });
});

describe('GoogleMeetServiceAccountAdapter.getConferenceRecords', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => warnSpy.mockRestore());

  // Se consultan todas las identidades suplantadas porque cada una ve las
  // reuniones a las que esta invitada, asi que un cliente caido no invalida lo que
  // traigan los demas. Lo que no vale es que fallen todos y contestar [], porque
  // eso afirma que no hay reunion
  function adapterWith(clients: unknown[]): GoogleMeetServiceAccountAdapter {
    const config = {
      getOrThrow: (key: string) =>
        key === 'GOOGLE_IMPERSONATE_EMAILS'
          ? 'a@secture.com,b@secture.com'
          : key === 'GOOGLE_PRIVATE_KEY'
            ? '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----'
            : 'sa@secture.iam.gserviceaccount.com',
    } as unknown as ConfigService;

    const adapter = new GoogleMeetServiceAccountAdapter(config);
    (adapter as unknown as { meetClients: unknown[] }).meetClients = clients;
    return adapter;
  }

  const ok = (name: string) =>
    clientThat(() => ({
      data: {
        conferenceRecords: [
          { name, startTime: '2026-03-27T09:30:00.000Z', endTime: null },
        ],
      },
    }));
  const boom = () =>
    clientThat(() => {
      throw new Error('503 Service Unavailable');
    });

  it('se cae cuando fallan todos los clientes', async () => {
    const adapter = adapterWith([boom(), boom()]);

    await expect(adapter.getConferenceRecords('wye-iwfu-jch')).rejects.toThrow(
      '503 Service Unavailable',
    );
  });

  it('devuelve lo que traiga el cliente que si contesta', async () => {
    const adapter = adapterWith([boom(), ok('conferenceRecords/abc')]);

    const records = await adapter.getConferenceRecords('wye-iwfu-jch');

    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('conferenceRecords/abc');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('no repite un registro que ven dos identidades', async () => {
    const adapter = adapterWith([
      ok('conferenceRecords/abc'),
      ok('conferenceRecords/abc'),
    ]);

    await expect(
      adapter.getConferenceRecords('wye-iwfu-jch'),
    ).resolves.toHaveLength(1);
  });

  it('devuelve vacio cuando todos contestan y no hay reunion', async () => {
    const empty = () => clientThat(() => ({ data: { conferenceRecords: [] } }));
    const adapter = adapterWith([empty(), empty()]);

    await expect(
      adapter.getConferenceRecords('wye-iwfu-jch'),
    ).resolves.toEqual([]);
  });
});
