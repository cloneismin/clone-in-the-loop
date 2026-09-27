# Verification record

This record separates automated checks from observed product behavior. All times are Pacific on September 27, 2026. Local Goal IDs and working directories identify ignored development evidence; they are not public artifacts or benchmark results.

## Automated checks

- The latest completed Clone CI workflow passed on [main](https://github.com/cloneismin/clone-in-the-loop/actions/runs/36355772333) and the [implementation branch](https://github.com/cloneismin/clone-in-the-loop/actions/runs/36355772176) at `e584c89f954ae6b2df6e896ea57b3a423279e370`.
- Those runs passed 93 tests: 62 targeted QM configuration and trusted-host filesystem tests, plus 31 extension tests covering official GBrain PGLite retrieval and persistence, personal/team source isolation, human-history filtering, Markdown structure, execution lifecycle failures, and keyboard shortcuts.
- Separate local checks passed 153 tests: 31 extension tests, 62 QM configuration and trusted-host tests, five documentation contract tests, and 55 Codex harness tests. These include the renamed teammate's stable identity, migration of existing synthetic records without changing private history or shared feedback, the cancellation regression described below, and conversational recall of quoted and mixed-language context. This total includes local-only Codex harness and documentation checks; it is not the CI test count.
- Keyboard regressions cover one-Tab acceptance, second-Tab Clone mode activation, edited or cleared acceptance, held keys, and modified Tab. The extension suite includes three navigation tests for the four destinations, physical digit keys, modifier combinations, AltGraph, composition, repeat, and already-handled events.
- Core and extension TypeScript checks, extension-wide ESLint, scoped Clone Knip, formatting, and the production web build passed. The inherited lint workflow now installs the Clone package before whole-repository Knip. Local whole-repository Knip remains limited by uninstalled upstream desktop and web-ui dependencies; those packages are installed in CI.
- Independent review reproduced workspace navigation races, cancellation races, a failed-start retry problem, and a filesystem root-alias issue. Fixes were exercised with focused regressions or delayed-response fixtures.

## Observed in the browser

- A real GBrain-backed personal prediction appeared after a partial draft. Tab inserted the predicted message without creating or sending a Goal.
- Starting Clone mode created a Goal and launched real QM Codex execution. Personal Goal `410cd6f2-5948-45b8-a014-3a9d07de3cec` completed six execution iterations between 14:12 and 14:15. Its conversation included a concrete review, a correction, and a revised answer.
- Stop paused that loop at six iterations. A later read confirmed no additional messages, no active run, and `loopEnabled: false`.
- Restarting QM and the web service preserved the personal Goal, conversation, and paused state.
- Company workspace used a synthetic teammate before the Garry persona update. GBrain supplied four shared demo memories, and Tab accepted a suggestion reflecting the fixture’s concise launch-review preferences. An actual team Clone mode run completed seven iterations before Stop; the paused state persisted. This verifies the shared workflow, not the later Garry persona wording.
- A fresh Research task returned primary-source links and an actionable checklist through QM.
- A fresh Product task used QM tools to create `task_triage.py`, `test_task_triage.py`, and `example_tasks.csv` under `data/clone-runtime/computers/59429d5160a8bd076a4c414529b63eba/workspace`. An independent `python3 -m unittest -v test_task_triage.py` run passed all three tests; running the tool on the CSV also produced output. These generated files remain ignored local execution artifacts.
- During continuous capture ending at 14:57, a fresh Marketing Goal (`75fb728c-3353-4708-8318-dde6b3becb5f`) started Clone mode with the second Tab. It completed seven iterations, reviewed missing evidence, requested and received a 50-word draft, and refined a template and table. After Stop, database readback confirmed `paused`, `idle`, seven iterations, `loopEnabled: false`, and an empty active-run ID. Recording this interaction does not establish final movie playback or delivery.

- A fresh session with ID prefix `fe3016b9` started Clone mode with two Tab presses in the recorded build. Its real review asked to show the missing headline, post, and call to action. The fourth result displayed a concrete headline, a 50-word post, and one call to action, with approval still required and nothing published. Stop was clicked at 15:27:05; an API read at 15:27:15 confirmed `paused`, `idle`, four iterations, `loopEnabled: false`, and an empty active-run ID. The continuous capture ended at 15:27:23. Final movie playback and Loom delivery remain separate checks.
- A recorded minimal-interface run used a fresh session with ID prefix `51dcb911`. Two Tab presses started Clone mode at 15:36:12. QM completed three iterations, and the operator opened and inspected the generated template file. The single composer Stop was clicked at 15:38:30. State reads at 15:38:36 and again at 15:39:55 confirmed `paused`, `idle`, three iterations, `loopEnabled: false`, and an empty active-run ID, with no extra continuation. That product capture completed at 15:41:31 using the interface without the duplicate banner or progress strip. This verifies captured product behavior; final movie playback and upload are still separate.

## Conversational recall

A real GBrain regression reproduced missing teammate evidence when a draft contained quoted text. Official keyword search preserves quoted-phrase semantics and skips its OR fallback for operator queries; an exact learned-message hit can also prevent fallback. Automatic prediction, review, and Inbox recall now use bounded natural-language terms, with a non-CJK OR query and separate CJK literal queries. All requests keep their source allowlist. Real PGLite tests verify teammate evidence before and after storing an exact shared message, private-memory exclusion, deduplication, and mixed-language recall. Manual Memory search retains its original syntax. Native readback after the repair showed five cited memory records on the quoted Garry launch-review prediction and three records on the Company home composer.

## Cancellation recovery

At 14:46, two previously stopped Codex runs still occupied both QM worker slots, leaving new predictions pending. The provider had completed its turns, but the harness could wait indefinitely for a missing `turn/interrupt` acknowledgement while draining stop signals. A regression reproduced the hang before the fix. Interrupt requests now have a five-second acknowledgement deadline, and repeated requests for the active turn share one promise. The same deadline also bounds child-turn interrupt requests.

After a core restart at 14:49, both prior runs reached `done` with `stopped: true`, queued predictions completed, and the web bridge's pending-run count returned to zero. An isolated real GPT-6 Sol run then reached the same stopped terminal state 268 ms after Stop. A subsequent asynchronous turn returned exactly `Clone runtime is ready.` This timing records one observed check, not a performance guarantee. No Goals, private histories, or databases were reset.

Concurrent tabs can supersede a prediction for the same session. Known prediction-controller cancellation now returns a typed `409 PREDICTION_CANCELED` response, which the browser dismisses quietly. Timeouts, provider failures, and unrelated abort errors remain visible. A late result from a canceled prediction cannot be persisted or clear its replacement controller. Backend and client regressions cover these boundaries. After the API restart, two isolated real prediction requests returned the typed 409 for the superseded request and a 200 with a model-generated prediction for its replacement; no session or memory record was created by that check.

## Focused interface checks

The interface follows QM's system typography, neutral palette, sidebar proportions, chat layout, and composer structure. A synthetic browser fixture checked a 2,895-character prediction: the composer expanded to its viewport cap, the complete suggestion remained reachable by scrolling, controls stayed below the text, and Tab accepted the full text. This was a layout fixture, not a live provider run.

An independent source-level integration check verified first-Tab focus and caret restoration, second distinct Tab starting Clone mode once, and repeat/modifier/Escape/edit resets. It also verified that Research sidebar → New submits to Research, and late personal Send or Clone mode responses preserve a newly selected team view and draft. These checks used delayed-response fixtures; the Marketing recording above subsequently exercised the real second-Tab path.

Recording QA also exposed an initial project-picker display mismatch and a previously saved draft reappearing through New. Explicit New actions now start with a blank composer in the current project, and selected option markup matches the stored project on first render. A focused component-state check verified that existing Goal drafts and ordinary home/workspace draft recovery are preserved. Native Chrome readback confirmed the final New shortcut opens a blank focused composer. The earlier project-preservation behavior is covered by the component-state check.

Native Chrome checks verified Cmd+Option+1/2/3/4 opens New/Sessions/Inbox/Memory, with matching sidebar labels and shortcut help. The same handler maps Ctrl+Alt+1/2/3/4 on Windows and Linux; those platforms have automated mapping coverage but were not exercised natively. The visible UI uses Sessions; internal Goal IDs, APIs, and database tables are unchanged.

## Upstream status

The [QM proposal](https://github.com/yc-software/qm/pull/1671) is open. It contains a short text proposal under QM's contribution policy. The executable implementation is in [this fork's main branch](https://github.com/cloneismin/clone-in-the-loop/tree/main). An open proposal does not establish upstream review, merge, or acceptance.

## Remaining acceptance

Complete movie playback, the uploaded Loom playback link, and the user's submission receipt remain pending. No completed submission or verified final video is claimed.
