export type Workspace = "personal" | "team";
export type CloneId = "min" | "jun";
export type Source = { id: string; title: string; source: string; excerpt: string; demo?: boolean };
export type Goal = {
  id: string;
  title: string;
  project: string;
  workspace: Workspace;
  cloneId: CloneId;
  status: "active" | "completed" | "paused" | "error";
  phase: "idle" | "predicting" | "executing" | "reviewing" | "improving" | "stopping" | "error";
  loopEnabled: boolean;
  iterations: number;
  generation: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  activeRunId?: string;
  criteria: string[];
};
export type Message = {
  id: string;
  goalId: string;
  role: "user" | "assistant" | "clone" | "review";
  content: string;
  createdAt: string;
  cloneId?: CloneId;
  sources?: Source[];
  model?: string;
  runId?: string;
  executionInstruction?: string;
  replyTo?: string;
  origin?: "human" | "agent" | "accepted_prediction" | "edited_prediction" | "unknown";
};

export const CLONES = [
  { id: "min", name: "Min Kim", color: "#7863e6", avatar: "/avatars/min.png", demo: false },
  { id: "jun", name: "Garry Tan", color: "#1d9b82", avatar: "/avatars/garry.png", demo: true },
] as const;

export function assertCloneScope(workspace: Workspace, cloneId: CloneId): void {
  if (workspace === "personal" && cloneId !== "min")
    throw new Error("Teammate Clones are available in the team workspace.");
}
