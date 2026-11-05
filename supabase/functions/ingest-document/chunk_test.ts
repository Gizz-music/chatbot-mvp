import { assertEquals } from "../_test/assert.ts";
import { chunkText } from "./chunk.ts";

const paragraph = (label: string, length: number): string => {
  const body = "x".repeat(Math.max(0, length - label.length - 1));

  return `${label}-${body}`;
};

Deno.test("returns nothing for blank input", () => {
  assertEquals(chunkText("  \n\n  "), []);
});

Deno.test("keeps a short document in one chunk", () => {
  assertEquals(chunkText("Hello\n\nworld"), ["Hello\n\nworld"]);
});

Deno.test("splits a long document and keeps every paragraph", () => {
  const parts = ["alpha", "beta", "gamma"].map((label) =>
    paragraph(label, 2000),
  );
  const chunks = chunkText(parts.join("\n\n"));

  if (chunks.length < 2) {
    throw new Error(`expected a split, got ${chunks.length} chunk(s)`);
  }

  for (const part of parts) {
    if (!chunks.some((chunk) => chunk.includes(part))) {
      throw new Error(`missing paragraph ${part.slice(0, 12)}`);
    }
  }
});

Deno.test("repeats the tail of a closed chunk at the start of the next one", () => {
  const first = paragraph("one", 2000);
  const second = paragraph("two", 2000);
  const chunks = chunkText(`${first}\n\n${second}`);

  assertEquals(chunks.length, 2);

  const seam = first.slice(-400);

  if (!chunks[1].startsWith(seam)) {
    throw new Error("second chunk should open with the tail of the first");
  }

  if (!chunks[1].includes(second)) {
    throw new Error("second chunk should include the new paragraph");
  }
});
