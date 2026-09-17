import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import {
  analyticsKeys,
  analyticsQueries,
  lastFourteenDays,
  type BotInsights,
  type TopQuestion,
} from "@/entities/analytics";
import { botQueries } from "@/entities/bot";
import { deleteLead, leadKeys, leadQueries, type Lead } from "@/entities/lead";
import {
  buildBotChatPath,
  buildBotDetailsPath,
  ROUTES,
} from "@/shared/config/routes";
import { downloadCsv } from "@/shared/lib/download-csv";
import { formatChartDay, formatDate } from "@/shared/lib/format-date";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { StateMessage } from "@/shared/ui/state-message";
import { useToast } from "@/shared/ui/toast";
import { BotSectionNav } from "@/widgets/bot-section-nav";

import styles from "./BotInsightsPage.module.css";

type BotInsightsParams = {
  id: string;
};

const InsightsSkeleton = () => {
  return (
    <section
      aria-busy="true"
      aria-label="Loading insights"
      className={styles.page}
    >
      <Skeleton height="2rem" width="12rem" />
      <div className={styles.stats}>
        <Skeleton height="5.5rem" />
        <Skeleton height="5.5rem" />
        <Skeleton height="5.5rem" />
        <Skeleton height="5.5rem" />
      </div>
      <Skeleton height="16rem" />
      <Skeleton height="12rem" />
    </section>
  );
};

const MessagesChart = ({
  botId,
  insights,
}: {
  botId: string;
  insights: BotInsights;
}) => {
  const series = lastFourteenDays(insights.messagesByDay);
  const peak = Math.max(...series.map((item) => item.count), 0);

  if (insights.totals.messages === 0) {
    return (
      <StateMessage
        description="Open Chat and ask a question, or embed the widget and wait for visitors. Counts show up here the same day."
        title="No messages yet"
      >
        <Link className={styles.link} to={buildBotChatPath(botId)}>
          Open chat
        </Link>
      </StateMessage>
    );
  }

  return (
    <div className={styles.chart} role="img" aria-label="Messages per day">
      {series.map((item) => (
        <div className={styles.col} key={item.day}>
          <span className={styles.count}>{item.count || ""}</span>
          <span
            className={styles.bar}
            style={{
              height: `${
                peak === 0
                  ? 0
                  : Math.max((item.count / peak) * 100, item.count > 0 ? 8 : 0)
              }%`,
            }}
          />
          <span className={styles.day}>{formatChartDay(item.day)}</span>
        </div>
      ))}
    </div>
  );
};

const TopQuestions = ({
  botId,
  questions,
}: {
  botId: string;
  questions: TopQuestion[];
}) => {
  if (questions.length === 0) {
    return (
      <StateMessage
        description="Questions visitors ask most often will rank here. Start a chat to seed the list."
        title="No questions yet"
      >
        <Link className={styles.link} to={buildBotChatPath(botId)}>
          Ask the first question
        </Link>
      </StateMessage>
    );
  }

  return (
    <ol className={styles.questions}>
      {questions.map((item) => (
        <li key={item.question}>
          <span className={styles.question}>{item.question}</span>
          <span className={styles.questionCount}>{item.count}</span>
        </li>
      ))}
    </ol>
  );
};

const LeadsTable = ({ botId, leads }: { botId: string; leads: Lead[] }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: deleteLead,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leadKeys.list(botId) }),
        queryClient.invalidateQueries({
          queryKey: analyticsKeys.detail(botId),
        }),
      ]);
      toast.success("Lead removed.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (leads.length === 0) {
    return (
      <StateMessage
        description="The widget asks visitors for an email after they send a message. Submissions land here."
        title="No leads yet"
      >
        <Link className={styles.link} to={buildBotDetailsPath(botId)}>
          Copy the embed snippet
        </Link>
      </StateMessage>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Captured</th>
            <th>
              <span className={styles.srOnly}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>{lead.email}</td>
              <td>{lead.name || "—"}</td>
              <td>{formatDate(lead.createdAt)}</td>
              <td>
                <Button
                  disabled={remove.isPending && remove.variables === lead.id}
                  onClick={() => remove.mutate(lead.id)}
                  variant="ghost"
                >
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const BotInsightsPage = () => {
  const { id = "" } = useParams<BotInsightsParams>();
  const toast = useToast();
  const botQuery = useQuery(botQueries.detail(id));
  const insightsQuery = useQuery(analyticsQueries.detail(id));
  const leadsQuery = useQuery(leadQueries.list(id));

  if (botQuery.isPending || insightsQuery.isPending || leadsQuery.isPending) {
    return <InsightsSkeleton />;
  }

  if (botQuery.isError) {
    return (
      <StateMessage
        description={botQuery.error.message}
        title="Could not load this bot"
        tone="error"
      >
        <Button onClick={() => void botQuery.refetch()} variant="secondary">
          Try again
        </Button>
      </StateMessage>
    );
  }

  if (!botQuery.data) {
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

  if (insightsQuery.isError) {
    return (
      <StateMessage
        description={insightsQuery.error.message}
        title="Could not load insights"
        tone="error"
      >
        <Button
          onClick={() => void insightsQuery.refetch()}
          variant="secondary"
        >
          Try again
        </Button>
      </StateMessage>
    );
  }

  const bot = botQuery.data;
  const insights = insightsQuery.data;
  const leads = leadsQuery.data ?? [];
  const unanswered = insights.unanswered;
  const shareLabel =
    unanswered.total === 0 ? "—" : `${unanswered.share.toFixed(1)}%`;

  const exportLeads = () => {
    downloadCsv(`leads-${bot.name}.csv`, [
      ["email", "name", "captured_at"],
      ...leads.map((lead) => [lead.email, lead.name ?? "", lead.createdAt]),
    ]);
    toast.success("Leads CSV downloaded.");
  };

  const exportInsights = () => {
    const days = lastFourteenDays(insights.messagesByDay);
    downloadCsv(`insights-${bot.name}.csv`, [
      ["metric", "value"],
      ["conversations", String(insights.totals.conversations)],
      ["messages", String(insights.totals.messages)],
      ["leads", String(insights.totals.leads)],
      ["unanswered_answers", String(unanswered.unanswered)],
      ["unanswered_share_pct", String(unanswered.share)],
      ["day", "messages"],
      ...days.map((item) => [item.day, String(item.count)]),
      ["question", "count"],
      ...insights.topQuestions.map((item) => [
        item.question,
        String(item.count),
      ]),
    ]);
    toast.success("Insights CSV downloaded.");
  };

  return (
    <section className={styles.page}>
      <div>
        <h1>{bot.name}</h1>
        <BotSectionNav botId={bot.id} />
      </div>

      <div className={styles.toolbar}>
        <p className={styles.lede}>
          Last 14 days of chat, the questions people repeat, and how often the
          bot had nothing in the knowledge base.
        </p>
        <div className={styles.exports}>
          <Button onClick={exportInsights} variant="secondary">
            Export insights CSV
          </Button>
          <Button
            disabled={leads.length === 0}
            onClick={exportLeads}
            variant="secondary"
          >
            Export leads CSV
          </Button>
        </div>
      </div>

      <div className={styles.stats}>
        <Card>
          <p className={styles.statLabel}>Conversations</p>
          <p className={styles.statValue}>
            {insights.totals.conversations.toLocaleString("en-US")}
          </p>
        </Card>
        <Card>
          <p className={styles.statLabel}>Messages</p>
          <p className={styles.statValue}>
            {insights.totals.messages.toLocaleString("en-US")}
          </p>
        </Card>
        <Card>
          <p className={styles.statLabel}>Leads</p>
          <p className={styles.statValue}>
            {insights.totals.leads.toLocaleString("en-US")}
          </p>
        </Card>
        <Card>
          <p className={styles.statLabel}>Couldn’t find an answer</p>
          <p className={styles.statValue}>{shareLabel}</p>
          <p className={styles.statHint}>
            {unanswered.total === 0
              ? "No answers yet."
              : `${unanswered.unanswered} of ${unanswered.total} answers had no matching document.`}
          </p>
        </Card>
      </div>

      <Card title="Messages per day">
        <MessagesChart botId={bot.id} insights={insights} />
      </Card>

      <div className={styles.split}>
        <Card title="Top questions">
          <TopQuestions botId={bot.id} questions={insights.topQuestions} />
        </Card>
        <Card title="Leads">
          {leadsQuery.isError ? (
            <StateMessage
              description={leadsQuery.error.message}
              title="Could not load leads"
              tone="error"
            />
          ) : (
            <LeadsTable botId={bot.id} leads={leads} />
          )}
        </Card>
      </div>
    </section>
  );
};
