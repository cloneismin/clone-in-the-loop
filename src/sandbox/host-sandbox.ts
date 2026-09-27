import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { WorkspaceStore } from "../workspace/workspace-store.ts";
import type { Sandbox, SandboxHandle } from "./sandbox.ts";

function contained(root: string, target: string): boolean {
  const path = relative(root, target);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export function createTrustedHostSandbox(workspace: WorkspaceStore, directory: string, path?: string): Sandbox {
  const base = resolve(directory);

  async function safePath(handle: SandboxHandle, path: string): Promise<string> {
    if (!/^[a-f0-9]{32}$/.test(handle.id)) throw new Error("Invalid trusted host sandbox handle");
    const home = join(base, handle.id);
    const root = resolve(handle.rootDir);
    const target = resolve(root, path);
    if (root !== join(home, "workspace") || !contained(root, target)) {
      throw new Error("Path escapes trusted host workspace");
    }
    const canonicalBase = await realpath(base);
    const canonicalHome = await realpath(home);
    const canonicalRoot = await realpath(root);
    if (
      (await lstat(home)).isSymbolicLink() ||
      (await lstat(root)).isSymbolicLink() ||
      canonicalHome !== join(canonicalBase, handle.id) ||
      canonicalRoot !== join(canonicalBase, handle.id, "workspace")
    ) {
      throw new Error("Symlink escapes trusted host workspace");
    }
    let existing = target;
    while (true) {
      try {
        const canonical = await realpath(existing);
        if (!contained(canonicalRoot, canonical)) throw new Error("Symlink escapes trusted host workspace");
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        if (existing === home) throw error;
        existing = dirname(existing);
      }
    }
    return target;
  }

  const sandbox: Sandbox = {
    profile: {
      backend: "trusted-host",
      writablePersistence: "resident_disk",
      processSessions: false,
      egressEnforcement: "none",
      spec: { os: process.platform, tools: ["bash", "node", "git"] },
    },
    async provision(layers, options) {
      const scope = options?.scratch?.key ?? layers.find((layer) => layer.mode === "rw")?.scopeId ?? "default";
      const id = createHash("sha256").update(scope).digest("hex").slice(0, 32);
      const homeDir = join(base, id);
      const rootDir = join(homeDir, "workspace");
      await mkdir(rootDir, { recursive: true, mode: 0o700 });
      const handle: SandboxHandle = { id, rootDir, homeDir, env: options?.env, scopeId: scope };
      await safePath(handle, ".");
      for (const layer of layers) {
        if (layer.mode === "rw") continue;
        for (const source of await workspace.list(layer.scopeId)) {
          const path = join(layer.mountPath ?? "", relative(workspace.scopeDir(layer.scopeId), source));
          await sandbox.writeFileBytes(handle, path, await readFile(source));
        }
      }
      return handle;
    },
    async run(handle, command, options) {
      options?.signal?.throwIfAborted();
      const cwd = await safePath(handle, ".");
      return new Promise((resolveResult, reject) => {
        const child = spawn("/bin/bash", ["-c", command], {
          cwd,
          detached: true,
          env: {
            PATH: path ?? "/usr/local/bin:/usr/bin:/bin",
            LANG: "en_US.UTF-8",
            TMPDIR: handle.homeDir,
            HOME: handle.homeDir,
            ...handle.env,
          },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const stop = () => {
          if (child.pid) {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ESRCH") reject(error);
            }
          }
        };
        const timer = setTimeout(() => {
          timedOut = true;
          stop();
        }, options?.timeoutMs ?? 120_000);
        const cleanup = () => {
          clearTimeout(timer);
          options?.signal?.removeEventListener("abort", stop);
        };
        options?.signal?.addEventListener("abort", stop, { once: true });
        if (options?.signal?.aborted) stop();
        child.stdout.on("data", (data: Buffer) => {
          stdout = (stdout + data.toString()).slice(-1_000_000);
        });
        child.stderr.on("data", (data: Buffer) => {
          stderr = (stderr + data.toString()).slice(-1_000_000);
        });
        child.on("error", (error) => {
          cleanup();
          reject(error);
        });
        child.on("close", (code) => {
          cleanup();
          resolveResult({ stdout, stderr, code: code ?? 1, timedOut });
        });
      });
    },
    async readFileBytes(handle, path) {
      const target = await safePath(handle, path);
      try {
        return await readFile(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async readFile(handle, path) {
      const bytes = await sandbox.readFileBytes(handle, path);
      return bytes === null ? null : Buffer.from(bytes).toString("utf8");
    },
    async writeFileBytes(handle, path, data) {
      const target = await safePath(handle, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    },
    async writeFile(handle, path, data) {
      await sandbox.writeFileBytes(handle, path, Buffer.from(data));
    },
    async listDir(handle, path) {
      const target = await safePath(handle, path);
      try {
        const entries = await readdir(target, { recursive: true, withFileTypes: true });
        return entries
          .filter((entry) => entry.isFile())
          .map((entry) => relative(handle.rootDir, join(entry.parentPath, entry.name)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
    },
    async removeDir(handle, path) {
      const target = await safePath(handle, path);
      if (target === resolve(handle.rootDir)) throw new Error("Cannot remove trusted host workspace root");
      await rm(target, { recursive: true, force: true });
    },
    async teardown() {},
  };
  return sandbox;
}
