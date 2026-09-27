# Clone-in-the-Loop architecture

Clone-in-the-Loop adds a decision layer to QM. A Clone uses a Goal, its recent conversation, and retrieved human history to propose an instruction. QM executes it. The Clone reviews the result and selects the next correction or improvement.

The product is a local web application with one real owner and one synthetic teammate persona. The browser interface and orchestration are the extension; the execution and memory engines are QM and official GBrain.

## Components

| Component        | Implementation                                | Responsibility                                                                              |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Browser          | Lit + Vite in `plugins/clone-ui/src`          | Goals, workspace selection, prediction acceptance, visible execution/review messages, Stop. |
| Clone API        | Node.js in `plugins/clone-ui/server/index.ts` | Validates requests, scopes Goals, serves state and memory, starts or stops work.            |
| Decision loop    | `server/loop.ts` and `server/prompts.ts`      | Predicts, executes, reviews, and selects the next instruction.                              |
| Goal store       | `server/store.ts` + PostgreSQL                | Persists Goals, messages, predictions, and loop generations.                                |
| QM adapter       | `server/qm.ts` + QM's shared chassis client   | Signs internal requests, starts real core turns, polls runs, and requests cancellation.     |
| Execution engine | QM core + Codex harness                       | Runs model turns and bounded execution steps.                                               |
| Memory adapter   | `server/memory`                               | Imports approved local human history, applies source scope, returns evidence.               |
| Memory engine    | Official GBrain `PGLiteEngine`                | Owns schema, migrations, pages, chunks, indexes, and keyword retrieval.                     |

## One loop iteration

```mermaid
sequenceDiagram
  actor Owner
  participant UI as Clone UI
  participant Loop as Clone loop
  participant Brain as GBrain
  participant Core as QM core
  participant Store as PostgreSQL

  Owner->>UI: Describe a Goal
  UI->>Loop: Request prediction with draft revision
  Loop->>Brain: Recall within workspace and Clone scope
  Brain-->>Loop: Evidence, source labels, demo flags
  Loop->>Core: Read-only prediction turn
  Core-->>Loop: Proposed instruction + run identity
  Loop->>Store: Persist prediction and provenance
  Loop-->>UI: Suggestion with original revision
  Owner->>UI: Tab to accept, or enable Clone mode
  UI->>Loop: Execute accepted instruction
  Loop->>Core: Bounded execution turn
  Core-->>Loop: Result + run identity
  Loop->>Store: Persist result
  Loop->>Brain: Recall evidence for review
  Loop->>Core: Read-only review turn
  Core-->>Loop: Review + next instruction
  Loop->>Store: Persist review and criteria
  Loop-->>UI: Show review and continuation
  Owner->>UI: Stop
  UI->>Loop: Disable loop and invalidate generation
  Loop->>Core: Abort active run
  Loop->>Store: Persist paused state
```

Prediction and review are model turns routed through QM, not handwritten demo responses. Execution also routes through QM. It gets a bounded instruction and returns a concrete result before another iteration begins.

The review response records whether the current step is complete. In the selected hackathon interaction, completing a step does not automatically disable Clone mode: the Clone chooses the next useful improvement toward the same Goal. The operator ends the continuous loop with Stop.

## Durable state and interruption

QM uses PostgreSQL for its configured session and run stores. The extension uses a separate `clone_loop` schema in the same database:

- `goals`: title, project, workspace, selected Clone, criteria, phase, iteration count, active QM run, and generation.
- `messages`: ordered human, Clone, assistant, and review messages, including model/run identity and evidence when available.
- `predictions`: draft, revision, proposed instruction, selected Clone, evidence, and model/run identity.
- `inbox`: proposed next Goals for a workspace.

In-memory controllers coordinate currently running operations. They are not the durable source of Goal or conversation state. Writes from execution paths carry the Goal's generation. Stop advances that generation, so a late result from the canceled generation cannot append stale work.

Restart recovery reads persisted Goals, requests cancellation of any recorded active run, disables unfinished loops, and marks them paused. It preserves history and requires an explicit action to continue. It does not silently resume autonomous work after restart.

These behaviors must also pass browser acceptance. Source structure and unit checks alone do not establish that Stop worked in the visible product.

## Real GBrain integration

The adapter pins official GBrain at:

```text
Repository: https://github.com/garrytan/gbrain
Revision:   1ec6a6e842a15f2bde2ebe8c3a686a6fa6b17aa5
Version:    0.45.9.0
```

`clone:setup` fetches that revision into ignored `.clone-loop/deps/gbrain` and installs its frozen upstream lockfile. The project does not depend on a developer's separate source checkout.

A Bun worker imports the official engine and source-management API. It opens the durable PGLite database, runs GBrain's schema and migrations, and creates three named sources. Imports and feedback become GBrain conversation pages through `putPage`, with chunks through `upsertChunks`. Search calls GBrain's `searchKeyword` with an explicit allowlist of source IDs. Returned pages are hydrated within the same source scope.

The Node API communicates with the worker over JSON lines. One worker owns the PGLite lock and serializes operations. Closing the service releases the database. Raw history and upstream database diagnostics are not printed to application logs.

### Scope rules

| GBrain source         | Written by                                                       | Readable in               |
| --------------------- | ---------------------------------------------------------------- | ------------------------- |
| `clone-personal-min`  | Owner's approved Codex/Claude import and personal feedback       | Min / Personal            |
| `clone-team-shared`   | Owner's explicit team-context messages; shared synthetic fixture | Min / Team and Jun / Team |
| `clone-team-jun-demo` | Versioned synthetic Jun fixtures                                 | Min / Team and Jun / Team |

The scope allowlist is applied before retrieval. The result mapper checks every search hit's source again. Team results and counts exclude the private source, including its import count. Jun's personal scope is rejected, and synthetic teammate memory is read-only through the application API.

Source labels, excerpts, and `demo` flags accompany the evidence. Model prompts treat that evidence as historical data, not authorization to perform actions. The UI must retain synthetic-data labels and clear stale evidence when the selected context changes.

### History import

Import is an explicit command. Run it before starting the Clone API, which owns the PGLite database lock while active. It reads only the current OS user's standard Codex and Claude history directories:

```text
~/.codex/sessions
~/.codex/archived_sessions
~/.claude/projects
```

The importer accepts human user-message text and rejects assistant messages, tool results, sidechain agents, injected environment records, and recognizable credential patterns. It bounds the number and size of files, limits message length, deduplicates content, and balances recent messages across providers. It stores records only in the owner's personal source. Original history files are never edited.

### Retrieval mode

This build uses GBrain's local keyword retrieval, including its CJK handling and OR fallback. Empty queries use source-scoped `listPages` for recent context. It does not generate embeddings, call hosted GBrain, or claim semantic vector search. The architecture leaves those options open without making the demo depend on a second hosted account.

For implementation and tests, see the [memory adapter guide](../plugins/clone-ui/server/memory/README.md).

## Trusted-local runtime

The startup script provisions or reuses a local PostgreSQL cluster, writes private runtime settings, and starts QM with the Codex harness. An explicit `QM_TRUSTED_HOST_SANDBOX_DIR` enables the host-backed workspace adapter for this demonstration. Working directories remain scope-specific, but commands run with the local OS user's permissions.

This is not OS sandbox isolation. The public web surface is bound to loopback and checks host/origin headers, but the application has no production login, per-user authorization, or genuine simultaneous teammates. The authenticated internal client protects the core-client boundary; it does not turn the browser app into a production multi-user system.

Expanding this build beyond one trusted local operator requires a real identity boundary, workspace authorization, an isolated execution backend, and operational controls for credentials and model spending.

## Failure behavior

| Condition                              | Intended behavior                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| GBrain is not installed                | Startup fails with the setup command; no fabricated memory results.                         |
| No personal history has been imported  | Predictions can use the Goal and current conversation, with no invented personal evidence.  |
| QM or the provider rejects a turn      | The Goal exposes an error and disables the loop.                                            |
| QM requests approval                   | The loop stops with an actionable message; it does not silently approve.                    |
| The operator presses Stop              | Active work is canceled, the generation changes, and no queued continuation should execute. |
| The application restarts mid-loop      | Saved work remains; unfinished loops recover as paused.                                     |
| A teammate requests personal memory    | The request is rejected before retrieval.                                                   |
| A prediction belongs to an older draft | Its revision is available for the composer to reject it.                                    |

## Verification boundary

At this documentation checkpoint, 61 targeted QM runtime tests and four memory tests have passed. The memory integration test runs the official GBrain engine and verifies source isolation plus persistence after engine restart. The memory adapter also passes strict TypeScript and ESLint checks.

Frontend build, full browser acceptance, continuous-loop cancellation, workspace switching, and final video playback remain separate verification gates. Update those claims only after exercising the actual terminal path. See the [acceptance checklist](clone-in-the-loop-plan.md) and [presentation script](pitch.md).

## Upstream and extension boundaries

The repository preserves QM's source history, license, and [original README](../README.qm.md). The Clone interface, decision loop, memory adapter, and local startup scripts are authored as the extension. GBrain is installed as a pinned upstream dependency, not copied into the application as a substitute engine. Private account history, generated artifacts, runtime databases, and review media stay out of Git.

## Hackathon demo provenance

The submission film must show fresh captures of this checkout's QM-based extension, recorded during the hackathon. Preserve the legitimate upstream QM foundation and identify the new extension source through its Git revision and working-tree digest. Earlier product recordings inform the camera direction only; they are not evidence for this implementation. Every visible prompt, result, model label, memory source, and execution state must come from the actual new application. See the [production kit](../demo/README.md).
