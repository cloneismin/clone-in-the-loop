import { ClonePredictionError } from "@clone-ai/tab-completion";

export class PredictionCanceledError extends Error {
  constructor() {
    super("Prediction canceled.");
    this.name = "PredictionCanceledError";
  }
}

export function requestError(error: unknown) {
  if (error instanceof ClonePredictionError)
    return { status: error.status, body: { error: error.code, code: error.code } };
  if (error instanceof PredictionCanceledError)
    return { status: 409, body: { error: error.message, code: "PREDICTION_CANCELED" } };
  const message = error instanceof Error ? error.message : "Request failed.";
  return { status: message === "Goal not found." ? 404 : 400, body: { error: message } };
}
