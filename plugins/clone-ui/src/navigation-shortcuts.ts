export const navigationItems = [
  { view: "new", label: "New", icon: "plus", digit: "1" },
  { view: "inbox", label: "Inbox", icon: "inbox", digit: "2" },
  { view: "goals", label: "Goals", icon: "goals", digit: "3" },
  { view: "memory", label: "Memories", icon: "memory", digit: "4" },
] as const;

type NavigationKey = Pick<
  KeyboardEvent,
  "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented"
> &
  Partial<Pick<KeyboardEvent, "getModifierState">>;

export function navigationShortcut(event: NavigationKey) {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.shiftKey ||
    !event.altKey ||
    event.metaKey === event.ctrlKey ||
    event.getModifierState?.("AltGraph")
  )
    return undefined;
  return navigationItems.find((item) => event.code === `Digit${item.digit}`)?.view;
}

export function navigationShortcutHint(digit: string, isMac: boolean) {
  return isMac ? `⌘ ⌥ ${digit}` : `Ctrl Alt ${digit}`;
}
