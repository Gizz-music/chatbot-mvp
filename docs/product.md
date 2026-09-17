# Chatbot Builder

Chatbot Builder turns your own knowledge base into an embeddable AI chatbot. You upload files or import a website, we index them, and you paste one script tag on any page. Visitors ask questions and get answers grounded in your documents, with citations.

This file is the product documentation used to train the public demo bot on the landing page.

## How it works

Three steps:

1. **Upload.** Add PDF, DOCX, Markdown, TXT or CSV files, or import a public website. The bot only answers from this knowledge base.
2. **Train.** Files are chunked, embedded and indexed. Chat replies stream back and show which document they came from.
3. **Embed.** Copy the script tag from the dashboard. It loads `embed.js`, draws a chat bubble, and opens the widget in an iframe.

You do not need to write a custom model prompt before the bot can answer. A system prompt is optional flavor. The knowledge base is the source of truth.

## Embed snippet

Use the **public key**, never the internal bot id. The snippet looks like this:

```html
<script src="https://your-app.example/embed.js" data-bot="pk_live_your_public_key" async></script>
```

What happens:

- `embed.js` is a host-page loader. It creates a bubble and an iframe pointing at `/widget.html?bot=…`.
- The iframe talks to the host with `postMessage`. The host never receives your dashboard session cookie.
- Leave the domain allow-list empty while you test. On Pro and Business you can lock the widget to chosen hosts.

## File types and indexing

Accepted uploads: **PDF, DOCX, Markdown, TXT, CSV**. You can also import a public website URL.

Each plan caps:

- how many documents sit on one bot
- maximum file size
- monthly messages

If a file is the wrong type, empty, or larger than the plan allows, the dashboard explains why it was rejected.

## Widget look

Every bot has a name, welcome message and accent color. Free keeps the “Powered by Chatbot Builder” badge and locks color/greeting changes. Pro and Business can remove the badge and customize the widget.

## Plans and limits

Prices are USD. Yearly billing is 20% cheaper than paying monthly.

### Free — $0 / month

- 1 bot
- 10 documents per bot
- Files up to 5 MB
- 100 messages / month
- “Powered by” badge on the widget
- Widget color and greeting locked
- Embed from any domain

### Pro — $29 / month, or $276 / year

- 3 bots
- 150 documents per bot
- Files up to 20 MB
- 2,000 messages / month
- Remove the “Powered by” badge
- Widget color and greeting
- Domain allow-list

### Business — $99 / month, or $948 / year

- 10 bots
- 1,000 documents per bot
- Files up to 50 MB
- 10,000 messages / month
- Same widget customisation and allow-list as Pro

Checkout in this MVP is mocked: you can change plans end to end, but no real card is charged. The numbers above are the same matrix the landing page, Billing screen and server-side enforcement use.

## Security notes

- The public key is safe to put on a customer website. It is not the database row id.
- Widget requests send `X-Embed-Origin`. If the bot has an allow-list, other hosts are rejected.
- Owners sign in to the dashboard. Visitors chatting through the widget stay anonymous, with a visitor id stored only in their browser.

## Typical questions

**How do I embed the widget?** Copy the script tag from the bot’s Embed card and paste it before `</body>` on any site.

**What file types can I upload?** PDF, DOCX, Markdown, TXT and CSV. Website import is available from the same knowledge-base card.

**What is included on the Free plan?** One bot, 10 documents, 5 MB files, 100 messages per month, and the “Powered by” badge. Upgrade to Pro when you need more volume or a custom widget.

**Can I remove branding?** Yes, on Pro and Business.

**Do I need an account to try it?** No. The landing page hosts a live demo trained on this document. Creating an account is only required to build your own bot.

**Where do I see analytics and leads?** Open the bot and go to Insights. You get messages per day, top questions, how often the bot had no matching document, captured emails, and CSV export.
