import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/shared/lib/cx";

import styles from "./Container.module.css";

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  narrow?: boolean;
};

export const Container = ({
  children,
  narrow = false,
  className,
  ...props
}: ContainerProps) => {
  return (
    <div
      className={cx(styles.container, narrow && styles.narrow, className)}
      {...props}
    >
      {children}
    </div>
  );
};
