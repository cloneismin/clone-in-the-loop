# Clone SDK integration

The Lit composer uses the official `@clone-ai/tab-completion/server` client from Clone SDK **0.3.1** for next-prompt prediction and draft completion. It retains the existing composer and keyboard behavior. QM continues to execute instructions, produce structured reviews and propose Inbox items. The SDK does not execute agents, review work through a structured review API, or activate Clone mode.

## Distribution and configuration

The official release archive and checksum are vendored under `vendor/clone-sdk`. The plugin manifest uses a relative archive dependency and its lockfile pins the integrity. `clone:setup` verifies the SHA-256 before installation. No SDK source is copied or modified.

- Release: https://github.com/cloneisyou/clone-sdk/releases/tag/v0.3.1
- Archive SHA-256: `a6cb46d3b4bf7dd878f824e6ee1b5d5ecd23c1475ad1bceccf6841f9dee0feb4`
- Server key: `CLONE_APP_KEY`, supplied through the process environment or the Git-ignored root `.env.local`.
- Service base: `CLONE_API_URL`, default `https://api.clone.is` without `/v1`.
- Local Vite proxy: `CLONE_WEB_API_URL`, default `http://127.0.0.1:4318`. This is separate from the hosted service address.

The app remains a loopback prototype for one trusted local operator. Its server-owned user ID is fixed to that operator; it is not a production multi-user authentication implementation. `connection_id` is null. No optional Clone account connection, callback or profile sync is implemented. The app key stays on the server and is not part of the browser bundle or source tree.

## Request and response handling

GBrain retrieves only the selected workspace and Clone's permitted sources. The adapter sends bounded excerpts with source and synthetic-demo labels, the Goal, recent conversation and draft to Clone. The most recent human-origin message is preserved within the API's per-message limit; an oversized correction is rejected instead of silently trimmed. Generated Clone turns are marked as agent-origin text; accepted or edited suggestions keep their origin when sent and are not added to GBrain as independently written human preferences. Provenance is retained throughout an accepted draft's undo history; complete replacements are conservatively marked as edited predictions until that draft is submitted or reset. Legacy messages with unknown origins remain unknown.

The SDK returns a suffix, which is appended exactly once to the unchanged draft. Empty drafts use `next_prompt`; nonempty drafts use `complete_draft`. Request, session, context and draft identities, connection mode and expiry are validated before a response can become a suggestion. Prediction IDs, request IDs, context revisions, expiry, usage units and truncation metadata are retained with saved predictions. No QM model/run identity is invented for SDK results.

Supersession, Stop, input edits, navigation and browser disconnect cancel the request. The service cancellation endpoint is called as well as aborting the HTTP request. Pending SDK requests are namespaced in PostgreSQL and routed to Clone during restart recovery, independently of legacy QM runs. Unconfirmed cancellations remain durable for a later recovery attempt, including missing credentials and gateway failures. Cancellation does not establish that provider work or a settled charge was avoided.

Abstention produces no suggestion. A loop start without an explicit instruction stops on abstention instead of executing the draft or fabricated text. Missing keys, quota limits, rate limits and service failures preserve ordinary input and explicit QM send. There are no automatic billed retries or paid-plan changes. SDK observation-event telemetry is not implemented; no engagement or usefulness measurement is claimed.

## Local validation

The SDK HTTP boundary uses the installed release with deterministic responses in automated tests. Coverage includes suffix insertion, identity and expiry rejection, context/source changes, latest-correction preservation, no connected account, safe quota/service errors, cancellation, durable recovery routing, abstention and generated-message provenance. Existing execution, review, Stop and restart lifecycle tests remain in place.

Commands:

```sh
npm run clone:typecheck
npm run clone:test
npm run clone:build
node node_modules/eslint/bin/eslint.js plugins/clone-ui/src plugins/clone-ui/server plugins/clone-ui/test plugins/clone-ui/vite.config.ts scripts/clone-setup.mjs
```

The real GBrain tests use the pinned official PGLite engine. The PostgreSQL store test requires `CLONE_TEST_DATABASE_URL` and is skipped when that variable is absent. Browser verification uses the actual built composer and installed SDK client with fixture service responses and simulated QM/memory state. It does not demonstrate a live hosted prediction, native IME behavior, real QM execution after migration, or suggestion quality.

Hosted API calls and app-key issuance were explicitly excluded from this revision's verification at the user's request. The existing Loom video predates the SDK migration and is not SDK verification evidence.
