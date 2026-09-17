import type { User } from "@supabase/supabase-js";

import type { SessionUser } from "./types";

const readMetadata = (user: User, key: string): string | null => {
  const value: unknown = user.user_metadata[key];

  return typeof value === "string" && value.length > 0 ? value : null;
};

export const toSessionUser = (user: User): SessionUser => ({
  id: user.id,
  email: user.email ?? null,
  fullName: readMetadata(user, "full_name"),
  avatarUrl: readMetadata(user, "avatar_url"),
});
