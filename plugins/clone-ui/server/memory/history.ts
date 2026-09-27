import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { createInterface } from "node:readline";
import type { MemoryRecord } from "./types.ts";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function sanitizeUserText(text: string, minimumLength = 12): string | null {
  const trimmed = text.trim();
  if (trimmed.length < minimumLength || trimmed.length > 16000) return null;
  if (
    /^(?:#{1,6}\s*AGENTS\.md\b|<(?:skills?|skills_instructions|codex_internal_context|environment_context|recommended_plugins|instructions|user_instructions|permissions|turn_aborted|local-command(?:-caveat|-stdout|-stderr)?|command-name|command-message|system-reminder|developer_instructions|available_tools|in-app-browser-context|browser_context|app-context|task-notification|agent_notification|collaboration_message|send_user_message(?:_question_reply)?|request_user_input(?:_async)?|tool_result|function_result|compacted_context)(?=[\s>])|Message Type:\s*(?:NEW_TASK|MESSAGE|FINAL_ANSWER)\b|This session is being continued from a previous conversation)/i.test(
      trimmed,
    )
  )
    return null;
  if (
    /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}|\bBearer\s+[A-Za-z0-9._-]{16,}|\b(?:api[_-]?key|password|passwd|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret)["']?\s*[=:]\s*["']?[^\s"']{8,}|\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@)/i.test(
      trimmed,
    )
  )
    return null;
  return (
    trimmed
      .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, "")
      .trim()
      .slice(0, 3000) || null
  );
}

function textContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part: unknown) => {
      const item = object(part);
      return ["text", "input_text"].includes(String(item.type)) && typeof item.text === "string" ? item.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function humanMessage(record: unknown, provider: "codex" | "claude"): string | null {
  const row = object(record);
  if (provider === "codex") {
    const payload = object(row.payload);
    if (row.type !== "response_item" || payload.type !== "message" || payload.role !== "user") return null;
    return sanitizeUserText(textContent(payload.content));
  }
  const message = object(row.message);
  if (row.type !== "user" || message.role !== "user" || row.isMeta || row.isSidechain || row.toolUseResult) return null;
  if (Array.isArray(message.content) && message.content.some((part: unknown) => object(part).type === "tool_result"))
    return null;
  return sanitizeUserText(textContent(message.content));
}

export function staleImportedHistoryPages(
  pages: { slug: string; source_id: string; frontmatter: Record<string, unknown> }[],
  records: MemoryRecord[],
): string[] {
  const eligible = new Set(records.map((record) => `conversations/${record.id}`));
  return pages
    .filter(
      (page) =>
        page.source_id === "clone-personal-min" &&
        page.frontmatter.kind === "human-history" &&
        ["Codex history", "Claude history"].includes(String(page.frontmatter.source)) &&
        !eligible.has(page.slug),
    )
    .map((page) => page.slug);
}

async function historyFiles(root: string, depth = 0): Promise<string[]> {
  if (depth > 5) return [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "subagents")
      files.push(...(await historyFiles(join(root, entry.name), depth + 1)));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(join(root, entry.name));
  }
  return files;
}

export async function collectLocalHistory(
  limit = 120,
  home = homedir(),
): Promise<{ records: MemoryRecord[]; skipped: number }> {
  const boundedLimit = Math.max(1, Math.min(300, Math.floor(limit)));
  const candidates: { path: string; provider: "codex" | "claude"; modified: number }[] = [];
  for (const [root, provider] of [
    [join(home, ".codex/sessions"), "codex"],
    [join(home, ".codex/archived_sessions"), "codex"],
    [join(home, ".claude/projects"), "claude"],
  ] as const) {
    for (const path of await historyFiles(root)) {
      const info = await stat(path).catch(() => null);
      if (info && info.size <= 40 * 1024 * 1024) candidates.push({ path, provider, modified: info.mtimeMs });
    }
  }
  candidates.sort((a, b) => b.modified - a.modified);
  const records: MemoryRecord[] = [];
  const perProvider = Math.ceil(boundedLimit / 2);
  const providerCounts = { codex: 0, claude: 0 };
  const selectedFiles = ["codex", "claude"].flatMap((provider) =>
    candidates.filter((file) => file.provider === provider).slice(0, 24),
  );
  const seen = new Set<string>();
  let skipped = 0;
  for (const file of selectedFiles) {
    if (providerCounts[file.provider] >= perProvider) continue;
    const fileRecords: MemoryRecord[] = [];
    const stream = createReadStream(file.path, { encoding: "utf8" });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        if (line.length > 200000) continue;
        let record: JsonObject;
        try {
          record = object(JSON.parse(line));
        } catch {
          skipped++;
          continue;
        }
        if (file.provider === "codex" && record.type === "session_meta") {
          const source = object(record.payload).source;
          if (source === "exec" || source === "subagent" || object(source).subagent !== undefined) {
            fileRecords.length = 0;
            skipped++;
            break;
          }
        }
        const text = humanMessage(record, file.provider);
        if (!text) continue;
        const hash = createHash("sha256").update(text).digest("hex").slice(0, 24);
        if (seen.has(hash)) continue;
        seen.add(hash);
        fileRecords.push({
          id: `history-${file.provider}-${hash}`,
          ownerId: "min",
          workspace: "personal",
          title: text.replace(/\s+/g, " ").slice(0, 86),
          text,
          source: file.provider === "codex" ? "Codex history" : "Claude history",
          sourceRef: `${file.provider}:${basename(file.path, ".jsonl")}`,
          kind: "human-history",
          demo: false,
          timestamp: typeof record.timestamp === "string" ? record.timestamp : undefined,
        });
      }
    } finally {
      lines.close();
      stream.destroy();
    }
    const recent = fileRecords.reverse().slice(0, Math.min(24, perProvider - providerCounts[file.provider]));
    records.push(...recent);
    providerCounts[file.provider] += recent.length;
  }
  return { records: records.slice(0, boundedLimit), skipped };
}
