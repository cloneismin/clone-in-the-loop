import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8").replace(/^import[\s\S]*?;\n/gm, "");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

type Composer = {
  active: unknown;
  view: string;
  draft: string;
  prediction: { text: string; expiresAt: number };
  acceptPrediction(): void;
  navigate(view: string): Promise<void>;
  openGoal(id: string): Promise<void>;
  send(): Promise<void>;
  onDraft(event: { target: { value: string }; inputType?: string }): void;
};

function fixture(sendResult = Promise.resolve()) {
  let createApp: () => Composer = () => {
    throw new Error("Composer did not register");
  };
  const calls: Array<{ url: string; body?: { origin?: string; text?: string } }> = [];
  const goal = {
    id: "g1",
    workspace: "personal",
    cloneId: "min",
    project: "Marketing",
    phase: "idle",
    loopEnabled: false,
  };
  runInNewContext(compiled, {
    LitElement: class {
      updateComplete = Promise.resolve();
      querySelector() {
        return null;
      }
    },
    customElements: {
      define(_name: string, Constructor: new () => Composer) {
        createApp = () => new Constructor();
      },
    },
    localStorage: { setItem() {}, removeItem() {} },
    setTimeout,
    clearTimeout,
    AbortController,
    api: async (url: string, body?: { origin?: string; text?: string }) => {
      calls.push({ url, body });
      if (url.endsWith("/send")) await sendResult;
      return url === "/state" ? { goals: [], clones: [] } : { goal, messages: [] };
    },
    messageError: String,
  });
  const app = createApp();
  app.active = { goal, messages: [] };
  app.view = "goal";
  return { app, calls };
}

function accept(app: Composer, text: string) {
  app.prediction = { text, expiresAt: Date.now() / 1000 + 60 };
  app.acceptPrediction();
}

test("opening a saved goal after navigation preserves generated draft provenance", async () => {
  const { app, calls } = fixture();
  app.draft = "";
  accept(app, "Generated instruction");
  await app.navigate("goals");
  await app.openGoal("g1");
  await app.send();
  assert.equal(calls.find((call) => call.url.endsWith("/send"))?.body?.origin, "accepted_prediction");
});

test("undoing a second completion keeps provenance for generated text from the first", async () => {
  const { app, calls } = fixture();
  app.draft = "Review";
  accept(app, "Review launch");
  app.onDraft({ target: { value: "Review launch and" } });
  accept(app, "Review launch and pricing");
  app.onDraft({ target: { value: "Review launch and" } });
  await app.send();
  assert.equal(calls.find((call) => call.url.endsWith("/send"))?.body?.origin, "edited_prediction");
});

test("undoing all completions restores human provenance for the original draft", async () => {
  const { app, calls } = fixture();
  app.draft = "Review";
  accept(app, "Review launch");
  accept(app, "Review launch and pricing");
  app.onDraft({ target: { value: "Review" } });
  await app.send();
  assert.equal(calls.find((call) => call.url.endsWith("/send"))?.body?.origin, "human");
});

test("native undo and redo preserve provenance even when undo restores an empty draft", async () => {
  for (const original of ["Review", ""]) {
    const { app, calls } = fixture();
    app.draft = original;
    accept(app, "Review launch");
    app.onDraft({ target: { value: original }, inputType: "historyUndo" });
    app.onDraft({ target: { value: "Review launch" }, inputType: "historyRedo" });
    await app.send();
    assert.equal(calls.find((call) => call.url.endsWith("/send"))?.body?.origin, "accepted_prediction");
  }
});

test("replacing a generated draft conservatively retains provenance while native undo history exists", async () => {
  const { app, calls } = fixture();
  app.draft = "Review";
  accept(app, "Review launch");
  app.onDraft({ target: { value: "" }, inputType: "deleteContentBackward" });
  app.onDraft({ target: { value: "New direction" }, inputType: "insertText" });
  await app.send();
  assert.equal(calls.find((call) => call.url.endsWith("/send"))?.body?.origin, "edited_prediction");
});

test("undoing replacement typing and deletion restores the accepted prediction provenance", async () => {
  const { app, calls } = fixture();
  app.draft = "Review";
  accept(app, "Review launch");
  app.onDraft({ target: { value: "" }, inputType: "deleteContentBackward" });
  app.onDraft({ target: { value: "New direction" }, inputType: "insertText" });
  app.onDraft({ target: { value: "" }, inputType: "historyUndo" });
  app.onDraft({ target: { value: "Review launch" }, inputType: "historyUndo" });
  await app.send();
  assert.equal(calls.find((call) => call.url.endsWith("/send"))?.body?.origin, "accepted_prediction");
});

test("editing while a send is pending retains provenance for the next send", async () => {
  let finish!: () => void;
  const { app, calls } = fixture(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  app.draft = "Review";
  accept(app, "Review launch");
  const sending = app.send();
  app.onDraft({ target: { value: "Review launch tomorrow" }, inputType: "insertText" });
  finish();
  await sending;
  await app.send();
  assert.deepEqual(
    calls.filter((call) => call.url.endsWith("/send")).map((call) => call.body?.origin),
    ["accepted_prediction", "edited_prediction"],
  );
});
