export const EMBED_SOURCE = "chatbot-embed";
export const WIDGET_SOURCE = "chatbot-widget";

export const PANEL_SIZE = {
  width: 380,
  height: 640,
} as const;

type HostMessage = {
  source: typeof EMBED_SOURCE;
  type: "host" | "open" | "close";
};

type WidgetMessage =
  | {
      source: typeof WIDGET_SOURCE;
      type: "ready";
      accentColor?: string;
    }
  | {
      source: typeof WIDGET_SOURCE;
      type: "resize";
      width: number;
      height: number;
    }
  | {
      source: typeof WIDGET_SOURCE;
      type: "close";
    };

const isHostMessage = (value: unknown): value is HostMessage =>
  typeof value === "object" &&
  value !== null &&
  "source" in value &&
  value.source === EMBED_SOURCE &&
  "type" in value &&
  (value.type === "host" || value.type === "open" || value.type === "close");

export const publicKeyFromSearch = (): string => {
  const key = new URLSearchParams(window.location.search).get("bot") ?? "";

  return key.trim();
};

/**
 * Parent origin from `postMessage` (`event.origin` cannot be spoofed by the
 * iframe). Falls back to `document.referrer` when the page is opened directly.
 */
export const waitForEmbedOrigin = (): Promise<string> =>
  new Promise((resolve) => {
    const referrerOrigin = () => {
      if (!document.referrer) {
        return window.location.origin;
      }

      try {
        return new URL(document.referrer).origin;
      } catch {
        return window.location.origin;
      }
    };

    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(referrerOrigin());
    }, 800);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !isHostMessage(event.data)) {
        return;
      }

      if (event.data.type !== "host") {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(event.origin);
    };

    window.addEventListener("message", onMessage);
  });

export const postToHost = (targetOrigin: string, message: WidgetMessage) => {
  if (window.parent === window) {
    return;
  }

  window.parent.postMessage(message, targetOrigin);
};
