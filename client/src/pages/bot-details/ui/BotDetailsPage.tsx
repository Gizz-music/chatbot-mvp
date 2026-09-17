import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { botQueries } from "@/entities/bot";
import { DeleteBotButton } from "@/features/bot-delete";
import { BotSettingsForm } from "@/features/bot-settings";
import { DocumentList } from "@/features/document-list";
import { DocumentUpload } from "@/features/document-upload";
import { EmbedSnippet } from "@/features/embed-snippet";
import { WebsiteImportForm } from "@/features/website-import";
import { buildBotChatPath, ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { StateMessage } from "@/shared/ui/state-message";
import { BotSectionNav } from "@/widgets/bot-section-nav";

import styles from "./BotDetailsPage.module.css";

type BotDetailsParams = {
  id: string;
};

export const BotDetailsPage = () => {
  const { id = "" } = useParams<BotDetailsParams>();
  const {
    data: bot,
    isPending,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery(botQueries.detail(id));

  if (isPending) {
    return (
      <section
        aria-busy="true"
        aria-label="Loading bot"
        className={styles.page}
      >
        <Skeleton height="2rem" width="12rem" />
        <div className={styles.grid}>
          <Skeleton className={styles.wide} height="18rem" />
          <Skeleton className={styles.wide} height="12rem" />
          <Skeleton height="8rem" />
          <Skeleton height="8rem" />
        </div>
      </section>
    );
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
        <Link className={styles.previewLink} to={ROUTES.dashboard}>
          Back to my bots
        </Link>
      </StateMessage>
    );
  }

  return (
    <section className={styles.page}>
      <div>
        <h1>{bot.name}</h1>
        <p className={styles.meta}>
          Public key: <code className={styles.code}>{bot.publicKey}</code>
        </p>
        <BotSectionNav botId={bot.id} />
      </div>
      <div className={styles.grid}>
        <Card className={styles.wide} title="Settings">
          {/* Remount on navigation between bots, so the draft starts fresh. */}
          <BotSettingsForm bot={bot} key={bot.id} />
        </Card>
        <Card className={styles.wide} title="Knowledge base">
          <div className={styles.sources}>
            <DocumentUpload botId={bot.id} />
            <WebsiteImportForm botId={bot.id} />
          </div>
          <DocumentList botId={bot.id} />
        </Card>
        <div className={styles.bottom}>
          <Card className={styles.chatCard} title="Chat">
            <p>
              Full conversation history, streaming answers and citations live on
              the chat page. Insights tracks volume, top questions and missed
              answers.
            </p>
            <Link className={styles.previewLink} to={buildBotChatPath(bot.id)}>
              Open chat
            </Link>
          </Card>
          <Card className={styles.embedCard} title="Embed">
            <EmbedSnippet publicKey={bot.publicKey} />
          </Card>
          <Card className={styles.dangerCard} title="Danger zone">
            <DeleteBotButton botId={bot.id} botName={bot.name} />
          </Card>
        </div>
      </div>
    </section>
  );
};
