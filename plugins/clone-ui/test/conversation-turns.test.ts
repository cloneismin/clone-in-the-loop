import assert from "node:assert/strict";
import test from "node:test";
import type { Message } from "../src/api.ts";
import { conversationTurns } from "../src/conversation-turns.ts";

function message(id: string, role: Message["role"], overrides: Partial<Message> = {}): Message {
  return Object.freeze({
    id,
    role,
    cloneId: "min",
    content: `Original content ${id}`,
    createdAt: "2026-09-27T12:00:00Z",
    ...overrides,
  });
}

test("legacy review and adjacent direction form one Clone reply even after a long gap", () => {
  const review = message("review", "review");
  const direction = message("direction", "clone", { createdAt: "2026-09-28T12:00:00Z" });
  assert.deepEqual(conversationTurns([review, direction]), [[review, direction]]);
});

test("agent replies, distinct owners, and consecutive attempts preserve their own turns", () => {
  const messages = Object.freeze([
    message("first", "clone"),
    message("retry", "clone"),
    message("result", "assistant"),
    message("review", "review"),
    message("teammate", "clone", { cloneId: "jun" }),
    message("review-again", "review"),
    message("result-again", "assistant"),
    message("next", "clone"),
  ]);
  const turns = conversationTurns(messages);
  assert.deepEqual(
    turns.map((turn) => turn.length),
    messages.map(() => 1),
  );
  turns.flat().forEach((entry, index) => assert.equal(entry, messages[index]));
});

test("durable combined replies and reply identities never use legacy grouping", () => {
  const review = message("legacy-review", "review");
  const combined = message("combined", "clone", {
    content: "The draft needs evidence.\n\nAdd the supporting source.",
    executionInstruction: "Add the supporting source.",
  });
  const result = message("result", "assistant", { replyTo: combined.id });
  assert.deepEqual(conversationTurns([review, combined, result]), [[review], [combined], [result]]);
  const linkedDirection = message("linked", "clone", { replyTo: review.id });
  assert.deepEqual(conversationTurns([review, linkedDirection]), [[review], [linkedDirection]]);
});

test("legacy grouping preserves every original record and source without mutating history", () => {
  const source = { id: "source", title: "Launch review", source: "Shared history", excerpt: "Ask for evidence." };
  const messages = Object.freeze([
    message("user", "user"),
    message("agent", "assistant"),
    message("review", "review", { sources: [source] }),
    message("direction", "clone", { sources: [source] }),
    message("retry", "clone"),
  ]);
  const turns = conversationTurns(messages);
  assert.deepEqual(
    turns.map((turn) => turn.length),
    [1, 1, 2, 1],
  );
  turns.flat().forEach((entry, index) => assert.equal(entry, messages[index]));
  assert.equal(turns[2][0].sources?.[0], source);
  assert.equal(turns[2][1].sources?.[0], source);
  assert.deepEqual(conversationTurns([]), []);
});

test("unknown Clone ownership cannot combine legacy records", () => {
  const messages = [
    message("review", "review", { cloneId: undefined }),
    message("next", "clone", { cloneId: undefined }),
  ];
  assert.deepEqual(
    conversationTurns(messages),
    messages.map((entry) => [entry]),
  );
});
