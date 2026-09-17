import { useState } from "react";
import { Link } from "react-router-dom";

import {
  PLANS,
  featureLinesOf,
  monthlyEquivalentOf,
  type BillingInterval,
  type Plan,
} from "@/entities/plan";
import { useSession } from "@/entities/session";
import { DemoWidget } from "@/features/demo-widget";
import { snippetOf } from "@/features/embed-snippet";
import { env } from "@/shared/config/env";
import { ROUTES } from "@/shared/config/routes";
import { cx } from "@/shared/lib/cx";
import { formatPrice } from "@/shared/lib/format-price";
import { Button } from "@/shared/ui/button";
import { Container } from "@/shared/ui/container";

import {
  DEMO,
  FAQ,
  FEATURES,
  FINAL_CTA,
  HERO,
  PRICING,
  SNIPPET,
  STEPS,
} from "../model/content";

import styles from "./LandingPage.module.css";

const signupPath = ROUTES.login;

const primaryPathOf = (authenticated: boolean): string =>
  authenticated ? ROUTES.dashboard : signupPath;

const primaryLabelOf = (
  authenticated: boolean,
  labels: { guest: string; member: string },
): string => (authenticated ? labels.member : labels.guest);

const FeatureIcon = ({ id }: { id: (typeof FEATURES)[number]["id"] }) => {
  const icons: Record<(typeof FEATURES)[number]["id"], string> = {
    citations:
      "M7 3.5h10A2.5 2.5 0 0 1 19.5 6v12A2.5 2.5 0 0 1 17 20.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5Zm0 4h10M7 12h6",
    embed: "M8.5 8 5 12l3.5 4M15.5 8 19 12l-3.5 4M13 7l-2 10",
    domains: "M12 4.5 19 8v5.2c0 4-3 6.6-7 7.8-4-1.2-7-3.8-7-7.8V8l7-3.5Z",
    look: "M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3M7.4 7.4l2.1 2.1M14.5 14.5l2.1 2.1M16.6 7.4l-2.1 2.1M9.5 14.5l-2.1 2.1M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4Z",
    history: "M5 8.5A7 7 0 1 1 4.8 14M5 8.5V5M5 8.5h3.4M12 9v4l2.5 1.5",
    plans: "M5 7.5h14M5 12h14M5 16.5h9",
  };

  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d={icons[id]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
};

const SnippetBlock = () => {
  const [copied, setCopied] = useState(false);
  const publicKey = env.demoBotPublicKey ?? SNIPPET.placeholderKey;
  const snippet = snippetOf(window.location.origin, publicKey);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      const area = document.createElement("textarea");
      area.value = snippet;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={styles.snippetFrame}>
      <pre className={styles.code}>
        <code>{snippet}</code>
      </pre>
      <Button onClick={() => void copy()} variant="secondary">
        {copied ? "Copied" : "Copy snippet"}
      </Button>
      {copied ? (
        <p className={styles.copied} role="status">
          Copied to clipboard.
        </p>
      ) : null}
    </div>
  );
};

const PricingSection = ({ authenticated }: { authenticated: boolean }) => {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const ctaTo = primaryPathOf(authenticated);

  return (
    <section className={styles.section} id="pricing">
      <header className={styles.sectionHead}>
        <p className={styles.kicker}>{PRICING.kicker}</p>
        <h2>{PRICING.title}</h2>
        <p>{PRICING.body}</p>
      </header>
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
      <ul className={styles.plans}>
        {PLANS.map((plan) => (
          <li
            className={cx(styles.plan, plan.recommended && styles.featured)}
            key={plan.id}
          >
            {plan.recommended ? (
              <p className={styles.badge}>Recommended</p>
            ) : null}
            <h3 className={styles.planName}>{plan.name}</h3>
            <p className={styles.planPrice}>
              {formatPrice(
                interval === "yearly"
                  ? monthlyEquivalentOf(plan)
                  : plan.priceMonthly,
              )}
              <span className={styles.planPeriod}>/mo</span>
            </p>
            <p className={styles.planDescription}>
              {interval === "yearly" && plan.priceYearly > 0
                ? `Billed annually at ${formatPrice(plan.priceYearly)}`
                : plan.description}
            </p>
            <ul className={styles.planFeatures}>
              {featureLinesOf(plan).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <Link
              className={
                plan.recommended ? styles.linkButton : styles.secondaryLink
              }
              to={ctaTo}
            >
              {planCtaOf(plan, authenticated)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

const planCtaOf = (plan: Plan, authenticated: boolean): string => {
  if (authenticated) {
    return "Manage plan";
  }

  return plan.id === "free" ? "Start free" : `Get ${plan.name}`;
};

export const LandingPage = () => {
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const primaryTo = primaryPathOf(authenticated);
  const primaryLabel = primaryLabelOf(authenticated, {
    guest: HERO.primary,
    member: HERO.primaryAuthenticated,
  });
  const finalLabel = primaryLabelOf(authenticated, {
    guest: FINAL_CTA.action,
    member: FINAL_CTA.actionAuthenticated,
  });

  return (
    <div className={styles.page}>
      <Container>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{HERO.kicker}</p>
            <h1>{HERO.title}</h1>
            <p className={styles.lede}>{HERO.body}</p>
            <div className={styles.actions}>
              <Link className={styles.linkButton} to={primaryTo}>
                {primaryLabel}
              </Link>
              <a className={styles.secondaryLink} href="#demo">
                {HERO.secondary}
              </a>
            </div>
          </div>
          <img
            alt="A documentation site beside a chat widget answering how to embed the bot."
            className={styles.heroImage}
            fetchPriority="high"
            height={900}
            src="/hero.png"
            width={1600}
          />
        </section>
      </Container>

      <Container>
        <section className={styles.section} id="how-it-works">
          <header className={styles.sectionHead}>
            <p className={styles.kicker}>How it works</p>
            <h2>Live in three steps: upload, train, embed.</h2>
            <p>
              No model training on your side. Index your files, then drop the
              widget on the site that needs answers.
            </p>
          </header>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li className={styles.step} key={step.id}>
                <span className={styles.stepIndex}>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </Container>

      <Container>
        <section className={styles.section} id="features">
          <header className={styles.sectionHead}>
            <p className={styles.kicker}>Product</p>
            <h2>Everything you need to ship the widget.</h2>
          </header>
          <ul className={styles.features}>
            {FEATURES.map((feature) => (
              <li className={styles.feature} key={feature.id}>
                <span className={styles.iconWrap}>
                  <FeatureIcon id={feature.id} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </Container>

      <Container>
        <section className={styles.section} id="demo">
          <div className={styles.demoGrid}>
            <header className={styles.sectionHead}>
              <p className={styles.kicker}>{DEMO.kicker}</p>
              <h2>{DEMO.title}</h2>
              <p>{DEMO.body}</p>
              <p className={styles.promptLabel}>Try asking</p>
              <ul className={styles.prompts}>
                {DEMO.prompts.map((prompt) => (
                  <li key={prompt}>
                    <span className={styles.prompt}>{prompt}</span>
                  </li>
                ))}
              </ul>
            </header>
            <DemoWidget />
          </div>
        </section>
      </Container>

      <Container>
        <section className={styles.section} id="embed">
          <header className={styles.sectionHead}>
            <p className={styles.kicker}>{SNIPPET.kicker}</p>
            <h2>{SNIPPET.title}</h2>
            <p>{SNIPPET.body}</p>
          </header>
          <SnippetBlock />
        </section>
      </Container>

      <Container>
        <PricingSection authenticated={authenticated} />
      </Container>

      <Container>
        <section className={styles.section} id="faq">
          <header className={styles.sectionHead}>
            <p className={styles.kicker}>FAQ</p>
            <h2>Questions before you sign up.</h2>
          </header>
          <div className={styles.faq}>
            {FAQ.map((item) => (
              <details className={styles.faqItem} key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </Container>

      <section className={styles.final} id="start">
        <Container className={styles.finalInner}>
          <h2>{FINAL_CTA.title}</h2>
          <p>{FINAL_CTA.body}</p>
          <Link className={styles.linkButton} to={primaryTo}>
            {finalLabel}
          </Link>
        </Container>
      </section>
    </div>
  );
};
