import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

const envPaths = [
  path.join(__dirname, ".env"),
  path.resolve(process.cwd(), ".env")
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const config = {
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_KEY"),
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || "listing-images",

  telegramApiId: Number(requireEnv("TELEGRAM_API_ID")),
  telegramApiHash: requireEnv("TELEGRAM_API_HASH"),
  telegramSessionString: (process.env.TELEGRAM_SESSION_STRING || "").trim(),
  telegramChannelUsername: requireEnv("TELEGRAM_CHANNEL").replace("@", ""),

  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",

  extractVersion: process.env.EXTRACT_VERSION || "v1"
};
