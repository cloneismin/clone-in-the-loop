import { spawn } from "node:child_process";
import { access, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { GBRAIN_DIRECTORY, GBRAIN_REVISION, GBRAIN_VERSION } from "./paths.ts";

async function run(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let error = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      error += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? accept(output.trim()) : reject(new Error(`${command} failed (${code}): ${error.slice(-1600)}`)),
    );
  });
}

export async function setupGBrain(bun = process.env.CLONE_BUN || "bun"): Promise<void> {
  await mkdir(GBRAIN_DIRECTORY, { recursive: true, mode: 0o700 });
  try {
    await access(resolve(GBRAIN_DIRECTORY, ".git"));
  } catch {
    await run("git", ["init", "-q"], GBRAIN_DIRECTORY);
    await run("git", ["remote", "add", "origin", "https://github.com/garrytan/gbrain.git"], GBRAIN_DIRECTORY);
  }
  let revision: string;
  try {
    revision = await run("git", ["rev-parse", "HEAD"], GBRAIN_DIRECTORY);
  } catch {
    revision = "";
  }
  if (revision !== GBRAIN_REVISION) {
    await run("git", ["fetch", "--depth", "1", "origin", GBRAIN_REVISION], GBRAIN_DIRECTORY);
    await run("git", ["checkout", "--detach", GBRAIN_REVISION], GBRAIN_DIRECTORY);
  }
  const manifest = JSON.parse(await readFile(resolve(GBRAIN_DIRECTORY, "package.json"), "utf8")) as { version: string };
  if (manifest.version !== GBRAIN_VERSION) throw new Error("The pinned GBrain checkout has an unexpected version.");
  await run(bun, ["install", "--frozen-lockfile", "--ignore-scripts"], GBRAIN_DIRECTORY);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await setupGBrain();
  process.stdout.write(`GBrain ${GBRAIN_VERSION} installed at the pinned revision.\n`);
}
