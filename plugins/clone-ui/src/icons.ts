import { svg } from "lit";

const paths: Record<string, string> = {
  plus: "M12 5v14M5 12h14",
  goals: "M21 12a9 9 0 1 1-9-9M21 3l-9 9m4-9h5v5M16 12a4 4 0 1 1-4-4",
  inbox: "M4 4h16l2 12v4H2v-4L4 4ZM2 14h6l2 3h4l2-3h6",
  memory:
    "M9 18V5a3 3 0 0 0-6 0v2a3 3 0 0 0-1 5 3 3 0 0 0 2 5v1a3 3 0 0 0 5 2M15 18V5a3 3 0 0 1 6 0v2a3 3 0 0 1 1 5 3 3 0 0 1-2 5v1a3 3 0 0 1-5 2M6 8h3m6 0h3M6 14h3m6 0h3",
  folder: "M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3V7Z",
  chevron: "m8 10 4 4 4-4",
  arrow: "M12 19V5m-6 6 6-6 6 6",
  right: "M5 12h14m-6-6 6 6-6 6",
  sparkle: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4",
  loop: "M20 7h-7m7 0V1M4 17h7m-7 0v6M3.7 9a8.5 8.5 0 0 1 14-5L20 7M4 17l2.3 3a8.5 8.5 0 0 0 14-5",
  stop: "M6 6h12v12H6Z",
  check: "m5 12 4 4L19 6",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.8M13 3.2a4 4 0 0 1 0 7.6M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  close: "m6 6 12 12M6 18 18 6",
  clock: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  link: "m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 2h6l1 4 4 1 2 5-3 3 1 4-5 3-3-3-4 1-3-5 3-3-1-4 2-1V2Z",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5m-5 3 2-16",
  book: "M12 6c-3-2-6-3-10-2v15c4-1 7 0 10 2m0-15c3-2 6-3 10-2v15c-4-1-7 0-10 2V6Z",
  external: "M14 3h7v7m0-7L10 14M10 3H3v18h18v-7",
};

export function icon(name: string, size = 18) {
  return svg`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${paths[name] ?? paths.sparkle}></path></svg>`;
}

export function brand(size = 29) {
  return svg`<svg width=${size} height=${size} viewBox="0 0 128 128" fill="none" aria-hidden="true"><rect width="128" height="128" rx="24" fill="currentColor"></rect><circle cx="62" cy="60" r="30" stroke="white" stroke-width="12"></circle><path d="m78 78 20 20" stroke="white" stroke-width="12" stroke-linecap="round"></path></svg>`;
}
