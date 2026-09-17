import { supabase } from "@/shared/api";
import { env } from "@/shared/config/env";

export type WidgetConfig = {
  name: string;
  welcomeMessage: string;
  accentColor: string;
  showBranding: boolean;
};

const readError = async (response: Response): Promise<string> => {
  const payload: unknown = await response.json().catch(() => null);

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return `Widget failed with status ${response.status}.`;
};

const accessToken = async (): Promise<string> => {
  const { data } = await supabase.auth.getSession();

  return data.session?.access_token ?? env.supabaseAnonKey;
};

/** Public widget config used by the iframe and the landing-page demo. */
export const fetchWidgetConfig = async (
  publicKey: string,
  embedOrigin: string,
  signal?: AbortSignal,
): Promise<WidgetConfig> => {
  const response = await fetch(
    `${env.supabaseUrl}/functions/v1/widget-chat?bot=${encodeURIComponent(publicKey)}`,
    {
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        apikey: env.supabaseAnonKey,
        "X-Embed-Origin": embedOrigin,
      },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const payload = (await response.json()) as Partial<WidgetConfig>;

  if (
    typeof payload.name !== "string" ||
    typeof payload.welcomeMessage !== "string" ||
    typeof payload.accentColor !== "string"
  ) {
    throw new Error("The widget config was incomplete.");
  }

  return {
    name: payload.name,
    welcomeMessage: payload.welcomeMessage,
    accentColor: payload.accentColor,
    showBranding: payload.showBranding === true,
  };
};
