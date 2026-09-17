import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import { createQueryClient } from "@/shared/api";

import { WidgetApp } from "./WidgetApp";

import "@/app/styles/global.css";
import "./widget.css";

const queryClient = createQueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WidgetApp />
    </QueryClientProvider>
  </StrictMode>,
);
