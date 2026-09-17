export type MessagesByDay = {
  day: string;
  count: number;
};

export type TopQuestion = {
  question: string;
  count: number;
};

export type UnansweredShare = {
  total: number;
  unanswered: number;
  share: number;
};

export type InsightTotals = {
  conversations: number;
  messages: number;
  leads: number;
};

export type BotInsights = {
  messagesByDay: MessagesByDay[];
  topQuestions: TopQuestion[];
  unanswered: UnansweredShare;
  totals: InsightTotals;
};
