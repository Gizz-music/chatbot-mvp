import { supabase } from "@/shared/api";

import { DEFAULT_PLAN, getPlanById } from "../model/plans";
import type {
  BillingInterval,
  Invoice,
  InvoiceStatus,
  PlanId,
  PlanUsage,
  Subscription,
  SubscriptionStatus,
} from "../model/types";

type SubscriptionRow = {
  plan: string;
  status: SubscriptionStatus;
  billing_interval: BillingInterval | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

type UsageRow = {
  messages_used: number;
};

type InvoiceRow = {
  id: string;
  number: string;
  plan: string;
  billing_interval: BillingInterval;
  amount_cents: number;
  currency: string;
  status: InvoiceStatus;
  description: string;
  paid_at: string | null;
  created_at: string;
};

const isPlanId = (value: string): value is PlanId =>
  value === "free" || value === "pro" || value === "business";

/** UTC calendar month the usage counter is keyed on. */
export const currentPeriodStart = (): string => {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `${now.getUTCFullYear()}-${month}-01`;
};

const toSubscription = (row: SubscriptionRow | null): Subscription => {
  const planId = row && isPlanId(row.plan) ? row.plan : DEFAULT_PLAN.id;

  return {
    planId,
    status: row?.status ?? "active",
    interval: row?.billing_interval ?? "monthly",
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
  };
};

export const fetchSubscription = async (): Promise<Subscription> => {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "plan, status, billing_interval, current_period_end, cancel_at_period_end",
    )
    .maybeSingle<SubscriptionRow>();

  if (error) {
    throw new Error(error.message);
  }

  return toSubscription(data);
};

export const fetchPlanUsage = async (): Promise<Pick<PlanUsage, "messages">> => {
  const { data, error } = await supabase
    .from("usage_counters")
    .select("messages_used")
    .eq("period_start", currentPeriodStart())
    .maybeSingle<UsageRow>();

  if (error) {
    throw new Error(error.message);
  }

  return { messages: data?.messages_used ?? 0 };
};

const toInvoice = (row: InvoiceRow): Invoice => ({
  id: row.id,
  number: row.number,
  planId: getPlanById(row.plan).id,
  interval: row.billing_interval,
  amountCents: row.amount_cents,
  currency: row.currency,
  status: row.status,
  description: row.description,
  paidAt: row.paid_at,
  createdAt: row.created_at,
});

export const fetchInvoices = async (): Promise<Invoice[]> => {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, number, plan, billing_interval, amount_cents, currency, status, description, paid_at, created_at",
    )
    .order("created_at", { ascending: false })
    .returns<InvoiceRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toInvoice);
};
