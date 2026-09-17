import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { botQueries } from "@/entities/bot";
import { CreateBotButton } from "@/features/bot-create";
import {
  buildBotChatPath,
  buildBotDetailsPath,
  buildBotInsightsPath,
} from "@/shared/config/routes";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { StateMessage } from "@/shared/ui/state-message";

import styles from "./DashboardPage.module.css";

const DashboardSkeleton = () => {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your bots"
      className={styles.list}
    >
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <div className={styles.item}>
            <div className={styles.skeletonCopy}>
              <Skeleton height="1.25rem" width="11rem" />
              <Skeleton height="0.9rem" width="18rem" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export const DashboardPage = () => {
  const {
    data: bots,
    isPending,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery(botQueries.list());

  const renderBots = () => {
    if (isPending) {
      return <DashboardSkeleton />;
    }

    if (isError) {
      return (
        <StateMessage
          description={error.message}
          title="Could not load your bots"
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

    if (bots.length === 0) {
      return (
        <StateMessage
          description="Create a bot, upload a file or a website, then paste the embed snippet on your site. Chat and insights stay empty until that first document is indexed."
          title="No bots yet"
        >
          <CreateBotButton label="Create your first bot" />
        </StateMessage>
      );
    }

    return (
      <div className={styles.list}>
        {bots.map((bot) => (
          <Card key={bot.id}>
            <div className={styles.item}>
              <div>
                <h2>{bot.name}</h2>
                <p className={styles.status}>
                  <span
                    className={
                      bot.status === "active"
                        ? styles.badgeActive
                        : styles.badge
                    }
                  >
                    {bot.status === "active" ? "Active" : "Draft"}
                  </span>
                  {bot.description || "No description yet"}
                </p>
              </div>
              <div className={styles.actions}>
                <Link className={styles.link} to={buildBotChatPath(bot.id)}>
                  Chat
                </Link>
                <Link className={styles.link} to={buildBotInsightsPath(bot.id)}>
                  Insights
                </Link>
                <Link className={styles.link} to={buildBotDetailsPath(bot.id)}>
                  Configure
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <h1>My bots</h1>
        <CreateBotButton />
      </div>
      {renderBots()}
    </section>
  );
};
