import { useQuery } from "@tanstack/react-query";

import { botQueries } from "@/entities/bot";
import { ChatWorkspace } from "@/features/chat";
import { env } from "@/shared/config/env";
import { Button } from "@/shared/ui/button";
import { PageLoader } from "@/shared/ui/page-loader";
import { StateMessage } from "@/shared/ui/state-message";

import styles from "./DemoWidget.module.css";

export const DemoWidget = () => {
  const publicKey = env.demoBotPublicKey;
  const origin = window.location.origin;
  const configQuery = useQuery({
    ...botQueries.widgetConfig(publicKey ?? "", origin),
    enabled: Boolean(publicKey),
  });

  if (!publicKey) {
    return (
      <div className={styles.panel}>
        <StateMessage
          description="The live widget appears here once a demo bot trained on the product docs is connected."
          title="Live demo is not connected yet"
        />
      </div>
    );
  }

  if (configQuery.isPending) {
    return (
      <div className={styles.panel}>
        <PageLoader label="Loading the live demo…" />
      </div>
    );
  }

  if (configQuery.isError || !configQuery.data) {
    return (
      <div className={styles.panel}>
        <StateMessage
          description={configQuery.error?.message}
          title="The live demo is unavailable"
          tone="error"
        >
          <Button
            disabled={configQuery.isFetching}
            onClick={() => void configQuery.refetch()}
            variant="secondary"
          >
            Try again
          </Button>
        </StateMessage>
      </div>
    );
  }

  const config = configQuery.data;

  return (
    <div className={styles.panel}>
      <ChatWorkspace
        accentColor={config.accentColor}
        botId={publicKey}
        botName={config.name}
        className={styles.chat}
        embedOrigin={origin}
        publicKey={publicKey}
        showBranding={config.showBranding}
        showSidebar={false}
        source="widget"
        welcomeMessage={config.welcomeMessage}
      />
    </div>
  );
};
