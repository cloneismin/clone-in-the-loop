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
