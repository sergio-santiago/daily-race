import { DynamicModule, Logger, Module } from '@nestjs/common';
import { NOTIFICATION_PORT } from '../../core/ports/notification.port';
import { DiscordModule } from '../discord/discord.module';
import { DiscordWebhookAdapter } from '../discord/webhook.adapter';
import { GoogleChatModule } from '../google-chat/google-chat.module';
import { ChatAppAdapter } from '../google-chat/chat-app.adapter';
import { MulticastNotificationAdapter } from './multicast.adapter';

export type NotificationProvider = 'discord' | 'google-chat' | 'dual';

/**
 * Modulo de notificaciones unificado.
 *
 * Selecciona el proveedor segun la env var `NOTIFICATION_PROVIDER`:
 * - `discord` (default): solo Discord webhooks. Estado actual.
 * - `google-chat`: solo Google Chat App. Estado objetivo.
 * - `dual`: ambos a la vez (transicion). Tolerante a fallos.
 *
 * El binding al token `NOTIFICATION_PORT` se hace aqui, por lo que los
 * use-cases siguen inyectando el mismo simbolo sin enterarse de la implementacion.
 */
@Module({})
export class NotificationModule {
  static forRoot(): DynamicModule {
    const provider = (process.env.NOTIFICATION_PROVIDER ?? 'discord') as NotificationProvider;
    Logger.log(`NotificationProvider = ${provider}`, 'NotificationModule');

    switch (provider) {
      case 'discord':
        return {
          module: NotificationModule,
          imports: [DiscordModule],
          providers: [
            { provide: NOTIFICATION_PORT, useExisting: DiscordWebhookAdapter },
          ],
          exports: [NOTIFICATION_PORT],
        };

      case 'google-chat':
        return {
          module: NotificationModule,
          imports: [GoogleChatModule],
          providers: [
            { provide: NOTIFICATION_PORT, useExisting: ChatAppAdapter },
          ],
          exports: [NOTIFICATION_PORT],
        };

      case 'dual':
        return {
          module: NotificationModule,
          imports: [DiscordModule, GoogleChatModule],
          providers: [
            MulticastNotificationAdapter,
            {
              provide: NOTIFICATION_PORT,
              useExisting: MulticastNotificationAdapter,
            },
          ],
          exports: [NOTIFICATION_PORT],
        };

      default:
        throw new Error(
          `Unknown NOTIFICATION_PROVIDER: '${provider}'. Use 'discord' | 'google-chat' | 'dual'.`,
        );
    }
  }
}
