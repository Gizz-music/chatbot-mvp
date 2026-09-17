import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { SessionProvider } from "@/entities/session";
import { createQueryClient } from "@/shared/api";
import { ToastProvider, ToastViewport } from "@/shared/ui/toast";

import { router } from "./router";

export const App = () => {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
        <ToastViewport />
      </ToastProvider>
    </QueryClientProvider>
  );
};
