import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { conversationQueries, type ChatSource } from "@/entities/conversation";
import { cx } from "@/shared/lib/cx";
import { Button } from "@/shared/ui/button";

import { hasSubmittedLead } from "../lib/lead-flag";
import { readVisitorId } from "../lib/visitor-id";
import { clearWidgetCache, readWidgetCache } from "../lib/widget-cache";
import { useChatSession } from "../model/use-chat-session";

import { ChatComposer } from "./ChatComposer";
import { ChatTranscript } from "./ChatTranscript";
import { ConversationSidebar } from "./ConversationSidebar";
import { LeadCaptureForm } from "./LeadCaptureForm";

import styles from "./ChatWorkspace.module.css";

export type ChatWorkspaceProps = {
  botId: string;
  botName: string;
  welcomeMessage: string;
  accentColor?: string;
  source: ChatSource;
  showSidebar?: boolean;
  className?: string;
  publicKey?: string;
  embedOrigin?: string;
  showBranding?: boolean;
  onClose?: () => void;
  composerLocked?: ReactNode;
};

export const ChatWorkspace = ({
  botId,
  botName,
  welcomeMessage,
  accentColor,
  source,
  showSidebar = source === "app",
  className,
  publicKey,
  embedOrigin,
  showBranding = false,
  onClose,
  composerLocked,
}: ChatWorkspaceProps) => {
  const widgetCache = useMemo(
    () => (source === "widget" ? readWidgetCache(botId) : null),
    [botId, source],
  );
  const visitorId = useMemo(
    () => (source === "widget" ? readVisitorId() : undefined),
    [source],
  );

  const [conversationId, setConversationId] = useState<string | null>(
    widgetCache?.conversationId ?? null,
  );
  const [threadKey, setThreadKey] = useState(0);
  const [leadCaptured, setLeadCaptured] = useState(() =>
    publicKey ? hasSubmittedLead(publicKey) : true,
  );
  const [leadThanks, setLeadThanks] = useState(false);

  const listQuery = useQuery({
    ...conversationQueries.list(botId),
    enabled: showSidebar,
  });

  const chat = useChatSession({
    botId,
    source,
    visitorId,
    conversationId,
    initialMessages: widgetCache?.messages,
    onConversation: setConversationId,
    publicKey,
    embedOrigin,
  });

  const startNewChat = () => {
    chat.clear();
    setConversationId(null);
    setLeadThanks(false);
    setThreadKey((key) => key + 1);

    if (source === "widget") {
      clearWidgetCache(botId);
    }
  };

  const selectConversation = (id: string) => {
    if (id === conversationId) {
      return;
    }

    chat.abort();
    setConversationId(id);
  };

  return (
    <div
      className={cx(styles.workspace, className)}
      data-source={source}
      style={
        accentColor
          ? ({ "--chat-accent": accentColor } as CSSProperties)
          : undefined
      }
    >
      {showSidebar ? (
        <ConversationSidebar
          conversations={listQuery.data ?? []}
          isLoading={listQuery.isPending}
          onCreate={startNewChat}
          onSelect={selectConversation}
          selectedId={conversationId}
        />
      ) : null}

      <div className={styles.main}>
        <div className={styles.toolbar}>
          <p className={styles.heading}>{showSidebar ? "Chat" : botName}</p>
          <div className={styles.toolbarActions}>
            {showSidebar ? null : (
              <Button onClick={startNewChat} variant="ghost">
                New chat
              </Button>
            )}
            {onClose ? (
              <Button aria-label="Close chat" onClick={onClose} variant="ghost">
                ×
              </Button>
            ) : null}
          </div>
        </div>

        <div className={styles.thread} key={threadKey}>
          <ChatTranscript
            botName={botName}
            isLoading={chat.isLoading}
            isStreaming={chat.isStreaming}
            messages={chat.messages}
            welcomeMessage={welcomeMessage}
          />

          {chat.error ? (
            <p className={styles.error} role="alert">
              {chat.error}
            </p>
          ) : null}

          {source === "widget" && publicKey && conversationId && !leadCaptured ? (
            <LeadCaptureForm
              conversationId={conversationId}
              onCaptured={() => {
                setLeadCaptured(true);
                setLeadThanks(true);
              }}
              publicKey={publicKey}
            />
          ) : null}
          {leadThanks ? (
            <p className={styles.thanks}>Thanks — the owner can follow up.</p>
          ) : null}

          <ChatComposer
            disabled={chat.isStreaming || Boolean(composerLocked)}
            onSend={(text) => void chat.send(text)}
          />

          {composerLocked ? (
            <div className={styles.lock}>{composerLocked}</div>
          ) : null}

          {showBranding ? (
            <p className={styles.brand}>
              <a href={window.location.origin} rel="noreferrer" target="_blank">
                Powered by Chatbot Builder
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};
