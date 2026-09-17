import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";

import { encodeSse, messageOf, sseHeaders } from "./http.ts";
import { consumeMessageQuota } from "../_shared/entitlements.ts";
import { streamCompletion } from "../_shared/gemini.ts";
import { buildSystemPrompt, citationsOf, retrieveChunks } from "./rag.ts";
import type {
  BotRow,
  ChatSource,
  ConversationRow,
  HistoryMessage,
  SseEvent,
} from "./types.ts";

const HISTORY_LIMIT = 12;
const TITLE_CHARS = 80;
const CONVERSATION_COLUMNS = "id, bot_id, source, visitor_id, title";

export const failOn = (error: { message: string } | null) => {
  if (error) {
    throw new Error(error.message);
  }
};

const titleOf = (message: string): string => {
  const compact = message.replace(/\s+/g, " ").trim();

  return compact.length > TITLE_CHARS
    ? `${compact.slice(0, TITLE_CHARS)}…`
    : compact;
};

const loadConversation = async (
  admin: SupabaseClient,
  conversationId: string,
): Promise<ConversationRow | null> => {
  const { data, error } = await admin
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();

  failOn(error);

  return data;
};

const createConversation = async (
  admin: SupabaseClient,
  botId: string,
  source: ChatSource,
  visitorId: string | null,
  title: string,
): Promise<ConversationRow> => {
  const { data, error } = await admin
    .from("conversations")
    .insert({
      bot_id: botId,
      source,
      visitor_id: visitorId,
      title,
    })
    .select(CONVERSATION_COLUMNS)
    .single<ConversationRow>();

  failOn(error);

  return data;
};

const loadHistory = async (
  admin: SupabaseClient,
  conversationId: string,
): Promise<HistoryMessage[]> => {
  const { data, error } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  failOn(error);

  return (data ?? []) as HistoryMessage[];
};

const insertMessage = async (
  admin: SupabaseClient,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  citations: unknown[] = [],
  unanswered = false,
) => {
  failOn(
    (
      await admin.from("messages").insert({
        conversation_id: conversationId,
        role,
        content,
        citations,
        unanswered: role === "assistant" && unanswered,
      })
    ).error,
  );
};

const conversationGuard = (
  conversation: ConversationRow,
  botId: string,
  source: ChatSource,
  visitorId: string | null,
): string | null => {
  if (conversation.bot_id !== botId) {
    return "Conversation not found.";
  }

  if (source === "widget" && conversation.visitor_id !== visitorId) {
    return "Conversation not found.";
  }

  return null;
};

export type ChatRun = {
  bot: BotRow;
  source: ChatSource;
  visitorId: string | null;
  conversationId: string | null;
  message: string;
};

/** Shared SSE body for dashboard `/chat` and public `/widget-chat`. */
export const runChatStream = (
  admin: SupabaseClient,
  input: ChatRun,
  headers: HeadersInit = sseHeaders,
): Response => {
  const { bot, source, visitorId, conversationId, message } = input;

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: SseEvent) => {
          controller.enqueue(encodeSse(event));
        };

        try {
          let conversation: ConversationRow | null = conversationId
            ? await loadConversation(admin, conversationId)
            : null;

          if (conversationId && !conversation) {
            send({ type: "error", message: "Conversation not found." });
            return;
          }

          if (conversation) {
            const blocked = conversationGuard(
              conversation,
              bot.id,
              source,
              visitorId,
            );

            if (blocked) {
              send({ type: "error", message: blocked });
              return;
            }
          } else {
            conversation = await createConversation(
              admin,
              bot.id,
              source,
              source === "widget" ? visitorId : null,
              titleOf(message),
            );
          }

          const history = await loadHistory(admin, conversation.id);

          await insertMessage(admin, conversation.id, "user", message);

          await consumeMessageQuota(admin, bot.user_id);

          send({ type: "session", conversationId: conversation.id });

          const chunks = await retrieveChunks(admin, bot.id, message);
          const citations = citationsOf(chunks);
          const system = buildSystemPrompt(bot.system_prompt, chunks);

          let answer = "";

          for await (const delta of streamCompletion(
            system,
            history,
            message,
          )) {
            answer += delta;
            send({ type: "delta", text: delta });
          }

          if (answer.trim().length === 0) {
            throw new Error("The model returned an empty answer.");
          }

          await insertMessage(
            admin,
            conversation.id,
            "assistant",
            answer,
            citations,
            chunks.length === 0,
          );

          send({ type: "done", citations });
        } catch (cause) {
          const messageText = messageOf(cause);
          console.error(`chat failed: ${messageText}`);
          send({ type: "error", message: messageText });
        } finally {
          controller.close();
        }
      },
    }),
    { headers },
  );
};
