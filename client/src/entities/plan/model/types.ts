export type PlanId = "free" | "pro" | "business";

export type BillingInterval = "monthly" | "yearly";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled";

export type PlanFeature =
  | "removeBranding"
  | "widgetCustomization"
  | "domainAllowlist";

export type PlanResource = "bots" | "messages" | "documents";

export type PlanFeatureFlags = Record<PlanFeature, boolean>;

export type PlanLimits = {
  planId: PlanId;
  maxBots: number;
  maxFileBytes: number;
  /** `null` means the plan sets no cap on the number of documents. */
  maxDocuments: number | null;
  maxMessages: number;
  features: PlanFeatureFlags;
};

export type Plan = {
  id: PlanId;
  name: string;
  /** Monthly price in cents. */
  priceMonthly: number;
  /** Prepaid annual price in cents. Free stays 0. */
  priceYearly: number;
  description: string;
  recommended: boolean;
  limits: PlanLimits;
};

export type Subscription = {
  planId: PlanId;
  status: SubscriptionStatus;
  interval: BillingInterval;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type PlanUsage = {
  bots: number;
  messages: number;
};

export type InvoiceStatus = "paid" | "open" | "void";

export type Invoice = {
  id: string;
  number: string;
  planId: PlanId;
  interval: BillingInterval;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  description: string;
  paidAt: string | null;
  createdAt: string;
};
