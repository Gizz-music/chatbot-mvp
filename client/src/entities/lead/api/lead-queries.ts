import { queryOptions } from "@tanstack/react-query";

import { fetchLeads } from "./lead-api";

export const leadKeys = {
  all: ["leads"] as const,
  list: (botId: string) => ["leads", botId] as const,
};

export const leadQueries = {
  list: (botId: string) =>
    queryOptions({
      queryKey: leadKeys.list(botId),
      queryFn: () => fetchLeads(botId),
      staleTime: 0,
    }),
};
