import { queryOptions } from "@tanstack/react-query";

import { fetchBotInsights } from "./analytics-api";

export const analyticsKeys = {
  all: ["analytics"] as const,
  detail: (botId: string) => ["analytics", botId] as const,
};

export const analyticsQueries = {
  detail: (botId: string) =>
    queryOptions({
      queryKey: analyticsKeys.detail(botId),
      queryFn: () => fetchBotInsights(botId),
      staleTime: 0,
    }),
};
