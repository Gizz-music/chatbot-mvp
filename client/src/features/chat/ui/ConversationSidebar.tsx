import type { Conversation } from "@/entities/conversation";
import { cx } from "@/shared/lib/cx";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

import styles from "./ConversationSidebar.module.css";

type ConversationSidebarProps = {
  conversations: Conversation[];
  selectedId: string | null;
  isLoading?: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

export const ConversationSidebar = ({
  conversations,
  selectedId,
  isLoading,
  onSelect,
  onCreate,
}: ConversationSidebarProps) => {
  return (
    <aside className={styles.aside} aria-label="Conversations">
      <Button onClick={onCreate} variant="secondary">
        New chat
      </Button>

      {isLoading ? (
        <div
          aria-busy="true"
          aria-label="Loading chats"
          className={styles.skeleton}
        >
          <Skeleton height="2.2rem" />
          <Skeleton height="2.2rem" />
          <Skeleton height="2.2rem" />
        </div>
      ) : null}

      {!isLoading && conversations.length === 0 ? (
        <p className={styles.empty}>
          No chats yet. Ask a question on the right to start a thread.
        </p>
      ) : null}

      <ul className={styles.list}>
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <button
              className={cx(
                styles.item,
                conversation.id === selectedId && styles.active,
              )}
              onClick={() => onSelect(conversation.id)}
              type="button"
            >
              <span className={styles.title}>{conversation.title}</span>
              {conversation.source === "widget" ? (
                <span className={styles.badge}>widget</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};
