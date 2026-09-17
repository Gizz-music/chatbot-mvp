export const HERO = {
  kicker: "Embeddable AI chat",
  title: "A chatbot that answers from your files — live on any website.",
  body: "Upload your docs, we index them, you paste one script tag. Visitors get cited answers from your knowledge base. Try the live widget on this page before you create an account.",
  primary: "Start free",
  primaryAuthenticated: "Open dashboard",
  secondary: "Try the live demo",
} as const;

export const STEPS = [
  {
    id: "upload",
    title: "Upload",
    body: "Drop PDF, DOCX, Markdown, TXT or CSV files, or import a website. The bot only ever sees this knowledge base.",
  },
  {
    id: "train",
    title: "Train",
    body: "We chunk, embed and index the files. Answers come with citations so you can see which document they used.",
  },
  {
    id: "embed",
    title: "Embed",
    body: "Paste one script tag. A bubble opens the widget in an iframe — no backend of yours required.",
  },
] as const;

export const FEATURES = [
  {
    id: "citations",
    title: "Grounded answers",
    body: "Replies stay inside your documents and show the file they came from.",
  },
  {
    id: "embed",
    title: "One-line embed",
    body: "A public key and embed.js. The host page never sees your internal bot id.",
  },
  {
    id: "domains",
    title: "Domain allow-list",
    body: "Lock the widget to the sites you choose, or leave it open while you test.",
  },
  {
    id: "look",
    title: "Widget look",
    body: "Accent color, greeting and branding follow the plan — Pro and Business unlock the rest.",
  },
  {
    id: "history",
    title: "History and insights",
    body: "Owners see every thread, messages by day, top questions and when the bot could not answer.",
  },
  {
    id: "plans",
    title: "Limits that are honest",
    body: "Bots, files, size and monthly messages are the same numbers on this page and in Billing.",
  },
] as const;

export const DEMO = {
  kicker: "Live demo",
  title: "Ask the bot trained on these docs.",
  body: "This is the real widget, not a mock. It answers from Chatbot Builder’s own product documentation, so you can test retrieval, citations and streaming before you sign up.",
  prompts: [
    "How do I embed the widget?",
    "What file types can I upload?",
    "What is included on the Free plan?",
  ],
} as const;

export const SNIPPET = {
  kicker: "Embed",
  title: "One script tag. That is the whole install.",
  body: "The script draws a bubble and loads the chat UI in an iframe. Use the public key from the dashboard — never the internal id.",
  placeholderKey: "pk_live_your_public_key",
} as const;

export const PRICING = {
  kicker: "Pricing",
  title: "Start free. Upgrade when the widget is live.",
  body: "Every limit on these cards is the same matrix Billing uses. Nothing here is a separate marketing number.",
} as const;

export const FAQ = [
  {
    question: "Do I have to write prompts before the bot can answer?",
    answer:
      "No. Upload files or import a website, wait for indexing, then chat. A system prompt is optional flavor — the knowledge base is the source of truth.",
  },
  {
    question: "Which files can I upload?",
    answer:
      "PDF, DOCX, Markdown, TXT and CSV. You can also import a public website. Each plan caps file size and how many documents sit on a bot.",
  },
  {
    question: "How does the embed work?",
    answer:
      "You paste a script tag with your public key. embed.js opens a bubble that loads /widget.html in an iframe and talks to it with postMessage. Third-party sites never receive your session cookie.",
  },
  {
    question: "Is the demo on this page a real bot?",
    answer:
      "Yes. It is the production widget pointed at a bot trained on Chatbot Builder’s own documentation. Ask it how to embed, what the plans include, or which file types we index.",
  },
  {
    question: "Can I remove the “Powered by” badge?",
    answer:
      "Free keeps the badge. Pro and Business can hide it, change the widget color and greeting, and restrict which domains may load the embed.",
  },
  {
    question: "Where do I see chats, missed answers and leads?",
    answer:
      "Open the bot in the dashboard and go to Insights. You get messages per day, top questions, the share of answers with no matching document, captured emails, and CSV export.",
  },
  {
    question: "Do you charge a real card?",
    answer:
      "Not in this MVP. Checkout is mocked so you can change plans end to end. The prices and limits still match what a paid product would enforce.",
  },
] as const;

export const FINAL_CTA = {
  title: "Put a chatbot on your site this afternoon.",
  body: "Create a free bot, upload a few files, paste the snippet. The live demo above is the same widget your visitors will get.",
  action: "Start free",
  actionAuthenticated: "Go to dashboard",
} as const;
