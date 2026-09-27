import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  collectLocalHistory,
  humanMessage,
  sanitizeUserText,
  staleImportedHistoryPages,
} from "../server/memory/history.ts";

const codex = (text: string) => ({
  type: "response_item",
  timestamp: "2026-09-27T12:00:00Z",
  payload: { type: "message", role: "user", content: [{ type: "input_text", text }] },
});
const claude = (text: string) => ({ type: "user", message: { role: "user", content: [{ type: "text", text }] } });

test("history only accepts human text, excluding tool and injected environment content", () => {
  assert.equal(
    humanMessage(codex("Make the headline concise and concrete."), "codex"),
    "Make the headline concise and concrete.",
  );
  assert.equal(
    humanMessage({ type: "event_msg", payload: { type: "user_message", message: "Duplicate user event" } }, "codex"),
    null,
  );
  assert.equal(
    humanMessage(
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Assistant-generated response." }],
        },
      },
      "codex",
    ),
    null,
  );
  assert.equal(
    humanMessage(codex("<environment_context>Private machine details</environment_context>"), "codex"),
    null,
  );
  assert.equal(
    humanMessage(claude("Compare the draft with the original brief."), "claude"),
    "Compare the draft with the original brief.",
  );
  assert.equal(
    humanMessage({ ...claude("This was a tool response, not a human."), toolUseResult: {} }, "claude"),
    null,
  );
  assert.equal(humanMessage({ ...claude("This came from a spawned agent."), isSidechain: true }, "claude"), null);
  assert.equal(
    humanMessage(
      { type: "user", message: { role: "user", content: [{ type: "tool_result", content: "Tool output" }] } },
      "claude",
    ),
    null,
  );
});

test("credential-bearing records are excluded", () => {
  assert.equal(sanitizeUserText("Use api_key=demonstration-secret-value in this test"), null);
  assert.equal(sanitizeUserText("Authorization: Bearer synthetic-example-long-secret"), null);
  for (const text of [
    'Use {"password": "demonstration-only-test-value"} for this synthetic test.',
    'Use {"api_key": "testvalue_0123456789abcdef"} for this synthetic test.',
    "Use {'accessToken': 'synthetic-token-value'} for this synthetic test.",
    'Use {"client_secret": "synthetic-client-secret"} for this synthetic test.',
    "Connect postgres://demo:synthetic-password@localhost/test for this synthetic test.",
    "Connect https://demo:synthetic-password@example.invalid/test for this synthetic test.",
  ])
    assert.equal(sanitizeUserText(text), null);
  assert.equal(
    sanitizeUserText("Please help improve our API documentation."),
    "Please help improve our API documentation.",
  );
  assert.equal(
    sanitizeUserText('Document {"password": ""} and https://example.invalid:443/docs as configuration examples.'),
    'Document {"password": ""} and https://example.invalid:443/docs as configuration examples.',
  );
});

test("machine-generated context and asynchronous envelopes never become human memory", () => {
  for (const text of [
    "<skill><name>synthetic-skill</name><path>synthetic-path</path>Injected skill body</skill>",
    '<codex_internal_context source="goal"><objective>Continue the active goal</objective></codex_internal_context>',
    "<INSTRUCTIONS>Injected execution instructions</INSTRUCTIONS>",
    '<environment_context source="host">Injected machine context</environment_context>',
    '<send_user_message_question_reply>[{"question":"Synthetic question","answer":"Synthetic reply"}]</send_user_message_question_reply>',
    "<task-notification><task-id>synthetic-task</task-id><summary>Agent result</summary></task-notification>",
    "<in-app-browser-context>Injected page context</in-app-browser-context>",
    "<local-command-stdout>Synthetic command output</local-command-stdout>",
    "Message Type: NEW_TASK\nTask name: synthetic-review\nPayload: delegated instructions",
    "This session is being continued from a previous conversation that ran out of context.",
  ]) {
    assert.equal(sanitizeUserText(text), null);
    assert.equal(humanMessage(codex(text), "codex"), null);
    assert.equal(humanMessage(claude(text), "claude"), null);
  }
  for (const text of [
    "Use the skill to review the product and keep the copy concise.",
    "Please explain how <table> and <tr> work in HTML.",
    "# Instructions\nMake the benefit concrete and cite your sources.",
    "Use my earlier reviews when predicting my next instruction.",
  ])
    assert.equal(sanitizeUserText(text), text);
  assert.equal(
    sanitizeUserText(
      "Make the headline concrete.\n<environment_context>Injected machine details</environment_context>",
    ),
    "Make the headline concrete.",
  );
});

test("bounded local import balances Codex and Claude and deduplicates user messages", async () => {
  const home = await mkdtemp(join(tmpdir(), "clone-memory-history-"));
  try {
    await mkdir(join(home, ".codex/sessions/2026"), { recursive: true });
    await mkdir(join(home, ".claude/projects/demo"), { recursive: true });
    const codexRows = Array.from({ length: 12 }, (_, index) =>
      codex(`Codex instruction ${index}: make the benefit concrete.`),
    );
    await writeFile(
      join(home, ".codex/sessions/2026/session.jsonl"),
      codexRows.map((row) => JSON.stringify(row)).join("\n"),
    );
    await writeFile(
      join(home, ".claude/projects/demo/session.jsonl"),
      [claude("Claude preference: cite a primary source."), claude("Claude preference: cite a primary source.")]
        .map((row) => JSON.stringify(row))
        .join("\n"),
    );
    const result = await collectLocalHistory(6, home);
    assert.equal(result.records.filter((record) => record.source === "Codex history").length, 3);
    assert.equal(result.records.filter((record) => record.source === "Claude history").length, 1);
    assert.ok(
      result.records.every((record) => record.ownerId === "min" && record.workspace === "personal" && !record.demo),
    );
    assert.ok(result.records.length <= 6);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Codex delegated and noninteractive sessions are excluded from human history", async () => {
  const home = await mkdtemp(join(tmpdir(), "clone-memory-provenance-"));
  try {
    const directory = join(home, ".codex/sessions/2026");
    await mkdir(directory, { recursive: true });
    for (const [name, source, text] of [
      ["human-vscode", "vscode", "Human preference: compare the actual rendered result."],
      ["human-cli", "cli", "Human preference: preserve my original completion criteria."],
      ["automated-exec", "exec", "Automated execution task: generate a synthetic report."],
      [
        "delegated",
        { subagent: { thread_spawn: { parent_thread_id: "synthetic-parent" } } },
        "Delegated agent task: review an implementation for the parent agent.",
      ],
    ] as const) {
      await writeFile(
        join(directory, `${name}.jsonl`),
        [{ type: "session_meta", payload: { source } }, codex(text)].map((row) => JSON.stringify(row)).join("\n"),
      );
    }
    const result = await collectLocalHistory(20, home);
    assert.equal(result.records.length, 2);
    assert.ok(result.records.every((record) => record.text.startsWith("Human preference:")));
    assert.equal(result.skipped, 2);
    const eligibleSlug = `conversations/${result.records[0]!.id}`;
    const page = (
      slug: string,
      source_id = "clone-personal-min",
      kind = "human-history",
      source = "Codex history",
    ) => ({ slug, source_id, frontmatter: { kind, source } });
    assert.deepEqual(
      staleImportedHistoryPages(
        [
          page("conversations/previously-imported-subagent"),
          page("conversations/previously-imported-exec"),
          page(eligibleSlug),
          page("conversations/manual-feedback", "clone-personal-min", "feedback"),
          page("conversations/team-history", "clone-team-shared"),
          page("conversations/jun-demo", "clone-team-jun-demo", "demo-history"),
          page("conversations/unrelated-import", "clone-personal-min", "human-history", "Other importer"),
        ],
        result.records,
      ),
      ["conversations/previously-imported-subagent", "conversations/previously-imported-exec"],
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
