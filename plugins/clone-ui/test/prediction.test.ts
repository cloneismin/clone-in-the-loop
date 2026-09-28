import assert from "node:assert/strict";
import test from "node:test";
import { ClonePredictionError, type CompletionRequest, type PredictionOutput } from "@clone-ai/tab-completion";
import { ClonePrediction, predictionRequest, type PredictionContext } from "../server/prediction.ts";
import { requestError } from "../server/errors.ts";

function context(): PredictionContext {
  return {
    goal: {
      id: "draft:personal:min:제품 연구",
      title: "Review the launch",
      project: "Marketing",
      workspace: "personal",
      cloneId: "min",
      criteria: ["Cite the evidence"],
      generation: 0,
      iterations: 0,
      loopEnabled: false,
      phase: "idle",
      status: "active",
      createdAt: "now",
      updatedAt: "now",
    },
    messages: [],
    sources: [
      { id: "one", title: "Feedback", source: "Shared history", excerpt: "Prefer a concrete next step.", demo: false },
    ],
    draft: "Review",
    revision: 2,
  };
}

function output(request: CompletionRequest, patch: Partial<PredictionOutput> = {}): PredictionOutput {
  return {
    request_id: request.request_id,
    session_id: request.session_id,
    connection_id: null,
    context_revision: request.context_revision,
    draft_revision: request.draft.revision,
    completion: " the launch evidence.",
    status: "suggested",
    prediction_id: "prediction-one",
    expires_at: Date.now() / 1000 + 60,
    profile_revision: "",
    grant_revision: 0,
    context_truncated: false,
    usage: { prediction_units: 1 },
    ...patch,
  };
}

test("the installed SDK sends scoped context and server identity, and appends its suffix exactly once", async () => {
  let calls = 0;
  const predictor = new ClonePrediction({
    apiKey: "clnp_fixture",
    fetch: async (url, init) => {
      calls++;
      assert.equal(url, "https://api.clone.is/v1/predictions");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer clnp_fixture");
      const request = JSON.parse(String(init?.body));
      assert.equal(request.user_id, "clone-local:min");
      assert.equal(request.connection_id, null);
      assert.equal(request.mode, "complete_draft");
      assert.deepEqual(request.draft, { text: "Review", revision: 2 });
      assert.match(request.session_id, /^[A-Za-z0-9._:-]{1,80}$/);
      assert.match(request.artifact.summary, /Prefer a concrete next step/);
      return Response.json(output(request));
    },
  });
  const tracked: string[] = [];
  const result = await predictor.predict(context(), new AbortController().signal, async (id) => {
    tracked.push(id);
  });
  assert.equal(result.text, "Review the launch evidence.");
  assert.equal(result.predictionId, "prediction-one");
  assert.equal(result.predictionUnits, 1);
  assert.equal(calls, 1);
  assert.deepEqual(tracked, [result.requestId]);
});

test("context mapping retains the latest human correction, marks generated turns, and scopes session identity", () => {
  const input = context();
  input.draft = "";
  const correction = "Preserve this correction exactly. ".repeat(150);
  input.messages = [
    { id: "human", goalId: input.goal.id, role: "user", origin: "human", content: correction, createdAt: "now" },
    ...Array.from({ length: 11 }, (_, i) => ({
      id: String(i),
      goalId: input.goal.id,
      role: "clone" as const,
      content: "Generated direction",
      createdAt: "now",
    })),
  ];
  const request = predictionRequest(input);
  assert.equal(request.mode, "next_prompt");
  assert.equal(request.messages?.[0].content, correction);
  assert.equal(request.messages?.[0].origin, "human");
  assert.ok(request.messages?.slice(1).every((message) => message.origin === "agent"));
  const updated = predictionRequest({ ...input, sources: [] });
  assert.notEqual(updated.context_revision, request.context_revision);
  const teammate = predictionRequest({ ...input, goal: { ...input.goal, workspace: "team", cloneId: "jun" } });
  assert.notEqual(teammate.session_id, request.session_id);
  assert.match(teammate.user_preferences ?? "", /fictional demo teammate with invented history/);
  assert.throws(() => predictionRequest({ ...input, goal: { ...input.goal, cloneId: "jun" } }), /team workspace/);
  input.messages[0].content = "x".repeat(8001);
  assert.throws(() => predictionRequest(input), /latest_message_too_large/);
});

test("later accepted suggestions cannot truncate or evict the latest human correction", () => {
  for (const count of [1, 11]) {
    const input = context();
    const correction = "Keep the verified numbers and label assumptions. ".repeat(75);
    input.messages = [
      { id: "human", goalId: input.goal.id, role: "user", origin: "human", content: correction, createdAt: "now" },
      ...Array.from({ length: count }, (_, index) => ({
        id: String(index),
        goalId: input.goal.id,
        role: "user" as const,
        origin: "accepted_prediction" as const,
        content: "Generated direction",
        createdAt: "now",
      })),
    ];
    const request = predictionRequest(input);
    assert.equal(request.messages?.[0].content, correction);
    assert.equal(request.messages?.[0].origin, "human");
    assert.ok(request.messages?.slice(1).every((message) => message.origin === "accepted_prediction"));
    input.messages[0].content = "x".repeat(8001);
    assert.throws(() => predictionRequest(input), /latest_message_too_large/);
  }
});

test("legacy user messages retain unknown origin instead of being inferred as human", () => {
  const input = context();
  input.messages = [
    { id: "legacy", goalId: input.goal.id, role: "user", content: "Old instruction", createdAt: "now" },
  ];
  assert.equal(predictionRequest(input).messages?.[0].origin, "unknown");
});

test("SDK abstention returns no executable instruction, even with a nonempty draft", async () => {
  const predictor = new ClonePrediction({
    apiKey: "clnp_fixture",
    fetch: async (_url, init) =>
      Response.json(output(JSON.parse(String(init?.body)), { status: "abstained", completion: "" })),
  });
  const result = await predictor.predict(context(), new AbortController().signal, async () => undefined);
  assert.equal(result.text, "");
  assert.equal(result.status, "abstained");
});

test("stale, expired and incorrectly bound SDK responses cannot become suggestions", async () => {
  for (const patch of [
    { request_id: "wrong" },
    { session_id: "wrong" },
    { context_revision: "wrong" },
    { draft_revision: 999 },
    { connection_id: "other-user" },
    { expires_at: Date.now() / 1000 - 1 },
    { completion: "" },
  ]) {
    const predictor = new ClonePrediction({
      apiKey: "clnp_fixture",
      fetch: async (_url, init) => Response.json(output(JSON.parse(String(init?.body)), patch)),
    });
    await assert.rejects(
      predictor.predict(context(), new AbortController().signal, async () => undefined),
      /invalid_prediction_response/,
    );
  }
});

test("quota and service errors retain safe status codes without retrying or leaking bodies", async () => {
  for (const [status, code] of [
    [402, "sandbox_exhausted"],
    [429, "rate_limited"],
    [503, "prediction_unavailable"],
  ] as const) {
    let calls = 0;
    const predictor = new ClonePrediction({
      apiKey: "clnp_fixture",
      fetch: async (url) => {
        if (String(url).endsWith("/cancel")) return Response.json({ status: "cancelled", prediction_units: 0 });
        calls++;
        return Response.json({ detail: { code, secret: "must not leak" } }, { status });
      },
    });
    await assert.rejects(
      predictor.predict(context(), new AbortController().signal, async () => undefined),
      (error) => {
        assert.ok(error instanceof ClonePredictionError);
        assert.deepEqual(requestError(error), { status, body: { error: code, code } });
        return true;
      },
    );
    assert.equal(calls, 1);
  }
});

test("unknown settlement from gateway errors or malformed responses retains the recovery handle", async () => {
  for (const status of [200, 408, 502, 503, 504]) {
    for (const canceled of [false, true]) {
      let settled = false;
      let cancellations = 0;
      const predictor = new ClonePrediction({
        apiKey: "clnp_fixture",
        fetch: async (url) => {
          if (String(url).endsWith("/cancel")) {
            cancellations++;
            return Response.json({ status: "cancelled", prediction_units: 0 }, { status: canceled ? 200 : 503 });
          }
          return Response.json({}, { status });
        },
      });
      await assert.rejects(
        predictor.predict(
          context(),
          new AbortController().signal,
          async () => undefined,
          async () => {
            settled = true;
          },
        ),
        ClonePredictionError,
      );
      assert.equal(cancellations, 1);
      assert.equal(settled, canceled);
    }
  }
});

test("cancellation reaches both the in-flight SDK fetch and its service cancellation endpoint", async () => {
  const controller = new AbortController();
  const canceled: string[] = [];
  const predictor = new ClonePrediction({
    apiKey: "clnp_fixture",
    fetch: async (url, init) => {
      if (String(url).endsWith("/cancel")) {
        canceled.push(String(url));
        assert.deepEqual(JSON.parse(String(init?.body)), { user_id: "clone-local:min" });
        return Response.json({ status: "cancelled" });
      }
      controller.abort();
      assert.equal(init?.signal?.aborted, true);
      return Response.json(output(JSON.parse(String(init?.body))));
    },
  });
  await assert.rejects(
    predictor.predict(context(), controller.signal, async () => undefined),
    { name: "AbortError" },
  );
  assert.equal(canceled.length, 1);
});

test("missing app key is an explicit prediction failure without disabling QM", async () => {
  const predictor = new ClonePrediction({ apiKey: "" });
  assert.equal(predictor.configured, false);
  await assert.rejects(predictor.cancel("pending"), /clone_app_key_missing/);
  await assert.rejects(
    predictor.predict(context(), new AbortController().signal, async () => undefined),
    /clone_app_key_missing/,
  );
});

test("aborting after durable tracking but before dispatch settles without contacting the provider", async () => {
  const controller = new AbortController();
  let settled = false;
  const predictor = new ClonePrediction({
    apiKey: "clnp_fixture",
    fetch: async () => {
      throw new Error("Request should not be dispatched");
    },
  });
  await assert.rejects(
    predictor.predict(
      context(),
      controller.signal,
      async () => controller.abort(),
      async () => {
        settled = true;
      },
    ),
    { name: "AbortError" },
  );
  assert.equal(settled, true);
});
