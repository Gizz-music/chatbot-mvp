import type { InputHTMLAttributes } from "react";

import { cx } from "@/shared/lib/cx";

import styles from "./Input.module.css";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Input = ({ label, id, className, ...props }: InputProps) => {
  return (
    <label className={styles.field} htmlFor={id}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <input id={id} className={cx(styles.input, className)} {...props} />
    </label>
  );
};
