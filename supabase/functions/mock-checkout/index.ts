import { createClient, type User } from "npm:@supabase/supabase-js@2.116.0";

import { corsHeaders as ingestCors, jsonResponse, messageOf, requireEnv } from "../ingest-document/http.ts";

const corsHeaders = {
  ...ingestCors,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type BillingInterval = "monthly" | "yearly";
type PlanId = "free" | "pro" | "business";

type CheckoutSession = {
  id: string;
  user_id: string;
  plan: PlanId;
  billing_interval: BillingInterval;
  amount_cents: number;
  success_url: string;
  cancel_url: string;
  status: "open" | "complete" | "expired";
  expires_at: string;
};

const PLAN_PRICES: Record<PlanId, Record<BillingInterval, number>> = {
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 2900, yearly: 27600 },
  business: { monthly: 9900, yearly: 94800 },
};

const PLAN_NAMES: Record<PlanId, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

const isPlanId = (value: unknown): value is PlanId =>
  value === "free" || value === "pro" || value === "business";

const isInterval = (value: unknown): value is BillingInterval =>
  value === "monthly" || value === "yearly";

const periodEndOf = (interval: BillingInterval): string => {
  const end = new Date();

  if (interval === "yearly") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }

  return end.toISOString();
};

const invoiceNumberOf = (): string => {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();

  return `INV-${stamp}-${suffix}`;
};

const isSafeReturnUrl = (value: string): boolean => {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
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

const readJson = async (request: Request): Promise<Record<string, unknown>> => {
  try {
    const body = await request.json();

    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const readForm = async (request: Request): Promise<Record<string, unknown>> => {
  const form = await request.formData();
  const body: Record<string, unknown> = {};

  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      body[key] = value;
    }
  }

  return body;
};

const checkoutPageUrl = (successUrl: string, sessionId: string): string => {
  const url = new URL("/checkout", successUrl);
  url.searchParams.set("session", sessionId);

  return url.toString();
};

const publicSessionOf = (session: CheckoutSession) => ({
  id: session.id,
  plan: session.plan,
  interval: session.billing_interval,
  amountCents: session.amount_cents,
  cancelUrl: session.cancel_url,
  status: session.status,
  expiresAt: session.expires_at,
});

const applyPlan = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
  plan: PlanId,
  interval: BillingInterval,
  amountCents: number,
  writeInvoice: boolean,
) => {
  const { error: subscriptionError } = await admin
    .from("subscriptions")
    .update({
      plan,
      billing_interval: interval,
      status: plan === "free" ? "canceled" : "active",
      cancel_at_period_end: false,
      current_period_end: plan === "free" ? new Date().toISOString() : periodEndOf(interval),
    })
    .eq("user_id", userId);

  if (subscriptionError) {
    throw new Error(subscriptionError.message);
  }

  if (!writeInvoice || amountCents <= 0) {
    return;
  }

  const { error: invoiceError } = await admin.from("invoices").insert({
    user_id: userId,
    number: invoiceNumberOf(),
    plan,
    billing_interval: interval,
    amount_cents: amountCents,
    status: "paid",
    description: `${PLAN_NAMES[plan]} (${interval})`,
    paid_at: new Date().toISOString(),
  });

  if (invoiceError) {
    throw new Error(invoiceError.message);
  }
};

const SESSION_COLUMNS =
  "id, user_id, plan, billing_interval, amount_cents, success_url, cancel_url, status, expires_at";

const loadOpenSession = async (
  admin: ReturnType<typeof createClient>,
  sessionId: string,
): Promise<Response | CheckoutSession> => {
  const { data, error } = await admin
    .from("checkout_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .maybeSingle<CheckoutSession>();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  if (!data || data.status !== "open") {
    return jsonResponse({ error: "This checkout session has expired." }, 410);
  }

  if (new Date(data.expires_at) < new Date()) {
    await admin
      .from("checkout_sessions")
      .update({ status: "expired" })
      .eq("id", data.id);

    return jsonResponse({ error: "This checkout session has expired." }, 410);
  }

  return data;
};

const isSession = (value: Response | CheckoutSession): value is CheckoutSession =>
  !(value instanceof Response);

const sessionIdOf = (
  body: Record<string, unknown>,
  fallback: string | null,
): string | null => {
  if (typeof body.sessionId === "string" && body.sessionId) {
    return body.sessionId;
  }

  if (typeof body.session_id === "string" && body.session_id) {
    return body.session_id;
  }

  return fallback;
};

const wantsJson = (request: Request, contentType: string): boolean =>
  contentType.includes("application/json") ||
  (request.headers.get("accept") ?? "").includes("application/json");

const finishCheckout = (request: Request, contentType: string, url: string): Response => {
  if (wantsJson(request, contentType)) {
    return jsonResponse({ url });
  }

  return new Response(null, {
    status: 303,
    headers: { ...corsHeaders, Location: url },
  });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const admin = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const contentType = request.headers.get("content-type") ?? "";
  const sessionIdFromQuery = new URL(request.url).searchParams.get("session");

  try {
    if (request.method === "GET") {
      if (!sessionIdFromQuery) {
        return jsonResponse({ error: "Expected a checkout session." }, 400);
      }

      const loaded = await loadOpenSession(admin, sessionIdFromQuery);

      return isSession(loaded) ? jsonResponse(publicSessionOf(loaded)) : loaded;
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Use GET or POST." }, 405);
    }

    const body = contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
      ? await readForm(request)
      : await readJson(request);

    const action =
      typeof body.action === "string"
        ? body.action
        : typeof body.action === "undefined" && sessionIdFromQuery
          ? "confirm"
          : "create";

    if (action === "session") {
      const sessionId = sessionIdOf(body, sessionIdFromQuery);

      if (!sessionId) {
        return jsonResponse({ error: "Expected a sessionId." }, 400);
      }

      const loaded = await loadOpenSession(admin, sessionId);

      return isSession(loaded) ? jsonResponse(publicSessionOf(loaded)) : loaded;
    }

    if (action === "confirm") {
      const sessionId = sessionIdOf(body, sessionIdFromQuery);

      if (!sessionId) {
        return jsonResponse({ error: "Expected a sessionId." }, 400);
      }

      const loaded = await loadOpenSession(admin, sessionId);

      if (!isSession(loaded)) {
        return loaded;
      }

      await applyPlan(
        admin,
        loaded.user_id,
        loaded.plan,
        loaded.billing_interval,
        loaded.amount_cents,
        true,
      );

      await admin
        .from("checkout_sessions")
        .update({ status: "complete" })
        .eq("id", loaded.id);

      return finishCheckout(request, contentType, loaded.success_url);
    }

    const token = bearerToken(request);

    if (!token || token === requireEnv("SUPABASE_ANON_KEY")) {
      return jsonResponse({ error: "Sign in to manage billing." }, 401);
    }

    const { data: userData, error: userError } = await admin.auth.getUser(token);

    if (userError || !userData.user) {
      return jsonResponse({ error: "Sign in to manage billing." }, 401);
    }

    const user: User = userData.user;

    if (action === "cancel") {
      await applyPlan(admin, user.id, "free", "monthly", 0, false);

      return jsonResponse({ ok: true });
    }

    if (!isPlanId(body.planId) || !isInterval(body.interval)) {
      return jsonResponse({ error: "Expected planId and interval." }, 400);
    }

    const successUrl =
      typeof body.successUrl === "string" ? body.successUrl : "";
    const cancelUrl = typeof body.cancelUrl === "string" ? body.cancelUrl : "";

    if (!isSafeReturnUrl(successUrl) || !isSafeReturnUrl(cancelUrl)) {
      return jsonResponse({ error: "Return URLs are invalid." }, 400);
    }

    const amountCents = PLAN_PRICES[body.planId][body.interval];

    if (amountCents === 0) {
      await applyPlan(admin, user.id, body.planId, body.interval, 0, false);

      return jsonResponse({ url: successUrl });
    }

    const { data: session, error } = await admin
      .from("checkout_sessions")
      .insert({
        user_id: user.id,
        plan: body.planId,
        billing_interval: body.interval,
        amount_cents: amountCents,
        success_url: successUrl,
        cancel_url: cancelUrl,
      })
      .select(
        "id, user_id, plan, billing_interval, amount_cents, success_url, cancel_url, status, expires_at",
      )
      .single<CheckoutSession>();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ url: checkoutPageUrl(successUrl, session.id) });
  } catch (cause) {
    return jsonResponse({ error: messageOf(cause) }, 500);
  }
});
