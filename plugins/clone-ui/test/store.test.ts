import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { Store } from "../server/store.ts";

const databaseUrl = process.env.CLONE_TEST_DATABASE_URL;

test(
  "message persistence and execution state commit together and reject stale generations",
  { skip: !databaseUrl },
  async () => {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const store = new Store(databaseUrl!);
    await store.pool.end();
    let duplicateId: string | undefined;
    store.pool = {
      query: async (text: string, values?: unknown[]) => {
        const parameters = values ? [...values] : undefined;
        if (duplicateId && text.includes("INSERT INTO clone_loop.messages") && parameters) parameters[0] = duplicateId;
        return client.query(text, parameters);
      },
    } as unknown as pg.Pool;
    try {
      await client.query("BEGIN");
      await store.init();
      const goal = await store.create({
        title: "Atomic persistence fixture",
        project: "Marketing",
        workspace: "personal",
        cloneId: "min",
      });
      const directive = await store.append(
        { goalId: goal.id, role: "clone", content: "Write the draft", executionInstruction: "Write the draft" },
        0,
      );
      assert.ok(directive);
      const response = await store.append(
        { goalId: goal.id, role: "assistant", content: "Actual result", replyTo: directive.id, runId: "actual-run" },
        0,
        { iterations: 1, phase: "reviewing" },
      );
      assert.ok(response);
      assert.equal((await store.goal(goal.id)).iterations, 1);
      assert.equal((await store.messages(goal.id))[1]?.replyTo, directive.id);
      await store.patch(goal.id, { generation: 1 });
      assert.equal(
        await store.append({ goalId: goal.id, role: "assistant", content: "Stale result" }, 0, { iterations: 99 }),
        null,
      );
      assert.equal((await store.goal(goal.id)).iterations, 1);
      assert.equal((await store.messages(goal.id)).length, 2);
      await client.query("SAVEPOINT failed_message");
      duplicateId = directive.id;
      await assert.rejects(
        store.append({ goalId: goal.id, role: "assistant", content: "Cannot save" }, 1, { iterations: 99 }),
        /duplicate key/,
      );
      await client.query("ROLLBACK TO SAVEPOINT failed_message");
      assert.equal((await store.goal(goal.id)).iterations, 1);
      assert.equal((await store.messages(goal.id)).length, 2);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);
