# Verification record

This record separates automated checks from observed product behavior. All times are Pacific on September 27, 2026. Local run IDs identify evidence in the ignored PostgreSQL database; they are not public artifacts or benchmark results.

## Automated checks

- 62 targeted QM configuration and trusted-host filesystem tests passed.
- 15 extension tests passed: real GBrain PGLite retrieval and persistence, personal/team scope separation, human-history filtering, Markdown structure, and execution lifecycle failures.
- Core and extension TypeScript checks passed.
- The production web build passed.
- Independent review reproduced workspace navigation races, cancellation races, a failed-start retry problem, and a filesystem root-alias issue. Fixes were exercised with focused regressions or delayed-response fixtures.

## Observed in the browser

- A real GBrain-backed personal prediction appeared after a partial draft. Tab inserted the predicted message without creating or sending a Goal.
- Starting Clone mode created a Goal and launched a real QM Codex execution. Goal `410cd6f2-5948-45b8-a014-3a9d07de3cec` completed six execution iterations between 14:12 and 14:15. The conversation included a concrete review, a correction, and a revised answer.
- Stop paused the loop at six iterations. A later read confirmed no additional messages, no active run, and `loopEnabled: false`.
- Restarting QM and the web service preserved the Goal, conversation, and paused state.
- Switching to Company exposed a clearly labeled synthetic Clone Jun. GBrain supplied four shared demo memories; Tab accepted a suggestion reflecting Jun's short, concrete launch-review preferences.

## Remaining acceptance

The final QM-aligned visual pass, long-prediction composer, recorded teammate loop, full movie playback, upstream PR, Loom URL, and submission receipt are still pending final verification.
