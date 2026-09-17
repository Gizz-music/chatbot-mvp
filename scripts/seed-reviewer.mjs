import { readFileSync } from "node:fs";

import { seedDemoKnowledgeBase } from "./seed-demo-kb.mjs";

const EMAIL = "reviewer@chatbot-builder.dev";
const PASSWORD = "Reviewer-Demo-2026";
const URL = "https://qgraaepfqhpuokvtgqlo.supabase.co";
const DEMO_PREFIX = "pk_live_23557479";
const DEMO_PUBLIC_KEY = "pk_live_235574794ae747e4b2fea8679795d008";

const keys = JSON.parse(readFileSync(0, "utf8"));
const list = Array.isArray(keys) ? keys : (keys.keys ?? keys.apiKeys ?? []);
const service =
  list.find((item) => {
    const blob = JSON.stringify(item).toLowerCase();
    return blob.includes("service") || item.name === "service_role";
  })?.api_key ?? list.find((item) => item.name === "service_role")?.api_key;

if (!service) {
  console.error(
    "No service_role key. Names:",
    list.map((item) => item.name ?? item.id ?? item.type),
  );
  process.exit(1);
}

const rest = async (path, init = {}) => {
  const response = await fetch(`${URL}${path}`, {
    ...init,
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${path} ${response.status}: ${text.slice(0, 400)}`);
  }

  return body;
};

try {
  await rest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Reviewer" },
    }),
  });
} catch (error) {
  if (!/already|registered|exists|duplicate/i.test(String(error))) {
    throw error;
  }
}

const listed = await rest("/auth/v1/admin/users");
const users = listed.users ?? listed;
const user = users.find((item) => item.email === EMAIL);

if (!user) {
  throw new Error("Reviewer user missing after create.");
}

const bots = await rest(
  `/rest/v1/bots?public_key=like.${DEMO_PREFIX}*&select=id`,
);
const demo = Array.isArray(bots) ? bots[0] : null;

if (!demo) {
  throw new Error("Demo bot not found.");
}

await rest(`/rest/v1/bots?id=eq.${demo.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    user_id: user.id,
    name: "Chatbot Builder docs",
    description: "Seeded for the reviewer. Trained on docs/product.md.",
    status: "active",
  }),
});

const conversations = await rest(
  `/rest/v1/conversations?bot_id=eq.${demo.id}&select=id`,
);

if (!conversations.length) {
  const [conversation] = await rest("/rest/v1/conversations", {
    method: "POST",
    body: JSON.stringify({
      bot_id: demo.id,
      source: "widget",
      visitor_id: "reviewer-seed",
      title: "How do I embed the widget?",
    }),
  });

  await rest("/rest/v1/messages", {
    method: "POST",
    body: JSON.stringify([
      {
        conversation_id: conversation.id,
        role: "user",
        content: "How do I embed the widget?",
      },
      {
        conversation_id: conversation.id,
        role: "assistant",
        content:
          "Copy the script tag from the bot’s Embed card and paste it before </body> on any site. Use the public key, never the internal bot id.",
        unanswered: false,
      },
      {
        conversation_id: conversation.id,
        role: "user",
        content: "What is the capital of Mars?",
      },
      {
        conversation_id: conversation.id,
        role: "assistant",
        content:
          "I do not have that information in the uploaded documents. Try adding a file that covers it.",
        unanswered: true,
      },
    ]),
  });

  await rest("/rest/v1/leads", {
    method: "POST",
    body: JSON.stringify({
      bot_id: demo.id,
      conversation_id: conversation.id,
      email: "visitor@example.com",
      name: "Sample visitor",
    }),
  });
}

await seedDemoKnowledgeBase({
  url: URL,
  anonKey: service,
  email: EMAIL,
  password: PASSWORD,
  publicKey: DEMO_PUBLIC_KEY,
});

console.log("Reviewer ready:", EMAIL);
