import type { TextareaHTMLAttributes } from "react";

import { cx } from "@/shared/lib/cx";

import styles from "./Textarea.module.css";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export const Textarea = ({
  label,
  id,
  className,
  rows = 4,
  ...props
}: TextareaProps) => {
  return (
    <label className={styles.field} htmlFor={id}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <textarea
        id={id}
        rows={rows}
        className={cx(styles.textarea, className)}
        {...props}
      />
    </label>
  );
};
