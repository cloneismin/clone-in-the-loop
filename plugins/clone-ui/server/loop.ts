import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { assertCloneScope, type Goal, type Source, type Workspace, type CloneId, type Message } from "./domain.ts";
import { Store } from "./store.ts";
import { QM } from "./qm.ts";
import { executionPrompt, reviewPrompt, parseReview } from "./prompts.ts";
import type { MemoryService } from "./memory/types.ts";
import { PredictionCanceledError } from "./errors.ts";
import { ClonePrediction, type PredictionResult } from "./prediction.ts";

export class CloneLoop {
  store: Store;
  qm: QM;
  memory: MemoryService;
  prediction: ClonePrediction;
  active = new Map<string, AbortController>();
  predictions = new Map<string, AbortController>();
  mutations = new Map<string, Promise<void>>();

  constructor(store: Store, qm: QM, memory: MemoryService, prediction = new ClonePrediction()) {
    this.store = store;
    this.qm = qm;
    this.memory = memory;
    this.prediction = prediction;
  }
  async recover(): Promise<void> {
    for (const id of await this.store.pendingRuns()) {
      if (id.startsWith("clone-sdk:")) {
        try {
          await this.prediction.cancel(id.slice(10));
        } catch {
          continue;
        }
      } else await this.qm.abort(id).catch(() => undefined);
      await this.store.untrackRun(id);
    }
    for (const goal of await this.store.goals()) {
      if (goal.activeRunId) await this.qm.abort(goal.activeRunId).catch(() => undefined);
      if (goal.loopEnabled || goal.phase !== "idle")
        await this.store.patch(goal.id, {
          loopEnabled: false,
          phase: "idle",
          status: "paused",
          activeRunId: "",
          generation: goal.generation + 1,
          error: "Previous execution was interrupted by a restart. Your history is saved; press Clone to continue.",
        });
    }
  }
  async predict(
    id: string,
    draft: string,
    revision: number,
    signal?: AbortSignal,
  ): Promise<PredictionResult & { revision: number; sources: Source[] }> {
    const goal = await this.store.goal(id);
    return this.predictGoal(goal, draft, revision, true, signal);
  }
  async predictDraft(
    input: {
      workspace: Workspace;
      cloneId: CloneId;
      project: string;
      draft: string;
      revision: number;
    },
    signal?: AbortSignal,
  ): Promise<PredictionResult & { revision: number; sources: Source[] }> {
    const now = new Date().toISOString();
    const goal: Goal = {
      id: `draft:${input.workspace}:${input.cloneId}:${input.project}`,
      title: input.draft || `A useful ${input.project} workflow`,
      project: input.project,
      workspace: input.workspace,
      cloneId: input.cloneId,
      status: "active",
      phase: "idle",
      loopEnabled: false,
      iterations: 0,
      generation: 0,
      createdAt: now,
      updatedAt: now,
      criteria: [],
    };
    return this.predictGoal(goal, input.draft, input.revision, false, signal);
  }
  private async predictGoal(
    goal: Goal,
    draft: string,
    revision: number,
    persist: boolean,
    signal?: AbortSignal,
  ): Promise<PredictionResult & { revision: number; sources: Source[] }> {
    const id = goal.id;
    assertCloneScope(goal.workspace, goal.cloneId);
    this.predictions.get(id)?.abort();
    const controller = new AbortController();
    this.predictions.set(id, controller);
    let runId = "";
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    try {
      controller.signal.throwIfAborted();
      const messages = persist ? await this.store.messages(id) : [];
      const memory = await this.memory.search({
        workspace: goal.workspace,
        cloneId: goal.cloneId,
        query: [goal.title, goal.project, draft, ...messages.slice(-2).map((m) => m.content.slice(0, 500))].join(" "),
        mode: "recall",
        limit: 5,
      });
      controller.signal.throwIfAborted();
      const result = await this.prediction.predict(
        { goal, messages, sources: memory.results, draft, revision },
        controller.signal,
        async (requestId) => {
          runId = `clone-sdk:${requestId}`;
          await this.store.trackRun(runId, "clone-sdk");
        },
        async () => {
          if (runId) await this.store.untrackRun(runId);
        },
      );
      controller.signal.throwIfAborted();
      if (persist)
        await this.store.prediction(id, {
          ...result,
          draft,
          revision,
          cloneId: goal.cloneId,
          sources: memory.results,
          provider: "clone-sdk",
        });
      return { ...result, revision, sources: memory.results };
    } catch (error) {
      if (controller.signal.aborted) throw new PredictionCanceledError();
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
      if (this.predictions.get(id) === controller) this.predictions.delete(id);
    }
  }
  private async mutate<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = this.mutations.get(id) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.mutations.set(id, current);
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.mutations.get(id) === current) this.mutations.delete(id);
    }
  }
  async start(
    id: string,
    options: { loop: boolean; instruction?: string; human?: boolean; origin?: Message["origin"] },
  ): Promise<void> {
    await this.mutate(id, () => this.startExclusive(id, options));
  }
  private async startExclusive(
    id: string,
    options: { loop: boolean; instruction?: string; human?: boolean; origin?: Message["origin"] },
  ): Promise<void> {
    if (this.active.get(id)?.signal.aborted) this.active.delete(id);
    if (this.active.has(id)) {
      if (options.loop && !options.human) {
        await this.store.patch(id, { loopEnabled: true });
        return;
      }
      throw new Error("This Goal is already working. Press Stop before starting another instruction.");
    }
    const goal = await this.store.goal(id);
    assertCloneScope(goal.workspace, goal.cloneId);
    this.predictions.get(id)?.abort();
    const controller = new AbortController();
    this.active.set(id, controller);
    const generation = goal.generation + 1;
    try {
      await this.store.patch(id, {
        generation,
        loopEnabled: options.loop,
        status: "active",
        phase: options.instruction ? "executing" : "predicting",
        error: "",
        activeRunId: "",
      });
    } catch (error) {
      controller.abort();
      if (this.active.get(id) === controller) this.active.delete(id);
      throw error;
    }
    void this.run({ ...goal, generation }, controller, options)
      .catch(async (error: unknown) => {
        if (!controller.signal.aborted)
          await this.store.patch(
            id,
            {
              phase: "error",
              status: "error",
              loopEnabled: false,
              activeRunId: "",
              error: error instanceof Error ? error.message : "Execution failed.",
            },
            generation,
          );
      })
      .finally(() => {
        if (this.active.get(id) === controller) this.active.delete(id);
      });
  }
  async stop(id: string): Promise<void> {
    await this.mutate(id, () => this.stopExclusive(id));
  }
  async changeClone(id: string, cloneId: CloneId): Promise<Goal | null> {
    return this.mutate(id, async () => {
      if (this.active.get(id)?.signal.aborted) this.active.delete(id);
      const goal = await this.store.goal(id);
      assertCloneScope(goal.workspace, cloneId);
      if (this.active.has(id)) throw new Error("Press Stop before changing the active Clone.");
      this.predictions.get(id)?.abort();
      return this.store.patch(id, { cloneId, generation: goal.generation + 1 });
    });
  }
  private async stopExclusive(id: string): Promise<void> {
    const goal = await this.store.goal(id);
    await this.store.patch(id, {
      loopEnabled: false,
      generation: goal.generation + 1,
      phase: "stopping",
      status: "paused",
    });
    this.active.get(id)?.abort();
    this.predictions.get(id)?.abort();
    if (goal.activeRunId) await this.qm.abort(goal.activeRunId).catch(() => undefined);
    await this.store.patch(id, { phase: "idle", activeRunId: "" });
  }
  private async saveMessage(
    goal: Goal,
    input: Omit<Message, "id" | "createdAt" | "goalId">,
    patch: Partial<Goal> = {},
  ): Promise<Message> {
    const message = await this.store.append({ ...input, goalId: goal.id }, goal.generation, patch);
    if (!message) throw new DOMException("Execution was superseded.", "AbortError");
    return message;
  }
  private async review(goal: Goal, result: Message, signal: AbortSignal): Promise<Message> {
    signal.throwIfAborted();
    await this.store.patch(goal.id, { phase: "reviewing" }, goal.generation);
    const memory = await this.memory.search({
      workspace: goal.workspace,
      cloneId: goal.cloneId,
      query: `${goal.title} ${goal.project} ${result.content.slice(0, 600)}`,
      mode: "recall",
      limit: 5,
    });
    signal.throwIfAborted();
    const reviewResult = await this.qm.turn({
      threadId: `clone-review:${randomUUID()}`,
      text: reviewPrompt(goal, await this.store.messages(goal.id), memory.results),
      workspace: goal.workspace,
      readOnly: true,
      signal,
      onRun: async (activeRunId) => {
        await this.store.patch(goal.id, { activeRunId }, goal.generation);
      },
    });
    signal.throwIfAborted();
    const review = parseReview(reviewResult.text);
    const message = await this.saveMessage(
      goal,
      {
        role: "clone",
        content: [review.review.trim(), review.nextInstruction.trim()].filter(Boolean).join(" "),
        executionInstruction: review.nextInstruction,
        replyTo: result.id,
        cloneId: goal.cloneId,
        sources: memory.results,
        model: reviewResult.model,
        runId: reviewResult.runId,
      },
      { criteria: review.criteria, phase: "improving", activeRunId: "" },
    );
    goal.criteria = review.criteria;
    return message;
  }
  private async run(
    goal: Goal,
    controller: AbortController,
    options: { loop: boolean; instruction?: string; human?: boolean; origin?: Message["origin"] },
  ): Promise<void> {
    const signal = controller.signal;
    const messages = await this.store.messages(goal.id);
    const last = messages.at(-1);
    const requested = options.instruction?.trim();
    const pending =
      last &&
      (last.role === "clone" || last.role === "user") &&
      last.cloneId === goal.cloneId &&
      (!requested || requested === (last.executionInstruction ?? last.content))
        ? last
        : undefined;
    let directive: Message;
    if (pending) {
      directive = pending;
    } else if (!requested && options.loop && last?.role === "assistant") {
      directive = await this.review(goal, last, signal);
      await delay(1800, undefined, { signal });
    } else {
      let instruction = requested;
      let sources: Source[] = [];
      if (!instruction) {
        const prediction = await this.predict(goal.id, "", 0, signal);
        if (!prediction.text) throw new Error("Clone did not suggest an instruction. Type a direction to continue.");
        instruction = prediction.text;
        sources = prediction.sources;
      }
      signal.throwIfAborted();
      if (options.human && options.origin === "human")
        await this.memory.remember({
          ownerId: "min",
          workspace: goal.workspace,
          text: instruction,
          source: `Clone conversation ${goal.id}`,
          kind: "user-message",
        });
      signal.throwIfAborted();
      directive = await this.saveMessage(goal, {
        role: options.human ? "user" : "clone",
        origin: options.human ? (options.origin ?? "unknown") : "agent",
        content: instruction,
        executionInstruction: instruction,
        cloneId: goal.cloneId,
        sources,
      });
    }
    for (;;) {
      signal.throwIfAborted();
      await this.store.patch(goal.id, { phase: "executing", error: "" }, goal.generation);
      signal.throwIfAborted();
      const result = await this.qm.turn({
        threadId: `clone-goal:${goal.id}`,
        text: executionPrompt(goal, directive.executionInstruction ?? directive.content),
        workspace: goal.workspace,
        signal,
        onRun: async (activeRunId) => {
          await this.store.patch(goal.id, { activeRunId }, goal.generation);
        },
      });
      signal.throwIfAborted();
      const response = await this.saveMessage(
        goal,
        {
          role: "assistant",
          content: result.text,
          model: result.model,
          runId: result.runId,
          replyTo: directive.id,
        },
        { iterations: goal.iterations + 1, activeRunId: "" },
      );
      goal.iterations++;
      signal.throwIfAborted();
      const current = await this.store.goal(goal.id);
      if (!current.loopEnabled) {
        await this.store.patch(goal.id, { phase: "idle" }, goal.generation);
        return;
      }
      directive = await this.review(goal, response, signal);
      await delay(1800, undefined, { signal });
    }
  }
}
