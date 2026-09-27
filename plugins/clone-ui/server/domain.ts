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
};

export const CLONES = [
  { id: "min", name: "Clone Min", color: "#7863e6", demo: false },
  { id: "jun", name: "Clone Jun", color: "#1d9b82", demo: true },
] as const;

export function assertCloneScope(workspace: Workspace, cloneId: CloneId): void {
  if (workspace === "personal" && cloneId !== "min")
    throw new Error("Teammate Clones are available in the team workspace.");
}

export function parsePrediction(text: string, draft: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let instruction = trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.instruction === "string") instruction = parsed.instruction.trim();
  } catch {
    instruction = trimmed.replace(/^['"]|['"]$/g, "");
  }
  if (!instruction || instruction.length > 2400) throw new Error("The prediction was empty or too long. Try again.");
  if (draft && !instruction.startsWith(draft)) return `${draft}${/\s$/.test(draft) ? "" : " "}${instruction}`;
  return instruction;
}
