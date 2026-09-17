import { createContext } from "react";

export type ToastTone = "success" | "error";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

export type ToastContextValue = {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: (id: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
