# Clone-in-the-Loop

## Agreed product

The organizer's clarified rules require using GBrain, no prebuilt project, and building during hackathon hours. The submitted product extensions are newly implemented during this hackathon on the permitted QM and GBrain foundations. Prior product source is not included in the new extension. Preserve real upstream ancestry, new commit timestamps, and truthful attribution.

A minimal web application extending QM with a personal decision loop. GBrain retrieves relevant human chat history; a person's Clone predicts their next instruction, reviews the agent's result, and chooses the next useful action. QM executes the work. The operator can interrupt at any time.

The hackathon submission retains the QM upstream history. All application source, setup scripts, tests, and the demo specification live in this repository. Private histories, credentials, runtime databases, and review recordings remain ignored local data.

## Interview decisions

- Web application, using QM as the execution and collaboration foundation.
- Main demonstration: the owner's Clone continues instructions and reviews until the user stops it.
- Clone mode continues into further improvements after a completed task. Stop cancels the active operation and prevents another iteration.
- GBrain memory starts with owner-approved local Codex and Claude user messages. Team memory uses explicitly labelled synthetic teammate conversations.
- Personal and team workspaces, Tab completion, continuous Clone mode, and teammate Clone selection are required.
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
4. Add a durable Clone loop: predict instruction, execute, review, correct or improve, repeat. Double Tab enables it; Stop aborts and prevents queued continuations. Preserve the actor and Clone identity on each message.
5. Provide personal/team workspace switching, teammate Clone selection, Goals and Inbox projections, and inspectable memory citations.
6. Run browser acceptance, package reproducible setup, record real interaction, and complete the submission fields.

## Acceptance evidence

- A real QM-backed execution produces an inspectable result.
- GBrain remembers multiple source conversations and retrieves cited evidence into a subsequent prediction.
- Distinct owner and demo-teammate evidence produces attributable predictions without exposing owner-private history to the teammate.
- Tab inserts the displayed prediction without silently sending; stale responses never replace a newer draft.
- Clone mode performs an observable instruction, execution, review, and correction/improvement sequence; Stop prevents subsequent execution.
- Workspace switching and application restart preserve persisted messages and Goal state.
- Synthetic team records are identified as demo data. Model identity and memory provenance are truthful.
- The final video shows the actual application, plays through locally and on Loom, and the submission form contains the verified Loom URL.

## Demo direction

Approximately 90 seconds, following the referenced Demo Video task: blinking cursor and ambition; Tab prediction; Research, Product, and Marketing workflow examples; a continuous Clone review/correction loop; Goals followed by Inbox; team workspace and teammate Clone; GBrain memory evidence; closing prediction and send. Use full-app framing by default, selective composer zoom, visible key cues, deliberate navigation, and a consistent speed indicator for accelerated execution.

## Submission

- Team: Clone-in-the-Loop
- Description currently saved in the form: Clone-in-the-Loop just killed Human-in-the-Loop
- Repository: https://github.com/cloneismin/clone-in-the-loop
- Side quests: GBrain and QM
- Loom URL: pending actual recording and upload
- Organizer note: write after verification; describe only implemented QM and GBrain integration.

## Status

Interview complete. QM upstream fetched at `a5a36675041a85e30b9ff3632f678ba36837aabf` into `codex/hackathon-qm`. Implementation and acceptance are in progress; no completed integration, final video, or submission is claimed yet.
