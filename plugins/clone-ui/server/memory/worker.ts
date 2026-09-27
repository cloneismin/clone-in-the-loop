import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { TEAM_DEMO_MEMORIES } from "./demo.ts";
import { collectLocalHistory, sanitizeUserText, staleImportedHistoryPages } from "./history.ts";
import { GBRAIN_DIRECTORY, GBRAIN_REVISION, GBRAIN_VERSION } from "./paths.ts";
import { recallQueries } from "./recall-query.ts";
import type {
  CloneId,
  ImportResult,
  MemoryCounts,
  MemoryRecord,
  MemoryResult,
  MemorySearch,
  MemorySearchResponse,
  MemoryStatus,
  RememberInput,
  Workspace,
} from "./types.ts";

interface BrainPage {
  slug: string;
  source_id: string;
  title: string;
  compiled_truth: string;
  frontmatter: Record<string, unknown>;
}

interface BrainHit {
  slug: string;
  source_id: string;
  score: number;
}

interface BrainEngine {
  connect(input: { engine: string; database_path: string }): Promise<void>;
  initSchema(): Promise<void>;
  disconnect(): Promise<void>;
  executeRaw<T>(query: string, values?: unknown[]): Promise<T[]>;
  getPage(slug: string, input: { sourceId: string }): Promise<BrainPage | null>;
  deletePage(slug: string, input: { sourceId: string }): Promise<void>;
  putPage(slug: string, input: Record<string, unknown>, scope: { sourceId: string }): Promise<BrainPage>;
  upsertChunks(slug: string, chunks: Record<string, unknown>[], scope: { sourceId: string }): Promise<void>;
  listPages(input: { sourceIds: string[]; limit: number; sort: string }): Promise<BrainPage[]>;
  searchKeyword(query: string, input: { sourceIds: string[]; limit: number; orFallback: boolean }): Promise<BrainHit[]>;
}

interface Request {
  id: string;
  method: "init" | "import" | "search" | "remember" | "close";
  input?: unknown;
}

const SOURCES = {
  personal: "clone-personal-min",
  shared: "clone-team-shared",
  junDemo: "clone-team-jun-demo",
} as const;

let engine: BrainEngine | null = null;
const dataDir = resolve(process.argv[2] || ".clone-loop/memory");

function activeEngine(): BrainEngine {
  if (!engine) throw new Error("GBrain has not been initialized.");
  return engine;
}

function scope(workspace: Workspace, cloneId: CloneId): string[] {
  if (workspace === "personal" && cloneId === "min") return [SOURCES.personal];
  if (workspace === "team" && (cloneId === "min" || cloneId === "jun")) return [SOURCES.shared, SOURCES.junDemo];
  throw new Error("This clone is not permitted to access the requested memory scope.");
}

function recordSource(record: MemoryRecord): string {
  if (record.workspace === "personal" && record.ownerId === "min") return SOURCES.personal;
  if (record.workspace === "team") return record.ownerId === "jun" ? SOURCES.junDemo : SOURCES.shared;
  throw new Error("Unsupported memory owner.");
}

async function save(record: MemoryRecord): Promise<MemoryResult> {
  const brain = activeEngine();
  const sourceId = recordSource(record);
  const slug = `conversations/${record.id}`;
  const prior = await brain.getPage(slug, { sourceId });
  if (!prior || prior.compiled_truth !== record.text) {
    await brain.putPage(
      slug,
      {
        type: "conversation",
        title: record.title,
        compiled_truth: record.text,
        frontmatter: {
          ownerId: record.ownerId,
          workspace: record.workspace,
          source: record.source,
          demo: record.demo,
          kind: record.kind,
          timestamp: record.timestamp,
        },
        source_kind: record.kind,
        source_uri: record.sourceRef ?? record.source,
        ingested_via: "clone-in-the-loop",
      },
      { sourceId },
    );
  }
  await brain.upsertChunks(slug, [{ chunk_index: 0, chunk_text: record.text, chunk_source: "compiled_truth" }], {
    sourceId,
  });
  return resultFromPage(
    { slug, source_id: sourceId, title: record.title, compiled_truth: record.text, frontmatter: { ...record } },
    1,
  );
}

function resultFromPage(page: BrainPage, score: number): MemoryResult {
  const metadata = page.frontmatter;
  return {
    id: page.slug,
    title: page.title,
    source: String(metadata.source || "GBrain memory"),
    excerpt: page.compiled_truth.slice(0, 1200),
    demo: metadata.demo === true,
    ownerId: metadata.ownerId === "jun" ? "jun" : "min",
    workspace: page.source_id === SOURCES.personal ? "personal" : "team",
    score,
  };
}

async function status(): Promise<MemoryStatus> {
  const rows = await activeEngine().executeRaw<{ count: string }>(
    "SELECT COUNT(*) AS count FROM pages WHERE deleted_at IS NULL AND source_id = $1 AND frontmatter->>'kind' = 'human-history'",
    [SOURCES.personal],
  );
  return {
    engine: "gbrain-pglite",
    mode: "local-keyword",
    ready: true,
    version: GBRAIN_VERSION,
    revision: GBRAIN_REVISION,
    imported: Number(rows[0]?.count || 0),
  };
}

async function counts(sourceIds: string[]): Promise<MemoryCounts> {
  const rows = await activeEngine().executeRaw<{ source_id: string; source: string; demo: string; count: string }>(
    "SELECT source_id, frontmatter->>'source' AS source, frontmatter->>'demo' AS demo, COUNT(*) AS count FROM pages WHERE deleted_at IS NULL AND source_id = ANY($1::text[]) GROUP BY source_id, frontmatter->>'source', frontmatter->>'demo'",
    [sourceIds],
  );
  const result: MemoryCounts = { personal: 0, team: 0, accessible: 0, codex: 0, claude: 0, demo: 0 };
  for (const row of rows) {
    const total = Number(row.count);
    result.accessible += total;
    result[row.source_id === SOURCES.personal ? "personal" : "team"] += total;
    if (row.source === "Codex history") result.codex += total;
    if (row.source === "Claude history") result.claude += total;
    if (row.demo === "true") result.demo += total;
  }
  return result;
}

async function initialize(): Promise<MemoryStatus> {
  if (engine) return status();
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const engineModule = (await import(pathToFileURL(resolve(GBRAIN_DIRECTORY, "src/core/pglite-engine.ts")).href)) as {
    PGLiteEngine: new () => BrainEngine;
  };
  const sourceModule = (await import(pathToFileURL(resolve(GBRAIN_DIRECTORY, "src/core/sources-ops.ts")).href)) as {
    addSource: (engine: BrainEngine, input: { id: string; name: string }) => Promise<unknown>;
  };
  const brain = new engineModule.PGLiteEngine();
  await brain.connect({ engine: "pglite", database_path: resolve(dataDir, "brain") });
  try {
    await brain.initSchema();
    for (const [id, name] of [
      [SOURCES.personal, "Min private history"],
      [SOURCES.shared, "Shared team history"],
      [SOURCES.junDemo, "Garry synthetic demo history"],
    ]) {
      const rows = await brain.executeRaw<{ id: string }>("SELECT id FROM sources WHERE id = $1", [id]);
      if (!rows.length) await sourceModule.addSource(brain, { id: id!, name: name! });
    }
    await brain.executeRaw("UPDATE sources SET name = $1 WHERE id = $2 AND name = $3", [
      "Garry synthetic demo history",
      SOURCES.junDemo,
      "Jun synthetic demo history",
    ]);
    engine = brain;
    for (const record of TEAM_DEMO_MEMORIES) await save(record);
    return status();
  } catch (error) {
    engine = null;
    await brain.disconnect();
    throw error;
  }
}

async function search(input: MemorySearch): Promise<MemorySearchResponse> {
  const sourceIds = scope(input.workspace, input.cloneId);
  if (typeof input.query !== "string") throw new Error("A search query is required.");
  const query = input.query.trim().slice(0, 500);
  const limit = Math.max(1, Math.min(12, Math.floor(input.limit || 6)));
  const brain = activeEngine();
  let results: MemoryResult[];
  if (!query) {
    results = (await brain.listPages({ sourceIds, limit, sort: "updated_desc" })).map((page) =>
      resultFromPage(page, 0),
    );
  } else {
    const queries = input.mode === "recall" ? recallQueries(query) : [query];
    const batches = await Promise.all(
      queries.map((expression) => brain.searchKeyword(expression, { sourceIds, limit, orFallback: true })),
    );
    const ranked = new Map<string, BrainHit>();
    for (const batch of batches) {
      for (const [rank, hit] of batch.entries()) {
        if (!sourceIds.includes(hit.source_id))
          throw new Error("GBrain returned a result outside the requested source scope.");
        const key = `${hit.source_id}:${hit.slug}`;
        const score = input.mode === "recall" ? 1 / (60 + rank) : hit.score;
        ranked.set(key, { ...hit, score: (ranked.get(key)?.score ?? 0) + score });
      }
    }
    const hits = [...ranked.values()].sort((a, b) => b.score - a.score).slice(0, limit);
    results = [];
    for (const hit of hits) {
      const page = await brain.getPage(hit.slug, { sourceId: hit.source_id });
      if (page) results.push(resultFromPage(page, hit.score));
    }
  }
  const currentStatus = await status();
  if (input.workspace === "team") currentStatus.imported = 0;
  return { results, counts: await counts(sourceIds), status: currentStatus };
}

async function importHistory(input: { ownerId: string; limit?: number }): Promise<ImportResult> {
  if (input.ownerId !== "min") throw new Error("Local history import is available only for the signed-in owner.");
  const { records, skipped } = await collectLocalHistory(input.limit);
  const existing = await activeEngine().executeRaw<BrainPage>(
    "SELECT slug, source_id, frontmatter FROM pages WHERE deleted_at IS NULL AND source_id = $1 AND frontmatter->>'kind' = 'human-history'",
    [SOURCES.personal],
  );
  for (const slug of staleImportedHistoryPages(existing, records))
    await activeEngine().deletePage(slug, { sourceId: SOURCES.personal });
  for (const record of records) await save(record);
  return {
    imported: records.length,
    codex: records.filter((record) => record.source === "Codex history").length,
    claude: records.filter((record) => record.source === "Claude history").length,
    skipped,
    status: await status(),
  };
}

async function remember(input: RememberInput): Promise<MemoryResult> {
  scope(input.workspace, input.ownerId);
  if (input.ownerId !== "min") throw new Error("Synthetic teammate memory is read-only.");
  if (typeof input.text !== "string" || !sanitizeUserText(input.text, 1))
    throw new Error("This memory is empty or contains sensitive credentials.");
  const text = input.text.trim().slice(0, 3000);
  const id = createHash("sha256").update(`${input.ownerId}:${input.workspace}:${text}`).digest("hex").slice(0, 24);
  return save({
    id: `learned-${id}`,
    ownerId: input.ownerId,
    workspace: input.workspace,
    text,
    title: text.replace(/\s+/g, " ").slice(0, 86),
    source: String(input.source || "Conversation feedback").slice(0, 100),
    kind: input.kind || "feedback",
    demo: false,
  });
}

async function shutdown(): Promise<void> {
  await engine?.disconnect();
  engine = null;
}

async function dispatch(request: Request): Promise<unknown> {
  if (request.method === "init") return initialize();
  if (request.method === "search") return search(request.input as MemorySearch);
  if (request.method === "import") return importHistory(request.input as { ownerId: string; limit?: number });
  if (request.method === "remember") return remember(request.input as RememberInput);
  if (request.method === "close") {
    await shutdown();
    return { closed: true };
  }
  throw new Error("Unknown memory operation.");
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  let request: Request;
  try {
    request = JSON.parse(line) as Request;
  } catch {
    continue;
  }
  try {
    const result = await dispatch(request);
    process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "GBrain memory operation failed.";
    process.stdout.write(`${JSON.stringify({ id: request.id, error: detail.slice(0, 500) })}\n`);
  }
  if (request.method === "close") break;
}
await shutdown();
process.exit(0);
