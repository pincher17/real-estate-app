import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    persistSession: false
  }
});

export type SourceRow = {
  id: string;
  type: string;
  telegram_peer_id: number;
  title: string | null;
  username: string | null;
  last_message_id: number | null;
};

export type TelegramMessageRow = {
  id: string;
  source_id: string;
  message_id: number;
};
