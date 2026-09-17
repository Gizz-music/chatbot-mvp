import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2.116.0";

import { PlanLimitError, assertMessageQuota, loadLimitsForUser } from "../_shared/entitlements.ts";
import {
  corsHeaders as baseCors,
  messageOf,
  requireEnv,
  sseHeaders as baseSse,
} from "../chat/http.ts";
import { embedHostOf, isHostAllowed } from "../chat/origin.ts";
import { failOn, runChatStream } from "../chat/session.ts";
import type { BotRow } from "../chat/types.ts";

const MAX_MESSAGE_CHARS = 4_000;
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60;
const PUBLIC_KEY_RE = /^(?:pk_live_)?[a-z0-9]{32}$/i;

const BOT_COLUMNS =
  "id, user_id, name, system_prompt, welcome_message, accent_color, status, allowed_domains";

const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers": `${baseCors["Access-Control-Allow-Headers"]}, x-embed-origin`,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const corsFor = (request: Request) => {
  const origin = request.headers.get("Origin");

  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": origin ?? "*",
    Vary: "Origin",
  };
};

const jsonResponse = (
  request: Request,
  body: unknown,
  status = 200,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(request), "Content-Type": "application/json" },
  });

const sseFor = (request: Request) => ({
  ...baseSse,
  ...corsFor(request),
});

type WidgetBotRow = BotRow & {
  accent_color: string;
  allowed_domains: string[];
};

type WidgetChatRequest = {
  publicKey: string;
  conversationId: string | null;
  message: string;
  visitorId: string;
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
  publicKey: string,
): Promise<WidgetBotRow | null> => {
  const candidates = publicKey.startsWith("pk_live_")
    ? [publicKey, publicKey.slice("pk_live_".length)]
    : [publicKey, `pk_live_${publicKey}`];

  for (const key of candidates) {
    const { data, error } = await admin
      .from("bots")
      .select(BOT_COLUMNS)
      .eq("public_key", key)
      .maybeSingle<WidgetBotRow>();

    failOn(error);

    if (data) {
      return data;
    }
  }

  return null;
};

const readPublicKey = (request: Request, bodyKey?: unknown): string | null => {
  if (typeof bodyKey === "string") {
    return bodyKey.trim();
  }

  const fromQuery = new URL(request.url).searchParams.get("bot");

  return fromQuery?.trim() || null;
};

const readChatRequest = async (
  request: Request,
): Promise<WidgetChatRequest | null> => {
  try {
    const body = await request.json();

    if (typeof body !== "object" || body === null) {
      return null;
    }

    const publicKey = readPublicKey(request, body.publicKey);

    if (
      !publicKey ||
      typeof body.message !== "string" ||
      typeof body.visitorId !== "string"
    ) {
      return null;
    }

    return {
      publicKey,
      conversationId:
        typeof body.conversationId === "string" ? body.conversationId : null,
      message: body.message.trim(),
      visitorId: body.visitorId.trim(),
    };
  } catch {
    return null;
  }
};

const assertOrigin = (
  bot: WidgetBotRow,
  request: Request,
): string | null => {
  if (bot.allowed_domains.length === 0) {
    return null;
  }

  const host = embedHostOf(request);

  if (!host || !isHostAllowed(host, bot.allowed_domains)) {
    return "This website is not allowed to use this chatbot.";
  }

  return null;
};

const assertAvailable = (
  bot: WidgetBotRow,
  owner: User | null,
): string | null => {
  if (bot.status === "active" || owner?.id === bot.user_id) {
    return null;
  }

  return "This bot is not available.";
};

const memoryHits = new Map<string, { window: number; hits: number }>();

const consumeRateLimitMemory = (botId: string, visitorId: string): boolean => {
  const windowId = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
  const key = `${botId}:${visitorId}`;
  const current = memoryHits.get(key);

  if (!current || current.window !== windowId) {
    memoryHits.set(key, { window: windowId, hits: 1 });
    return true;
  }

  current.hits += 1;

  return current.hits <= RATE_LIMIT;
};

const consumeRateLimit = async (
  admin: SupabaseClient,
  botId: string,
  visitorId: string,
): Promise<boolean> => {
  const { data, error } = await admin.rpc("consume_widget_rate_limit", {
    p_bot_id: botId,
    p_visitor_id: visitorId,
    p_limit: RATE_LIMIT,
    p_window_seconds: RATE_WINDOW_SECONDS,
  });

  if (error) {
    console.error(`widget rate limit rpc: ${error.message}`);
    return consumeRateLimitMemory(botId, visitorId);
  }

  return data === true;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsFor(request) });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse(request, { error: "Use GET or POST." }, 405);
  }

  const admin = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  if (request.method === "GET") {
    const publicKey = readPublicKey(request);

    if (!publicKey || !PUBLIC_KEY_RE.test(publicKey)) {
      return jsonResponse(request, { error: "Expected a public bot key." }, 400);
    }

    let owner: User | null;
    let bot: WidgetBotRow | null;

    try {
      owner = await resolveUser(admin, bearerToken(request));
      bot = await loadBot(admin, publicKey);
    } catch (cause) {
      return jsonResponse(request, { error: messageOf(cause) }, 500);
    }

    if (!bot) {
      return jsonResponse(request, { error: "Bot not found." }, 404);
    }

    const unavailable = assertAvailable(bot, owner);

    if (unavailable) {
      return jsonResponse(request, { error: unavailable }, 403);
    }

    const denied = assertOrigin(bot, request);

    if (denied) {
      return jsonResponse(request, { error: denied }, 403);
    }

    let limits;

    try {
      limits = await loadLimitsForUser(admin, bot.user_id);
    } catch (cause) {
      return jsonResponse(request, { error: messageOf(cause) }, 500);
    }

    return jsonResponse(request, {
      name: bot.name,
      welcomeMessage: bot.welcome_message,
      accentColor: bot.accent_color,
      showBranding: !limits.remove_branding,
    });
  }

  const payload = await readChatRequest(request);

  if (!payload || !PUBLIC_KEY_RE.test(payload.publicKey)) {
    return jsonResponse(
      request,
      { error: "Expected publicKey, message and visitorId." },
      400,
    );
  }

  if (payload.visitorId.length < 8 || payload.visitorId.length > 80) {
    return jsonResponse(request, { error: "Visitor id is invalid." }, 400);
  }

  if (payload.message.length === 0) {
    return jsonResponse(request, { error: "Message is empty." }, 400);
  }

  if (payload.message.length > MAX_MESSAGE_CHARS) {
    return jsonResponse(
      request,
      { error: `Message must be at most ${MAX_MESSAGE_CHARS} characters.` },
      400,
    );
  }

  let owner: User | null;
  let bot: WidgetBotRow | null;

  try {
    owner = await resolveUser(admin, bearerToken(request));
    bot = await loadBot(admin, payload.publicKey);
  } catch (cause) {
    return jsonResponse(request, { error: messageOf(cause) }, 500);
  }

  if (!bot) {
    return jsonResponse(request, { error: "Bot not found." }, 404);
  }

  const unavailable = assertAvailable(bot, owner);

  if (unavailable) {
    return jsonResponse(request, { error: unavailable }, 403);
  }

  const denied = assertOrigin(bot, request);

  if (denied) {
    return jsonResponse(request, { error: denied }, 403);
  }

  try {
    const allowed = await consumeRateLimit(admin, bot.id, payload.visitorId);

    if (!allowed) {
      return jsonResponse(
        request,
        { error: "Too many messages. Please wait a moment." },
        429,
      );
    }

    await assertMessageQuota(admin, bot.user_id);
  } catch (cause) {
    if (cause instanceof PlanLimitError) {
      return jsonResponse(request, { error: cause.message }, cause.status);
    }

    return jsonResponse(request, { error: messageOf(cause) }, 500);
  }

  return runChatStream(
    admin,
    {
      bot,
      source: "widget",
      visitorId: payload.visitorId,
      conversationId: payload.conversationId,
      message: payload.message,
    },
    sseFor(request),
  );
});
