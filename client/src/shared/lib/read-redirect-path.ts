/**
 * Reads the path a visitor was heading to before being bounced to /login.
 * Router location state is untyped, so everything is checked by hand.
 */
export const readRedirectPath = (state: unknown): string | null => {
  if (typeof state !== "object" || state === null) {
    return null;
  }

  const { from } = state as { from?: unknown };

  if (typeof from !== "object" || from === null) {
    return null;
  }

  const { pathname, search } = from as { pathname?: unknown; search?: unknown };

  if (typeof pathname !== "string" || !pathname.startsWith("/")) {
    return null;
  }

  return typeof search === "string" ? `${pathname}${search}` : pathname;
};
