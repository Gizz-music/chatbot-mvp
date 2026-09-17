import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCT_PATH = resolve(ROOT, "docs/product.md");
const FILENAME = "product.md";
const MIME = "text/markdown";
const POLL_MS = 2_000;
const POLL_ATTEMPTS = 30;

const envFile = (relative) => {
  try {
    return readFileSync(resolve(ROOT, relative), "utf8");
  } catch {
    return "";
  }
};

const envValue = (name, fallback = "") => {
  const fromProcess = process.env[name]?.trim();

  if (fromProcess) {
    return fromProcess;
  }

  const match = envFile("client/.env.local").match(
    new RegExp(`^${name}=(.*)$`, "m"),
  );

  return match?.[1]?.trim() || fallback;
};

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const jsonHeaders = (token, extra = {}) => ({
  apikey: extra.apikey ?? token,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
  ...extra.headers,
});

const readJson = async (response) => {
  const text = await response.text();

  return text ? JSON.parse(text) : null;
};

const failIf = async (response, label) => {
  if (response.ok) {
    return readJson(response);
  }

  const text = await response.text();
  throw new Error(`${label} ${response.status}: ${text.slice(0, 400)}`);
};

export const seedDemoKnowledgeBase = async ({
  url,
  anonKey,
  email,
  password,
  publicKey,
}) => {
  const product = readFileSync(PRODUCT_PATH);
  const auth = await failIf(
    await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: jsonHeaders(anonKey),
      body: JSON.stringify({ email, password }),
    }),
    "sign-in",
  );
  const token = auth.access_token;
  const rest = (path, init = {}) =>
    fetch(`${url}${path}`, {
      ...init,
      headers: jsonHeaders(token, { apikey: anonKey, headers: init.headers }),
    });

  const bots = await failIf(
    await rest(
      `/rest/v1/bots?public_key=eq.${encodeURIComponent(publicKey)}&select=id,name,status`,
    ),
    "load bot",
  );
  const bot = Array.isArray(bots) ? bots[0] : null;

  if (!bot) {
    throw new Error(`Demo bot ${publicKey} was not found.`);
  }

  const existing = await failIf(
    await rest(
      `/rest/v1/documents?bot_id=eq.${bot.id}&filename=eq.${FILENAME}&select=id,status,error,chunks_count,storage_path&order=created_at.desc`,
    ),
    "list documents",
  );
  const ready = existing.find((item) => item.status === "ready");

  if (ready) {
    console.log(
      `Demo knowledge base already indexed: ${FILENAME} (${ready.chunks_count} chunks).`,
    );
    return ready;
  }

  const pending = existing.find(
    (item) => item.status === "pending" || item.status === "processing",
  );
  let document = pending;

  if (!document) {
    const storagePath = `${bot.id}/${randomUUID()}.md`;
    const created = await failIf(
      await rest("/rest/v1/documents", {
        method: "POST",
        body: JSON.stringify({
          bot_id: bot.id,
          filename: FILENAME,
          storage_path: storagePath,
          mime: MIME,
          size: product.byteLength,
          source_type: "file",
        }),
      }),
      "insert document",
    );
    document = Array.isArray(created) ? created[0] : created;

    const upload = await fetch(
      `${url}/storage/v1/object/documents/${storagePath}`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": MIME,
          "x-upsert": "true",
        },
        body: product,
      },
    );

    if (!upload.ok) {
      const text = await upload.text();
      throw new Error(`upload ${upload.status}: ${text.slice(0, 400)}`);
    }
  }

  const ingest = await fetch(`${url}/functions/v1/ingest-document`, {
    method: "POST",
    headers: jsonHeaders(token, { apikey: anonKey }),
    body: JSON.stringify({ documentId: document.id }),
  });

  if (!ingest.ok && ingest.status !== 202) {
    const text = await ingest.text();
    throw new Error(`ingest ${ingest.status}: ${text.slice(0, 400)}`);
  }

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const rows = await failIf(
      await rest(
        `/rest/v1/documents?id=eq.${document.id}&select=id,status,error,chunks_count`,
      ),
      "poll document",
    );
    const current = rows[0];

    if (current?.status === "ready") {
      console.log(
        `Indexed ${FILENAME} for ${bot.name}: ${current.chunks_count} chunks.`,
      );
      return current;
    }

    if (current?.status === "failed") {
      throw new Error(`Ingestion failed: ${current.error ?? "unknown error"}`);
    }

    await sleep(POLL_MS);
  }

  throw new Error("Ingestion timed out before the document became ready.");
};

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const url = envValue("VITE_SUPABASE_URL");
  const anonKey = envValue("VITE_SUPABASE_ANON_KEY");
  const publicKey = envValue("VITE_DEMO_BOT_PUBLIC_KEY");
  const email = envValue("DEMO_SEED_EMAIL", "reviewer@chatbot-builder.dev");
  const password = envValue("DEMO_SEED_PASSWORD", "Reviewer-Demo-2026");

  if (!url || !anonKey || !publicKey) {
    throw new Error(
      "Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_DEMO_BOT_PUBLIC_KEY.",
    );
  }

  await seedDemoKnowledgeBase({ url, anonKey, email, password, publicKey });
}
