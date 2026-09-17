export type ChatSource = "app" | "widget";

export type Citation = {
  documentId: string;
  filename: string;
};

export type Conversation = {
  id: string;
  botId: string;
  source: ChatSource;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
};
