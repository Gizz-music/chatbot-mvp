import { useToast } from "./use-toast";

import styles from "./ToastViewport.module.css";

export const ToastViewport = () => {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={styles.stack} aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <p
          className={toast.tone === "error" ? styles.error : styles.success}
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            className={styles.close}
            onClick={() => dismiss(toast.id)}
            type="button"
          >
            ×
          </button>
        </p>
      ))}
    </div>
  );
};
