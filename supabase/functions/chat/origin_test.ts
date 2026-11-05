import { assertEquals } from "../_test/assert.ts";
import { embedHostOf, hostOf, isHostAllowed } from "./origin.ts";

Deno.test("hostOf reads a hostname and rejects junk", () => {
  assertEquals(hostOf(null), null);
  assertEquals(hostOf("   "), null);
  assertEquals(hostOf("https://Docs.Example.com/a"), "docs.example.com");
  assertEquals(hostOf("localhost:5173"), "localhost");
  assertEquals(hostOf("not a host"), null);
});

Deno.test("an empty allow-list does not restrict the host", () => {
  assertEquals(isHostAllowed("evil.example", []), true);
});

Deno.test("allow-list matches the host exactly and ignores www", () => {
  assertEquals(
    isHostAllowed("www.example.com", ["https://example.com/docs"]),
    true,
  );
  assertEquals(isHostAllowed("example.com", ["www.example.com"]), true);
  assertEquals(isHostAllowed("docs.example.com", ["example.com"]), false);
  assertEquals(isHostAllowed("example.com", ["not a host"]), false);
});

Deno.test("embedHostOf prefers the parent origin", () => {
  const request = new Request("https://app.example/widget-chat", {
    headers: {
      origin: "https://app.example",
      "x-embed-origin": "https://customer.example/docs",
      referer: "https://other.example/",
    },
  });

  assertEquals(embedHostOf(request), "customer.example");
});

Deno.test("embedHostOf falls back to origin, then referer", () => {
  const fromOrigin = new Request("https://app.example/widget-chat", {
    headers: { origin: "https://WWW.Customer.example" },
  });
  const fromReferer = new Request("https://app.example/widget-chat", {
    headers: { referer: "https://docs.customer.example/page" },
  });

  assertEquals(embedHostOf(fromOrigin), "www.customer.example");
  assertEquals(embedHostOf(fromReferer), "docs.customer.example");
});
