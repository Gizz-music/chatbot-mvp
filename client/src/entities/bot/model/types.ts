export type BotStatus = "draft" | "active";

/** Everything the owner can edit from the dashboard. */
export type BotSettings = {
  name: string;
  description: string;
  systemPrompt: string;
  welcomeMessage: string;
  /** Hex colour of the widget, e.g. `#4f46e5`. */
  accentColor: string;
  showBranding: boolean;
  status: BotStatus;
  /** Hosts allowed to embed the widget. Empty means "no restriction yet". */
  allowedDomains: string[];
};

export type Bot = BotSettings & {
  id: string;
  /** Public identifier for the embed snippet, deliberately not the row id. */
  publicKey: string;
  createdAt: string;
};

/** What the create modal asks for; the rest comes from database defaults. */
export type BotDraft = Pick<BotSettings, "name" | "description">;
