type TabKey = Pick<KeyboardEvent, "shiftKey" | "ctrlKey" | "metaKey" | "altKey" | "repeat">;

export function composerTabAction(
  key: TabKey,
  draft: string,
  prediction: string | undefined,
  acceptedPrediction: string,
): "accept" | "enable-loop" | "ignore" | "move-focus" {
  if (key.shiftKey || key.ctrlKey || key.metaKey || key.altKey) return "move-focus";
  if (key.repeat) return "ignore";
  if (acceptedPrediction && draft === acceptedPrediction) return "enable-loop";
  if (prediction) return "accept";
  return "move-focus";
}

export function composerLoopInstruction(
  hasExistingGoal: boolean,
  draft: string,
  prediction: string | undefined,
): string | undefined {
  const instruction = draft.trim();
  if (instruction) return instruction;
  if (hasExistingGoal) return undefined;
  return prediction?.trim() || undefined;
}
