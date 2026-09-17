import { supabase } from "@/shared/api";

import type { BotInsights } from "../model/types";

type InsightsRow = {
  messagesByDay?: unknown;
  topQuestions?: unknown;
  unanswered?: unknown;
  totals?: unknown;
};

const asCount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const asText = (value: unknown): string =>
  typeof value === "string" ? value : "";

const toInsights = (row: InsightsRow | null): BotInsights => {
  const days = Array.isArray(row?.messagesByDay) ? row.messagesByDay : [];
  const questions = Array.isArray(row?.topQuestions) ? row.topQuestions : [];
  const unanswered =
    row?.unanswered && typeof row.unanswered === "object"
      ? (row.unanswered as Record<string, unknown>)
      : {};
  const totals =
    row?.totals && typeof row.totals === "object"
      ? (row.totals as Record<string, unknown>)
      : {};

  return {
    messagesByDay: days.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const rowItem = item as Record<string, unknown>;
      const day = asText(rowItem.day);
      const count = asCount(rowItem.count);

      return day ? [{ day, count }] : [];
    }),
    topQuestions: questions.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const rowItem = item as Record<string, unknown>;
      const question = asText(rowItem.question);
      const count = asCount(rowItem.count);

      return question ? [{ question, count }] : [];
    }),
    unanswered: {
      total: asCount(unanswered.total),
      unanswered: asCount(unanswered.unanswered),
      share: asCount(unanswered.share),
    },
    totals: {
      conversations: asCount(totals.conversations),
      messages: asCount(totals.messages),
      leads: asCount(totals.leads),
    },
  };
};

export const fetchBotInsights = async (botId: string): Promise<BotInsights> => {
  const { data, error } = await supabase.rpc("bot_insights", {
    p_bot_id: botId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return toInsights((data ?? null) as InsightsRow | null);
};
