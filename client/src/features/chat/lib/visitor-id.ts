const STORAGE_KEY = "chatbot-visitor-id";

/** Stable anonymous id for widget conversations, kept in this browser only. */
export const readVisitorId = (): string => {
  const existing = window.localStorage.getItem(STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, created);

  return created;
};
