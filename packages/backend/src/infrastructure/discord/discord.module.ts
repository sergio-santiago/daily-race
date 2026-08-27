import { Module } from '@nestjs/common';
import { DiscordWebhookAdapter } from './webhook.adapter';
import { DiscordFormatterService } from './discord-formatter.service';
import { NOTIFICATION_PORT } from '../../core/ports/notification.port';
import { ChartsModule } from '../charts/charts.module';

@Module({
  imports: [ChartsModule],
  providers: [
    DiscordFormatterService,
    { provide: NOTIFICATION_PORT, useClass: DiscordWebhookAdapter },
  ],
  exports: [NOTIFICATION_PORT],
})
export class DiscordModule {}
