import { useContext } from "react";

import { SessionContext } from "./session-context";
import type { SessionState } from "./types";

export const useSession = (): SessionState => {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error("useSession must be used inside <SessionProvider>.");
  }

  return session;
};
