import type { ChatMessage } from "@/entities/conversation";

type WidgetCache = {
  conversationId: string | null;
  messages: ChatMessage[];
};

const keyOf = (botId: string): string => `chat-widget:${botId}`;

export const readWidgetCache = (botId: string): WidgetCache | null => {
  try {
    const raw = window.sessionStorage.getItem(keyOf(botId));

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("messages" in parsed) ||
      !Array.isArray(parsed.messages)
    ) {
      return null;
    }

    const conversationId =
      "conversationId" in parsed && typeof parsed.conversationId === "string"
        ? parsed.conversationId
        : null;

    return {
      conversationId,
      messages: parsed.messages as ChatMessage[],
    };
  } catch {
    return null;
  }
};

export const writeWidgetCache = (botId: string, cache: WidgetCache): void => {
  window.sessionStorage.setItem(keyOf(botId), JSON.stringify(cache));
};

export const clearWidgetCache = (botId: string): void => {
  window.sessionStorage.removeItem(keyOf(botId));
};
