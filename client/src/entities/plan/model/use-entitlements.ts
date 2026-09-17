import { useQuery } from "@tanstack/react-query";

import { botQueries } from "@/entities/bot";

import { planQueries } from "../api/plan-queries";
import { DEFAULT_PLAN, getPlanById } from "./plans";
import type {
  Plan,
  PlanFeature,
  PlanLimits,
  PlanResource,
  PlanUsage,
  Subscription,
} from "./types";

export type Entitlements = {
  plan: Plan;
  limits: PlanLimits;
  usage: PlanUsage;
  subscription: Subscription | null;
  can: (feature: PlanFeature) => boolean;
  isAtLimit: (resource: PlanResource) => boolean;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

const capOf = (limits: PlanLimits, resource: PlanResource): number | null => {
  switch (resource) {
    case "bots":
      return limits.maxBots;
    case "messages":
      return limits.maxMessages;
    case "documents":
      return limits.maxDocuments;
  }
};

const usedOf = (usage: PlanUsage, resource: PlanResource): number => {
  if (resource === "documents") {
    return 0;
  }

  return usage[resource];
};

/**
 * Workspace entitlements. Document caps are per-bot, so `isAtLimit("documents")`
 * is always false here — the upload UI compares against that bot's own count.
 */
export const useEntitlements = (): Entitlements => {
  const subscriptionQuery = useQuery(planQueries.subscription());
  const usageQuery = useQuery(planQueries.usage());
  const botsQuery = useQuery(botQueries.list());

  const plan = getPlanById(subscriptionQuery.data?.planId ?? DEFAULT_PLAN.id);
  const usage: PlanUsage = {
    bots: botsQuery.data?.length ?? 0,
    messages: usageQuery.data?.messages ?? 0,
  };

  const can = (feature: PlanFeature): boolean => plan.limits.features[feature];

  const isAtLimit = (resource: PlanResource): boolean => {
    const cap = capOf(plan.limits, resource);

    if (cap === null) {
      return false;
    }

    return usedOf(usage, resource) >= cap;
  };

  const error =
    subscriptionQuery.error ?? usageQuery.error ?? botsQuery.error ?? null;

  return {
    plan,
    limits: plan.limits,
    usage,
    subscription: subscriptionQuery.data ?? null,
    can,
    isAtLimit,
    isPending:
      subscriptionQuery.isPending ||
      usageQuery.isPending ||
      botsQuery.isPending,
    isError: Boolean(error),
    error,
  };
};
