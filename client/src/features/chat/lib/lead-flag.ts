const KEY = "chatbot-lead";

export const hasSubmittedLead = (publicKey: string): boolean => {
  try {
    return window.localStorage.getItem(`${KEY}:${publicKey}`) === "1";
  } catch {
    return false;
  }
};

export const markLeadSubmitted = (publicKey: string): void => {
  try {
    window.localStorage.setItem(`${KEY}:${publicKey}`, "1");
  } catch {
    // Private mode can refuse localStorage; the form still submitted.
  }
};
