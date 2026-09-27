import { randomUUID } from "node:crypto";
import pg from "pg";
import type { Goal, Message, Workspace } from "./domain.ts";

export class Store {
  pool: pg.Pool;
  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 5 });
  }
  async init(): Promise<void> {
    await this.pool.query(`
      CREATE SCHEMA IF NOT EXISTS clone_loop;
      CREATE TABLE IF NOT EXISTS clone_loop.goals (
        id text PRIMARY KEY,
        data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS clone_loop.messages (
        seq bigserial PRIMARY KEY,
        id text UNIQUE NOT NULL,
        goal_id text NOT NULL REFERENCES clone_loop.goals(id),
        data jsonb NOT NULL
      );
      CREATE INDEX IF NOT EXISTS clone_loop_messages_goal ON clone_loop.messages(goal_id, seq);
      CREATE TABLE IF NOT EXISTS clone_loop.predictions (
        id text PRIMARY KEY,
        goal_id text NOT NULL REFERENCES clone_loop.goals(id),
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS clone_loop.pending_runs (
        run_id text PRIMARY KEY,
        kind text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }
  async goals(workspace?: Workspace): Promise<Goal[]> {
    const result = await this.pool.query(
      "SELECT data FROM clone_loop.goals WHERE ($1::text IS NULL OR data->>'workspace'=$1) ORDER BY data->>'updatedAt' DESC",
      [workspace ?? null],
    );
    return result.rows.map((r) => r.data);
  }
  async goal(id: string): Promise<Goal> {
    const result = await this.pool.query("SELECT data FROM clone_loop.goals WHERE id=$1", [id]);
    if (!result.rows[0]) throw new Error("Goal not found.");
    return result.rows[0].data;
  }
  async create(input: Pick<Goal, "title" | "project" | "workspace" | "cloneId">): Promise<Goal> {
    const now = new Date().toISOString();
    const goal: Goal = {
      ...input,
      id: randomUUID(),
      status: "active",
      phase: "idle",
      loopEnabled: false,
      iterations: 0,
      generation: 0,
      createdAt: now,
      updatedAt: now,
      criteria: [],
    };
    await this.pool.query("INSERT INTO clone_loop.goals(id,data) VALUES($1,$2)", [goal.id, goal]);
    return goal;
  }
  async patch(id: string, patch: Partial<Goal>, generation?: number): Promise<Goal | null> {
    const result = await this.pool.query(
      "UPDATE clone_loop.goals SET data=data || $2::jsonb WHERE id=$1 AND ($3::int IS NULL OR (data->>'generation')::int=$3) RETURNING data",
      [id, { ...patch, updatedAt: new Date().toISOString() }, generation ?? null],
    );
    return result.rows[0]?.data ?? null;
  }
  async messages(id: string): Promise<Message[]> {
    const result = await this.pool.query("SELECT data FROM clone_loop.messages WHERE goal_id=$1 ORDER BY seq", [id]);
    return result.rows.map((r) => r.data);
  }
  async append(input: Omit<Message, "id" | "createdAt">, generation?: number): Promise<Message | null> {
    const message: Message = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    const result = await this.pool.query(
      "INSERT INTO clone_loop.messages(id,goal_id,data) SELECT $1,$2,$3 FROM clone_loop.goals WHERE id=$2 AND ($4::int IS NULL OR (data->>'generation')::int=$4) RETURNING id",
      [message.id, message.goalId, message, generation ?? null],
    );
    return result.rowCount ? message : null;
  }
  async prediction(goalId: string, data: unknown): Promise<void> {
    await this.pool.query("INSERT INTO clone_loop.predictions(id,goal_id,data) VALUES($1,$2,$3)", [
      randomUUID(),
      goalId,
      data,
    ]);
  }
  async trackRun(runId: string, kind: string): Promise<void> {
    await this.pool.query("INSERT INTO clone_loop.pending_runs(run_id,kind) VALUES($1,$2) ON CONFLICT DO NOTHING", [
      runId,
      kind,
    ]);
  }
  async untrackRun(runId: string): Promise<void> {
    await this.pool.query("DELETE FROM clone_loop.pending_runs WHERE run_id=$1", [runId]);
  }
  async pendingRuns(): Promise<string[]> {
    return (await this.pool.query("SELECT run_id FROM clone_loop.pending_runs")).rows.map((row) => row.run_id);
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
}
