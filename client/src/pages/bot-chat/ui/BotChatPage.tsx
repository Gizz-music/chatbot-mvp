import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { botQueries } from "@/entities/bot";
import {
  messageLimitMessage,
  useEntitlements,
} from "@/entities/plan";
import { ChatWorkspace } from "@/features/chat";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/button";
import { PageLoader } from "@/shared/ui/page-loader";
import { StateMessage } from "@/shared/ui/state-message";
import { UpgradePrompt } from "@/shared/ui/upgrade-prompt";
import { BotSectionNav } from "@/widgets/bot-section-nav";

import styles from "./BotChatPage.module.css";

type BotChatParams = {
  id: string;
};

export const BotChatPage = () => {
  const { id = "" } = useParams<BotChatParams>();
  const entitlements = useEntitlements();
  const messagesLocked = entitlements.isAtLimit("messages");
  const {
    data: bot,
    isPending,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery(botQueries.detail(id));

  if (isPending) {
    return <PageLoader label="Loading chat…" />;
  }

  if (isError) {
    return (
      <StateMessage
        description={error.message}
        title="Could not load this bot"
        tone="error"
      >
        <Button
          disabled={isFetching}
          onClick={() => void refetch()}
          variant="secondary"
        >
          Try again
        </Button>
      </StateMessage>
    );
  }

  if (!bot) {
    return (
      <StateMessage
        description="It was deleted, or it belongs to another account."
        title="Bot not found"
      >
        <Link className={styles.link} to={ROUTES.dashboard}>
          Back to my bots
        </Link>
      </StateMessage>
    );
  }

  return (
    <section className={styles.page}>
      <div>
        <h1>{bot.name}</h1>
        <BotSectionNav botId={bot.id} />
      </div>
      <ChatWorkspace
        accentColor={bot.accentColor}
        botId={bot.id}
        botName={bot.name}
        composerLocked={
          messagesLocked ? (
            <UpgradePrompt
              description={messageLimitMessage(entitlements.plan)}
            />
          ) : null
        }
        key={bot.id}
        source="app"
        welcomeMessage={bot.welcomeMessage}
      />
    </section>
  );
};
