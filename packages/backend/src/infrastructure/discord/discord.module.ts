import { Module } from '@nestjs/common';
import { DiscordWebhookAdapter } from './webhook.adapter';
import { NOTIFICATION_PORT } from '../../core/ports/notification.port';

@Module({
  providers: [
    { provide: NOTIFICATION_PORT, useClass: DiscordWebhookAdapter },
  ],
  exports: [NOTIFICATION_PORT],
})
export class DiscordModule {}
