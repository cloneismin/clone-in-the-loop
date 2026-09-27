import type { MemoryRecord } from "./types.ts";

export const TEAM_DEMO_MEMORIES: MemoryRecord[] = [
  {
    id: "demo-jun-launch-review",
    ownerId: "jun",
    workspace: "team",
    demo: true,
    title: "Jun · launch review preferences",
    source: "Jun demo history",
    kind: "demo-history",
    text: "Synthetic teammate history for the hackathon demo. Jun reviews launch copy by asking for one concrete user outcome, one visible product interaction, and one clear call to action. Remove vague claims. Compare the draft against the original brief before approving it.",
  },
  {
    id: "demo-jun-research",
    ownerId: "jun",
    workspace: "team",
    demo: true,
    title: "Jun · research and evidence",
    source: "Jun demo history",
    kind: "demo-history",
    text: "Synthetic teammate history for the hackathon demo. Jun wants research to cite primary sources and distinguish a hypothesis from a measured result. For an agent workflow, show the input, execution, review, and the correction that made the final artifact better.",
  },
  {
    id: "demo-jun-next-step",
    ownerId: "jun",
    workspace: "team",
    demo: true,
    title: "Jun · next instruction",
    source: "Jun demo history",
    kind: "demo-history",
    text: "Synthetic teammate history for the hackathon demo. After an agent produces a launch draft, Jun asks: Make the headline shorter, make the benefit concrete, and show the product doing the work. After revision, verify the result against the completion criteria before choosing the next useful action.",
  },
  {
    id: "demo-team-working-agreement",
    ownerId: "min",
    workspace: "team",
    demo: true,
    title: "Team · shared demo working agreement",
    source: "Team demo history",
    kind: "demo-history",
    text: "Synthetic shared team history for the hackathon demo. The team is building an AI-native workflow in QM. GBrain retrieves source-scoped chat evidence for next-prompt prediction and review. Every proposed next instruction should advance the current task. Personal histories stay private unless the owner explicitly shares them.",
  },
];
