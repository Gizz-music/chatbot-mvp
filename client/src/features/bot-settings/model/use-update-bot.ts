import { useMutation, useQueryClient } from "@tanstack/react-query";

import { botKeys, updateBot, type Bot, type BotSettings } from "@/entities/bot";

export const useUpdateBot = (botId: string) => {
  const queryClient = useQueryClient();

  return useMutation<Bot, Error, BotSettings>({
    mutationFn: (settings) => updateBot(botId, settings),
    onSuccess: async (bot) => {
      queryClient.setQueryData(botKeys.detail(bot.id), bot);
      await queryClient.invalidateQueries({
        queryKey: botKeys.all,
        exact: true,
      });
    },
  });
};
