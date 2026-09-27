import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createMemoryService } from "../server/memory/index.ts";

test(
  "real GBrain retrieval persists feedback and blocks private memory from team clones",
  { timeout: 180000 },
  async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "clone-gbrain-test-"));
    let memory = createMemoryService({ dataDir });
    try {
      const status = await memory.init();
      assert.equal(status.engine, "gbrain-pglite");
      assert.equal(status.ready, true);
      await memory.remember({
        ownerId: "min",
        workspace: "personal",
        text: "Moonstone private roadmap: test the native interaction before acceptance.",
        source: "Private test feedback",
      });
      await memory.remember({
        ownerId: "min",
        workspace: "team",
        text: "Shared launch review: keep the headline concrete and support claims with evidence.",
        source: "Shared test feedback",
      });
      const personal = await memory.search({ workspace: "personal", cloneId: "min", query: "Moonstone" });
      assert.equal(personal.results.length, 1);
      assert.equal(personal.results[0]?.demo, false);
      const teammate = await memory.search({ workspace: "team", cloneId: "jun", query: "Moonstone" });
      assert.equal(teammate.results.length, 0);
      assert.equal(teammate.counts.personal, 0);
      assert.equal(teammate.status.imported, 0);
      const shared = await memory.search({ workspace: "team", cloneId: "jun", query: "launch review" });
      assert.ok(shared.results.some((result) => result.source === "Shared test feedback"));
      assert.ok(shared.results.some((result) => result.demo));
      await assert.rejects(
        memory.search({ workspace: "personal", cloneId: "jun", query: "Moonstone" }),
        /not permitted/,
      );
      await assert.rejects(
        memory.remember({
          ownerId: "jun",
          workspace: "team",
          text: "Attempt to overwrite synthetic demo history.",
          source: "test",
        }),
        /read-only/,
      );
      await memory.close();
      memory = createMemoryService({ dataDir });
      await memory.init();
      const restored = await memory.search({ workspace: "personal", cloneId: "min", query: "Moonstone" });
      assert.equal(restored.results.length, 1);
      assert.equal(restored.results[0]?.source, "Private test feedback");
    } finally {
      await memory.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);
