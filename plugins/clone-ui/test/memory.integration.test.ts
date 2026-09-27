import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createMemoryService } from "../server/memory/index.ts";
import { GBRAIN_DIRECTORY } from "../server/memory/paths.ts";

const KOREAN_LAUNCH = "\ucd9c\uc2dc";
const KOREAN_USER = "\uc0ac\uc6a9\uc790";

async function restoreLegacyDemoRecords(dataDir: string): Promise<void> {
  await promisify(execFile)(
    process.env.CLONE_BUN || "bun",
    [
      "-e",
      `const { PGLiteEngine } = await import(process.env.CLONE_TEST_ENGINE);
const brain = new PGLiteEngine();
await brain.connect({ engine: "pglite", database_path: process.env.CLONE_TEST_BRAIN });
try {
  for (const id of ["demo-jun-launch-review", "demo-jun-research", "demo-jun-next-step"]) {
    const slug = "conversations/" + id;
    const scope = { sourceId: "clone-team-jun-demo" };
    const prior = await brain.getPage(slug, scope);
    await brain.putPage(slug, {
      type: "conversation",
      title: "Jun legacy demo preference",
      compiled_truth: "Jun legacy demo preference for launch review.",
      frontmatter: { ...prior.frontmatter, source: "Jun demo history" },
    }, scope);
  }
  await brain.executeRaw("UPDATE sources SET name = $1 WHERE id = $2", ["Jun synthetic demo history", "clone-team-jun-demo"]);
} finally {
  await brain.disconnect();
}`,
    ],
    {
      env: {
        ...process.env,
        GBRAIN_HOME: join(dataDir, "config"),
        GBRAIN_TELEMETRY: "off",
        CLONE_TEST_ENGINE: pathToFileURL(join(GBRAIN_DIRECTORY, "src/core/pglite-engine.ts")).href,
        CLONE_TEST_BRAIN: join(dataDir, "brain"),
      },
      timeout: 30000,
    },
  );
}

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
      await restoreLegacyDemoRecords(dataDir);
      memory = createMemoryService({ dataDir });
      await memory.init();
      const restored = await memory.search({ workspace: "personal", cloneId: "min", query: "Moonstone" });
      assert.equal(restored.results.length, 1);
      assert.equal(restored.results[0]?.source, "Private test feedback");
      const migrated = await memory.search({ workspace: "team", cloneId: "jun", query: "" });
      const demo = migrated.results.filter((record) => record.ownerId === "jun");
      assert.equal(demo.length, 3);
      assert.equal(migrated.counts.demo, shared.counts.demo);
      assert.equal(migrated.counts.accessible, shared.counts.accessible);
      assert.ok(migrated.results.some((record) => record.source === "Shared test feedback"));
      for (const record of demo) {
        assert.equal(record.demo, true);
        assert.match(record.id, /^conversations\/demo-jun-/);
        assert.match(record.title, /^Garry ·/);
        assert.equal(record.source, "Garry synthetic demo history");
        assert.match(record.excerpt, /not actual conversations/);
        assert.match(record.excerpt, /No affiliation or endorsement/);
        assert.doesNotMatch(record.excerpt, /Jun/);
      }
    } finally {
      await memory.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);

test("automatic GBrain recall finds quoted and multilingual context without widening its source scope", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "clone-gbrain-recall-"));
  const memory = createMemoryService({ dataDir });
  const query = 'Review our launch pitch: "AI for everything."';
  try {
    await memory.init();
    await memory.remember({
      ownerId: "min",
      workspace: "personal",
      text: `${query} Private roadmap marker: Moonstone.`,
      source: "Private launch feedback",
    });
    const automatic = () => memory.search({ workspace: "team", cloneId: "jun", query, mode: "recall" });
    const first = await automatic();
    assert.ok(first.results.some((result) => result.title === "Garry · launch review preferences"));
    assert.ok(first.results.every((result) => result.workspace === "team"));
    assert.ok(first.results.every((result) => !result.excerpt.includes("Moonstone")));
    const manual = await memory.search({ workspace: "team", cloneId: "jun", query });
    assert.equal(manual.results.length, 0);
    await memory.remember({ ownerId: "min", workspace: "team", text: query, source: "Exact shared prompt" });
    const exact = await memory.search({ workspace: "team", cloneId: "jun", query });
    assert.equal(exact.results.length, 1);
    assert.equal(exact.results[0]?.source, "Exact shared prompt");
    const afterLearning = await automatic();
    assert.ok(afterLearning.results.some((result) => result.title === "Garry · launch review preferences"));
    await memory.remember({
      ownerId: "min",
      workspace: "team",
      text: `${KOREAN_LAUNCH} ${KOREAN_USER} review: show the user's concrete outcome first.`,
      source: "Korean shared feedback",
    });
    const multilingual = await memory.search({
      workspace: "team",
      cloneId: "jun",
      query: `Please review "${KOREAN_LAUNCH}" launch pitch and ${KOREAN_USER} results.`,
      mode: "recall",
    });
    assert.ok(multilingual.results.some((result) => result.source === "Korean shared feedback"));
    assert.ok(multilingual.results.some((result) => result.title === "Garry · launch review preferences"));
    assert.equal(new Set(multilingual.results.map((result) => result.id)).size, multilingual.results.length);
    assert.ok(multilingual.results.length <= 6);
    assert.equal(multilingual.counts.personal, 0);
  } finally {
    await memory.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
