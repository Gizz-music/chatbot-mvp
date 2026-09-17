import { queryOptions } from "@tanstack/react-query";

import { fetchConversations, fetchMessages } from "./conversation-api";

export const conversationKeys = {
  all: ["conversations"] as const,
  list: (botId: string) => ["conversations", botId] as const,
  messages: (conversationId: string) => ["messages", conversationId] as const,
};

export const conversationQueries = {
  list: (botId: string) =>
    queryOptions({
      queryKey: conversationKeys.list(botId),
      queryFn: () => fetchConversations(botId),
    }),
  messages: (conversationId: string) =>
    queryOptions({
      queryKey: conversationKeys.messages(conversationId),
      queryFn: () => fetchMessages(conversationId),
    }),
};
