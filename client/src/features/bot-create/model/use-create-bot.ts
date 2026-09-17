import { useMutation, useQueryClient } from "@tanstack/react-query";

import { botKeys, createBot, type Bot, type BotDraft } from "@/entities/bot";

export const useCreateBot = () => {
  const queryClient = useQueryClient();

  return useMutation<Bot, Error, BotDraft>({
    mutationFn: createBot,
    onSuccess: async (bot) => {
      // The fresh row is already here, so only the list needs a refetch.
      queryClient.setQueryData(botKeys.detail(bot.id), bot);
      await queryClient.invalidateQueries({
        queryKey: botKeys.all,
        exact: true,
      });
    },
  });
};
