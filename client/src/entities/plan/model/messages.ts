import type { Plan } from "./types";

export const botLimitMessage = (plan: Plan): string =>
  `You've reached the ${plan.limits.maxBots} bot limit on ${plan.name}`;

export const messageLimitMessage = (plan: Plan): string =>
  `You've reached the ${plan.limits.maxMessages.toLocaleString("en-US")} message limit on ${plan.name} this month.`;

export const documentLimitMessage = (plan: Plan): string => {
  const cap = plan.limits.maxDocuments;

  if (cap === null) {
    return `The ${plan.name} plan does not cap documents per bot.`;
  }

  return `The ${plan.name} plan allows up to ${cap.toLocaleString("en-US")} documents per bot.`;
};
