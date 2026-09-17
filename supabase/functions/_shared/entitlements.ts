import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";

export type PlanLimitsRow = {
  plan: string;
  max_bots: number;
  max_documents: number | null;
  max_file_bytes: number;
  max_messages: number;
  remove_branding: boolean;
  widget_customization: boolean;
  domain_allowlist: boolean;
};

export class PlanLimitError extends Error {
  readonly status = 402;

  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
  team: "Business",
};

export const planNameOf = (plan: string): string =>
  PLAN_NAMES[plan] ?? "Free";

const failOn = (error: { message: string } | null) => {
  if (error) {
    throw new Error(error.message);
  }
};

export const loadLimitsForUser = async (
  admin: SupabaseClient,
  userId: string,
): Promise<PlanLimitsRow> => {
  const { data: subscription, error: subscriptionError } = await admin
    .from("subscriptions")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle<{ plan: string }>();

  failOn(subscriptionError);

  const plan = subscription?.plan ?? "free";

  const { data: limits, error: limitsError } = await admin
    .from("plan_limits")
    .select(
      "plan, max_bots, max_documents, max_file_bytes, max_messages, remove_branding, widget_customization, domain_allowlist",
    )
    .eq("plan", plan === "team" ? "business" : plan)
    .maybeSingle<PlanLimitsRow>();

  failOn(limitsError);

  if (!limits) {
    throw new Error(`No plan_limits row for ${plan}.`);
  }

  return limits;
};

export const messageQuotaMessage = (limits: PlanLimitsRow): string =>
  `You've reached the ${limits.max_messages} message limit on ${planNameOf(limits.plan)} this month.`;

export const assertMessageQuota = async (
  admin: SupabaseClient,
  userId: string,
): Promise<PlanLimitsRow> => {
  const limits = await loadLimitsForUser(admin, userId);
  const periodStart = new Date().toISOString().slice(0, 7) + "-01";

  const { data, error } = await admin
    .from("usage_counters")
    .select("messages_used")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle<{ messages_used: number }>();

  failOn(error);

  if ((data?.messages_used ?? 0) >= limits.max_messages) {
    throw new PlanLimitError(messageQuotaMessage(limits));
  }

  return limits;
};

export const consumeMessageQuota = async (
  admin: SupabaseClient,
  userId: string,
): Promise<void> => {
  const limits = await loadLimitsForUser(admin, userId);
  const { data, error } = await admin.rpc("consume_message_quota", {
    p_user_id: userId,
  });

  failOn(error);

  if (data === false) {
    throw new PlanLimitError(messageQuotaMessage(limits));
  }
};

export const assertDocumentQuota = async (
  admin: SupabaseClient,
  botId: string,
  size: number,
): Promise<void> => {
  const { data: bot, error: botError } = await admin
    .from("bots")
    .select("user_id")
    .eq("id", botId)
    .maybeSingle<{ user_id: string }>();

  failOn(botError);

  if (!bot) {
    throw new Error("Bot not found.");
  }

  const limits = await loadLimitsForUser(admin, bot.user_id);

  if (size > limits.max_file_bytes) {
    throw new PlanLimitError(
      `The ${planNameOf(limits.plan)} plan allows files up to ${limits.max_file_bytes} bytes, this one is ${size} bytes.`,
    );
  }

  if (limits.max_documents === null) {
    return;
  }

  const { count, error } = await admin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("bot_id", botId);

  failOn(error);

  // The row being ingested is already stored, so equality is still allowed.
  if ((count ?? 0) > limits.max_documents) {
    throw new PlanLimitError(
      `The ${planNameOf(limits.plan)} plan allows up to ${limits.max_documents} documents per bot.`,
    );
  }
};
