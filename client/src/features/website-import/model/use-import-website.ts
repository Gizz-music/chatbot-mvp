import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createUrlDocument,
  documentKeys,
  requestIngestion,
} from "@/entities/document";

export const useImportWebsite = (botId: string) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (url) => {
      const document = await createUrlDocument(botId, url);

      await queryClient.invalidateQueries({
        queryKey: documentKeys.list(botId),
      });

      await requestIngestion(document.id);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: documentKeys.list(botId),
      });
    },
  });
};
