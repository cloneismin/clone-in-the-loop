import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate as tick } from "node:timers/promises";
import { CloneLoop } from "../server/loop.ts";
import { QM, type TurnOptions } from "../server/qm.ts";
import type { Goal, Message } from "../server/domain.ts";
import type { Store } from "../server/store.ts";
import type { MemoryService } from "../server/memory/types.ts";
import { PredictionCanceledError, requestError } from "../server/errors.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

async function until(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await tick();
  }
  assert.ok(predicate(), "Expected the asynchronous lifecycle transition");
}

function fixture() {
  let goal: Goal = {
    id: "lifecycle-goal",
    title: "Improve the launch",
    project: "Marketing",
    workspace: "personal",
    cloneId: "min",
    status: "active",
    phase: "idle",
    loopEnabled: false,
    iterations: 0,
    generation: 0,
    criteria: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const messages: Partial<Message>[] = [];
  const pendingRuns = new Set<string>();
  const abortedRuns: string[] = [];
  const store = {
    goal: async () => ({ ...goal }),
    goals: async () => [{ ...goal }],
    patch: async (_id: string, patch: Partial<Goal>, generation?: number) => {
      if (generation !== undefined && generation !== goal.generation) return null;
      goal = { ...goal, ...JSON.parse(JSON.stringify(patch)) };
      return { ...goal };
    },
    append: async (message: Partial<Message>, generation?: number) => {
      if (generation !== undefined && generation !== goal.generation) return null;
      messages.push(message);
      return message;
    },
    messages: async () => [...messages],
    pendingRuns: async () => [...pendingRuns],
    trackRun: async (runId: string) => {
      pendingRuns.add(runId);
    },
    untrackRun: async (runId: string) => {
      pendingRuns.delete(runId);
    },
  } as unknown as Store;
  const turns: Array<{
    options: TurnOptions;
    result: ReturnType<typeof deferred<{ text: string; runId: string; model: string }>>;
  }> = [];
  const qm = {
    turn: async (options: TurnOptions) => {
      const result = deferred<{ text: string; runId: string; model: string }>();
      turns.push({ options, result });
      return result.promise;
    },
    abort: async (runId: string) => {
      abortedRuns.push(runId);
    },
  } as unknown as QM;
  const loop = new CloneLoop(store, qm, {} as MemoryService);
  return { loop, store, turns, messages, abortedRuns, goal: () => goal };
}

test("a superseded prediction cannot persist a late provider result or clear the replacement", async () => {
  const f = fixture();
  f.loop.memory = { search: async () => ({ results: [] }) } as unknown as MemoryService;
  const saved: unknown[] = [];
  f.store.prediction = async (_id, value) => {
    saved.push(value);
  };
  const first = f.loop.predict("lifecycle-goal", "", 1).catch((error: unknown) => error);
  await until(() => f.turns.length === 1);
  const second = f.loop.predict("lifecycle-goal", "", 2);
  await until(() => f.turns.length === 2);
  assert.equal(f.turns[0]!.options.signal.aborted, true);
  f.turns[0]!.result.resolve({ text: '{"instruction":"Stale instruction"}', runId: "old", model: "test" });
  const canceled = await first;
  assert.ok(canceled instanceof PredictionCanceledError);
  assert.deepEqual(requestError(canceled), {
    status: 409,
    body: { error: "Prediction canceled.", code: "PREDICTION_CANCELED" },
  });
  assert.equal(saved.length, 0);
  assert.equal(f.loop.predictions.get("lifecycle-goal")?.signal, f.turns[1]!.options.signal);
  f.turns[1]!.result.resolve({ text: '{"instruction":"Current instruction"}', runId: "new", model: "test" });
  assert.equal((await second).text, "Current instruction");
  assert.equal(saved.length, 1);
  assert.equal(f.loop.predictions.size, 0);
});

test("provider timeouts and unrecognized abort errors remain visible request failures", async () => {
  const f = fixture();
  f.loop.memory = { search: async () => ({ results: [] }) } as unknown as MemoryService;
  const timeout = new DOMException("Prediction timed out.", "TimeoutError");
  f.loop.qm.turn = async () => {
    throw timeout;
  };
  await assert.rejects(f.loop.predict("lifecycle-goal", "", 1), (error) => error === timeout);
  assert.deepEqual(requestError(timeout), { status: 400, body: { error: "Prediction timed out." } });
  assert.deepEqual(requestError(new DOMException("This operation was aborted", "AbortError")), {
    status: 400,
    body: { error: "This operation was aborted" },
  });
  assert.deepEqual(requestError(new Error("Goal not found.")), { status: 404, body: { error: "Goal not found." } });
});

test("a failed initial persistence write permits retry after the database recovers", async () => {
  const f = fixture();
  const patch = f.store.patch.bind(f.store);
  f.store.patch = async () => {
    throw new Error("Database unavailable");
  };
  await assert.rejects(
    f.loop.start("lifecycle-goal", { loop: false, instruction: "Try the work" }),
    /Database unavailable/,
  );
  assert.equal(f.loop.active.size, 0);
  assert.equal(f.turns.length, 0);
  f.store.patch = patch;
  await f.loop.start("lifecycle-goal", { loop: false, instruction: "Retry the work" });
  await until(() => f.turns.length === 1);
  f.turns[0]!.result.resolve({ text: "Recovered", runId: "recovered", model: "test" });
  await until(() => f.loop.active.size === 0);
  assert.equal(f.goal().iterations, 1);
});

test("simultaneous starts launch one execution and reject the duplicate", async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.loop.start("lifecycle-goal", { loop: false, instruction: "First instruction" }),
    f.loop.start("lifecycle-goal", { loop: false, instruction: "Second instruction" }),
  ]);
  await until(() => f.turns.length > 0);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(f.turns.length, 1);
  f.turns[0]!.result.resolve({ text: "Done", runId: "one", model: "test" });
  await until(() => f.loop.active.size === 0);
});

test("Stop permits an immediate restart and ignores the old execution's late result", async () => {
  const f = fixture();
  await f.loop.start("lifecycle-goal", { loop: false, instruction: "Old instruction" });
  await until(() => f.turns.length === 1);
  await f.loop.stop("lifecycle-goal");
  assert.equal(f.turns[0]!.options.signal.aborted, true);
  await f.loop.start("lifecycle-goal", { loop: false, instruction: "New instruction" });
  await until(() => f.turns.length === 2);
  assert.equal(f.turns[1]!.options.signal.aborted, false);
  f.turns[0]!.result.resolve({ text: "Stale result", runId: "old", model: "test" });
  f.turns[1]!.result.resolve({ text: "Fresh result", runId: "new", model: "test" });
  await until(() => f.loop.active.size === 0);
  assert.deepEqual(
    f.messages.filter((message) => message.role === "assistant").map((message) => message.content),
    ["Fresh result"],
  );
  assert.equal(f.goal().phase, "idle");
  assert.equal(f.goal().iterations, 1);
});

test("QM cancels the remote run when Stop arrives while its ID is being persisted", async () => {
  const qm = new QM();
  let abortRequests = 0;
  qm.request = async (path) => {
    if (path.endsWith("/signal")) {
      abortRequests++;
      return { accepted: true };
    }
    return { runId: "remote-run" };
  };
  const controller = new AbortController();
  await assert.rejects(
    qm.turn({
      threadId: "abort-race",
      text: "test",
      workspace: "personal",
      signal: controller.signal,
      onRun: async () => {
        controller.abort();
      },
    }),
    /abort/i,
  );
  assert.ok(abortRequests >= 1, "The already-created QM run must receive cancellation");
});

test("QM cancels a newly queued run when Stop arrived before the POST response", async () => {
  const qm = new QM();
  const queued = deferred<Record<string, unknown>>();
  let requested = false;
  let abortRequests = 0;
  qm.request = async (path) => {
    if (path.endsWith("/signal")) {
      abortRequests++;
      return { accepted: true };
    }
    requested = true;
    return queued.promise;
  };
  const controller = new AbortController();
  const running = qm.turn({ threadId: "queue-race", text: "test", workspace: "personal", signal: controller.signal });
  const rejected = assert.rejects(running, /abort/i);
  await until(() => requested);
  controller.abort();
  queued.resolve({ runId: "late-queued-run" });
  await rejected;
  assert.ok(abortRequests >= 1, "A queued response that arrives after Stop must be cancelled");
});

test("Stop allows changing the selected Clone while the old execution unwinds", async () => {
  const f = fixture();
  await f.store.patch("lifecycle-goal", { workspace: "team" });
  await f.loop.start("lifecycle-goal", { loop: false, instruction: "Old instruction" });
  await until(() => f.turns.length === 1);
  await f.loop.stop("lifecycle-goal");
  await f.loop.changeClone("lifecycle-goal", "jun");
  assert.equal(f.goal().cloneId, "jun");
  f.turns[0]!.result.resolve({ text: "Stale result", runId: "old", model: "test" });
  await until(() => f.loop.active.size === 0);
  assert.equal(
    f.messages.some((message) => message.role === "assistant"),
    false,
  );
});

test("restart recovery cancels tracked runs and clears persisted execution identity", async () => {
  const f = fixture();
  await f.store.patch("lifecycle-goal", {
    activeRunId: "interrupted-execution",
    phase: "executing",
    loopEnabled: true,
    generation: 5,
  });
  await f.store.trackRun("interrupted-prediction", "prediction");
  await f.loop.recover();
  assert.deepEqual(f.abortedRuns, ["interrupted-prediction", "interrupted-execution"]);
  assert.deepEqual(await f.store.pendingRuns(), []);
  assert.equal(f.goal().activeRunId, "");
  assert.equal(f.goal().phase, "idle");
  assert.equal(f.goal().status, "paused");
  assert.equal(f.goal().loopEnabled, false);
  assert.equal(f.goal().generation, 6);
});
