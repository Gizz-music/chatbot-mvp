export type ChatSource = "app" | "widget";

export type ChatRequest = {
  botId: string;
  conversationId: string | null;
  message: string;
  source: ChatSource;
  visitorId: string | null;
};

export type BotRow = {
  id: string;
  user_id: string;
  name: string;
  system_prompt: string;
  welcome_message: string;
  status: "draft" | "active";
};

export type ConversationRow = {
  id: string;
  bot_id: string;
  source: ChatSource;
  visitor_id: string | null;
  title: string;
};

export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type MatchedChunk = {
  id: string;
  document_id: string;
  content: string;
  filename: string;
  similarity: number;
};

export type Citation = {
  document_id: string;
  filename: string;
};

export type SseEvent =
  | { type: "session"; conversationId: string }
  | { type: "delta"; text: string }
  | { type: "done"; citations: Citation[] }
  | { type: "error"; message: string };
