import { useMutation, useQueryClient } from "@tanstack/react-query";

import { botKeys, deleteBot } from "@/entities/bot";

export const useDeleteBot = (botId: string) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error>({
    mutationFn: () => deleteBot(botId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: botKeys.detail(botId) });
      await queryClient.invalidateQueries({
        queryKey: botKeys.all,
        exact: true,
      });
    },
  });
};
