import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import {
  PLANS,
  comparePlans,
  featureLinesOf,
  monthlyEquivalentOf,
  planQueries,
  priceOf,
  useEntitlements,
  type BillingInterval,
  type Invoice,
  type Plan,
  type PlanId,
} from "@/entities/plan";
import { useCancelSubscription, useStartCheckout } from "@/features/billing";
import { cx } from "@/shared/lib/cx";
import { formatDate } from "@/shared/lib/format-date";
import { formatPrice } from "@/shared/lib/format-price";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Modal } from "@/shared/ui/modal";
import { PageLoader } from "@/shared/ui/page-loader";
import { StateMessage } from "@/shared/ui/state-message";
import { useToast } from "@/shared/ui/toast";

import styles from "./BillingPage.module.css";

type PendingAction =
  | { type: "checkout"; plan: Plan; interval: BillingInterval }
  | { type: "cancel" };

const actionLabel = (
  currentId: PlanId,
  currentInterval: BillingInterval,
  plan: Plan,
  interval: BillingInterval,
): string => {
  if (
    plan.id === currentId &&
    (plan.id === "free" || interval === currentInterval)
  ) {
    return "Current plan";
  }

  if (plan.id === currentId) {
    return interval === "yearly"
      ? "Switch to yearly billing"
      : "Switch to monthly billing";
  }

  if (plan.id === "free") {
    return "Downgrade";
  }

  return comparePlans(currentId, plan.id) > 0 ? "Upgrade" : "Downgrade";
};

const confirmCopy = (
  action: PendingAction,
  currentId: PlanId,
): { title: string; body: string } => {
  if (action.type === "cancel") {
    return {
      title: "Cancel subscription?",
      body: "You'll be moved to Free immediately. Widget customization and extra bots will lock until you upgrade again.",
    };
  }

  if (action.plan.id === "free") {
    return {
      title: "Switch to Free?",
      body: "Widget customization, extra bots and the higher message allowance go away as soon as you confirm.",
    };
  }

  const price = formatPrice(priceOf(action.plan, action.interval));
  const period = action.interval === "yearly" ? "year" : "month";
  const verb =
    comparePlans(currentId, action.plan.id) > 0 ? "Upgrade" : "Change";

  return {
    title: `${verb} to ${action.plan.name}?`,
    body: `You'll go through a mock checkout for ${price} / ${period}. No real card is charged.`,
  };
};

const InvoiceHistory = ({ invoices }: { invoices: Invoice[] }) => {
  if (invoices.length === 0) {
    return (
      <p className={styles.empty}>
        No invoices yet. Confirm a plan change above — a mock invoice appears
        here so you can see the history.
      </p>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Date</th>
            <th>Description</th>
            <th>Status</th>
            <th className={styles.amount}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>
                <code>{invoice.number}</code>
              </td>
              <td>{formatDate(invoice.paidAt ?? invoice.createdAt)}</td>
              <td>{invoice.description}</td>
              <td className={styles.capitalize}>{invoice.status}</td>
              <td className={styles.amount}>
                {formatPrice(invoice.amountCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const BillingPage = () => {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [searchParams] = useSearchParams();
  const entitlements = useEntitlements();
  const invoicesQuery = useQuery(planQueries.invoices());
  const checkout = useStartCheckout();
  const cancel = useCancelSubscription();
  const toast = useToast();

  const checkoutFlash = searchParams.get("checkout");
  const currentId = entitlements.plan.id;
  const currentInterval = entitlements.subscription?.interval ?? "monthly";
  const periodEnd = entitlements.subscription?.currentPeriodEnd;
  const isPaid = currentId !== "free";

  const confirmBusy = checkout.isPending || cancel.isPending;
  const confirmError = checkout.error ?? cancel.error;

  const periodLabel = useMemo(() => {
    if (!isPaid) {
      return "Upgrade any time — nothing is billed on Free.";
    }

    if (entitlements.subscription?.status === "canceled") {
      return periodEnd
        ? `Canceled. Access stays until ${formatDate(periodEnd)}.`
        : "Canceled.";
    }

    return periodEnd
      ? `Renews on ${formatDate(periodEnd)} · billed ${currentInterval}.`
      : `Billed ${currentInterval}.`;
  }, [currentInterval, isPaid, periodEnd, entitlements.subscription?.status]);

  const handleConfirm = () => {
    if (!pending) {
      return;
    }

    if (pending.type === "cancel") {
      cancel.mutate(undefined, {
        onSuccess: () => {
          setPending(null);
          toast.success("Subscription canceled. You are on Free.");
        },
      });
      return;
    }

    checkout.mutate({
      planId: pending.plan.id,
      interval: pending.interval,
    });
  };

  if (entitlements.isPending) {
    return <PageLoader label="Loading billing…" />;
  }

  if (entitlements.isError) {
    return (
      <StateMessage
        description={entitlements.error?.message}
        title="Could not load your plan"
        tone="error"
      />
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Current plan</p>
          <h1>{entitlements.plan.name}</h1>
          <p className={styles.renewal}>{periodLabel}</p>
        </div>
        {isPaid ? (
          <Button
            onClick={() => setPending({ type: "cancel" })}
            variant="ghost"
          >
            Cancel subscription
          </Button>
        ) : null}
      </header>

      {checkoutFlash === "success" ? (
        <p className={styles.flash} role="status">
          Plan updated. This was a mock payment — nothing was charged.
        </p>
      ) : null}
      {checkoutFlash === "canceled" ? (
        <p className={styles.notice} role="status">
          Checkout was canceled. Your plan is unchanged.
        </p>
      ) : null}

      <div className={styles.toggle} role="group" aria-label="Billing interval">
        <button
          aria-pressed={interval === "monthly"}
          className={
            interval === "monthly" ? styles.toggleOn : styles.toggleOff
          }
          onClick={() => setInterval("monthly")}
          type="button"
        >
          Monthly
        </button>
        <button
          aria-pressed={interval === "yearly"}
          className={interval === "yearly" ? styles.toggleOn : styles.toggleOff}
          onClick={() => setInterval("yearly")}
          type="button"
        >
          Yearly
          <span className={styles.save}>Save 20%</span>
        </button>
      </div>

      <div className={styles.grid}>
        {PLANS.map((plan) => {
          const isCurrentPlan = plan.id === currentId;
          const isCurrentOption =
            isCurrentPlan &&
            (plan.id === "free" || interval === currentInterval);
          const label = actionLabel(currentId, currentInterval, plan, interval);
          const amount =
            interval === "yearly"
              ? monthlyEquivalentOf(plan)
              : plan.priceMonthly;

          return (
            <Card
              className={cx(
                styles.planCard,
                plan.recommended && styles.recommended,
              )}
              key={plan.id}
              title={plan.name}
            >
              {plan.recommended ? (
                <p className={styles.badge}>Recommended</p>
              ) : null}
              {isCurrentPlan ? (
                <p className={styles.current}>Current plan</p>
              ) : null}
              <p className={styles.price}>
                {formatPrice(amount)}
                <span className={styles.period}>/mo</span>
              </p>
              {interval === "yearly" && plan.priceYearly > 0 ? (
                <p className={styles.billed}>
                  Billed annually at {formatPrice(plan.priceYearly)}
                </p>
              ) : (
                <p className={styles.billed}>{plan.description}</p>
              )}
              <ul className={styles.features}>
                {featureLinesOf(plan).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Button
                disabled={isCurrentOption}
                onClick={() => setPending({ type: "checkout", plan, interval })}
                variant={plan.recommended ? "primary" : "secondary"}
              >
                {label}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card title="Payment history">
        {invoicesQuery.isPending ? (
          <PageLoader label="Loading invoices…" />
        ) : invoicesQuery.isError ? (
          <StateMessage
            description={invoicesQuery.error.message}
            title="Could not load invoices"
            tone="error"
          />
        ) : (
          <InvoiceHistory invoices={invoicesQuery.data} />
        )}
      </Card>

      {pending ? (
        <Modal
          onClose={() => {
            if (!confirmBusy) {
              setPending(null);
            }
          }}
          title={confirmCopy(pending, currentId).title}
        >
          <p className={styles.confirmBody}>
            {confirmCopy(pending, currentId).body}
          </p>
          {confirmError ? (
            <p className={styles.error} role="alert">
              {confirmError.message}
            </p>
          ) : null}
          <div className={styles.confirmActions}>
            <Button
              disabled={confirmBusy}
              onClick={() => setPending(null)}
              variant="secondary"
            >
              Keep plan
            </Button>
            <Button
              disabled={confirmBusy}
              onClick={handleConfirm}
              variant={pending.type === "cancel" ? "danger" : "primary"}
            >
              {confirmBusy ? "Working…" : "Confirm"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
};
