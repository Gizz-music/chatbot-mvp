import { createBrowserRouter } from "react-router-dom";

import { AuthCallbackPage, AuthPage } from "@/pages/auth";
import { BillingPage } from "@/pages/billing";
import { BotChatPage } from "@/pages/bot-chat";
import { BotDetailsPage } from "@/pages/bot-details";
import { BotInsightsPage } from "@/pages/bot-insights";
import { CheckoutPage } from "@/pages/checkout";
import { DashboardPage } from "@/pages/dashboard";
import { LandingPage } from "@/pages/landing";
import { NotFoundPage } from "@/pages/not-found";
import { ROUTES } from "@/shared/config/routes";

import { DashboardLayout } from "../layouts/DashboardLayout";
import { RootLayout } from "../layouts/RootLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

const errorElement = <RouteErrorBoundary />;

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement,
    children: [
      {
        path: ROUTES.landing,
        element: <LandingPage />,
      },
      {
        path: ROUTES.login,
        element: <AuthPage />,
      },
      {
        path: ROUTES.authCallback,
        element: <AuthCallbackPage />,
      },
      {
        path: ROUTES.checkout,
        element: <CheckoutPage />,
      },
      {
        path: ROUTES.notFound,
        element: <NotFoundPage />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    errorElement,
    children: [
      {
        path: ROUTES.dashboard,
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: ROUTES.botDetails,
            element: <BotDetailsPage />,
          },
          {
            path: ROUTES.botChat,
            element: <BotChatPage />,
          },
          {
            path: ROUTES.botInsights,
            element: <BotInsightsPage />,
          },
          {
            path: ROUTES.billing,
            element: <BillingPage />,
          },
        ],
      },
    ],
  },
]);
