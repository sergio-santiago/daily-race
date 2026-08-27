import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatAppAdapter } from './chat-app.adapter';
import { ChatFormatterService } from './chat-formatter.service';
import { CHAT_CLIENT, GoogleChatApiClient } from './chat-api.client';

/**
 * Modulo de notificaciones via Google Chat App (Service Account + chat.bot).
 *
 * Expone el adapter como provider — el binding al token NOTIFICATION_PORT
 * lo hace `NotificationModule` segun el proveedor activo.
 */
@Module({
  providers: [
    ChatFormatterService,
    {
      provide: CHAT_CLIENT,
      useFactory: (config: ConfigService) =>
        GoogleChatApiClient.fromServiceAccount(
          config.getOrThrow('GOOGLE_CLIENT_EMAIL'),
          config.getOrThrow('GOOGLE_PRIVATE_KEY'),
        ),
      inject: [ConfigService],
    },
    ChatAppAdapter,
  ],
  exports: [ChatAppAdapter, ChatFormatterService, CHAT_CLIENT],
})
export class GoogleChatModule {}
