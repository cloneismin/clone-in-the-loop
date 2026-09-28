import type { Message } from "./api.ts";

export function conversationTurns(messages: readonly Message[]): Message[][] {
  const turns: Message[][] = [];
  for (const message of messages) {
    const previousTurn = turns.at(-1);
    const previous = previousTurn?.at(-1);
    const isLegacyReply =
      previousTurn?.length === 1 &&
      previous?.role === "review" &&
      message.role === "clone" &&
      Boolean(previous.cloneId) &&
      previous.cloneId === message.cloneId &&
      previous.executionInstruction === undefined &&
      message.executionInstruction === undefined &&
      previous.replyTo === undefined &&
      message.replyTo === undefined;
    if (isLegacyReply) previousTurn!.push(message);
    else turns.push([message]);
  }
  return turns;
}
