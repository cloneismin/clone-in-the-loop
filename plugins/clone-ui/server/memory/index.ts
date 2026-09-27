import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { GBRAIN_DIRECTORY } from "./paths.ts";
import type { ImportResult, MemoryResult, MemorySearchResponse, MemoryService, MemoryStatus } from "./types.ts";

interface Pending {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}

export function createMemoryService(options: { dataDir: string; bunPath?: string }): MemoryService {
  const dataDir = resolve(options.dataDir);
  const pending = new Map<string, Pending>();
  let worker: ChildProcessWithoutNullStreams | undefined;
  let nextId = 0;
  let ready: Promise<MemoryStatus> | undefined;
  let closing = false;

  function rejectPending(message: string): void {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(message));
    }
    pending.clear();
  }

  async function start(): Promise<void> {
    await access(resolve(GBRAIN_DIRECTORY, "node_modules/@electric-sql/pglite/package.json")).catch(() => {
      throw new Error("GBrain is not installed. Run npm run clone:setup first.");
    });
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const child = spawn(
      options.bunPath || process.env.CLONE_BUN || "bun",
      [fileURLToPath(new URL("./worker.ts", import.meta.url)), dataDir],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, GBRAIN_HOME: resolve(dataDir, "config"), GBRAIN_TELEMETRY: "off" },
      },
    );
    worker = child;
    child.stderr.on("data", () => undefined);
    child.on("error", (error) => rejectPending(`GBrain worker could not start: ${error.message}`));
    child.on("exit", (code) => {
      if (worker !== child) return;
      worker = undefined;
      ready = undefined;
      rejectPending(`GBrain worker stopped${closing ? "" : ` unexpectedly (${code ?? "signal"})`}.`);
    });
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => {
      let response: { id?: string; result?: unknown; error?: string };
      try {
        response = JSON.parse(line) as typeof response;
      } catch {
        return;
      }
      if (!response.id) return;
      const request = pending.get(response.id);
      if (!request) return;
      pending.delete(response.id);
      clearTimeout(request.timer);
      if (response.error) request.reject(new Error(response.error));
      else request.resolve(response.result);
    });
  }

  function call<T>(method: string, input?: unknown): Promise<T> {
    return new Promise<T>((accept, reject) => {
      if (!worker || worker.killed) {
        reject(new Error("GBrain worker is not running."));
        return;
      }
      const id = String(++nextId);
      const timer = setTimeout(
        () => {
          pending.delete(id);
          reject(new Error(`GBrain ${method} timed out.`));
        },
        method === "init" || method === "import" ? 180000 : 30000,
      );
      pending.set(id, { resolve: (value) => accept(value as T), reject, timer });
      worker.stdin.write(`${JSON.stringify({ id, method, input })}\n`, (error) => {
        if (!error) return;
        clearTimeout(timer);
        pending.delete(id);
        reject(new Error("Could not send a request to the GBrain worker."));
      });
    });
  }

  async function init(): Promise<MemoryStatus> {
    if (closing) throw new Error("GBrain memory service is closed.");
    if (!ready)
      ready = start()
        .then(() => call<MemoryStatus>("init"))
        .catch((error) => {
          ready = undefined;
          worker?.kill("SIGTERM");
          throw error;
        });
    return ready;
  }

  return {
    init,
    async importLocalHistory(input) {
      await init();
      const imported = await call<ImportResult>("import", input);
      ready = Promise.resolve(imported.status);
      return imported;
    },
    async search(input) {
      await init();
      return call<MemorySearchResponse>("search", input);
    },
    async remember(input) {
      await init();
      return call<MemoryResult>("remember", input);
    },
    async close() {
      closing = true;
      if (ready) await ready.catch(() => undefined);
      if (!worker) return;
      const child = worker;
      try {
        await call("close");
      } finally {
        child.stdin.end();
      }
    },
  };
}
