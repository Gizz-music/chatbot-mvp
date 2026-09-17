/** Hostname of an Origin, Referer, or bare host. Null when the value is junk. */
export const hostOf = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    const url = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    const host = url.hostname.toLowerCase();

    return host.length > 0 ? host : null;
  } catch {
    return null;
  }
};

const normalizeHost = (host: string): string =>
  host.toLowerCase().replace(/^www\./, "");

/**
 * Empty allow-list means "no restriction yet". Otherwise the hostname must
 * match an entry exactly (www. is ignored on both sides).
 */
export const isHostAllowed = (host: string, allowed: string[]): boolean => {
  if (allowed.length === 0) {
    return true;
  }

  const target = normalizeHost(host);

  return allowed.some((entry) => {
    const candidate = hostOf(entry);

    return candidate !== null && normalizeHost(candidate) === target;
  });
};

/**
 * The site that embedded the widget. Prefer `X-Embed-Origin` from the iframe
 * (the parent `postMessage` origin) so a third-party host is visible even
 * though the fetch `Origin` is the widget bundle. Fall back to `Origin` so a
 * call made directly from the host page still works.
 */
export const embedHostOf = (request: Request): string | null => {
  return (
    hostOf(request.headers.get("x-embed-origin")) ??
    hostOf(request.headers.get("origin")) ??
    hostOf(request.headers.get("referer"))
  );
};
