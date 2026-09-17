import { useLayoutEffect, useRef } from "react";

import type { ChatMessage } from "@/entities/conversation";
import { cx } from "@/shared/lib/cx";
import { PageLoader } from "@/shared/ui/page-loader";

import styles from "./ChatTranscript.module.css";

type ChatTranscriptProps = {
  botName: string;
  welcomeMessage: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading?: boolean;
};

export const ChatTranscript = ({
  botName,
  welcomeMessage,
  messages,
  isStreaming,
  isLoading,
}: ChatTranscriptProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    scroller.scrollTop = scroller.scrollHeight;
  }, [messages, isStreaming]);

  if (isLoading) {
    return <PageLoader label="Loading conversation…" />;
  }

  const last = messages[messages.length - 1];
  const showTyping =
    isStreaming && last?.role === "assistant" && last.content.length === 0;

  return (
    <div className={styles.scroller} ref={scrollerRef}>
      <div className={styles.column}>
        {messages.length === 0 ? (
          <article className={cx(styles.row, styles.assistant)}>
            <p className={styles.name}>{botName}</p>
            <div className={styles.bubble}>{welcomeMessage}</div>
          </article>
        ) : null}

        {messages.map((message) => (
          <article
            className={cx(
              styles.row,
              message.role === "user" ? styles.user : styles.assistant,
            )}
            key={message.id}
          >
            {message.role === "assistant" ? (
              <p className={styles.name}>{botName}</p>
            ) : null}
            {message.content.length > 0 ? (
              <div className={styles.bubble}>{message.content}</div>
            ) : null}
            {message.role === "assistant" && message.citations.length > 0 ? (
              <ul className={styles.citations}>
                {message.citations.map((citation) => (
                  <li key={citation.documentId}>
                    <span className={styles.chip} title={citation.filename}>
                      {citation.filename}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}

        {showTyping ? (
          <p className={styles.typing} aria-live="polite">
            <span />
            <span />
            <span />
          </p>
        ) : null}
      </div>
    </div>
  );
};
