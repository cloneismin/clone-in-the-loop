import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTrustedHostSandbox } from "../src/sandbox/host-sandbox.ts";
import { createLocalWorkspaceStore } from "../src/workspace/workspace-store.ts";
import { loadConfig } from "../src/config.ts";

test("trusted host files remain durable and reject traversal and escaping symlinks", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "qm-trusted-host-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const workspace = createLocalWorkspaceStore(directory);
  const sandbox = createTrustedHostSandbox(workspace, join(directory, "computers"));
  const handle = await sandbox.provision([]);
  await sandbox.writeFile(handle, "result/output.txt", "durable");
  await sandbox.teardown(handle);
  const reopened = await createTrustedHostSandbox(workspace, join(directory, "computers")).provision([]);
  assert.equal(await sandbox.readFile(reopened, "result/output.txt"), "durable");
  assert.equal(await sandbox.readFile(reopened, "missing.txt"), null);
  await assert.rejects(sandbox.writeFile(handle, "../../escape.txt", "bad"), /escapes/);
  await assert.rejects(sandbox.readFile(handle, "/etc/passwd"), /escapes/);
  await writeFile(join(directory, "private.txt"), "private");
  await symlink(directory, join(handle.rootDir, "escape"));
  await assert.rejects(sandbox.readFile(handle, "escape/private.txt"), /escapes/);
  await assert.rejects(sandbox.writeFile(handle, "escape/new.txt", "bad"), /escapes/);
  await assert.rejects(sandbox.removeDir(handle, "."), /workspace root/);
  assert.deepEqual(await sandbox.listDir(handle, "result"), ["result/output.txt"]);
});

test("trusted host execution respects timeouts, cancellation, and does not inherit process secrets", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "qm-trusted-host-exec-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sandbox = createTrustedHostSandbox(createLocalWorkspaceStore(directory), directory);
  const handle = await sandbox.provision([]);
  process.env.CLONE_RUNTIME_TEST_SECRET = "hidden";
  t.after(() => {
    delete process.env.CLONE_RUNTIME_TEST_SECRET;
  });
  const result = await sandbox.run(handle, "printf '%s' \"${CLONE_RUNTIME_TEST_SECRET-unset}\"");
  assert.equal(result.stdout, "unset");
  assert.equal(result.code, 0);
  const timeout = await sandbox.run(handle, "sleep 10", { timeoutMs: 30 });
  assert.equal(timeout.timedOut, true);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(sandbox.run(handle, "touch unexpected", { signal: controller.signal }), /aborted/);
});

test("trusted host rejects workspace and home aliases into another sandbox", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "qm-trusted-host-alias-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sandbox = createTrustedHostSandbox(createLocalWorkspaceStore(directory), join(directory, "computers"));
  const alice = await sandbox.provision([], { scratch: { key: "alice" } });
  const bob = await sandbox.provision([], { scratch: { key: "bob" } });
  await sandbox.writeFile(bob, "private.txt", "Bob's private work");
  await rename(alice.rootDir, `${alice.rootDir}-original`);
  await symlink(bob.rootDir, alice.rootDir);
  await assert.rejects(sandbox.readFile(alice, "private.txt"), /escapes/);
  await assert.rejects(sandbox.writeFile(alice, "private.txt", "changed"), /escapes/);
  await assert.rejects(sandbox.listDir(alice, "."), /escapes/);
  await assert.rejects(sandbox.run(alice, "cat private.txt"), /escapes/);
  await assert.rejects(sandbox.provision([], { scratch: { key: "alice" } }), /escapes/);
  await rm(alice.rootDir);
  await rename(alice.homeDir!, `${alice.homeDir}-original`);
  await symlink(bob.homeDir!, alice.homeDir!);
  await assert.rejects(sandbox.readFile(alice, "private.txt"), /escapes/);
  await assert.rejects(sandbox.provision([], { scratch: { key: "alice" } }), /escapes/);
  assert.equal(await sandbox.readFile(bob, "private.txt"), "Bob's private work");
});

test("trusted host sandbox is opt-in and refused for production or remote backends", () => {
  assert.equal(loadConfig({}).trustedHostSandboxDir, undefined);
  assert.ok(
    loadConfig({ QM_TRUSTED_HOST_SANDBOX_DIR: "data/computers" }).trustedHostSandboxDir?.endsWith("data/computers"),
  );
  assert.throws(
    () => loadConfig({ QM_TRUSTED_HOST_SANDBOX_DIR: "data/computers", NODE_ENV: "production" }),
    /trusted local development/,
  );
  assert.throws(
    () => loadConfig({ QM_TRUSTED_HOST_SANDBOX_DIR: "data/computers", SANDBOX_BACKEND: "aws" }),
    /trusted local development/,
  );
});
