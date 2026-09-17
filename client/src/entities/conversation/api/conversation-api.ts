import { supabase } from "@/shared/api";

import type {
  ChatMessage,
  ChatSource,
  Citation,
  Conversation,
} from "../model/types";

type ConversationRow = {
  id: string;
  bot_id: string;
  source: ChatSource;
  title: string;
  created_at: string;
  updated_at: string;
};

type CitationRow = {
  document_id?: string;
  documentId?: string;
  filename?: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: CitationRow[] | null;
  created_at: string;
};

const toConversation = (row: ConversationRow): Conversation => ({
  id: row.id,
  botId: row.bot_id,
  source: row.source,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toCitation = (row: CitationRow): Citation | null => {
  const documentId = row.documentId ?? row.document_id;
  const filename = row.filename;

  if (!documentId || !filename) {
    return null;
  }

  return { documentId, filename };
};

const toMessage = (row: MessageRow): ChatMessage | null => {
  if (row.role !== "user" && row.role !== "assistant") {
    return null;
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    citations: (row.citations ?? [])
      .map(toCitation)
      .filter((item): item is Citation => item !== null),
    createdAt: row.created_at,
  };
};

export const fetchConversations = async (
  botId: string,
): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, bot_id, source, title, created_at, updated_at")
    .eq("bot_id", botId)
    .order("updated_at", { ascending: false })
    .returns<ConversationRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toConversation);
};

export const fetchMessages = async (
  conversationId: string,
): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, citations, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map(toMessage)
    .filter((item): item is ChatMessage => item !== null);
};
