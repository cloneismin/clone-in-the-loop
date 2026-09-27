import assert from "node:assert/strict";
import test from "node:test";
import { parseMarkdown } from "../src/markdown.ts";

test("a heading followed immediately by a checklist keeps distinct blocks", () => {
  const output = parseMarkdown(
    "## Two-week launch checklist\n- Days 1–3: interview founders\n- Days 4–7: test the message",
  );
  assert.match(output, /<h2>Two-week launch checklist<\/h2>\s*<ul>/);
  assert.match(output, /<li>Days 1–3: interview founders<\/li>/);
  assert.doesNotMatch(output, /<h2>[^<]*Days/);
});

test("GFM tables, task state, soft line breaks, and artifact links retain their structure", () => {
  const output = parseMarkdown(
    "| Phase | Owner |\n| --- | --- |\n| Review | Min |\n\n- [x] Review completed\n- [ ] Collect feedback\n\nFirst line\nSecond line\n\n[Open artifact](https://example.invalid/artifact)",
  );
  assert.match(output, /<table>/);
  assert.match(output, /<th>Phase<\/th>/);
  assert.match(output, /<td>Min<\/td>/);
  assert.match(output, /☑ Review completed/);
  assert.match(output, /☐ Collect feedback/);
  assert.match(output, /First line<br>Second line/);
  assert.match(output, /<a href="https:\/\/example\.invalid\/artifact">Open artifact<\/a>/);
});
