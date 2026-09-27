import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { assertCloneScope, parsePrediction, type Goal, type Source, type Workspace, type CloneId } from "./domain.ts";
import { Store } from "./store.ts";
import { QM } from "./qm.ts";
import { executionPrompt, predictionPrompt, reviewPrompt, parseReview } from "./prompts.ts";
import type { MemoryService } from "./memory/types.ts";

export class CloneLoop {
  store: Store;
  qm: QM;
  memory: MemoryService;
  active = new Map<string, AbortController>();
  predictions = new Map<string, AbortController>();
  mutations = new Map<string, Promise<void>>();

  constructor(store: Store, qm: QM, memory: MemoryService) {
    this.store = store;
    this.qm = qm;
    this.memory = memory;
  }
  async recover(): Promise<void> {
    for (const id of await this.store.pendingRuns()) {
      await this.qm.abort(id).catch(() => undefined);
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
  ): Promise<{ text: string; revision: number; sources: Source[] }> {
    const goal = await this.store.goal(id);
    return this.predictGoal(goal, draft, revision, true);
  }
  async predictDraft(input: {
    workspace: Workspace;
    cloneId: CloneId;
    project: string;
    draft: string;
    revision: number;
  }): Promise<{ text: string; revision: number; sources: Source[] }> {
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
    return this.predictGoal(goal, input.draft, input.revision, false);
  }
  private async predictGoal(
    goal: Goal,
    draft: string,
    revision: number,
    persist: boolean,
  ): Promise<{ text: string; revision: number; sources: Source[] }> {
    const id = goal.id;
    assertCloneScope(goal.workspace, goal.cloneId);
    this.predictions.get(id)?.abort();
    const controller = new AbortController();
    this.predictions.set(id, controller);
    let runId = "";
    try {
      const messages = persist ? await this.store.messages(id) : [];
      const memory = await this.memory.search({
        workspace: goal.workspace,
        cloneId: goal.cloneId,
        query: [goal.title, goal.project, draft, ...messages.slice(-2).map((m) => m.content.slice(0, 500))].join(" "),
        mode: "recall",
        limit: 5,
      });
      controller.signal.throwIfAborted();
      const result = await this.qm.turn({
        threadId: `clone-prediction:${randomUUID()}`,
        text: predictionPrompt(goal, messages, memory.results, draft),
        workspace: goal.workspace,
        readOnly: true,
        signal: controller.signal,
        onRun: async (id) => {
          runId = id;
          await this.store.trackRun(id, "prediction");
        },
      });
      const text = parsePrediction(result.text, draft);
      if (persist)
        await this.store.prediction(id, {
          draft,
          revision,
          text,
          cloneId: goal.cloneId,
          sources: memory.results,
          model: result.model,
          runId: result.runId,
        });
      return { text, revision, sources: memory.results };
    } finally {
      if (runId) await this.store.untrackRun(runId);
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
  async start(id: string, options: { loop: boolean; instruction?: string; human?: boolean }): Promise<void> {
    await this.mutate(id, () => this.startExclusive(id, options));
  }
  private async startExclusive(
    id: string,
    options: { loop: boolean; instruction?: string; human?: boolean },
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
  private async run(
    goal: Goal,
    controller: AbortController,
    options: { loop: boolean; instruction?: string; human?: boolean },
  ): Promise<void> {
    const signal = controller.signal;
    let instruction = options.instruction?.trim();
    let sources: Source[] = [];
    if (!instruction) {
      const prediction = await this.predict(goal.id, "", 0);
      instruction = prediction.text;
      sources = prediction.sources;
    }
    signal.throwIfAborted();
    if (options.human)
      await this.memory.remember({
        ownerId: "min",
        workspace: goal.workspace,
        text: instruction,
        source: `Clone conversation ${goal.id}`,
        kind: "user-message",
      });
    let first = true;
    for (;;) {
      signal.throwIfAborted();
      await this.store.append(
        {
          goalId: goal.id,
          role: first && options.human ? "user" : "clone",
          content: instruction,
          cloneId: goal.cloneId,
          sources,
        },
        goal.generation,
      );
      await this.store.patch(goal.id, { phase: "executing", error: "" }, goal.generation);
      const result = await this.qm.turn({
        threadId: `clone-goal:${goal.id}`,
        text: executionPrompt(goal, instruction),
        workspace: goal.workspace,
        signal,
        onRun: async (activeRunId) => {
          await this.store.patch(goal.id, { activeRunId }, goal.generation);
        },
      });
      signal.throwIfAborted();
      await this.store.append(
        { goalId: goal.id, role: "assistant", content: result.text, model: result.model, runId: result.runId },
        goal.generation,
      );
      goal.iterations++;
      await this.store.patch(goal.id, { iterations: goal.iterations, activeRunId: "" }, goal.generation);
      const current = await this.store.goal(goal.id);
      if (!current.loopEnabled) {
        await this.store.patch(goal.id, { phase: "idle" }, goal.generation);
        return;
      }
      await this.store.patch(goal.id, { phase: "reviewing" }, goal.generation);
      const memory = await this.memory.search({
        workspace: goal.workspace,
        cloneId: goal.cloneId,
        query: `${goal.title} ${goal.project} ${result.text.slice(0, 600)}`,
        mode: "recall",
        limit: 5,
      });
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
      await this.store.append(
        {
          goalId: goal.id,
          role: "review",
          content: review.review,
          cloneId: goal.cloneId,
          sources: memory.results,
          model: reviewResult.model,
          runId: reviewResult.runId,
        },
        goal.generation,
      );
      goal.criteria = review.criteria;
      await this.store.patch(
        goal.id,
        { criteria: review.criteria, phase: "improving", activeRunId: "" },
        goal.generation,
      );
      instruction = review.nextInstruction;
      sources = memory.results;
      first = false;
      await delay(1800, undefined, { signal });
    }
  }
}
