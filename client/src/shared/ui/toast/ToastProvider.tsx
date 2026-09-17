import { useCallback, useMemo, useState, type ReactNode } from "react";

import { ToastContext, type Toast, type ToastTone } from "./toast-context";

const TOAST_MS = 4_000;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current.slice(-4), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toasts,
      push,
      success: (message: string) => push(message, "success"),
      error: (message: string) => push(message, "error"),
      dismiss,
    }),
    [dismiss, push, toasts],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
};
