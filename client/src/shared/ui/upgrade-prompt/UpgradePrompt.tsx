import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "@/shared/config/routes";
import { cx } from "@/shared/lib/cx";

import styles from "./UpgradePrompt.module.css";

type UpgradePromptProps = {
  title?: string;
  description?: string;
};

export const UpgradePrompt = ({
  title = "Upgrade to Pro",
  description,
}: UpgradePromptProps) => {
  return (
    <div className={styles.prompt}>
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      <Link className={styles.link} to={ROUTES.billing}>
        View plans
      </Link>
    </div>
  );
};

type GatedProps = {
  locked: boolean;
  title?: string;
  description?: string;
  children: ReactNode;
};

/**
 * Keeps gated UI visible (so the user sees what they would get) and covers it
 * with an upgrade overlay instead of hiding the controls.
 */
export const Gated = ({
  locked,
  title,
  description,
  children,
}: GatedProps) => {
  if (!locked) {
    return children;
  }

  return (
    <div className={styles.gate}>
      <div className={cx(styles.dimmed)} inert>
        {children}
      </div>
      <div className={styles.overlay}>
        <UpgradePrompt description={description} title={title} />
      </div>
    </div>
  );
};
