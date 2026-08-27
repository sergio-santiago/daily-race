import { Module } from '@nestjs/common';
import { DiscordWebhookAdapter } from './webhook.adapter';
import { DiscordFormatterService } from './discord-formatter.service';

/**
 * Modulo de notificaciones via Discord (webhooks). Mantenido durante la
 * transicion a Google Chat.
 *
 * Expone el adapter como provider — el binding al token NOTIFICATION_PORT
 * lo hace `NotificationModule` segun el proveedor activo.
 */
@Module({
  providers: [DiscordFormatterService, DiscordWebhookAdapter],
  exports: [DiscordWebhookAdapter, DiscordFormatterService],
})
export class DiscordModule {}
