import assert from "node:assert/strict";
import test from "node:test";
import { api } from "../src/api.ts";

test("API identifies only the explicit canceled-prediction response as an abort", async (t) => {
  const response = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "Prediction canceled.", code: "PREDICTION_CANCELED" }, { status: 409 }),
  );
  await assert.rejects(api("/predict", { draft: "Review" }), { name: "AbortError" });

  response.mock.mockImplementation(async () => Response.json({ error: "This operation was aborted" }, { status: 400 }));
  await assert.rejects(api("/predict", { draft: "Review" }), { name: "Error", message: "This operation was aborted" });

  response.mock.mockImplementation(async () => Response.json({ error: "Provider unavailable" }, { status: 503 }));
  await assert.rejects(api("/predict", { draft: "Review" }), { name: "Error", message: "Provider unavailable" });
});

test("API preserves local request timeouts as failures", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("Request timed out", "TimeoutError");
  });
  await assert.rejects(api("/predict", { draft: "Review" }), { name: "TimeoutError" });
});
