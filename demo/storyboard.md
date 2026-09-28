# Demonstration storyboard

This storyboard defines the intended cut. Capture manifests and production reports record the footage and checks actually completed.

Target: a 96-second, 2560 × 1440, 30 fps film of the new QM-based application at `http://127.0.0.1:4317`. All product footage plays at its recorded speed. Speech, visible demo content, captions, and submission text are English.

## Sentence-aligned sequence

| Output            | Picture and narration alignment                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00:00–00:04.30    | Actual personalized prediction and visible QM branding introduce the fork.                                                                                 |
| 00:04.30–00:10.30 | Personal GBrain history appears for the Codex/Claude clause, followed by Shared history for the explicitly shared team clause.                             |
| 00:10.30–00:17    | The gray suggestion, actual Tab acceptance, and actual Enter submission match the spoken actions.                                                          |
| 00:17–00:26.30    | The real Projects list shows Research, Product, and Marketing beside a reusable Marketing workflow.                                                        |
| 00:26.30–00:39    | Recorded double-Tab controls lead into a concrete Clone direction, an actual QM result, and the coherent Clone review.                                     |
| 00:39–00:51.30    | A continuous real scroll moves from the weak-CTA review and concrete request into the revised QM response. A quiet pause gives the result time to be read. |
| 00:51.30–00:57    | The actual square Stop click, Stopping state, and paused loop follow the revised result.                                                                   |
| 00:57–01:10.10    | Goals, Inbox, the team Clone selector, and Garry's shared-history pitch suggestion appear with their respective clauses.                                   |
| 01:10.10–01:15.20 | Personal and Shared scopes appear separately, followed by an inspectable English team source.                                                              |
| 01:15.20–01:19.20 | A QM response and a coherent Clone reply match the agent-execution and Clone-judgment lines.                                                               |
| 01:19.20–01:22.20 | A genuine accepted prompt and Enter submission close the product sequence.                                                                                 |
| 01:22.20–01:30.20 | The black Clone-in-the-Loop title accompanies the complete closing tagline and Own Your Clone.                                                             |
| 01:30.20–01:36    | The actual open [upstream QM PR](https://github.com/yc-software/qm/pull/1671) appears as a final add-on.                                                   |

The source map distinguishes live actions from inspection of earlier results in the same real session. The review, revised result, and real Stop appear in causal order. The film does not claim that the inspected historical results were newly completed during the capture. Short five-frame dissolves use real outgoing source handles and incoming frames without moving narration timing. No speech is accelerated, faded, or removed.

## Capture order and continuity

1. Capture the published upstream QM pull request first, using its exact live URL. Record this as an `upstream-pr` capture, never as local product footage. Then lock the source revision and working-tree digest. Complete one successful live end-to-end run before recording the hero sequence.
2. Capture the hero loop in the same real session: empty composer → Clone activation → instruction → execution → review → correction → result → Stop. Preserve each original recording and document any pickup in the source map.
3. Capture opening and ending, then Research/Product/Marketing, then Goals/Inbox, then Team/Garry/GBrain. Scene order in the film follows the table above.
4. Use `cua_repl` for every product and browser interaction. The user explicitly authorized the selected-Chrome-window-only ScreenCaptureKit fallback after native and browser recording entry points failed. Use the bounded recorder in this kit and confirm its source window through CUA before capture. Preserve at least two seconds before and after every interaction. Keep the entire app visible, use actual buttons for transitions, and move the pointer deliberately.
5. Record interaction timestamps in the manifest. Add key indicators only where a real captured key action occurred. Do not draw replacement prompts, results, model names, counters, or memory evidence over the app.
6. Film English-only sessions and examples. Use actual English history where available. If translating evidence for narration, identify it as a translation; do not present a translation as a verbatim source.

## Source truth

All product footage comes from this repository's QM extension built for the hackathon. Later pickup recordings retain their actual capture timestamps. The user-approved visual direction uses full-app framing, selective composer emphasis, restrained music, and a traceable instruction, execution, review, and correction sequence.

The manifest records source path, SHA-256, capture time, app origin, Git revision, working-tree digest, scene in/out points, playback speed, and evidence notes. `assemble.py` only accepts product captures under ignored `demo/output/` or `data/`; it rejects missing capture metadata, hash mismatches, and timestamps before the event start.

A cut may omit waiting. The final film uses only normal-speed source footage, including execution, review, and results. Do not claim parallel execution, autonomous completion, semantic retrieval, or real multiplayer participation without corresponding recorded evidence.

## Time gates

All times are September 27, 2026, America/Los_Angeles.

| By    | Deliverable                                                           |
| ----- | --------------------------------------------------------------------- |
| 14:35 | Capture method confirmed, narration chosen, capture manifest ready.   |
| 15:00 | Hero loop passes live acceptance; first continuous take captured.     |
| 15:25 | All remaining shots and English narration captured.                   |
| 15:40 | First complete film assembled, including sources and captions.        |
| 16:00 | Complete local playback reviewed; only essential fixes remain.        |
| 16:15 | Final MP4 uploaded to Loom.                                           |
| 16:30 | Loom playback verified; complete fields handed to the user to submit. |

If execution blocks, preserve the honest working footage and reduce decorative transitions first. Protect the actual review/correction loop and the QM/GBrain explanation. The 16:30 handoff target leaves a 30-minute deadline buffer. The user personally submits the Google Form.

## Realistic reusable workflows

Each departmental shot must show a useful repeatable process and its actual output. Prepare these as real English sessions through the product UI, then film completed state and representative interaction.

| Department | First-run session                                                                                                                                                                                                            | Evidence to show                                                                                                                                | Reuse trigger                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Research   | Create a weekly agent-memory review. For the first run, compare QM and GBrain using their official GitHub documentation. Cite primary links, separate implemented features from assumptions, and produce a review checklist. | A compact comparison with source links and a reusable checklist.                                                                                | New releases or new research arrive.             |
| Product    | Build a small CSV task-triage tool using owner, due date, and status. Include a runnable example and tests for blank dates. Run the tests, review any failure, and repair it.                                                | Actual artifact path, example output, and reported test result with the distinction between agent report and independent verification retained. | New task exports need triage.                    |
| Marketing  | Turn a product update into a concise launch brief and three channel-specific drafts. Use only facts in the supplied brief; review vague claims and revise the weakest draft.                                                 | The original draft, a specific Clone review, the correction instruction, and a visibly improved version.                                        | Every product update creates a new launch cycle. |

Use Marketing as the default hero loop because a concrete editorial correction stays readable in a short film. Research and Product demonstrate breadth without pretending they all finished simultaneously. Use the same artifact before and after review so the improvement is visibly attributable.

For the teammate moment, ask Garry's synthetic Clone to review the same shared launch brief. Show a different attributable emphasis, such as a concrete user outcome or a primary-source check. The README and memory evidence identify invented teammate history. The GBrain scene should expose the source behind that instruction and its team scope, then contrast the Personal source boundary without revealing private text.
