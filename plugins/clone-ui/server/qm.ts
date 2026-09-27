import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { fetchCoreText } from "../../chassis/src/core-client.ts";

type Run = {
  id?: string;
  status: string;
  partial?: string;
  result?: {
    status: string;
    reply?: string;
    message?: string;
    reason?: string;
    stopped?: boolean;
    pendingApprovals?: unknown[];
  };
  error?: string;
};
export type TurnOptions = {
  threadId: string;
  text: string;
  workspace: "personal" | "team";
  readOnly?: boolean;
  signal: AbortSignal;
  onRun?: (id: string) => Promise<void>;
};

export class QM {
  origin: string;
  secret: string | undefined;
  model: string;
  constructor() {
    this.origin = process.env.CORE_API_URL || "http://127.0.0.1:8088";
    this.secret = process.env.CORE_SIGNING_SECRET;
    this.model = process.env.CLONE_MODEL || process.env.CODEX_MODEL || "gpt-6-sol";
  }
  async initialize(): Promise<void> {
    await this.request("/v1/directory", {
      members: [
        { principalId: "min@clone.local", displayName: "Min", type: "internal" },
        { principalId: "jun@clone.local", displayName: "Garry Tan", type: "internal" },
      ],
      groupMembers: [
        { groupId: "clone-team", principalId: "min@clone.local" },
        { groupId: "clone-team", principalId: "jun@clone.local" },
      ],
      groupIds: ["clone-team"],
      groupRosterIds: ["clone-team"],
    });
  }
  async request(path: string, body?: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await fetchCoreText({
      origin: this.origin,
      secret: this.secret,
      method: body ? "POST" : "GET",
      path,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal,
    });
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(result.text);
    } catch {
      throw new Error(`QM returned HTTP ${result.status}.`);
    }
    if (result.status >= 400)
      throw new Error(String(data.message || data.error || `QM returned HTTP ${result.status}.`));
    return data;
  }
  async abort(runId: string): Promise<void> {
    await this.request(`/v1/runs/${encodeURIComponent(runId)}/signal`, { kind: "abort" }, AbortSignal.timeout(5000));
  }
  async turn(options: TurnOptions): Promise<{ text: string; runId: string; model: string }> {
    options.signal.throwIfAborted();
    const actor = { externalId: "min@clone.local", displayName: "Min" };
    const response = await this.request(
      "/v1/turns?async=1",
      {
        surface: "web",
        actor,
        conversation:
          options.workspace === "team"
            ? {
                kind: "group",
                threadRef: options.threadId,
                channelRef: "clone-team",
                channelName: "Clone Team",
                audience: [actor, { externalId: "jun@clone.local", displayName: "Garry Tan" }],
              }
            : { kind: "dm", threadRef: options.threadId, audience: [actor] },
        text: options.text,
        model: this.model,
        harness: "codex",
        thinkingLevel: "low",
        readOnly: options.readOnly === true,
        skipMemory: true,
        surfaceTools: !options.readOnly,
        addressed: true,
        timezone: "America/Los_Angeles",
        idempotencyKey: `clone:${randomUUID()}`,
      },
      AbortSignal.timeout(15_000),
    );
    const runId = String(response.runId || response.id || "");
    if (!runId) {
      if (response.reply) return { text: String(response.reply), runId: "", model: this.model };
      throw new Error(String(response.message || "QM did not return a run identifier."));
    }
    let cancel: Promise<void> | undefined;
    const cancelRemote = () => (cancel ??= this.abort(runId).catch(() => undefined));
    const abort = () => {
      void cancelRemote();
    };
    options.signal.addEventListener("abort", abort, { once: true });
    try {
      if (options.signal.aborted) await cancelRemote();
      options.signal.throwIfAborted();
      await options.onRun?.(runId);
      options.signal.throwIfAborted();
      for (;;) {
        options.signal.throwIfAborted();
        const run = (await this.request(
          `/v1/runs/${encodeURIComponent(runId)}`,
          undefined,
          options.signal,
        )) as unknown as Run;
        if (run.status === "done" || run.status === "failed") {
          if (run.result?.status === "pending_approval" || run.result?.pendingApprovals?.length)
            throw new Error("QM requires approval. Stop this loop and review the requested action in QM.");
          if (run.result?.stopped) throw new Error("QM execution was stopped.");
          if (run.status === "failed" || run.result?.status === "refused" || run.result?.status === "failed")
            throw new Error(
              run.result?.reason || run.result?.message || run.error || run.result?.reply || "QM execution failed.",
            );
          const text = run.result?.reply || run.result?.message;
          if (!text) throw new Error("QM finished without a response.");
          return { text, runId, model: this.model };
        }
        await delay(700, undefined, { signal: options.signal });
      }
    } catch (error) {
      await cancelRemote();
      throw error;
    } finally {
      options.signal.removeEventListener("abort", abort);
    }
  }
}
