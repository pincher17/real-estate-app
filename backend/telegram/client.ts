import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { config } from "../config";

let client: TelegramClient | null = null;

export async function getTelegramClient(): Promise<TelegramClient> {
  if (client) return client;

  if (!config.telegramSessionString) {
    throw new Error(
      "TELEGRAM_SESSION_STRING not set. Run 'npm run telegram:auth' first to generate a session."
    );
  }

  const session = new StringSession(config.telegramSessionString);
  const c = new TelegramClient(session, config.telegramApiId, config.telegramApiHash, {
    connectionRetries: 5
  });

  await c.connect();
  if (!c.connected) {
    throw new Error("Failed to connect Telegram client. Make sure TELEGRAM_SESSION_STRING is valid.");
  }

  client = c;
  return client;
}

export async function disconnectTelegramClient() {
  if (client) {
    await client.disconnect();
    client = null;
  }
}
