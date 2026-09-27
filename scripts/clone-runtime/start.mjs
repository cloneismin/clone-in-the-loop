import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import pg from "pg";

const root = fileURLToPath(new URL("../../", import.meta.url));
const runtimeDir = resolve(process.env.CLONE_RUNTIME_DIR ?? join(root, "data/clone-runtime"));
const envFile = join(runtimeDir, "runtime.env");
mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
const saved = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const pgPort = process.env.CLONE_PG_PORT ?? saved.CLONE_PG_PORT ?? "55432";
const corePort = process.env.CLONE_CORE_PORT ?? saved.PORT ?? "8088";
for (const port of [pgPort, corePort]) {
  if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error("Invalid local port");
}
const pgDirectory = process.env.CLONE_PG_BIN;
const pgCommand = (command) => (pgDirectory ? join(pgDirectory, command) : command);
const pgData = join(runtimeDir, "postgres");
const pgPassword = saved.CLONE_PG_PASSWORD ?? randomBytes(24).toString("hex");
const signingSecret = process.env.CORE_SIGNING_SECRET ?? saved.CORE_SIGNING_SECRET ?? randomBytes(32).toString("hex");
const databaseUrl = process.env.DATABASE_URL ?? `postgresql://clone_loop:${pgPassword}@127.0.0.1:${pgPort}/clone_loop`;
const environment = {
  CLONE_PG_PORT: pgPort,
  CLONE_PG_PASSWORD: pgPassword,
  DATABASE_URL: databaseUrl,
  CORE_API_URL: `http://127.0.0.1:${corePort}`,
  CORE_ORG_ID: process.env.CORE_ORG_ID ?? "clone-loop",
  CORE_SIGNING_SECRET: signingSecret,
  CONNECTOR_SECRET_KEY: saved.CONNECTOR_SECRET_KEY ?? randomBytes(32).toString("hex"),
  PORT: corePort,
  ORG_ID: process.env.CORE_ORG_ID ?? "clone-loop",
  DATA_DIR: join(runtimeDir, "core"),
  HARNESS: "codex",
  CODEX_MODEL: process.env.CODEX_MODEL ?? saved.CODEX_MODEL ?? "gpt-6-sol",
  CODEX_BIN: process.env.CODEX_BIN ?? saved.CODEX_BIN ?? join(root, "node_modules/.bin/codex"),
  CODEX_AUTH_FILE: process.env.CODEX_AUTH_FILE ?? join(homedir(), ".codex/auth.json"),
  SESSION_STORE: "postgres",
  RUN_STORE: "postgres",
  SANDBOX_BACKEND: "local",
  QM_TRUSTED_HOST_SANDBOX_DIR: join(runtimeDir, "computers"),
  BACKGROUND_WORK_ENABLED: "true",
  SUGGESTED_ACTIVITIES_ENABLED: "false",
  WORKERS: "2",
  ORG_BRAND_SELF_LABEL: "Clone",
  ORG_BRAND_ORG_NAME: "Clone-in-the-Loop",
  ORG_BRAND_MARK: "C",
  SHUTDOWN_DRAIN_MS: "2000",
};
writeFileSync(
  envFile,
  Object.entries(environment)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", timeout: 30_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}

if (!process.env.DATABASE_URL) {
  if (!existsSync(join(pgData, "PG_VERSION"))) {
    const passwordFile = join(runtimeDir, "postgres-password");
    writeFileSync(passwordFile, pgPassword, { mode: 0o600 });
    run(pgCommand("initdb"), [
      "-D",
      pgData,
      "-U",
      "clone_loop",
      "--auth-local=trust",
      "--auth-host=scram-sha-256",
      `--pwfile=${passwordFile}`,
      "--encoding=UTF8",
    ]);
  }
  const status = spawnSync(pgCommand("pg_ctl"), ["status", "-D", pgData], { stdio: "ignore" });
  if (status.error) throw status.error;
  if (status.status !== 0) {
    run(pgCommand("pg_ctl"), [
      "start",
      "-D",
      pgData,
      "-l",
      join(runtimeDir, "postgres.log"),
      "-o",
      `-p ${pgPort} -h 127.0.0.1 -k ${JSON.stringify(runtimeDir)}`,
      "-w",
    ]);
  }
  const client = new pg.Client({ connectionString: databaseUrl.replace(/\/clone_loop$/, "/postgres") });
  await client.connect();
  try {
    if (!(await client.query("SELECT 1 FROM pg_database WHERE datname = 'clone_loop'")).rowCount)
      await client.query("CREATE DATABASE clone_loop");
  } finally {
    await client.end();
  }
}

console.log(`[clone-runtime] PostgreSQL ready; private runtime config: ${envFile}`);
console.log(
  `[clone-runtime] Trusted local host execution enabled. This runtime has no OS isolation and is for one trusted local user.`,
);
const core = spawn(process.execPath, ["src/index.ts"], {
  cwd: root,
  env: {
    ...process.env,
    ...environment,
    NODE_ENV: "development",
    PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ""}`,
  },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => core.kill(signal));
core.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
core.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
