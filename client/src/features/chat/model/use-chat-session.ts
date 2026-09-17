import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  conversationKeys,
  conversationQueries,
  type ChatMessage,
  type ChatSource,
  type Citation,
} from "@/entities/conversation";
import { planKeys } from "@/entities/plan";

import { streamChat } from "../api/stream-chat";
import { writeWidgetCache } from "../lib/widget-cache";

type UseChatSessionArgs = {
  botId: string;
  source: ChatSource;
  visitorId?: string;
  conversationId: string | null;
  initialMessages?: ChatMessage[];
  onConversation: (id: string) => void;
  publicKey?: string;
  embedOrigin?: string;
};

const localId = (): string => `local-${crypto.randomUUID()}`;

const isAbort = (cause: unknown): boolean =>
  cause instanceof DOMException
    ? cause.name === "AbortError"
    : cause instanceof Error && cause.name === "AbortError";

const patchLastAssistant = (
  thread: ChatMessage[],
  patch: Partial<ChatMessage> | ((current: ChatMessage) => ChatMessage),
): ChatMessage[] => {
  const last = thread[thread.length - 1];

  if (last?.role !== "assistant") {
    return thread;
  }

  const next = [...thread];
  next[next.length - 1] =
    typeof patch === "function" ? patch(last) : { ...last, ...patch };

  return next;
};

export const useChatSession = ({
  botId,
  source,
  visitorId,
  conversationId,
  initialMessages = [],
  onConversation,
  publicKey,
  embedOrigin,
}: UseChatSessionArgs) => {
  const queryClient = useQueryClient();
  const messagesQuery = useQuery({
    ...conversationQueries.messages(conversationId ?? ""),
    enabled: source === "app" && Boolean(conversationId),
  });

  const [widgetMessages, setWidgetMessages] =
    useState<ChatMessage[]>(initialMessages);
  const [live, setLive] = useState<ChatMessage[] | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (source !== "widget") {
      return;
    }

    writeWidgetCache(botId, {
      conversationId,
      messages: widgetMessages,
    });
  }, [botId, conversationId, source, widgetMessages]);

  const baseMessages =
    source === "widget"
      ? widgetMessages
      : conversationId
        ? (messagesQuery.data ?? [])
        : [];

  const messages = live ?? baseMessages;

  const abort = () => {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setLive(null);
  };

  const send = async (text: string) => {
    const message = text.trim();

    if (message.length === 0 || isStreaming) {
      return;
    }

    setError(null);

    const now = new Date().toISOString();
    const starting: ChatMessage[] = [
      ...baseMessages,
      {
        id: localId(),
        conversationId: conversationId ?? "",
        role: "user",
        content: message,
        citations: [],
        createdAt: now,
      },
      {
        id: localId(),
        conversationId: conversationId ?? "",
        role: "assistant",
        content: "",
        citations: [],
        createdAt: now,
      },
    ];

    let draft = starting;
    setLive(starting);
    setIsStreaming(true);

    const generation = generationRef.current;
    const nextController = new AbortController();
    abortRef.current = nextController;

    let activeId = conversationId;
    const isCurrent = () => generation === generationRef.current;

    try {
      await streamChat(
        {
          botId,
          conversationId,
          message,
          source,
          visitorId,
          publicKey,
          embedOrigin,
        },
        {
          onSession: (id) => {
            if (!isCurrent()) {
              return;
            }

            activeId = id;
            onConversation(id);
          },
          onDelta: (delta) => {
            if (!isCurrent()) {
              return;
            }

            draft = patchLastAssistant(draft, (item) => ({
              ...item,
              content: item.content + delta,
            }));
            setLive(draft);
          },
          onDone: (citations: Citation[]) => {
            if (!isCurrent()) {
              return;
            }

            draft = patchLastAssistant(draft, { citations });
            setLive(draft);
          },
        },
        nextController.signal,
      );

      if (!isCurrent()) {
        return;
      }

      if (source === "widget") {
        setWidgetMessages(draft);
      } else if (activeId) {
        queryClient.setQueryData(conversationKeys.messages(activeId), draft);
      }

      await queryClient.invalidateQueries({
        queryKey: conversationKeys.list(botId),
      });
      await queryClient.invalidateQueries({ queryKey: planKeys.usage });

      if (activeId) {
        await queryClient.invalidateQueries({
          queryKey: conversationKeys.messages(activeId),
        });
      }
    } catch (cause) {
      if (isAbort(cause) || !isCurrent()) {
        return;
      }

      setError(cause instanceof Error ? cause.message : "Chat failed.");
    } finally {
      if (!isCurrent()) {
        return;
      }

      setIsStreaming(false);
      abortRef.current = null;
      setLive(null);
    }
  };

  const clear = () => {
    abort();
    setWidgetMessages([]);
    setError(null);
  };

  return {
    messages,
    isStreaming,
    isLoading:
      source === "app" &&
      Boolean(conversationId) &&
      messagesQuery.isPending &&
      messages.length === 0,
    error: error ?? (messagesQuery.error ? messagesQuery.error.message : null),
    send,
    abort,
    clear,
  };
};
