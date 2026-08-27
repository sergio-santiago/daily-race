import { Logger } from '@nestjs/common';
import { google, chat_v1 } from 'googleapis';
import { ChatMessage } from './chat-card.types';

/**
 * Cliente reducido contra Google Chat API (subset que usa Daily Race).
 * Existe como abstraccion para que los tests puedan mockear sin tocar googleapis.
 */
export interface ChatApiClient {
  /**
   * Crea un mensaje en un space y devuelve el `name` resource (formato
   * `spaces/AAA/messages/BBB.BBB`) que sirve como messageId para edits posteriores.
   */
  createMessage(parent: string, body: ChatMessage): Promise<string>;

  /**
   * Edita un mensaje existente. `name` es el resource name completo.
   * `updateMask` indica que campos modificar (`text`, `cardsV2`, o coma-separados).
   */
  patchMessage(name: string, updateMask: string, body: ChatMessage): Promise<void>;
}

/**
 * Implementacion real envolviendo `googleapis` chat_v1.
 * Auth via Service Account con scope `chat.bot` (sin impersonation).
 */
export class GoogleChatApiClient implements ChatApiClient {
  private readonly logger = new Logger(GoogleChatApiClient.name);
  private readonly client: chat_v1.Chat;

  constructor(client: chat_v1.Chat) {
    this.client = client;
  }

  static fromServiceAccount(
    clientEmail: string,
    privateKey: string,
  ): GoogleChatApiClient {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/chat.bot'],
    });
    const client = google.chat({ version: 'v1', auth });
    return new GoogleChatApiClient(client);
  }

  async createMessage(parent: string, body: ChatMessage): Promise<string> {
    const res = await this.client.spaces.messages.create({
      parent,
      requestBody: body as chat_v1.Schema$Message,
    });
    if (!res.data.name) {
      this.logger.error('Chat API create returned empty message name');
      throw new Error('Chat API create returned empty message name');
    }
    return res.data.name;
  }

  async patchMessage(
    name: string,
    updateMask: string,
    body: ChatMessage,
  ): Promise<void> {
    await this.client.spaces.messages.patch({
      name,
      updateMask,
      requestBody: body as chat_v1.Schema$Message,
    });
  }
}

export const CHAT_CLIENT = Symbol('CHAT_CLIENT');
