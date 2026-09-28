import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate as tick } from "node:timers/promises";
import { CloneLoop } from "../server/loop.ts";
import { ClonePrediction, type PredictionContext, type PredictionResult } from "../server/prediction.ts";
import { QM, type TurnOptions } from "../server/qm.ts";
import type { Goal, Message } from "../server/domain.ts";
import type { Store } from "../server/store.ts";
import type { MemoryService } from "../server/memory/types.ts";
import { PredictionCanceledError, requestError } from "../server/errors.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
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
    append: async (message: Partial<Message>, generation?: number, patch: Partial<Goal> = {}) => {
      if (generation !== undefined && generation !== goal.generation) return null;
      const saved = { ...message, id: `message-${messages.length + 1}`, createdAt: new Date().toISOString() };
      messages.push(saved);
      goal = { ...goal, ...patch };
      return saved;
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
  const predictions: Array<{
    options: { signal: AbortSignal };
    result: ReturnType<typeof deferred<PredictionResult>>;
  }> = [];
  const predictor = {
    predict: async (_input: PredictionContext, signal: AbortSignal, onRequest: (id: string) => Promise<void>) => {
      const result = deferred<PredictionResult>();
      predictions.push({ options: { signal }, result });
      await onRequest(`prediction-${predictions.length}`);
      return result.promise;
    },
    cancel: async (id: string) => {
      abortedRuns.push(`sdk:${id}`);
    },
  } as ClonePrediction;
  const loop = new CloneLoop(
    store,
    qm,
    {
      search: async () => ({ results: [] }),
      remember: async () => undefined,
    } as unknown as MemoryService,
    predictor,
  );
  return { loop, store, turns, predictions, messages, abortedRuns, goal: () => goal };
}

function predictionResult(text: string): PredictionResult {
  return {
    text,
    status: text ? "suggested" : "abstained",
    requestId: "sdk-request",
    predictionId: "sdk-prediction",
    expiresAt: Date.now() / 1000 + 60,
    contextRevision: "test",
    contextTruncated: false,
    predictionUnits: 1,
  };
}

test("a superseded prediction cannot persist a late provider result or clear the replacement", async () => {
  const f = fixture();
  f.loop.memory = { search: async () => ({ results: [] }) } as unknown as MemoryService;
  const saved: unknown[] = [];
  f.store.prediction = async (_id, value) => {
    saved.push(value);
  };
  const first = f.loop.predict("lifecycle-goal", "", 1).catch((error: unknown) => error);
  await until(() => f.predictions.length === 1);
  const second = f.loop.predict("lifecycle-goal", "", 2);
  await until(() => f.predictions.length === 2);
  assert.equal(f.predictions[0]!.options.signal.aborted, true);
  f.predictions[0]!.result.resolve(predictionResult("Stale instruction"));
  const canceled = await first;
  assert.ok(canceled instanceof PredictionCanceledError);
  assert.deepEqual(requestError(canceled), {
    status: 409,
    body: { error: "Prediction canceled.", code: "PREDICTION_CANCELED" },
  });
  assert.equal(saved.length, 0);
  assert.equal(f.loop.predictions.get("lifecycle-goal")?.signal, f.predictions[1]!.options.signal);
  f.predictions[1]!.result.resolve(predictionResult("Current instruction"));
  assert.equal((await second).text, "Current instruction");
  assert.equal(saved.length, 1);
  assert.equal(f.loop.predictions.size, 0);
});

test("provider timeouts and unrecognized abort errors remain visible request failures", async () => {
  const f = fixture();
  f.loop.memory = { search: async () => ({ results: [] }) } as unknown as MemoryService;
  const timeout = new DOMException("Prediction timed out.", "TimeoutError");
  f.loop.prediction.predict = async () => {
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

test("continuous execution stores one Clone reply per agent result and executes its exact instruction", async () => {
  const f = fixture();
  await f.loop.start("lifecycle-goal", { loop: true, instruction: "Create the draft" });
  await until(() => f.turns.length === 1);
  f.turns[0]!.result.resolve({ text: "First draft", runId: "execution-one", model: "test" });
  await until(() => f.turns.length === 2);
  assert.equal(f.turns[1]!.options.readOnly, true);
  f.turns[1]!.result.resolve({
    text: JSON.stringify({
      review: "The call to action is vague.",
      nextInstruction: "Use one concrete action.",
      criteria: ["One CTA"],
    }),
    runId: "review-one",
    model: "test",
  });
  await until(() => f.messages.length === 3);
  assert.deepEqual(
    f.messages.map((message) => message.role),
    ["clone", "assistant", "clone"],
  );
  assert.equal(f.messages[2]!.content, "The call to action is vague. Use one concrete action.");
  assert.equal(f.messages[2]!.replyTo, f.messages[1]!.id);
  assert.equal(f.messages[1]!.replyTo, f.messages[0]!.id);
  await new Promise((resolve) => setTimeout(resolve, 1850));
  await until(() => f.turns.length === 3);
  assert.equal(f.messages.length, 3, "Executing the visible feedback must not append it again");
  assert.ok(f.turns[2]!.options.text.endsWith("Instruction: Use one concrete action."));
  await f.store.patch("lifecycle-goal", { loopEnabled: false });
  f.turns[2]!.result.resolve({ text: "Revised draft", runId: "execution-two", model: "test" });
  await until(() => f.loop.active.size === 0);
  assert.deepEqual(
    f.messages.map((message) => message.role),
    ["clone", "assistant", "clone", "assistant"],
  );
  assert.equal(f.messages[3]!.replyTo, f.messages[2]!.id);
  assert.equal(f.goal().iterations, 2);
});

test("Stop after review preserves the exact next instruction across process recovery", async () => {
  const f = fixture();
  await f.loop.start("lifecycle-goal", { loop: true, instruction: "Create the draft" });
  await until(() => f.turns.length === 1);
  f.turns[0]!.result.resolve({ text: "Draft", runId: "execution-one", model: "test" });
  await until(() => f.turns.length === 2);
  f.turns[1]!.result.resolve({
    text: JSON.stringify({
      review: "The headline is generic.",
      nextInstruction: "Name the concrete benefit.",
      criteria: ["Specific benefit"],
    }),
    runId: "review-one",
    model: "test",
  });
  await until(() => f.messages.length === 3);
  await f.loop.stop("lifecycle-goal");
  await until(() => f.loop.active.size === 0);
  const restarted = new CloneLoop(f.store, f.loop.qm, f.loop.memory);
  await restarted.recover();
  await restarted.start("lifecycle-goal", { loop: false });
  await until(() => f.turns.length === 3);
  assert.equal(f.messages.length, 3);
  assert.ok(f.turns[2]!.options.text.endsWith("Instruction: Name the concrete benefit."));
  f.turns[2]!.result.resolve({ text: "A concrete headline", runId: "execution-two", model: "test" });
  await until(() => restarted.active.size === 0);
  assert.equal(f.messages[3]!.replyTo, f.messages[2]!.id);
  assert.equal(f.goal().iterations, 2);
});

test("failed execution and stopped retries reuse the unanswered directive without fabricating a result", async () => {
  const f = fixture();
  await f.loop.start("lifecycle-goal", { loop: false, instruction: "Make a useful artifact" });
  await until(() => f.turns.length === 1);
  f.turns[0]!.result.reject(new Error("Provider unavailable"));
  await until(() => f.loop.active.size === 0);
  assert.equal(f.goal().status, "error");
  assert.equal(f.messages.length, 1);
  await f.loop.start("lifecycle-goal", { loop: false });
  await until(() => f.turns.length === 2);
  assert.equal(f.messages.length, 1);
  await f.loop.stop("lifecycle-goal");
  await f.loop.start("lifecycle-goal", { loop: false, instruction: "Make a useful artifact" });
  await until(() => f.turns.length === 3);
  assert.equal(f.messages.length, 1);
  f.turns[1]!.result.resolve({ text: "Canceled output", runId: "canceled", model: "test" });
  f.turns[2]!.result.resolve({ text: "Actual result", runId: "actual", model: "test" });
  await until(() => f.loop.active.size === 0);
  assert.deepEqual(
    f.messages.map((message) => message.content),
    ["Make a useful artifact", "Actual result"],
  );
  assert.equal(f.messages[1]!.replyTo, f.messages[0]!.id);
});

test("restart after an agent result resumes its review instead of executing the old directive again", async () => {
  const f = fixture();
  await f.loop.start("lifecycle-goal", { loop: true, instruction: "Create the draft" });
  await until(() => f.turns.length === 1);
  f.turns[0]!.result.resolve({ text: "Durable draft", runId: "actual", model: "test" });
  await until(() => f.turns.length === 2);
  await f.loop.stop("lifecycle-goal");
  const restarted = new CloneLoop(f.store, f.loop.qm, f.loop.memory);
  await restarted.recover();
  await restarted.start("lifecycle-goal", { loop: true });
  await until(() => f.turns.length === 3);
  assert.equal(f.turns[2]!.options.readOnly, true);
  assert.equal(f.messages.length, 2);
  assert.equal(f.goal().iterations, 1);
  f.turns[1]!.result.resolve({
    text: '{"review":"Old","nextInstruction":"Ignore"}',
    runId: "canceled-review",
    model: "test",
  });
  f.turns[2]!.result.resolve({
    text: '{"review":"Needs proof.","nextInstruction":"Add a source."}',
    runId: "fresh-review",
    model: "test",
  });
  await until(() => f.messages.length === 3);
  await restarted.stop("lifecycle-goal");
  await until(() => restarted.active.size === 0);
  assert.equal(f.messages[2]!.content, "Needs proof. Add a source.");
  assert.equal(f.messages[2]!.replyTo, f.messages[1]!.id);
});

test("a superseded message write cannot launch an unrecorded execution", async () => {
  const f = fixture();
  f.store.append = async () => null;
  await f.loop.start("lifecycle-goal", { loop: false, instruction: "Do the work" });
  await until(() => f.loop.active.size === 0);
  assert.equal(f.turns.length, 0);
  assert.equal(f.messages.length, 0);
});

test("restart recovery routes SDK cancellations to Clone instead of QM", async () => {
  const f = fixture();
  await f.store.trackRun("clone-sdk:pending-sdk-request", "clone-sdk");
  await f.loop.recover();
  assert.deepEqual(f.abortedRuns, ["sdk:pending-sdk-request"]);
  assert.deepEqual(await f.store.pendingRuns(), []);
});

test("SDK abstention never launches a QM execution", async () => {
  const f = fixture();
  f.store.prediction = async () => undefined;
  await f.loop.start("lifecycle-goal", { loop: true });
  await until(() => f.predictions.length === 1);
  f.predictions[0].result.resolve(predictionResult(""));
  await until(() => f.loop.active.size === 0);
  assert.equal(f.turns.length, 0);
  assert.equal(f.messages.length, 0);
  assert.equal(f.goal().loopEnabled, false);
  assert.match(f.goal().error ?? "", /Type a direction/);
});

test("client disconnect cancels the SDK prediction and discards its late response", async () => {
  const f = fixture();
  const controller = new AbortController();
  const pending = f.loop.predict("lifecycle-goal", "", 1, controller.signal);
  const rejected = assert.rejects(pending, PredictionCanceledError);
  await until(() => f.predictions.length === 1);
  controller.abort();
  assert.equal(f.predictions[0].options.signal.aborted, true);
  f.predictions[0].result.resolve(predictionResult("Late response"));
  await rejected;
  assert.equal(f.loop.predictions.size, 0);
  assert.deepEqual(await f.store.pendingRuns(), []);
});

test("accepted suggestions are stored with provenance and never learned as human feedback", async () => {
  const f = fixture();
  let remembered = 0;
  f.loop.memory.remember = async () => {
    remembered++;
    throw new Error("Generated text must not be remembered as human feedback");
  };
  await f.loop.start("lifecycle-goal", {
    loop: false,
    instruction: "Generated direction",
    human: true,
    origin: "accepted_prediction",
  });
  await until(() => f.turns.length === 1);
  assert.equal(remembered, 0);
  assert.equal(f.messages[0].origin, "accepted_prediction");
  f.turns[0].result.resolve({ text: "Result", runId: "one", model: "test" });
  await until(() => f.loop.active.size === 0);
});
