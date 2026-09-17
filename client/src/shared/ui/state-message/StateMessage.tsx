import type { ReactNode } from "react";

import { cx } from "@/shared/lib/cx";

import styles from "./StateMessage.module.css";

type StateMessageTone = "neutral" | "error";

type StateMessageProps = {
  /** `error` announces itself to screen readers, `neutral` stays quiet. */
  tone?: StateMessageTone;
  title: string;
  description?: string;
  /** Recovery action: a retry button, a link back, a call to action. */
  children?: ReactNode;
};

/** Inline placeholder for the empty and failed states of a data panel. */
export const StateMessage = ({
  tone = "neutral",
  title,
  description,
  children,
}: StateMessageProps) => {
  return (
    <div
      className={cx(styles.state, tone === "error" && styles.error)}
      role={tone === "error" ? "alert" : undefined}
    >
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {children}
    </div>
  );
};
