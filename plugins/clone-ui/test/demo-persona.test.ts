import assert from "node:assert/strict";
import test from "node:test";
import { CLONES, type Goal } from "../server/domain.ts";
import { executionPrompt, reviewPrompt } from "../server/prompts.ts";
import { QM } from "../server/qm.ts";

test("the renamed teammate preserves its durable identity and declares its invented provenance", () => {
  const teammate = CLONES.find((clone) => clone.id === "jun");
  assert.equal(teammate?.name, "Garry Tan");
  assert.equal(teammate?.demo, true);
  const goal = {
    title: "Review a launch",
    project: "Marketing",
    workspace: "team",
    cloneId: "jun",
    criteria: [],
  } as unknown as Goal;
  for (const prompt of [executionPrompt(goal, "Review it"), reviewPrompt(goal, [], [])]) {
    assert.match(prompt, /Clone Garry/);
    assert.match(prompt, /fictional demo teammate|fictional Garry Tan demo teammate/);
    assert.match(prompt, /invented history/);
    assert.doesNotMatch(prompt, /affiliation|endorsement/);
    assert.doesNotMatch(prompt, /Clone Jun/);
  }
});

test("QM directory and team turns use the new name with the existing principal", async () => {
  const qm = new QM();
  const requests: { path: string; body: unknown }[] = [];
  qm.request = async (path, body) => {
    requests.push({ path, body });
    return path.startsWith("/v1/turns") ? { reply: "Ready" } : {};
  };
  await qm.initialize();
  await qm.turn({ threadId: "rename-test", text: "Review", workspace: "team", signal: new AbortController().signal });
  const directory = requests[0]!.body as { members: { principalId: string; displayName: string }[] };
  assert.equal(directory.members.find((member) => member.principalId === "jun@clone.local")?.displayName, "Garry Tan");
  const turn = requests[1]!.body as { conversation: { audience: { externalId: string; displayName: string }[] } };
  assert.equal(
    turn.conversation.audience.find((member) => member.externalId === "jun@clone.local")?.displayName,
    "Garry Tan",
  );
});
