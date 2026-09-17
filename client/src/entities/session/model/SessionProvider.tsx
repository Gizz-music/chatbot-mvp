import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/shared/api";

import { SessionContext } from "./session-context";
import { toSessionUser } from "./to-session-user";
import type { SessionState } from "./types";

type SessionProviderProps = {
  children: ReactNode;
};

export const SessionProvider = ({ children }: SessionProviderProps) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);

      if (event === "SIGNED_OUT") {
        // Cached data belongs to the user that just left.
        queryClient.clear();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<SessionState>(() => {
    if (isLoading) {
      return { status: "loading", user: null };
    }

    return session
      ? { status: "authenticated", user: toSessionUser(session.user) }
      : { status: "anonymous", user: null };
  }, [isLoading, session]);

  return <SessionContext value={value}>{children}</SessionContext>;
};
