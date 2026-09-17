import { useEffect, useState } from "react";

import { fetchWidgetConfig, type WidgetConfig } from "@/entities/bot";
import { ChatWorkspace } from "@/features/chat";
import { PageLoader } from "@/shared/ui/page-loader";
import { StateMessage } from "@/shared/ui/state-message";

import {
  PANEL_SIZE,
  postToHost,
  publicKeyFromSearch,
  waitForEmbedOrigin,
} from "./protocol";

import styles from "./WidgetApp.module.css";

export const WidgetApp = () => {
  const publicKey = publicKeyFromSearch();
  const [embedOrigin, setEmbedOrigin] = useState<string | null>(null);
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void waitForEmbedOrigin().then((origin) => {
      if (!cancelled) {
        setEmbedOrigin(origin);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!embedOrigin || !publicKey) {
      return;
    }

    const controller = new AbortController();

    void fetchWidgetConfig(publicKey, embedOrigin, controller.signal)
      .then((next) => {
        setConfig(next);
        setError(null);
        postToHost(embedOrigin, {
          source: "chatbot-widget",
          type: "ready",
          accentColor: next.accentColor,
        });
        postToHost(embedOrigin, {
          source: "chatbot-widget",
          type: "resize",
          width: PANEL_SIZE.width,
          height: PANEL_SIZE.height,
        });
      })
      .catch((cause) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          cause instanceof Error ? cause.message : "Could not load the widget.",
        );
      });

    return () => controller.abort();
  }, [embedOrigin, publicKey]);

  const close = () => {
    if (embedOrigin) {
      postToHost(embedOrigin, { source: "chatbot-widget", type: "close" });
    }
  };

  if (!publicKey) {
    return (
      <div className={styles.page}>
        <StateMessage
          description="The embed script must pass data-bot with the public key."
          title="Missing bot key"
          tone="error"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <StateMessage
          description={error}
          title="Widget unavailable"
          tone="error"
        />
      </div>
    );
  }

  if (!config || !embedOrigin) {
    return (
      <div className={styles.page}>
        <PageLoader label="Loading widget…" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ChatWorkspace
        accentColor={config.accentColor}
        botId={publicKey}
        botName={config.name}
        className={styles.fill}
        embedOrigin={embedOrigin}
        onClose={close}
        publicKey={publicKey}
        showBranding={config.showBranding}
        showSidebar={false}
        source="widget"
        welcomeMessage={config.welcomeMessage}
      />
    </div>
  );
};
