import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/shared/lib/cx";

import styles from "./Card.module.css";

type CardProps = HTMLAttributes<HTMLElement> & {
  title?: string;
  children: ReactNode;
};

export const Card = ({ title, children, className, ...props }: CardProps) => {
  return (
    <article className={cx(styles.card, className)} {...props}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      <div className={styles.body}>{children}</div>
    </article>
  );
};
