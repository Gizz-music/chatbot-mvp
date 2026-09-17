import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/shared/api";

import type { Bot, BotDraft, BotSettings, BotStatus } from "../model/types";

/**
 * Shape of a `public.bots` row. Hand-written while the Supabase CLI is not part
 * of the workflow yet — replace with `supabase gen types typescript` output.
 */
type BotRow = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  welcome_message: string;
  accent_color: string;
  show_branding: boolean;
  status: BotStatus;
  public_key: string;
  allowed_domains: string[];
  created_at: string;
};

const TABLE = "bots";

const BOT_COLUMNS =
  "id, name, description, system_prompt, welcome_message, accent_color, show_branding, status, public_key, allowed_domains, created_at";

type QueryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

/** Collapses the Supabase result tuple into a value or an exception. */
const unwrap = <T>({ data, error }: QueryResult<T>): T => {
  if (error) {
    throw new Error(error.message);
  }

  if (data === null) {
    throw new Error("Supabase returned no data for the bots request.");
  }

  return data;
};

const toBot = (row: BotRow): Bot => ({
  id: row.id,
  name: row.name,
  description: row.description,
  systemPrompt: row.system_prompt,
  welcomeMessage: row.welcome_message,
  accentColor: row.accent_color,
  showBranding: row.show_branding,
  status: row.status,
  publicKey: row.public_key,
  allowedDomains: row.allowed_domains,
  createdAt: row.created_at,
});

const toRow = (settings: BotSettings) => ({
  name: settings.name,
  description: settings.description,
  system_prompt: settings.systemPrompt,
  welcome_message: settings.welcomeMessage,
  accent_color: settings.accentColor,
  show_branding: settings.showBranding,
  status: settings.status,
  allowed_domains: settings.allowedDomains,
});

export const fetchBots = async (): Promise<Bot[]> => {
  const rows = unwrap<BotRow[]>(
    await supabase
      .from(TABLE)
      .select(BOT_COLUMNS)
      .order("created_at", { ascending: false }),
  );

  return rows.map(toBot);
};

/** Resolves to `null` when the bot does not exist or belongs to someone else. */
export const fetchBotById = async (id: string): Promise<Bot | null> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select(BOT_COLUMNS)
    .eq("id", id)
    .maybeSingle<BotRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toBot(data) : null;
};

export const createBot = async (draft: BotDraft): Promise<Bot> => {
  // user_id, public_key and the widget defaults are filled in by the database.
  const row = unwrap<BotRow>(
    await supabase
      .from(TABLE)
      .insert({ name: draft.name, description: draft.description })
      .select(BOT_COLUMNS)
      .single(),
  );

  return toBot(row);
};

export const updateBot = async (
  id: string,
  settings: BotSettings,
): Promise<Bot> => {
  const row = unwrap<BotRow>(
    await supabase
      .from(TABLE)
      .update(toRow(settings))
      .eq("id", id)
      .select(BOT_COLUMNS)
      .single(),
  );

  return toBot(row);
};

export const deleteBot = async (id: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
};
