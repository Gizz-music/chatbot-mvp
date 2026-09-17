import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { getPlanById } from "@/entities/plan";
import { confirmCheckout, readCheckoutSession } from "@/features/billing";
import { ROUTES } from "@/shared/config/routes";
import { formatPrice } from "@/shared/lib/format-price";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Container } from "@/shared/ui/container";
import { Input } from "@/shared/ui/input";
import { PageLoader } from "@/shared/ui/page-loader";
import { StateMessage } from "@/shared/ui/state-message";

import styles from "./CheckoutPage.module.css";

export const CheckoutPage = () => {
  const [params] = useSearchParams();
  const sessionId = params.get("session") ?? "";

  const sessionQuery = useQuery({
    queryKey: ["checkout-session", sessionId],
    queryFn: () => readCheckoutSession(sessionId),
    enabled: sessionId.length > 0,
    retry: false,
  });

  const pay = useMutation({
    mutationFn: () => confirmCheckout(sessionId),
    onSuccess: (session) => {
      window.location.assign(session.url);
    },
  });

  if (!sessionId) {
    return (
      <Container className={styles.page}>
        <StateMessage
          description="Open checkout from Billing so we can load the session."
          title="Missing checkout session"
        />
      </Container>
    );
  }

  if (sessionQuery.isPending) {
    return <PageLoader label="Loading checkout…" />;
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <Container className={styles.page}>
        <StateMessage
          description={sessionQuery.error?.message}
          title="This checkout session has expired"
          tone="error"
        >
          <Link className={styles.cancel} to={ROUTES.billing}>
            Back to billing
          </Link>
        </StateMessage>
      </Container>
    );
  }

  const session = sessionQuery.data;
  const plan = getPlanById(session.plan);
  const period = session.interval === "yearly" ? "year" : "month";
  const amount = formatPrice(session.amountCents);

  return (
    <Container className={styles.page}>
      <Card>
        <p className={styles.kicker}>Mock Stripe Checkout</p>
        <h1 className={styles.title}>{plan.name}</h1>
        <p className={styles.amount}>
          {amount} <span>/ {period}</span>
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            pay.mutate();
          }}
        >
          <Input
            autoComplete="cc-number"
            defaultValue="4242 4242 4242 4242"
            label="Card number"
            name="card"
          />
          <div className={styles.row}>
            <Input
              autoComplete="cc-exp"
              defaultValue="12 / 34"
              label="Expiry"
              name="expiry"
            />
            <Input
              autoComplete="cc-csc"
              defaultValue="123"
              label="CVC"
              name="cvc"
            />
          </div>
          {pay.error ? (
            <p className={styles.error} role="alert">
              {pay.error.message}
            </p>
          ) : null}
          <Button disabled={pay.isPending} type="submit">
            {pay.isPending ? "Paying…" : `Pay ${amount}`}
          </Button>
        </form>
        <a className={styles.cancel} href={session.cancelUrl}>
          Cancel
        </a>
        <p className={styles.note}>
          Test mode. The card is ignored and nothing is charged.
        </p>
      </Card>
    </Container>
  );
};
