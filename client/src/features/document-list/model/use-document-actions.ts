import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  deleteDocument,
  documentKeys,
  requestIngestion,
  type KnowledgeDocument,
} from "@/entities/document";

export const useDeleteDocument = (botId: string) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, KnowledgeDocument>({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: documentKeys.list(botId),
      });
    },
  });
};

/** Re-runs ingestion for a document that failed or never started. */
export const useRetryIngestion = (botId: string) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: requestIngestion,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: documentKeys.list(botId),
      });
    },
  });
};
