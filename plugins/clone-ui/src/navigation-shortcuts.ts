export const navigationItems = [
  { view: "new", label: "New", icon: "plus", digit: "1" },
  { view: "goals", label: "Sessions", icon: "goals", digit: "2" },
  { view: "inbox", label: "Inbox", icon: "inbox", digit: "3" },
  { view: "memory", label: "Memory", icon: "memory", digit: "4" },
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
