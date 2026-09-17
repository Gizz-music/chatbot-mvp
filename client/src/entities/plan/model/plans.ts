import type { BillingInterval, Plan, PlanId } from "./types";

const MB = 1024 * 1024;

/**
 * Declarative limits matrix. Landing, Billing and useEntitlements() all read
 * from here so a number never has to be updated in three places. The database
 * trigger and Edge Functions keep a matching copy for enforcement.
 */
export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    description: "Everything you need to try the product out.",
    recommended: false,
    limits: {
      planId: "free",
      maxBots: 1,
      maxDocuments: 10,
      maxFileBytes: 5 * MB,
      maxMessages: 100,
      features: {
        removeBranding: false,
        widgetCustomization: false,
        domainAllowlist: false,
      },
    },
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 2900,
    priceYearly: 27600,
    description: "For a growing product that needs a real widget.",
    recommended: true,
    limits: {
      planId: "pro",
      maxBots: 3,
      maxDocuments: 150,
      maxFileBytes: 20 * MB,
      maxMessages: 2_000,
      features: {
        removeBranding: true,
        widgetCustomization: true,
        domainAllowlist: true,
      },
    },
  },
  {
    id: "business",
    name: "Business",
    priceMonthly: 9900,
    priceYearly: 94800,
    description: "For teams with higher volume.",
    recommended: false,
    limits: {
      planId: "business",
      maxBots: 10,
      maxDocuments: 1_000,
      maxFileBytes: 50 * MB,
      maxMessages: 10_000,
      features: {
        removeBranding: true,
        widgetCustomization: true,
        domainAllowlist: true,
      },
    },
  },
];

const PLAN_BY_ID: Record<PlanId, Plan> = {
  free: PLANS[0],
  pro: PLANS[1],
  business: PLANS[2],
};

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  pro: 1,
  business: 2,
};

export const DEFAULT_PLAN = PLAN_BY_ID.free;

export const getPlanById = (id: string): Plan =>
  PLAN_BY_ID[id as PlanId] ?? DEFAULT_PLAN;

export const priceOf = (plan: Plan, interval: BillingInterval): number =>
  interval === "yearly" ? plan.priceYearly : plan.priceMonthly;

/** Equivalent monthly cents when billed yearly, for the toggle label. */
export const monthlyEquivalentOf = (plan: Plan): number =>
  plan.priceYearly === 0 ? 0 : Math.round(plan.priceYearly / 12);

export const comparePlans = (from: PlanId, to: PlanId): number =>
  PLAN_RANK[to] - PLAN_RANK[from];

const megabytesOf = (bytes: number): string =>
  `${Math.round(bytes / MB)} MB`;

const countLabel = (count: number, noun: string): string =>
  count === 1 ? `1 ${noun}` : `${count.toLocaleString("en-US")} ${noun}s`;

/** Marketing bullets derived from the limits, so the cards cannot drift. */
export const featureLinesOf = (plan: Plan): string[] => {
  const { limits } = plan;
  const lines = [
    countLabel(limits.maxBots, "bot"),
    limits.maxDocuments === null
      ? "Unlimited documents per bot"
      : `${limits.maxDocuments.toLocaleString("en-US")} documents per bot`,
    `Files up to ${megabytesOf(limits.maxFileBytes)}`,
    `${limits.maxMessages.toLocaleString("en-US")} messages / month`,
  ];

  if (limits.features.removeBranding) {
    lines.push("Remove the “Powered by” badge");
  } else {
    lines.push("“Powered by” badge on the widget");
  }

  if (limits.features.widgetCustomization) {
    lines.push("Widget color and greeting");
  } else {
    lines.push("Widget color and greeting locked");
  }

  if (limits.features.domainAllowlist) {
    lines.push("Domain allow-list");
  } else {
    lines.push("Embed from any domain");
  }

  return lines;
};
