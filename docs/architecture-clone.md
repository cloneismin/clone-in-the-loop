# Clone-in-the-Loop architecture

Clone-in-the-Loop extends QM with a cycle of prediction, execution, and review. A Clone uses the Goal, recent conversation, and relevant past instructions to propose what to do next. QM carries out that instruction, and the Clone reviews the result before choosing a correction or further improvement.

The product runs as a local web app for one owner, with a fictional teammate available for the demo. **Goals** shows saved conversations, **Inbox** suggests what to work on next, and **Memories** lets the user inspect retrieved evidence. These views retain the existing `Goal` type, `/goals` API, and database identities. The extension adds the interface and orchestration, with QM handling execution and official GBrain handling memory.

## Components

| Component         | Implementation                                | Responsibility                                                                                                  |
| ----------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Browser           | Lit + Vite in `plugins/clone-ui/src`          | Goals, workspace selection, prediction acceptance, visible execution/review messages, Stop.                     |
| Clone API         | Node.js in `plugins/clone-ui/server/index.ts` | Validates requests, scopes Goals, serves state and memory, starts or stops work.                                |
| Decision loop     | `server/loop.ts` and `server/prompts.ts`      | Predicts, executes, reviews, and selects the next instruction.                                                  |
| Goal store        | `server/store.ts` + PostgreSQL                | Persists Goals, messages, predictions, and loop generations.                                                    |
| Prediction client | `server/prediction.ts` + Clone SDK 0.3.1      | Builds bounded product context, calls the hosted API, validates response identity and expiry, cancels requests. |
| QM adapter        | `server/qm.ts` + QM's shared chassis client   | Signs internal requests, starts real core turns, polls runs, and requests cancellation.                         |
| Execution engine  | QM core + Codex harness                       | Runs model turns and bounded execution steps.                                                                   |
| Memory adapter    | `server/memory`                               | Imports approved local human history, applies source scope, returns evidence.                                   |
| Memory engine     | Official GBrain `PGLiteEngine`                | Owns schema, migrations, pages, chunks, indexes, and keyword retrieval.                                         |

## One loop iteration

```mermaid
sequenceDiagram
  actor Owner
  participant UI as Clone UI
  participant Loop as Clone loop
  participant Brain as GBrain
  participant SDK as Clone SDK / hosted API
  participant Core as QM core
  participant Store as PostgreSQL

  Owner->>UI: Describe a Goal
  UI->>Loop: Request prediction with draft revision
  Loop->>Brain: Recall within workspace and Clone scope
  Brain-->>Loop: Evidence, source labels, demo flags
  Loop->>SDK: Draft + scoped evidence + context revision
  SDK-->>Loop: Completion + prediction/request identity
  Loop->>Store: Persist prediction and provenance
  Loop-->>UI: Suggestion with original revision
  Owner->>UI: Tab to accept; Tab again to enable Clone mode
  UI->>Loop: Execute accepted instruction
  Loop->>Core: Bounded execution turn
  Core-->>Loop: Result + run identity
  Loop->>Store: Persist linked result and iteration count atomically
  Loop->>Brain: Recall evidence for review
  Loop->>Core: Read-only review turn
  Core-->>Loop: Review + next instruction
  Loop->>Store: Persist one Clone reply, next instruction, and criteria
  Loop-->>UI: Show coherent Clone reply
  Loop->>Core: Execute its saved instruction without duplicating the reply
  Owner->>UI: Stop
  UI->>Loop: Disable loop and invalidate generation
  Loop->>Core: Abort active run
  Loop->>Store: Persist paused state
```

Next-prompt predictions and draft completions use the official Clone SDK server client. QM continues to handle structured reviews, Inbox proposals and execution. The SDK does not execute agents or expose the structured review contract. Each execution turn receives a bounded instruction and returns a result before the next iteration begins.

The review records whether the current step is complete. Clone mode can then choose another useful improvement toward the same Goal, so completing a step does not end the loop. The operator can turn off the composer switch or press Stop; both use the same cancellation path. The composer glows blue while Clone mode is enabled and keeps a neutral border during a single manual execution.

## Durable state and interruption

QM uses PostgreSQL for its configured session and run stores. The extension uses a separate `clone_loop` schema in the same database:

- `goals`: title, project, workspace, selected Clone, criteria, phase, iteration count, active QM run, and generation.
- `messages`: ordered human, Clone, and assistant messages, plus preserved legacy review records. Each new review and next instruction are stored together as one Clone reply. `executionInstruction` stores the exact instruction to execute; `replyTo` links a real QM result to its directive and a Clone reply to the result it reviews. Model/run identity and evidence are retained when available.
- `predictions`: draft, revision, proposed instruction or abstention, selected Clone, evidence, provider, SDK request/prediction IDs, context revision, expiry and prediction units. The SDK does not return a QM model or run ID.
- `pending_runs`: namespaced SDK request IDs and legacy QM runs, routed to their respective cancellation APIs during recovery.
- `inbox`: proposed next Goals for a workspace.

The SDK uses a server-fixed local operator ID and no `connection_id`. Only the selected GBrain scope enters the request. The browser never receives the app key. Recent generated messages retain agent or accepted/edited prediction provenance. Missing credentials, quota limits, service failures and abstention preserve manual input and explicit QM send; an autonomous start with no instruction stops on abstention. No automatic retry or paid-plan activation occurs.

In-memory controllers coordinate active operations, while the database stores Goal and conversation state. Each execution write carries the Goal's generation number. Stop advances that number, preventing a late result from a canceled generation from being appended to the conversation.

After a restart, recovery reads the saved Goals, requests cancellation of any recorded active run, and marks unfinished loops as paused. History remains available, but the operator must explicitly choose to continue. Continuing an unanswered instruction reuses its saved message; it does not append the directive again. If the last saved message is a QM result, Clone mode resumes its review. For an existing Goal, an empty composer resumes the saved instruction without substituting an unaccepted prediction. A typed or Tab-accepted draft is explicit direction; a different instruction is preserved as a new turn. Failed or canceled attempts do not create synthetic QM responses.

Message insertion and its associated iteration or criteria update use one generation-guarded PostgreSQL statement. A failed insert cannot advance the iteration count, and a superseded generation cannot launch an execution without a saved directive. Legacy history is preserved; the interface may display an immediately adjacent legacy review and directive from the same Clone together without crossing a QM response.

Browser checks confirmed that Stop saved a paused state with no further continuation and that personal Goal history survived a service restart. The [verification record](verification.md) records those observations separately from automated lifecycle tests.

## Real GBrain integration

The adapter pins official GBrain at:

```text
Repository: https://github.com/garrytan/gbrain
Revision:   1ec6a6e842a15f2bde2ebe8c3a686a6fa6b17aa5
Version:    0.45.9.0
```

`clone:setup` fetches this revision into the Git-ignored `.clone-loop/deps/gbrain` directory and installs its dependencies using the frozen upstream lockfile. No separate developer checkout is required.

A Bun worker imports the official engine and source-management API, opens the persistent PGLite database, applies GBrain's schema and migrations, and creates three named sources. It stores imported messages and feedback as conversation pages using `putPage`, with chunks written through `upsertChunks`. Retrieval calls GBrain's `searchKeyword` with an explicit allowlist of source IDs, then loads the matching pages within that same scope.

The Node API communicates with the worker over JSON lines. A single worker holds the PGLite lock and processes operations in sequence, releasing the database when the service closes. Application logs exclude raw history and upstream database diagnostics.

### Scope rules

| GBrain source                | Written by                                                       | Readable in                         |
| ---------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| Min private history          | Owner's approved Codex/Claude import and personal feedback       | Min Kim / Personal                  |
| Shared team history          | Owner's explicit team-context messages; shared synthetic fixture | Min Kim / Team and Garry Tan / Team |
| Garry synthetic demo history | Versioned synthetic Garry fixtures                               | Min Kim / Team and Garry Tan / Team |

The source allowlist restricts retrieval before a query runs, and the result mapper checks each returned source again. Team results and counts exclude private history, including its import count. Requests for Garry's personal scope are rejected, and the application API treats fictional teammate memory as read-only.

For predictions, reviews, and Inbox suggestions, the adapter builds an OR query from a bounded set of non-CJK terms. CJK terms use separate literal queries supported by GBrain's engine. Results are combined using reciprocal rank and deduplicated within the permitted sources. Quoted text in a draft provides context rather than imposing an exact-phrase match. Direct searches in Memories retain GBrain's search semantics.

Clone Garry is a fictional demo persona inspired by Garry Tan, with invented conversation history. Evidence includes source labels, excerpts, and `demo` flags, and model prompts describe it as historical context rather than permission to act. The interface uses the name Clone Garry while retaining the fictional-origin labels on its evidence. Changing the selected context clears evidence from the previous selection.

### History import

History import is an explicit command that should run before the Clone API takes ownership of the PGLite database lock. The importer reads only the current OS user's standard Codex and Claude history directories:

```text
~/.codex/sessions
~/.codex/archived_sessions
~/.claude/projects
```

The importer accepts user-written messages and rejects assistant messages, tool results, sidechain-agent records, injected environment records, and recognizable credential patterns. It limits file counts, file sizes, and message length, removes duplicates, and balances recent messages across providers. Records are stored only in the owner's personal source, and the original history files remain unchanged.

### Retrieval mode

This build uses GBrain's local keyword retrieval, including CJK handling and OR fallback. For an empty query, it calls `listPages` within the permitted sources to retrieve recent context. It does not generate embeddings, call hosted GBrain, or perform semantic vector search, so the demo needs no additional hosted account for memory retrieval.

For implementation and tests, see the [memory adapter guide](../plugins/clone-ui/server/memory/README.md).

## Trusted-local runtime

The startup script creates or reuses a local PostgreSQL cluster, writes private runtime settings, and starts QM with the Codex harness. Setting `QM_TRUSTED_HOST_SANDBOX_DIR` explicitly enables the host-backed workspace adapter used by the demo. Each scope has its own working directory, but commands run with the local OS user's permissions.

The adapter does not provide OS sandbox isolation. The browser-facing app is bound to loopback and checks host and origin headers, but it has no production login, per-user authorization, or support for simultaneous teammates. Authentication on the internal QM client protects that API connection; it does not provide user-level access controls for the browser app.

Supporting more than one trusted local operator would require user authentication, workspace authorization, isolated execution, and controls for credentials and model spending.

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

## SDK migration validation

The checks below predate the SDK migration. See [Clone SDK integration](clone-sdk-integration.md) for the current local checks and hosted-service verification boundary. The existing Loom recording demonstrates the earlier QM prediction path, not a live SDK-backed prediction.

## Verification boundary

At the recorded revision, Clone CI passed 93 tests on both `main` and the implementation branch. A local checkpoint passed 153 focused tests covering the extension, QM runtime configuration, filesystem confinement, documentation contracts, and Codex harness. Core and extension TypeScript checks also passed, along with extension ESLint, scoped Clone Knip, and the production web build. GBrain tests run the official PGLite engine and check source isolation, filtering, and persistence after reopening. They also verify that changing the fictional teammate's display name preserves private and shared feedback.

Real QM runs produced a Research answer with primary-source links and a checklist, followed by a Product command-line tool whose three tests passed when run independently. Before the Garry persona update, browser checks showed six personal Clone mode iterations and seven fictional-teammate iterations. Stop saved a paused state, and personal work survived a service restart.

Independent review checked delayed workspace responses, draft preservation during navigation, keyboard activation, and project selection. Long multiline predictions were tested in an isolated browser fixture. A later recorded Marketing run used the second Tab to activate Clone mode, completed seven iterations, and was stopped by the operator.

Native Chrome checks also exercised all four navigation destinations. Their current order is New, Inbox, Goals, and Memories, using Cmd+Option+1/2/3/4 on macOS or Ctrl+Alt with the same digits on Windows and Linux. Updated automated tests cover this order. See the [verification record](verification.md) for later execution evidence and the separate status of video playback, Loom delivery, and submission.

## Upstream and extension boundaries

The repository preserves QM's source history, license, and [original README](../README.qm.md). The extension adds the Clone interface, decision loop, memory adapter, and local startup scripts, while GBrain is installed as a pinned upstream dependency. Private account history, generated work, runtime databases, and review media remain outside Git. Following upstream policy, the open [QM PR](https://github.com/yc-software/qm/pull/1671) contains a text proposal. The working implementation is on this fork's `main` branch.

## Hackathon demo provenance

Record the submission video from this QM-based extension during the hackathon, and identify the captured source with its Git revision and working-tree digest. Credit QM as the foundation. Earlier product recordings can guide camera choices, but every prompt, result, model label, memory source, and execution state shown in this demo must come from the new application. See the [production kit](../demo/README.md) for the recording workflow.
