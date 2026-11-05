import assert from "node:assert/strict";
import test from "node:test";

import {
  clipDiff,
  hasCritical,
  normalizeReview,
  renderReview,
} from "./review-diff.mjs";

test("clipDiff keeps a short diff and marks a long one", () => {
  assert.deepEqual(clipDiff("abc"), { text: "abc", truncated: false });

  const long = "x".repeat(60_001);
  const clipped = clipDiff(long);

  assert.equal(clipped.truncated, true);
  assert.equal(clipped.text.length, 60_000);
});

test("normalizeReview drops findings the rubric does not allow", () => {
  const review = normalizeReview({
    summary: "  One issue.  ",
    findings: [
      { severity: "critical", file: "supabase/migrations/a.sql", detail: "RLS off" },
      { severity: "nit", file: "client/src/app.tsx", detail: "rename this" },
      { severity: "advisory", file: "", detail: "   " },
    ],
  });

  assert.equal(review.summary, "One issue.");
  assert.deepEqual(review.findings, [
    {
      severity: "critical",
      file: "supabase/migrations/a.sql",
      detail: "RLS off",
    },
  ]);
  assert.equal(hasCritical(review), true);
});

test("renderReview includes the marker and does not approve the PR", () => {
  const body = renderReview({
    summary: "Allow-list would accept a foreign host.",
    truncated: true,
    findings: [
      {
        severity: "critical",
        file: "supabase/functions/chat/origin.ts",
        detail: "www.evil.com matches evil.com",
      },
    ],
  });

  assert.match(body, /chatbot-builder-ai-review/);
  assert.match(body, /Allow-list would accept a foreign host/);
  assert.match(body, /truncated/);
  assert.match(body, /does not approve or merge/);
  assert.doesNotMatch(body, /LGTM/);
});
