import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2.116.0";

import { corsHeaders, jsonResponse, messageOf, requireEnv, sseHeaders } from "./http.ts";
import { assertMessageQuota, PlanLimitError } from "../_shared/entitlements.ts";
import { runChatStream } from "./session.ts";
import type { BotRow, ChatRequest } from "./types.ts";

const MAX_MESSAGE_CHARS = 4_000;
const BOT_COLUMNS = "id, user_id, name, system_prompt, welcome_message, status";

const readRequest = async (request: Request): Promise<ChatRequest | null> => {
  try {
    const body = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      typeof body.botId !== "string" ||
      typeof body.message !== "string" ||
      body.source !== "app"
    ) {
      return null;
    }

    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : null;

    return {
      botId: body.botId,
      conversationId,
      message: body.message.trim(),
      source: "app",
      visitorId: null,
    };
  } catch {
    return null;
  }
};

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();

  return token.length > 0 ? token : null;
};

const resolveUser = async (
  admin: SupabaseClient,
  token: string | null,
): Promise<User | null> => {
  if (!token || token === requireEnv("SUPABASE_ANON_KEY")) {
    return null;
  }

  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
};

const loadBot = async (
  admin: SupabaseClient,
  botId: string,
): Promise<BotRow | null> => {
  const { data, error } = await admin
    .from("bots")
    .select(BOT_COLUMNS)
    .eq("id", botId)
    .maybeSingle<BotRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST." }, 405);
  }

  const payload = await readRequest(request);

  if (!payload) {
    return jsonResponse({ error: "Expected botId, message and source=app." }, 400);
  }

  if (payload.message.length === 0) {
    return jsonResponse({ error: "Message is empty." }, 400);
  }

  if (payload.message.length > MAX_MESSAGE_CHARS) {
    return jsonResponse(
      { error: `Message must be at most ${MAX_MESSAGE_CHARS} characters.` },
      400,
    );
  }

  const admin = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  let user: User | null;
  let bot: BotRow | null;

  try {
    user = await resolveUser(admin, bearerToken(request));
    bot = await loadBot(admin, payload.botId);
  } catch (cause) {
    return jsonResponse({ error: messageOf(cause) }, 500);
  }

  if (!bot) {
    return jsonResponse({ error: "Bot not found." }, 404);
  }

  if (!user) {
    return jsonResponse({ error: "Sign in to chat from the dashboard." }, 401);
  }

  if (user.id !== bot.user_id) {
    return jsonResponse({ error: "You do not own this bot." }, 403);
  }

  try {
    await assertMessageQuota(admin, bot.user_id);
  } catch (cause) {
    if (cause instanceof PlanLimitError) {
      return jsonResponse({ error: cause.message }, cause.status);
    }

    return jsonResponse({ error: messageOf(cause) }, 500);
  }

  return runChatStream(
    admin,
    {
      bot,
      source: "app",
      visitorId: null,
      conversationId: payload.conversationId,
      message: payload.message,
    },
    sseHeaders,
  );
});
