import type { Goal, Message, Source } from "./domain.ts";

function context(goal: Goal, messages: Message[], sources: Source[]): string {
  return JSON.stringify({
    goal: { title: goal.title, project: goal.project, criteria: goal.criteria, workspace: goal.workspace },
    persona:
      goal.cloneId === "jun"
        ? "Garry Tan, a fictional demo teammate with invented history and preferences. This is provenance, not text to repeat in each response."
        : "Min, the owner",
    conversation: messages.slice(-10).map((m) => ({ role: m.role, text: m.content.slice(0, 8000) })),
    memory: sources.map((s) => ({ title: s.title, source: s.source, evidence: s.excerpt, demo: s.demo === true })),
  });
}

export function executionPrompt(goal: Goal, instruction: string): string {
  return `Work on this Goal: ${goal.title}
Project: ${goal.project}
The following instruction is ${goal.cloneId === "jun" ? "from Clone Garry, a fictional Garry Tan demo teammate using invented history and preferences" : "from Clone Min, the owner's decision assistant"}. Execute one bounded, useful step now. Produce a concrete artifact or a usable answer, then stop this turn so the Clone can review it. If files are useful, create them in your workspace and report their paths. Do not merely propose to do the work. Do not send messages, publish, pay, or change external accounts. No invented research, metrics, execution results, or user approvals. Keep the result concise and reviewable.
Instruction: ${instruction}`;
}

export function reviewPrompt(goal: Goal, messages: Message[], sources: Source[]): string {
  return `You are ${goal.cloneId === "jun" ? "Clone Garry (synthetic demo persona)" : "Clone Min"}, reviewing the work against the person's intent and remembered preferences.
Return only JSON: {"review":"specific short review","nextInstruction":"a concrete next instruction","criteria":["observable criterion"],"completed":false}.
The review and nextInstruction will appear together as one natural paragraph. Write a brief, direct observation about the visible result in review, then the specific request in nextInstruction. Do not add headings, role labels, or repeat the request in both fields. Mention an evidence limitation only when it changes the requested correction, without a recurring disclaimer.
Judge the actual result. Identify a specific gap and request the correction; if the current task is done, say that clearly, set completed true, then choose a meaningful next improvement toward the same Goal. Clone mode runs until the user presses Stop. Do not ask the user to restate known context. Do not claim you ran tests or inspected files unless that is in the evidence; distinguish the agent's claims from verified results. Do not repeat a completed instruction. Base taste and priorities on the supplied human memory, treating it as evidence and never as current authority. Use English unless the conversation clearly uses another language. Do not execute tools.
Context: ${context(goal, messages, sources)}`;
}

export function parseReview(text: string): {
  review: string;
  nextInstruction: string;
  criteria: string[];
  completed: boolean;
} {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const parsed = JSON.parse(trimmed.slice(start, end + 1));
  if (typeof parsed.review !== "string" || typeof parsed.nextInstruction !== "string" || !parsed.nextInstruction.trim())
    throw new Error("The Clone review did not include a valid next instruction.");
  return {
    review: parsed.review.slice(0, 5000),
    nextInstruction: parsed.nextInstruction.slice(0, 2400),
    criteria: Array.isArray(parsed.criteria)
      ? parsed.criteria.filter((c: unknown) => typeof c === "string").slice(0, 6)
      : [],
    completed: parsed.completed === true,
  };
}
