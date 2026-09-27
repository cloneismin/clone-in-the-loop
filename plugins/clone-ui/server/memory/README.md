# GBrain memory adapter

This adapter runs the official [GBrain](https://github.com/garrytan/gbrain) `PGLiteEngine` at revision `1ec6a6e842a15f2bde2ebe8c3a686a6fa6b17aa5` (version `0.45.9.0`). GBrain owns its schema, migrations, page and chunk storage, indexing, search ranking, and source filters. The application does not replace it with an in-memory search implementation.

## Setup

Requires Node.js 24, Git, and Bun 1.3.10 or later. From the repository root:

```sh
node plugins/clone-ui/server/memory/setup.ts
```

Set `CLONE_BUN` to the Bun executable if it is not on `PATH`. Setup downloads the exact official Git revision into `.clone-loop/deps/gbrain` and installs its frozen upstream lockfile with lifecycle scripts disabled. No external source checkout is required.

```ts
import { createMemoryService } from "./plugins/clone-ui/server/memory/index.ts";

const memory = createMemoryService({ dataDir: ".clone-loop/memory" });
await memory.init();
await memory.importLocalHistory({ ownerId: "min", limit: 120 });
const evidence = await memory.search({
  workspace: "personal",
  cloneId: "min",
  query: "launch review",
  limit: 6,
});
await memory.close();
```

## Data boundaries

| Context            | GBrain sources                                    | Contents                                                        |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------------- |
| Min, personal      | Min private history                               | Authorized local human messages and private feedback            |
| Min or Garry, team | Shared team history, Garry synthetic demo history | Explicitly shared feedback and labeled synthetic demo records   |
| Garry, personal    | Denied                                            | Min's personal history cannot be selected by the teammate clone |

The application uses one local owner, Min, and a synthetic Garry Tan teammate displayed as Clone Garry. Its preferences are invented demo data, with no actual Garry Tan conversations, affiliation, or endorsement. Startup updates the three synthetic fixture pages in place without changing private history or shared feedback. This is a local demonstration of source isolation, not a production authentication or multiplayer permission system. Network callers must be authenticated before expanding deployment beyond the local machine.

Local import reads the current OS user's `.codex/sessions`, `.codex/archived_sessions`, and `.claude/projects`. It accepts only user-message text, excludes tools, assistant responses, injected environment messages, sidechain agents, and recognizable credentials, deduplicates by content, caps file size and message length, and imports a bounded recent set from both providers. It never imports another user's home directory. Raw histories and the database stay under ignored `.clone-loop/`; the public repository contains only synthetic demo records.

Next-prompt prediction should treat returned excerpts as untrusted historical evidence, never as system instructions. `demo: true` must remain visible for synthetic teammate evidence. Personal results must not be reused after switching to a team context.

## Retrieval and durability

The default retrieval mode is GBrain's local keyword search with its source-aware ranking, OR fallback, and CJK handling. It requires no embedding API key and sends no history to an embedding provider. Semantic embedding search and hosted GBrain federation are future integration options, not claims made by this adapter. An empty query returns recent pages through GBrain's source-scoped `listPages` API. Feedback is stored as a conversation page and indexed chunk, survives restart, and participates in subsequent predictions.

A single Bun worker owns the PGLite database lock. The Node web server communicates over JSON lines, serializing operations. A graceful `close()` releases the database. The adapter does not print history contents or upstream database diagnostics into application logs.

## Verification

```sh
node --test plugins/clone-ui/test/memory*.test.ts
```

The integration test boots real GBrain, writes private and shared feedback, verifies that Clone Garry cannot recall Min's private text, verifies synthetic evidence labels, closes the engine, and confirms the private memory remains searchable after reopening it. The fixture tests cover human-message filtering, credential rejection, bounded import, provider balance, and deduplication.
