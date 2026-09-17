/**
 * Normalises what someone types into an address the crawler can fetch, so
 * `example.com/docs` is as good as the full URL. Returns null when it is not a
 * usable http(s) address.
 */
export const toWebsiteUrl = (raw: string): string | null => {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);

    // Rules out typos like "localhost" or a bare word that parses as a URL.
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
};
