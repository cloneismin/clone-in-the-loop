# Clone-in-the-Loop

## Agreed product

The organizer's clarified rules require using GBrain, no prebuilt project, and building during hackathon hours. The submitted product extensions are newly implemented during this hackathon on the permitted QM and GBrain foundations. Prior product source is not included in the new extension. Preserve real upstream ancestry, new commit timestamps, and truthful attribution.

A minimal web application extending QM with a personal decision loop. GBrain retrieves relevant human chat history; a person's Clone predicts their next instruction, reviews the agent's result, and chooses the next useful action. QM executes the work. The operator can interrupt at any time.

The hackathon submission retains the QM upstream history. All application source, setup scripts, tests, and the demo specification live in this repository. Private histories, credentials, runtime databases, and review recordings remain ignored local data.

## Interview decisions

- Web application, using QM as the execution and collaboration foundation.
- Main demonstration: the owner's Clone continues instructions and reviews until the user stops it.
- Clone mode continues into further improvements after a completed task. Stop cancels the active operation and prevents another iteration.
- GBrain memory starts with owner-approved local Codex and Claude user messages. Team memory uses fictional Garry Tan conversations for Clone Garry. The presentation and README disclose the fictional persona and invented history; memory evidence retains demo origin labels.
- Personal and team workspaces, Tab completion, Clone mode, and teammate Clone selection are required.
- Local working application plus reproducible GitHub source and a Loom video. Public production deployment is outside this submission.

## Delivery schedule

All times are September 27, 2026, America/Los_Angeles. Confirmed event deadline: 17:00.

| Time        | Gate                                                                        |
| ----------- | --------------------------------------------------------------------------- |
| 13:50–14:20 | Boot real QM execution, durable local storage, and GBrain retrieval         |
| 14:20–15:15 | Complete prediction, continuous review loop, workspaces, and teammate Clone |
| 15:15       | Stop adding features; fix only demo-blocking defects                        |
| 15:15–16:00 | Browser acceptance, independent review, and continuous product recording    |
| 16:00–16:30 | Edit and inspect video, upload to Loom, verify playback and form fields     |
| 16:30–17:00 | Submission and recovery buffer                                              |

## Implementation slices

1. Reuse QM's core, provider harness, session model, and web surface interfaces. Verify one real provider response before building the full experience.
2. Add scoped GBrain ingestion and retrieval with source receipts. Separate owner-private memory from team-shared memory and synthetic teammate evidence.
3. Add next-prompt prediction with draft revision protection, ghost text, Tab acceptance, Escape dismissal, and explicit manual Send.
4. Add a durable Clone loop: predict instruction, execute, review, correct or improve, repeat. Press Tab twice to enable Clone mode; Stop aborts and prevents queued continuations. Preserve the actor and Clone identity on each message.
5. Provide personal/team workspace switching, teammate Clone selection, Goals and Inbox views, and inspectable memory citations.
6. Run browser acceptance, package reproducible setup, record real interaction, and complete the submission fields.

## Acceptance evidence

- A real QM-backed execution produces an inspectable result.
- GBrain remembers multiple source conversations and retrieves cited evidence into a subsequent prediction.
- Distinct owner and demo-teammate evidence produces attributable predictions without exposing owner-private history to the teammate.
- Tab inserts the displayed prediction without silently sending; stale responses never replace a newer draft.
- Clone mode performs an observable instruction, execution, review, and correction/improvement sequence; Stop prevents subsequent execution.
- Workspace switching and application restart preserve persisted messages and Goal state.
- Team memory evidence is identified as demo data. The README and presentation explain Clone Garry is fictional and uses invented history. Model identity and memory provenance are truthful.
- The final video shows the actual application, plays through locally and on Loom, and the submission form contains the verified Loom URL.

## Demo direction

The film now in progress follows one fresh launch-brief conversation: accept the predicted request, start Clone mode, show QM's actual result, read one coherent Clone correction, inspect the real revision, then press Stop. Team Clone and shared memory follow, with the title and upstream QM PR as closing additions. Use full-app framing, readable source evidence, visible key cues, deliberate navigation, and selected source footage at 1×. Keep Clone and QM turns visibly distinct and preserve their actual order.

## Submission

- Team: Clone-in-the-Loop
- Prepared description: Clone-in-the-Loop just killed Human-in-the-Loop
- Repository: https://github.com/cloneismin/clone-in-the-loop
- Side quests: GBrain and QM
- Demo video: [Loom demo](https://www.loom.com/share/f989c778d4f14d05acfe0a20d9bdfbc3)
- Prepared organizer note:

> Built as a QM fork, Clone-in-the-Loop predicts what you would ask your agent next. GBrain retrieves relevant agent sessions from your Codex and Claude history, plus explicitly shared team history, to personalize that next-prompt prediction.
>
> Press Tab once to accept the suggested prompt. Press Tab twice to enable Clone mode: your Clone directs agents, reviews their results, and gives feedback until you press Stop.
>
> Personal and team memory stay separate. Clone Garry is a fictional demo teammate with invented history.
>
> Upstream QM PR: https://github.com/yc-software/qm/pull/1671

## Status

Interview and implementation are complete. The fork preserves QM upstream `a5a36675041a85e30b9ff3632f678ba36837aabf`. Real QM execution, GBrain-backed prediction, personal and synthetic-teammate Clone mode, durable Stop, and restart persistence have been exercised. CI and focused regression checks passed as recorded in [verification](verification.md). The upstream PR is an open text proposal; implementation lives in the fork. Native Chrome checks exercised the final New, Inbox, Goals, and Memories shortcut order; automated tests also cover the Windows and Linux mappings. The same Loom URL is retained. The previous 96-second replacement passed technical playback, but the user rejected its creative alignment. A new film is in progress using coherent Clone replies alternating with real QM results. A fresh ten-iteration run verified that sequence and its paused state after Stop. The new film has not yet been verified or published. Prior playback and draft-field readback remain historical evidence in the verification record. User acceptance remains pending; submission is controlled by the user and its current state is not asserted here.
