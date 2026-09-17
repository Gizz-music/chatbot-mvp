# Chatbot Builder

**Chatbot Builder turns your own documents into an AI chatbot you can embed on any website with a single script tag.**

You sign up, create a bot, and upload your knowledge base — PDF, DOCX, Markdown, TXT, CSV, or a public website URL. The files are parsed, split into chunks, embedded, and stored as vectors. From then on the bot answers only from that material: every reply streams in token by token and carries citations pointing at the source documents. When you are happy with it, you copy one `<script>` tag into your own site and visitors get the same bot in a chat bubble, without ever seeing your dashboard or your internal ids.

Alongside the chat itself the product covers what a small SaaS needs around it: authentication, per-bot knowledge-base management, a domain allow-list for the widget, conversation history, an Insights screen with lead capture and CSV export, and three billing tiers whose limits are enforced server-side.

This is a full-stack MVP built as a take-home project. It is deliberately end-to-end rather than deep: real retrieval-augmented generation, real row-level security, real quota enforcement — but checkout is mocked and no payment provider is wired in.

## How it works

1. **Upload** — files go to Supabase Storage, or you point the importer at a URL.
2. **Index** — the `ingest-document` Edge Function extracts text, chunks it (800 tokens, 100 overlap), embeds each chunk with Gemini, and writes vectors to Postgres (`pgvector`).
3. **Ask** — the `chat` / `widget-chat` functions embed the question, fetch the closest chunks with a cosine HNSW search, and stream a grounded answer back over Server-Sent Events.
4. **Embed** — `embed.js` on the customer's page draws a bubble and loads the widget in an iframe, authenticated by the bot's **public key**.

## Stack

| Layer | Choice |
| --- | --- |
| Client | React 19, TypeScript, Vite 8, React Router 7, TanStack Query 5, CSS Modules |
| Architecture | Feature-Sliced Design |
| Backend | Supabase — Postgres + `pgvector`, RLS, Auth, Storage |
| Server logic | Supabase Edge Functions (Deno) |
| Embeddings | Gemini `gemini-embedding-001`, 1536 dimensions |
| Generation | Gemini `gemini-3.5-flash-lite`, streamed |
| Hosting | Vercel (client), Supabase (database and functions) |

There is no backend server to run: everything server-side is a Postgres function, an RLS policy, or an Edge Function.

## Reviewer login

This account already owns a bot indexed on this repo's `docs/product.md`:

| Field | Value |
| --- | --- |
| Email | `reviewer@chatbot-builder.dev` |
| Password | `Reviewer-Demo-2026` |

What to check after login:

1. **Dashboard** — open the seeded bot.
2. **Chat** — ask "How do I embed the widget?" and "What is on the Free plan?" Answers stream in and show citation chips. Ask something off-topic to see the "no matching document" path.
3. **Insights** — messages per day, top questions, unanswered share, captured leads, CSV export.
4. **Configure** — file upload, website import, embed snippet, bot settings.
5. **Billing** — plan switch through the mocked checkout, no real card.

The **Demo** widget on the landing page is the same product trained on the same file, and needs no account.

## Local setup

Prerequisites: Node 20+, a [Supabase](https://supabase.com) project, and a Gemini API key for embeddings and chat.

```bash
cd client
cp .env.example .env.local
npm install
npm run dev
```

`client/.env.local`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_DEMO_BOT_PUBLIC_KEY=
```

`VITE_DEMO_BOT_PUBLIC_KEY` is the public key of the bot rendered on the landing page. Create that bot in the dashboard and index `docs/product.md` on it, otherwise the landing-page demo has an empty knowledge base.

### Supabase

1. Link the CLI: `npx supabase link --project-ref <ref>`.
2. Apply migrations: `npx supabase db push`.
3. Deploy functions: `npx supabase functions deploy`.
4. Set function secrets: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Auth → URL Configuration: Site URL = your app origin. Redirect allow-list: `http://localhost:5173/auth/callback` and `https://<your-vercel-app>/auth/callback`.

The twelve migrations in `supabase/migrations/` cover profiles, billing, bots, the knowledge base, conversations and leads, document ingestion, chat and chat runtime, widget embedding, plan entitlements, insights, and the `match_chunks` retrieval function.

`supabase/config.toml` matters for two reasons: the edge runtime uses `policy = "per_worker"` so `ingest-document` can keep parsing and embedding in the background after it has answered, and JWT verification is turned off for the functions that validate tokens themselves (`chat`, `widget-chat`, `mock-checkout`).

### Seeding the demo knowledge base

Once the demo bot exists and the env vars are set, index `docs/product.md` on it:

```bash
node scripts/seed-demo-kb.mjs
```

The script reads the env values from `client/.env.local`, uploads the file, calls `ingest-document`, and polls until the document is `ready`. It is idempotent — if the document is already indexed it exits without doing anything.

`scripts/seed-reviewer.mjs` provisions the reviewer account above with sample conversations and a lead. It is pinned to the original Supabase project and needs a `service_role` key on stdin, so treat it as a record of how the demo data was produced rather than a script to run against your own project.

### Vercel

1. Import the repo.
2. Root directory: `client`.
3. Framework: Vite.
4. Environment variables: the three `VITE_*` keys above.
5. Redeploy after changing env — Vite inlines them at build time.

`client/vercel.json` rewrites SPA routes to `index.html` while leaving `widget.html`, `embed.js` and the static assets untouched. `vite.config.ts` builds two entry points: the dashboard (`index.html`) and the widget iframe (`widget.html`).

## Scripts

Run from `client/`:

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, writes |
| `npm run format:check` | Prettier, check only |
| `npm run preview` | Serve the production build |

## Product surface

- **Landing** (`/`) — how it works, a live demo widget, the embed snippet, pricing, FAQ.
- **Auth** (`/login`) — email and password, or a magic link. Everything under `/dashboard` requires a session.
- **Dashboard** (`/dashboard`) — bot list, creation, deletion.
- **Bot** (`/dashboard/bot/:id`) — knowledge base (upload, website import, document status), embed snippet, widget preview, settings: name, welcome message, accent colour, domain allow-list.
- **Chat** (`/dashboard/bot/:id/chat`) — owner-side chat with conversation history and citations.
- **Insights** (`/dashboard/bot/:id/insights`) — messages per day over the last 14 days, top questions, share of answers with no matching document, captured leads, and CSV export for both insights and leads.
- **Billing** (`/dashboard/billing`, `/checkout`) — plan comparison and the mocked checkout.
- **Widget** — the embeddable bubble. Visitors stay anonymous behind a visitor id kept in their own browser.

### Knowledge base details

| Input | Handling |
| --- | --- |
| `.pdf` | text extracted with `unpdf` |
| `.docx` | text extracted with `mammoth` |
| `.md`, `.txt`, `.csv` | decoded as UTF-8 |
| URL | one page indexed as-is; point at a `sitemap.xml` instead and the first 20 listed pages are crawled |

Files are validated by extension, rejected when empty, and capped by the plan's file-size limit. Extracted text is truncated at 400 000 characters.

### Lead capture

In the widget, an email form appears once a conversation exists — that is, from the visitor's first message onwards — and disappears after submission. A flag in the visitor's `localStorage` keeps it from reappearing on later visits. Email is required, name is optional. Captured leads show up on Insights and in the leads CSV.

## Plans

Prices in USD; yearly billing is 20% cheaper than monthly.

| | Free | Pro | Business |
| --- | --- | --- | --- |
| Price / month | $0 | $29 | $99 |
| Price / year | — | $276 | $948 |
| Bots | 1 | 3 | 10 |
| Documents per bot | 10 | 150 | 1 000 |
| Max file size | 5 MB | 20 MB | 50 MB |
| Messages / month | 100 | 2 000 | 10 000 |
| Remove "Powered by" badge | — | yes | yes |
| Widget colour and greeting | — | yes | yes |
| Domain allow-list | — | yes | yes |

Bot, document, file-size and message limits are enforced in Postgres (`check_bot_limit` and `enforce_document_limits` triggers, the `consume_message_quota` function) and re-checked in the Edge Functions, so the client cannot talk its way past them. The widget-customisation gates are UI-level. Checkout is mocked: plans change end to end, nothing is charged.

## Architecture

Feature-Sliced Design, imports flowing one way: `app` → `pages` → `widgets` → `features` → `entities` → `shared`.

```
client/src/
  app/        router, layouts, providers, global styles
  pages/      route-level screens
  widgets/    header, footer, sidebars, nav
  features/   auth, chat, upload, import, settings, billing, embed snippet
  entities/   bot, document, conversation, lead, plan, analytics, session
  shared/     ui kit, api clients, config, helpers
  widget/     the iframe app served by widget.html (separate from `widgets/`)
client/public/embed.js   host-page loader
docs/product.md          knowledge base for the demo bot
scripts/                 seeding scripts
supabase/functions/      chat, widget-chat, ingest-document, mock-checkout, _shared
supabase/migrations/     schema, RLS, triggers, RPCs
```

| Piece | Role |
| --- | --- |
| Vite SPA (`client/`) | Landing, dashboard, widget iframe |
| `public/embed.js` | Loader for the customer's page |
| Postgres + RLS | Bots, documents, chunks, conversations, messages, leads, plan limits |
| `ingest-document` | Extract → chunk → embed → store; continues in the background via `EdgeRuntime.waitUntil` |
| `chat` | Dashboard chat; verifies the user JWT itself |
| `widget-chat` | Public chat by public key; checks the origin against the allow-list |
| `mock-checkout` | Plan changes without a payment provider |

### Retrieval

Chunks are stored as `vector(1536)` with an HNSW index on `vector_cosine_ops`. The `match_chunks` RPC embeds the question, takes the six closest chunks from `ready` documents belonging to that bot, and filters by cosine similarity. Citations are de-duplicated per document before being streamed to the client. A reply is recorded as *unanswered* when retrieval returned no chunks at all — that flag, not the wording of the model's reply, is what Insights counts.

Answers stream the whole way through: Gemini SSE → the Edge Function's `ReadableStream` → `fetch` body reader in the browser → the transcript UI.

### Widget security

The embed snippet carries the bot's **public key**, never its database id:

```html
<script src="https://your-app.example/embed.js" data-bot="pk_live_…" async></script>
```

`embed.js` creates the bubble and an iframe at `/widget.html?bot=…`; the two sides talk over `postMessage`, so the host page never touches the dashboard session. The widget sends the host origin as `X-Embed-Origin`, and `widget-chat` checks it against the bot's `allowed_domains` — an empty list means any origin is allowed. Visitors are never authenticated; they get a visitor id stored locally.
