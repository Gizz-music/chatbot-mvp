import { queryOptions } from "@tanstack/react-query";

import { fetchBotById, fetchBots } from "./bot-api";
import { fetchWidgetConfig } from "./widget-config";

export const botKeys = {
  all: ["bots"] as const,
  detail: (id: string) => ["bots", id] as const,
  widgetConfig: (publicKey: string) =>
    ["bots", "widget-config", publicKey] as const,
};

export const botQueries = {
  list: () =>
    queryOptions({
      queryKey: botKeys.all,
      queryFn: fetchBots,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: botKeys.detail(id),
      queryFn: () => fetchBotById(id),
    }),
  widgetConfig: (publicKey: string, origin: string) =>
    queryOptions({
      queryKey: botKeys.widgetConfig(publicKey),
      queryFn: ({ signal }) => fetchWidgetConfig(publicKey, origin, signal),
    }),
};
