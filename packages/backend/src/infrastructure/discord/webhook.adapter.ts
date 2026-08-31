import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationPort } from '../../core/ports/notification.port';
import { Race } from '../../core/entities/race.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { SeasonSummary } from '../../core/entities/season-summary.entity';
import { DiscordFormatterService, DiscordEmbed } from './discord-formatter.service';
import { ChampionshipEvolutionChartService } from '../charts/championship-evolution-chart.service';
import { RaceGapChartService } from '../charts/race-gap-chart.service';

const EMBED_SEND_DELAY_MS = 500;
const CHAMPIONSHIP_CHART_FILENAME = 'championship-evolution.png';
const RACE_CHART_FILENAME = 'race-gaps.png';

// Un solo 429 al cerrar la carrera se llevaba por delante el mensaje del dia.
// 429 trae su propia espera en retry_after, el resto va con backoff exponencial.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;
const MIN_WAIT_MS = 50;
const MAX_WAIT_MS = 10_000;
// Discord senala el campo que falla en el cuerpo del 400, hay que registrarlo
const ERROR_BODY_MAX_CHARS = 500;

interface WebhookFile {
  name: string;
  data: Buffer;
}

@Injectable()
export class DiscordWebhookAdapter implements NotificationPort {
  private readonly logger = new Logger(DiscordWebhookAdapter.name);
  private readonly raceDayWebhook: string;
  private readonly championshipWebhook: string;

  constructor(
    config: ConfigService,
    private readonly formatter: DiscordFormatterService,
    private readonly championshipChart: ChampionshipEvolutionChartService,
    private readonly raceGapChart: RaceGapChartService,
  ) {
    this.raceDayWebhook = config.getOrThrow('DISCORD_WEBHOOK_RACE_DAY');
    this.championshipWebhook = config.getOrThrow('DISCORD_WEBHOOK_CHAMPIONSHIP');
  }

  async publishRaceResults(race: Race): Promise<void> {
    const embeds = this.formatter.formatRaceEmbeds(race);
    const chart = this.tryRenderRaceChart(race.startingGrid, race.greenLight);
    this.attachChartToLastEmbed(embeds, chart);

    for (let i = 0; i < embeds.length; i++) {
      const isLast = i === embeds.length - 1;
      await this.sendWebhook(
        { username: 'Daily Race', embeds: [embeds[i]] },
        this.raceDayWebhook,
        isLast ? chart : undefined,
      );
      if (!isLast) await this.sleep(EMBED_SEND_DELAY_MS);
    }
  }

  async publishChampionshipStandings(
    standings: ChampionshipStanding[],
    races: Race[],
  ): Promise<void> {
    const embeds = this.formatter.formatChampionshipEmbeds(
      standings,
      races.length,
    );
    if (embeds.length === 0) return;

    const chart = this.tryRenderChampionshipChart(standings, races);
    this.attachChartToLastEmbed(embeds, chart);

    for (let i = 0; i < embeds.length; i++) {
      const isLast = i === embeds.length - 1;
      await this.sendWebhook(
        { username: 'Daily Race', embeds: [embeds[i]] },
        this.championshipWebhook,
        isLast ? chart : undefined,
      );
      if (!isLast) await this.sleep(EMBED_SEND_DELAY_MS);
    }
  }

  /**
   * Va a los dos canales, no solo al del campeonato: hay gente que sigue
   * #race-day y no entra en #championship, y el relevo tiene que verlo todo el
   * mundo antes de encontrarse la tabla a cero.
   *
   * Lleva adjunta la grafica de la temporada que se cierra, que es el ano
   * completo dibujado y el mejor resumen posible de lo que ha pasado.
   */
  async publishSeasonChange(summary: SeasonSummary): Promise<void> {
    const embed = this.formatter.formatSeasonChangeEmbed(summary);
    const chart = this.tryRenderChampionshipChart(
      summary.standings,
      summary.races,
    );
    this.attachChartToLastEmbed([embed], chart);

    // Cada canal se intenta por separado a proposito. El relevo se publica una
    // sola vez al ano y el registro ya esta puesto cuando llegamos aqui, asi que
    // no hay reintento en bucle: si el primer canal se cayese arrastrando al
    // segundo, el mensaje se perderia justo para la audiencia por la que se
    // publica en los dos sitios, la de #race-day.
    let publicados = 0;
    for (const webhook of [this.championshipWebhook, this.raceDayWebhook]) {
      try {
        await this.sendWebhook(
          { username: 'Daily Race', embeds: [embed] },
          webhook,
          chart,
        );
        publicados++;
      } catch (error) {
        this.logger.error(`Relevo de temporada fallido en un canal: ${error}`);
      }
      await this.sleep(EMBED_SEND_DELAY_MS);
    }

    // Si no ha entrado en ninguno, que suba: quien llama lo registra y asi queda
    // constancia de que hay que republicarlo a mano
    if (publicados === 0) {
      throw new Error('Relevo de temporada: ningun canal acepto el mensaje');
    }
  }

  async createLiveRaceMessage(
    grid: StartingGridEntry[],
    greenLight: Date,
  ): Promise<string> {
    const embeds = this.formatter.formatLiveRaceEmbeds(grid, greenLight);
    const chart = this.tryRenderRaceChart(grid, greenLight, { live: true });
    this.attachChartToLastEmbed(embeds, chart);

    const body = { username: 'Daily Race', embeds };
    const response = await this.sendWebhookWithResponse(
      body,
      this.raceDayWebhook,
      chart,
    );
    return response.id as string;
  }

  async editLiveRaceMessage(
    messageId: string,
    grid: StartingGridEntry[],
    greenLight: Date,
  ): Promise<void> {
    const embeds = this.formatter.formatLiveRaceEmbeds(grid, greenLight);
    const chart = this.tryRenderRaceChart(grid, greenLight, { live: true });
    this.attachChartToLastEmbed(embeds, chart);
    await this.editWebhookMessage(
      messageId,
      { embeds },
      this.raceDayWebhook,
      chart,
    );
  }

  async editLiveRaceMessageAsFinal(
    messageId: string,
    race: Race,
  ): Promise<void> {
    const embeds = this.formatter.formatRaceEmbeds(race);
    const chart = this.tryRenderRaceChart(race.startingGrid, race.greenLight);
    this.attachChartToLastEmbed(embeds, chart);
    await this.editWebhookMessage(
      messageId,
      { embeds },
      this.raceDayWebhook,
      chart,
    );
  }

  // ── Charts ─────────────────────────────────────────────────

  private tryRenderChampionshipChart(
    standings: ChampionshipStanding[],
    races: Race[],
  ): WebhookFile | undefined {
    try {
      const png = this.championshipChart.renderPng(standings, races);
      return png ? { name: CHAMPIONSHIP_CHART_FILENAME, data: png } : undefined;
    } catch (error) {
      this.logger.warn(`Championship chart render failed: ${error}`);
      return undefined;
    }
  }

  private tryRenderRaceChart(
    grid: StartingGridEntry[],
    greenLight: Date,
    options: { live?: boolean } = {},
  ): WebhookFile | undefined {
    try {
      const png = this.raceGapChart.renderPng(grid, greenLight, options);
      return png ? { name: RACE_CHART_FILENAME, data: png } : undefined;
    } catch (error) {
      this.logger.warn(`Race gap chart render failed: ${error}`);
      return undefined;
    }
  }

  private attachChartToLastEmbed(
    embeds: DiscordEmbed[],
    chart: WebhookFile | undefined,
  ): void {
    if (!chart || embeds.length === 0) return;
    embeds[embeds.length - 1].image = { url: `attachment://${chart.name}` };
  }

  // ── HTTP ───────────────────────────────────────────────────

  /**
   * Unico punto de espera del adapter (retries y separacion entre embeds). Es
   * protected a proposito: los tests lo sustituyen para no tardar segundos.
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Con fichero adjunto Discord exige multipart/form-data: el JSON viaja en
   * payload_json y cada fichero en files[i]. El array attachments referencia
   * los ficheros nuevos y, en un PATCH, descarta los adjuntos anteriores.
   */
  private buildRequestInit(
    method: 'POST' | 'PATCH',
    payload: Record<string, unknown>,
    file?: WebhookFile,
  ): RequestInit {
    if (!file) {
      return {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      };
    }

    const form = new FormData();
    form.append(
      'payload_json',
      JSON.stringify({
        ...payload,
        attachments: [{ id: 0, filename: file.name }],
      }),
    );
    form.append(
      'files[0]',
      new Blob([new Uint8Array(file.data)], { type: 'image/png' }),
      file.name,
    );
    return { method, body: form };
  }

  /**
   * Reintenta 429 (respetando retry_after) y los 5xx transitorios. El init se
   * reconstruye en cada intento: un FormData ya enviado no se puede reutilizar.
   */
  private async request(
    url: string,
    buildInit: () => RequestInit,
    context: string,
  ): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, buildInit());
      if (response.ok) return response;

      const body = await this.readBody(response);
      const isRetryable = RETRYABLE_STATUSES.has(response.status);
      const hasAttemptsLeft = attempt < MAX_ATTEMPTS;

      this.logger.error(
        `${context} failed: ${response.status} ${response.statusText} ` +
          `(intento ${attempt}/${MAX_ATTEMPTS})` +
          (body ? ` body=${body}` : ''),
      );

      if (!isRetryable || !hasAttemptsLeft) {
        throw new Error(`${context} failed: ${response.status}`);
      }

      const waitMs = this.retryWaitMs(response, body, attempt);
      this.logger.warn(`${context}: reintento en ${waitMs} ms`);
      await this.sleep(waitMs);
    }
  }

  private retryWaitMs(
    response: Response,
    body: string,
    attempt: number,
  ): number {
    if (response.status === 429) {
      // Discord manda los segundos (decimales) en el cuerpo y en la cabecera
      const seconds =
        this.retryAfterFromBody(body) ?? this.retryAfterFromHeader(response);
      if (seconds !== undefined) {
        // Con retry_after 0 Discord aun no acepta la siguiente, no se reintenta
        // en el mismo instante
        const ms = Math.max(MIN_WAIT_MS, Math.ceil(seconds * 1000));
        return Math.min(ms, MAX_WAIT_MS);
      }
    }
    return Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_WAIT_MS);
  }

  private retryAfterFromBody(body: string): number | undefined {
    if (!body) return undefined;
    try {
      const parsed = JSON.parse(body) as { retry_after?: unknown };
      const value = Number(parsed.retry_after);
      return Number.isFinite(value) && value >= 0 ? value : undefined;
    } catch {
      return undefined;
    }
  }

  private retryAfterFromHeader(response: Response): number | undefined {
    try {
      const raw = response.headers?.get('retry-after');
      if (!raw) return undefined;
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : undefined;
    } catch {
      return undefined;
    }
  }

  /** El cuerpo de un error es la unica pista de que campo rechaza Discord */
  private async readBody(response: Response): Promise<string> {
    try {
      const text = await response.text();
      const flat = text.replace(/\s+/g, ' ').trim();
      return flat.length > ERROR_BODY_MAX_CHARS
        ? `${flat.slice(0, ERROR_BODY_MAX_CHARS)}...`
        : flat;
    } catch {
      return '';
    }
  }

  private async sendWebhook(
    body: Record<string, unknown>,
    webhookUrl: string,
    file?: WebhookFile,
  ): Promise<void> {
    await this.request(
      webhookUrl,
      () => this.buildRequestInit('POST', body, file),
      'Discord webhook',
    );
  }

  private async sendWebhookWithResponse(
    body: Record<string, unknown>,
    webhookUrl: string,
    file?: WebhookFile,
  ): Promise<Record<string, unknown>> {
    const response = await this.request(
      `${webhookUrl}?wait=true`,
      () => this.buildRequestInit('POST', body, file),
      'Discord webhook',
    );
    return response.json() as Promise<Record<string, unknown>>;
  }

  private async editWebhookMessage(
    messageId: string,
    body: Record<string, unknown>,
    webhookUrl: string,
    file?: WebhookFile,
  ): Promise<void> {
    // Sin fichero nuevo, attachments vacio elimina cualquier adjunto previo
    const payload = file ? body : { ...body, attachments: [] };
    await this.request(
      `${webhookUrl}/messages/${messageId}`,
      () => this.buildRequestInit('PATCH', payload, file),
      'Discord message edit',
    );
  }
}
