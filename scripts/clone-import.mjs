import { fileURLToPath } from "node:url";
import { createMemoryService } from "../plugins/clone-ui/server/memory/index.ts";
const memory = createMemoryService({ dataDir: fileURLToPath(new URL("../.clone-loop/memory", import.meta.url)) });
try {
  await memory.init();
  const result = await memory.importLocalHistory({ ownerId: "min", limit: 120 });
  process.stdout.write(
    JSON.stringify({ imported: result.imported, codex: result.codex, claude: result.claude, skipped: result.skipped }) +
      "\n",
  );
} finally {
  await memory.close();
}
