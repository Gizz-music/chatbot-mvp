export const ROUTES = {
  landing: "/",
  login: "/login",
  authCallback: "/auth/callback",
  dashboard: "/dashboard",
  botDetails: "/dashboard/bot/:id",
  botChat: "/dashboard/bot/:id/chat",
  botInsights: "/dashboard/bot/:id/insights",
  billing: "/dashboard/billing",
  checkout: "/checkout",
  notFound: "*",
} as const;

export const buildBotDetailsPath = (id: string) =>
  ROUTES.botDetails.replace(":id", id);

export const buildBotChatPath = (id: string) =>
  ROUTES.botChat.replace(":id", id);

export const buildBotInsightsPath = (id: string) =>
  ROUTES.botInsights.replace(":id", id);
