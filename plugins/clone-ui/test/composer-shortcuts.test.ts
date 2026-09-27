import assert from "node:assert/strict";
import test from "node:test";
import { composerTabAction } from "../src/composer-shortcuts.ts";

const tab = { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false };

test("Tab accepts once, then enables Clone mode for the unchanged accepted prediction", () => {
  const prediction = "Review the launch draft and make its benefit concrete.";
  assert.equal(composerTabAction(tab, "Review", prediction, ""), "accept");
  assert.equal(composerTabAction(tab, prediction, undefined, prediction), "enable-loop");
});

test("editing or clearing the acceptance state restores ordinary Tab focus navigation", () => {
  const accepted = "Review the launch draft.";
  assert.equal(composerTabAction(tab, `${accepted} Keep the title.`, undefined, accepted), "move-focus");
  assert.equal(composerTabAction(tab, accepted, undefined, ""), "move-focus");
  assert.equal(composerTabAction(tab, "An original user instruction.", undefined, ""), "move-focus");
});

test("holding Tab or using modified Tab cannot start Clone mode", () => {
  const accepted = "Review the launch draft.";
  assert.equal(composerTabAction({ ...tab, repeat: true }, accepted, undefined, accepted), "ignore");
  for (const modifier of ["shiftKey", "ctrlKey", "metaKey", "altKey"] as const)
    assert.equal(composerTabAction({ ...tab, [modifier]: true }, accepted, undefined, accepted), "move-focus");
});
