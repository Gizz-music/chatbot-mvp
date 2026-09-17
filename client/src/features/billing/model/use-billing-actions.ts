import { useMutation, useQueryClient } from "@tanstack/react-query";

import { planKeys } from "@/entities/plan";

import {
  cancelSubscription,
  startCheckout,
  type CheckoutInput,
} from "../api/checkout-api";

export const useStartCheckout = () => {
  return useMutation({
    mutationFn: async (input: CheckoutInput) => {
      const session = await startCheckout(input);
      window.location.assign(session.url);
    },
  });
};

export const useCancelSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: planKeys.all });
    },
  });
};
