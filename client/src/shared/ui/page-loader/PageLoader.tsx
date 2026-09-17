import styles from "./PageLoader.module.css";

type PageLoaderProps = {
  label?: string;
};

export const PageLoader = ({ label = "Loading…" }: PageLoaderProps) => {
  return (
    <div className={styles.loader} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
};
