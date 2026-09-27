export type Workspace = "personal" | "team";

export interface Clone {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  demo?: boolean;
}

export interface Goal {
  id: string;
  title: string;
  project: string;
  workspace: Workspace;
  status: string;
  cloneId: string;
  loopEnabled: boolean;
  phase: string;
  iterations: number;
  error?: string;
}

export interface MemorySource {
  id: string;
  title: string;
  source: string;
  excerpt: string;
  demo?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "clone" | "review";
  content: string;
  createdAt: string;
  cloneId?: string;
  sources?: MemorySource[];
}

export interface AppState {
  workspace: Workspace;
  clones: Clone[];
  goals: Goal[];
  activeGoalId?: string;
  models: { id: string; label: string }[];
  memory: { status: MemoryStatus; counts: Record<string, number> | number };
}

export interface GoalDetail {
  goal: Goal;
  messages: Message[];
}

export interface Prediction {
  text: string;
  revision: number;
  sources?: MemorySource[];
}

export interface MemoryResults {
  results: MemorySource[];
  counts: Record<string, number> | number;
  status: MemoryStatus;
}

export type MemoryStatus = string | { engine?: string; mode?: string; ready?: boolean; error?: string };

export interface InboxItem {
  id: string;
  title: string;
  project: string;
  reason: string;
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : data?.error?.message;
    if (response.status === 409 && data?.code === "PREDICTION_CANCELED")
      throw new DOMException(message || "Prediction canceled.", "AbortError");
    throw new Error(message || data?.message || `Request failed (${response.status})`);
  }
  return data as T;
}

export function messageError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function completionSuffix(draft: string, prediction: string): string {
  if (!draft) return prediction;
  return prediction.startsWith(draft) ? prediction.slice(draft.length) : "";
}

export function memoryTotal(counts: Record<string, number> | number | undefined): number {
  if (typeof counts === "number") return counts;
  if (!counts) return 0;
  if (typeof counts.accessible === "number") return counts.accessible;
  if (typeof counts.total === "number") return counts.total;
  return Object.values(counts).reduce((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
}

export function memoryStatusLabel(status: MemoryStatus | undefined): string {
  if (!status) return "connecting";
  if (typeof status === "string") return status === "ready" ? "connected" : status;
  if (status.error) return "unavailable";
  if (status.ready === false) return "connecting";
  if (status.mode?.includes("keyword")) return "keyword search";
  return status.ready ? "connected" : status.mode || "connecting";
}
