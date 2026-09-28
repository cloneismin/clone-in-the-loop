import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const archive = resolve(root, "vendor/clone-sdk/clone-ai-tab-completion-0.3.1.tgz");
const expected = readFileSync(`${archive}.sha256`, "utf8").trim().split(/\s+/)[0];
if (createHash("sha256").update(readFileSync(archive)).digest("hex") !== expected)
  throw new Error("Clone SDK archive checksum mismatch.");
for (const [command, args] of [
  [process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--prefix", "plugins/clone-ui"]],
  [process.execPath, ["plugins/clone-ui/server/memory/setup.ts"]],
]) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
process.stdout.write(
  "Ready. Optional owner history import: npm run clone:import\nStart QM: npm run clone:core\nStart the web app in a second terminal: npm run clone:dev\n",
);
