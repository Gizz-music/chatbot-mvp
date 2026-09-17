import { FunctionsHttpError } from "@supabase/supabase-js";

import type { BillingInterval, PlanId } from "@/entities/plan";
import { supabase } from "@/shared/api";
import { ROUTES } from "@/shared/config/routes";

export type CheckoutInput = {
  planId: PlanId;
  interval: BillingInterval;
};

export type CheckoutSession = {
  url: string;
};

export type CheckoutSessionDetails = {
  id: string;
  plan: PlanId;
  interval: BillingInterval;
  amountCents: number;
  cancelUrl: string;
};

type FunctionPayload = {
  error?: string;
  url?: string;
  id?: string;
  plan?: PlanId;
  interval?: BillingInterval;
  amountCents?: number;
  cancelUrl?: string;
};

const isPlanId = (value: unknown): value is PlanId =>
  value === "free" || value === "pro" || value === "business";

const isInterval = (value: unknown): value is BillingInterval =>
  value === "monthly" || value === "yearly";

/** Host HTML on the SPA. Supabase rewrites function GET text/html to text/plain. */
const toAppCheckoutUrl = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    const session = parsed.searchParams.get("session");

    if (!session) {
      return rawUrl;
    }

    const next = new URL(ROUTES.checkout, window.location.origin);
    next.searchParams.set("session", session);

    return next.toString();
  } catch {
    return rawUrl;
  }
};

const describeError = async (cause: unknown, fallback: string): Promise<string> => {
  if (cause instanceof FunctionsHttpError) {
    const payload: unknown = await cause.context.json().catch(() => null);

    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  }

  return cause instanceof Error ? cause.message : fallback;
};

const invokeBilling = async (
  body: Record<string, unknown>,
): Promise<FunctionPayload> => {
  const { data, error } = await supabase.functions.invoke("mock-checkout", {
    body,
  });

  if (error) {
    throw new Error(await describeError(error, "Billing request failed."));
  }

  return (data ?? {}) as FunctionPayload;
};

const billingReturnUrls = () => {
  const origin = window.location.origin;

  return {
    successUrl: `${origin}${ROUTES.billing}?checkout=success`,
    cancelUrl: `${origin}${ROUTES.billing}?checkout=canceled`,
  };
};

/**
 * Starts a checkout session and returns the hosted payment URL. Swap the
 * function name (and nothing else) when moving from mock-checkout to Stripe.
 */
export const startCheckout = async (
  input: CheckoutInput,
): Promise<CheckoutSession> => {
  const payload = await invokeBilling({
    action: "create",
    planId: input.planId,
    interval: input.interval,
    ...billingReturnUrls(),
  });

  if (!payload.url) {
    throw new Error(payload.error ?? "Checkout did not return a URL.");
  }

  return { url: toAppCheckoutUrl(payload.url) };
};

export const readCheckoutSession = async (
  sessionId: string,
): Promise<CheckoutSessionDetails> => {
  const payload = await invokeBilling({
    action: "session",
    sessionId,
  });

  if (
    typeof payload.id !== "string" ||
    !isPlanId(payload.plan) ||
    !isInterval(payload.interval) ||
    typeof payload.amountCents !== "number" ||
    typeof payload.cancelUrl !== "string"
  ) {
    throw new Error(payload.error ?? "Checkout session is unavailable.");
  }

  return {
    id: payload.id,
    plan: payload.plan,
    interval: payload.interval,
    amountCents: payload.amountCents,
    cancelUrl: payload.cancelUrl,
  };
};

export const confirmCheckout = async (sessionId: string): Promise<CheckoutSession> => {
  const payload = await invokeBilling({
    action: "confirm",
    sessionId,
  });

  if (!payload.url) {
    throw new Error(payload.error ?? "Payment did not complete.");
  }

  return { url: payload.url };
};

export const cancelSubscription = async (): Promise<void> => {
  const payload = await invokeBilling({ action: "cancel" });

  if (payload.error) {
    throw new Error(payload.error);
  }
};
