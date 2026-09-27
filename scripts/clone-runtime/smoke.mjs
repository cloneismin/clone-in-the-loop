import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { fetchCoreText } from "../../plugins/chassis/src/core-client.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const config = parseEnv(
  readFileSync(resolve(process.env.CLONE_RUNTIME_DIR ?? `${root}/data/clone-runtime`, "runtime.env"), "utf8"),
);
const payload = {
  surface: "clone-web",
  actor: { externalId: "min", displayName: "Min" },
  conversation: { kind: "dm", threadRef: `clone-smoke-${Date.now()}` },
  text: "Reply with exactly: Clone runtime is ready. Do not use any tools.",
  model: config.CODEX_MODEL,
  harness: "codex",
  thinkingLevel: "low",
  readOnly: true,
  skipMemory: true,
  surfaceTools: false,
};
const signal = AbortSignal.timeout(120_000);
const response = await fetchCoreText({
  origin: config.CORE_API_URL,
  secret: config.CORE_SIGNING_SECRET,
  method: "POST",
  path: "/v1/turns?async=1",
  body: JSON.stringify(payload),
  signal,
});
const queued = JSON.parse(response.text);
if (response.status !== 202 || typeof queued.runId !== "string") {
  throw new Error(`Expected a queued QM run: ${response.status} ${response.text}`);
}
try {
  for (;;) {
    const response = await fetchCoreText({
      origin: config.CORE_API_URL,
      secret: config.CORE_SIGNING_SECRET,
      method: "GET",
      path: `/v1/runs/${encodeURIComponent(queued.runId)}`,
      signal,
    });
    const run = JSON.parse(response.text);
    if (response.status !== 200 || run.status === "failed") throw new Error(`QM run failed: ${response.text}`);
    if (run.status === "done") {
      if (run.result?.status !== "ok" || run.result.reply !== "Clone runtime is ready.") {
        throw new Error(`Unexpected model response: ${response.text}`);
      }
      console.log(
        JSON.stringify({ queue: "postgres", runId: queued.runId, model: config.CODEX_MODEL, result: run.result }),
      );
      break;
    }
    await delay(700, undefined, { signal });
  }
} catch (error) {
  await fetchCoreText({
    origin: config.CORE_API_URL,
    secret: config.CORE_SIGNING_SECRET,
    method: "POST",
    path: `/v1/runs/${encodeURIComponent(queued.runId)}/signal`,
    body: JSON.stringify({ kind: "abort" }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
  throw error;
}
