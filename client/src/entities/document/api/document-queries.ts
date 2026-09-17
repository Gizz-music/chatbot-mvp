import { queryOptions } from "@tanstack/react-query";

import { isDocumentPending } from "../model/types";

import { fetchDocuments } from "./document-api";

/** How often to ask again while the Edge Function is still working. */
const POLL_INTERVAL_MS = 2_000;

export const documentKeys = {
  all: ["documents"] as const,
  list: (botId: string) => ["documents", botId] as const,
};

export const documentQueries = {
  list: (botId: string) =>
    queryOptions({
      queryKey: documentKeys.list(botId),
      queryFn: () => fetchDocuments(botId),
      // Ingestion runs outside the request, so the status arrives by polling
      // and the interval switches itself off once nothing is in flight.
      refetchInterval: (query) =>
        query.state.data?.some(isDocumentPending) ? POLL_INTERVAL_MS : false,
      staleTime: 0,
    }),
};
