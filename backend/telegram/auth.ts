import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import readline from "readline";
import { config } from "../config";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log("Telegram Authentication");
  console.log("=====================\n");

  const session = new StringSession("");
  const client = new TelegramClient(session, config.telegramApiId, config.telegramApiHash, {
    connectionRetries: 5
  });

  await client.start({
    phoneNumber: async () => await question("Enter your phone number (with country code): "),
    password: async () => await question("Enter your 2FA password (if enabled): "),
    phoneCode: async () => await question("Enter the code you received: "),
    onError: (err) => console.error(err)
  });

  const sessionString = client.session.save() as unknown as string;
  console.log("\n✅ Authentication successful!");
  console.log("\nAdd this to your .env file:");
  console.log(`TELEGRAM_SESSION_STRING=${sessionString}\n`);

  await client.disconnect();
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  rl.close();
  process.exit(1);
});
