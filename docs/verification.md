# Verification record

This record separates automated checks from observed product behavior. All times are Pacific on September 27, 2026. Local Goal IDs and working directories identify ignored development evidence; they are not public artifacts or benchmark results.

## Automated checks

- The latest completed Clone CI workflow passed on [main](https://github.com/cloneismin/clone-in-the-loop/actions/runs/36353746893) and the [implementation branch](https://github.com/cloneismin/clone-in-the-loop/actions/runs/36353744725) at `3280584cbd2661c1dbb1d161159e349f9d976c30`.
- Those runs passed 82 tests: 62 targeted QM configuration and trusted-host filesystem tests, plus 20 extension tests covering official GBrain PGLite retrieval and persistence, personal/team source isolation, human-history filtering, Markdown structure, execution lifecycle failures, and keyboard shortcuts.
- The subsequent local checkpoint passed 146 tests: 24 extension tests, 62 QM configuration and trusted-host tests, five documentation contract tests, and 55 Codex harness tests. These include the renamed teammate's stable identity, migration of existing synthetic records without changing private history or shared feedback, the cancellation regression described below, and conversational recall of quoted and mixed-language context. This total is a local result, not a completed CI result for that checkpoint.
- Keyboard regressions cover one-Tab acceptance, second-Tab Clone mode activation, edited or cleared acceptance, held keys, and modified Tab.
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

## Conversational recall

A real GBrain regression reproduced missing teammate evidence when a draft contained quoted text. Official keyword search preserves quoted-phrase semantics and skips its OR fallback for operator queries; an exact learned-message hit can also prevent fallback. Automatic prediction, review, and Inbox recall now use bounded natural-language terms, with a non-CJK OR query and separate CJK literal queries. All requests keep their source allowlist. Real PGLite tests verify teammate evidence before and after storing an exact shared message, private-memory exclusion, deduplication, and mixed-language recall. Manual Memory search retains its original syntax.

## Cancellation recovery

At 14:46, two previously stopped Codex runs still occupied both QM worker slots, leaving new predictions pending. The provider had completed its turns, but the harness could wait indefinitely for a missing `turn/interrupt` acknowledgement while draining stop signals. A regression reproduced the hang before the fix. Interrupt requests now have a five-second acknowledgement deadline, and repeated requests for the active turn share one promise. The same deadline also bounds child-turn interrupt requests.

After a core restart at 14:49, both prior runs reached `done` with `stopped: true`, queued predictions completed, and the web bridge's pending-run count returned to zero. An isolated real GPT-6 Sol run then reached the same stopped terminal state 268 ms after Stop. A subsequent asynchronous turn returned exactly `Clone runtime is ready.` This timing records one observed check, not a performance guarantee. No Goals, private histories, or databases were reset.

## Focused interface checks

The interface follows QM's system typography, neutral palette, sidebar proportions, chat layout, and composer structure. A synthetic browser fixture checked a 2,895-character prediction: the composer expanded to its viewport cap, the complete suggestion remained reachable by scrolling, controls stayed below the text, and Tab accepted the full text. This was a layout fixture, not a live provider run.

An independent source-level integration check verified first-Tab focus and caret restoration, second distinct Tab starting Clone mode once, and repeat/modifier/Escape/edit resets. It also verified that Research sidebar → New goal submits to Research, and late personal Send or Clone mode responses preserve a newly selected team view and draft. These checks used delayed-response fixtures; the Marketing recording above subsequently exercised the real second-Tab path.

Recording QA also exposed an initial project-picker display mismatch and a previously saved draft reappearing through New goal. Explicit New goal actions now start with a blank composer in the current project, and selected option markup matches the stored project on first render. A focused component-state check verified that existing Goal drafts and ordinary home/workspace draft recovery are preserved. This final refinement still requires native readback after the source update.

## Upstream status

The [QM proposal](https://github.com/yc-software/qm/pull/1671) is open. It contains a short text proposal under QM's contribution policy. The executable implementation is in [this fork's main branch](https://github.com/cloneismin/clone-in-the-loop/tree/main). An open proposal does not establish upstream review, merge, or acceptance.

## Remaining acceptance

Native readback of the final New goal refinement, Clone Garry interaction in the recorded build, complete movie playback, the uploaded Loom playback link, and the submission receipt remain pending. No completed submission or verified final video is claimed.
