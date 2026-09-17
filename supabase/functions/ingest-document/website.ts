import { messageOf } from "./http.ts";

const USER_AGENT = "chatbot-builder-ingest/1.0 (+https://supabase.com)";
const REQUEST_TIMEOUT_MS = 15_000;

/** A sitemap crawl stops here so one document cannot monopolise the worker. */
const MAX_SITEMAP_PAGES = 20;

/** Caps a single fetched page so a huge download cannot fill the worker. */
const MAX_PAGE_BYTES = 2_000_000;

type FetchedPage = {
  body: string;
  contentType: string;
};

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/**
 * Enough of an HTML-to-text pass for a knowledge base: drop the parts that
 * never carry prose, turn block ends into line breaks, collapse the rest.
 */
const stripHtml = (html: string): string =>
  html
    .replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|table|ul|ol)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(
      /&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/gi,
      (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity,
    )
    .replace(/[^\S\n]+/g, " ")
    .replace(/\s*\n\s*\n\s*/g, "\n\n")
    .trim();

const isPrivateHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.+$/, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  if (host.includes(":")) {
    return (
      host === "::1" ||
      host.startsWith("fe80:") ||
      host.startsWith("fc00:") ||
      host.startsWith("fd")
    );
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);

  if (!ipv4) {
    return false;
  }

  const [oct1, oct2] = [Number(ipv4[1]), Number(ipv4[2])];

  return (
    oct1 === 0 ||
    oct1 === 10 ||
    oct1 === 127 ||
    (oct1 === 169 && oct2 === 254) ||
    (oct1 === 172 && oct2 >= 16 && oct2 <= 31) ||
    (oct1 === 192 && oct2 === 168)
  );
};

const assertPublicHttpUrl = (value: string): URL => {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs can be indexed.");
  }

  if (isPrivateHostname(url.hostname)) {
    throw new Error("That address cannot be crawled.");
  }

  return url;
};

const fetchPage = async (url: string): Promise<FetchedPage> => {
  assertPublicHttpUrl(url);

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  // Followed redirects can land on a private host even if the start URL did not.
  assertPublicHttpUrl(response.url);

  if (!response.ok) {
    throw new Error(
      `${url} answered ${response.status} ${response.statusText}.`,
    );
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);

  if (declaredLength > MAX_PAGE_BYTES) {
    throw new Error(`${url} is larger than the crawl limit.`);
  }

  const body = await response.text();

  if (body.length > MAX_PAGE_BYTES) {
    throw new Error(`${url} is larger than the crawl limit.`);
  }

  return {
    body,
    contentType: response.headers.get("content-type") ?? "",
  };
};

const looksLikeSitemap = ({ body, contentType }: FetchedPage): boolean =>
  contentType.includes("xml") || /<(urlset|sitemapindex)\b/i.test(body);

const readLocations = (xml: string): string[] =>
  [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => match[1]);

/** Expands a sitemap, following a sitemap index one level down. */
const collectPageUrls = async (xml: string): Promise<string[]> => {
  const pages: string[] = [];

  for (const location of readLocations(xml)) {
    if (pages.length >= MAX_SITEMAP_PAGES) {
      break;
    }

    if (!location.endsWith(".xml")) {
      pages.push(location);
      continue;
    }

    const nested = await fetchPage(location);
    pages.push(
      ...readLocations(nested.body).filter((loc) => !loc.endsWith(".xml")),
    );
  }

  return pages.slice(0, MAX_SITEMAP_PAGES);
};

const crawlSitemap = async (xml: string): Promise<string> => {
  const pages = await collectPageUrls(xml);

  if (pages.length === 0) {
    throw new Error("The sitemap listed no pages to index.");
  }

  const sections: string[] = [];

  for (const page of pages) {
    try {
      const { body } = await fetchPage(page);
      sections.push(`# ${page}\n\n${stripHtml(body)}`);
    } catch (cause) {
      // One unreachable page should not sink the whole crawl.
      console.warn(`ingest-document skipped ${page}: ${messageOf(cause)}`);
    }
  }

  if (sections.length === 0) {
    throw new Error("None of the pages listed in the sitemap could be read.");
  }

  return sections.join("\n\n");
};

/**
 * Reads a single page, or every page of a sitemap when the URL points at one.
 */
export const fetchWebsiteText = async (url: string): Promise<string> => {
  const root = await fetchPage(url);

  if (looksLikeSitemap(root)) {
    return crawlSitemap(root.body);
  }

  if (root.contentType.length > 0 && !root.contentType.includes("html")) {
    throw new Error("That URL is not an HTML page or a sitemap.");
  }

  return stripHtml(root.body);
};
