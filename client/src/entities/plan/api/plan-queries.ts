import { queryOptions } from "@tanstack/react-query";

import {
  fetchInvoices,
  fetchPlanUsage,
  fetchSubscription,
} from "./plan-api";

export const planKeys = {
  all: ["plan"] as const,
  subscription: ["plan", "subscription"] as const,
  usage: ["plan", "usage"] as const,
  invoices: ["plan", "invoices"] as const,
};

export const planQueries = {
  subscription: () =>
    queryOptions({
      queryKey: planKeys.subscription,
      queryFn: fetchSubscription,
    }),
  usage: () =>
    queryOptions({
      queryKey: planKeys.usage,
      queryFn: fetchPlanUsage,
    }),
  invoices: () =>
    queryOptions({
      queryKey: planKeys.invoices,
      queryFn: fetchInvoices,
    }),
};
