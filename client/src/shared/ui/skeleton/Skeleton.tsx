import type { CSSProperties } from "react";

import { cx } from "@/shared/lib/cx";

import styles from "./Skeleton.module.css";

type SkeletonProps = {
  className?: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
};

export const Skeleton = ({ className, width, height }: SkeletonProps) => {
  return (
    <span
      aria-hidden="true"
      className={cx(styles.block, className)}
      style={{ width, height }}
    />
  );
};
