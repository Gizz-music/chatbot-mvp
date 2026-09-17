export type SessionStatus = "loading" | "authenticated" | "anonymous";

export type SessionUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

export type SessionState = {
  status: SessionStatus;
  user: SessionUser | null;
};
