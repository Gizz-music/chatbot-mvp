import type { ChatSource, Citation } from "@/entities/conversation";
import { supabase } from "@/shared/api";
import { env } from "@/shared/config/env";

export type StreamChatInput = {
  botId: string;
  conversationId: string | null;
  message: string;
  source: ChatSource;
  visitorId?: string;
  publicKey?: string;
  embedOrigin?: string;
};

export type StreamChatHandlers = {
  onSession: (conversationId: string) => void;
  onDelta: (text: string) => void;
  onDone: (citations: Citation[]) => void;
};

type SsePayload = {
  type?: string;
  conversationId?: string;
  text?: string;
  message?: string;
  citations?: Array<{
    document_id?: string;
    documentId?: string;
    filename?: string;
  }>;
};

const toCitations = (payload: SsePayload["citations"]): Citation[] => {
  if (!payload) {
    return [];
  }

  const citations: Citation[] = [];

  for (const item of payload) {
    const documentId = item.documentId ?? item.document_id;
    const filename = item.filename;

    if (!documentId || !filename) {
      continue;
    }

    citations.push({ documentId, filename });
  }

  return citations;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  const payload: unknown = await response.json().catch(() => null);

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return `Chat failed with status ${response.status}.`;
};

const dispatch = (payload: SsePayload, handlers: StreamChatHandlers) => {
  switch (payload.type) {
    case "session":
      if (payload.conversationId) {
        handlers.onSession(payload.conversationId);
      }
      return;
    case "delta":
      if (payload.text) {
        handlers.onDelta(payload.text);
      }
      return;
    case "done":
      handlers.onDone(toCitations(payload.citations));
      return;
    case "error":
      throw new Error(payload.message ?? "Chat failed.");
    default:
      return;
  }
};

const chatHeaders = (
  accessToken: string,
  embedOrigin?: string,
): HeadersInit => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    apikey: env.supabaseAnonKey,
    "Content-Type": "application/json",
  };

  if (embedOrigin) {
    headers["X-Embed-Origin"] = embedOrigin;
  }

  return headers;
};

/**
 * `functions.invoke` buffers the whole body, so chat talks to the Edge
 * Functions with fetch and reads the SSE stream as it arrives.
 */
export const streamChat = async (
  input: StreamChatInput,
  handlers: StreamChatHandlers,
  signal?: AbortSignal,
): Promise<void> => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? env.supabaseAnonKey;
  const isWidget = input.source === "widget";
  const path = isWidget ? "widget-chat" : "chat";

  const response = await fetch(`${env.supabaseUrl}/functions/v1/${path}`, {
    method: "POST",
    headers: chatHeaders(accessToken, input.embedOrigin),
    body: JSON.stringify(
      isWidget
        ? {
            publicKey: input.publicKey,
            conversationId: input.conversationId,
            message: input.message,
            visitorId: input.visitorId ?? null,
          }
        : {
            botId: input.botId,
            conversationId: input.conversationId,
            message: input.message,
            source: input.source,
          },
    ),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (!response.body) {
    throw new Error("The chat stream was empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const line = chunk.split("\n").find((entry) => entry.startsWith("data:"));

      if (!line) {
        continue;
      }

      const payload = JSON.parse(line.slice(5).trim()) as SsePayload;
      dispatch(payload, handlers);
    }
  }
};
