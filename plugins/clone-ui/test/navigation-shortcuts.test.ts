import assert from "node:assert/strict";
import test from "node:test";
import { navigationItems, navigationShortcut, navigationShortcutHint } from "../src/navigation-shortcuts.ts";

const chord = {
  code: "Digit1",
  metaKey: true,
  ctrlKey: false,
  altKey: true,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
};

test("navigation chords map physical number keys to the same four destinations on Mac and Windows", () => {
  for (const item of navigationItems) {
    assert.equal(navigationShortcut({ ...chord, code: `Digit${item.digit}` }), item.view);
    assert.equal(
      navigationShortcut({ ...chord, code: `Digit${item.digit}`, metaKey: false, ctrlKey: true }),
      item.view,
    );
  }
  assert.equal(navigationShortcutHint("2", true), "⌘ ⌥ 2");
  assert.equal(navigationShortcutHint("2", false), "Ctrl Alt 2");
});

test("navigation leaves browser tabs, other modifier chords, and AltGraph typing untouched", () => {
  for (const change of [
    { altKey: false },
    { metaKey: false },
    { ctrlKey: true },
    { shiftKey: true },
    { code: "Digit5" },
    { code: "Numpad1" },
    { code: "KeyK" },
    { metaKey: false, ctrlKey: true, getModifierState: (key: string) => key === "AltGraph" },
  ])
    assert.equal(navigationShortcut({ ...chord, ...change }), undefined);
});

test("navigation ignores composition, held keys, and events already handled by another control", () => {
  for (const flag of ["isComposing", "repeat", "defaultPrevented"] as const)
    assert.equal(navigationShortcut({ ...chord, [flag]: true }), undefined);
});
