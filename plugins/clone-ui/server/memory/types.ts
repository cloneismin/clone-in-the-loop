export type Workspace = "personal" | "team";
export type CloneId = "min" | "jun";

export interface MemoryRecord {
  id: string;
  ownerId: CloneId;
  workspace: Workspace;
  title: string;
  text: string;
  source: string;
  sourceRef?: string;
  kind: string;
  demo: boolean;
  timestamp?: string;
}

export interface MemoryResult {
  id: string;
  title: string;
  source: string;
  excerpt: string;
  demo: boolean;
  ownerId: CloneId;
  workspace: Workspace;
  score: number;
}

export interface MemoryCounts {
  personal: number;
  team: number;
  accessible: number;
  codex: number;
  claude: number;
  demo: number;
}

export interface MemoryStatus {
  engine: "gbrain-pglite";
  mode: "local-keyword";
  ready: boolean;
  version: string;
  revision: string;
  imported: number;
}

export interface MemorySearch {
  workspace: Workspace;
  cloneId: CloneId;
  query: string;
  mode?: "search" | "recall";
  limit?: number;
}

export interface MemorySearchResponse {
  results: MemoryResult[];
  counts: MemoryCounts;
  status: MemoryStatus;
}

export interface RememberInput {
  ownerId: CloneId;
  workspace: Workspace;
  text: string;
  source: string;
  kind?: string;
}

export interface ImportResult {
  imported: number;
  codex: number;
  claude: number;
  skipped: number;
  status: MemoryStatus;
}

export interface MemoryService {
  init(): Promise<MemoryStatus>;
  importLocalHistory(input: { ownerId: "min"; limit?: number }): Promise<ImportResult>;
  search(input: MemorySearch): Promise<MemorySearchResponse>;
  remember(input: RememberInput): Promise<MemoryResult>;
  close(): Promise<void>;
}
