# Demonstration storyboard

This storyboard defines the intended cut. Capture manifests and production reports record the footage and checks actually completed.

Target: a 93-second, 1920 × 1080, 30 fps film of the new QM-based application at `http://127.0.0.1:4317`. Use the built app at `4318` only if the capture manifest records that origin. All speech, visible demo content, overlays, captions, and submission text must be English.

## Locked sequence

The latest approved order starts with the product and closes with the actual upstream PR as a closing add-on.

| Output      | Seconds | Action and evidence                                                                                                   | Framing                                                          | Narration                                                                                                      |
| ----------- | ------: | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 00:00–00:17 |      17 | Show the actual QM extension, a sourced next-prompt suggestion, Tab acceptance, and Enter to send.                    | Full app with restrained composer emphasis.                      | QM fork; GBrain personal and explicitly shared history; the suggested prompt; Tab once and Enter.              |
| 00:17–00:26 |       9 | Navigate through real Research, Product, and Marketing work.                                                          | Full app; visible navigation.                                    | Repeatable workflows across the three departments.                                                             |
| 00:26–00:39 |      13 | Enable Clone mode with the recorded double-Tab interaction; show a Clone instruction followed by actual QM execution. | Full app; truthful key cue and labeled 20x execution where used. | Clone directs, QM executes, Clone reviews.                                                                     |
| 00:39–00:54 |      15 | Show the specific review, correction request, changed QM result, and Stop from the same real session.                 | Keep review and corrected result readable at normal speed.       | A weak call to action leads to a concrete-example request and a revised result; the loop continues until Stop. |
| 00:54–01:07 |      13 | Show the actual Goals status board, Inbox, and Company workspace with Clone Garry.                                    | Full app; visible clicks and clear actor identity.               | Goals show progress, Inbox suggests next work, and a teammate provides another perspective.                    |
| 01:07–01:19 |      12 | Open memory evidence and show personal/team scope without exposing private records.                                   | Full app and one inspectable source.                             | Personal and team memory remain separate; the user can inspect sources.                                        |
| 01:19–01:27 |       8 | Black product title card.                                                                                             | Centered Clone-in-the-Loop typography.                           | Clone-in-the-Loop just killed Human-in-the-Loop. Own Your Clone.                                               |
| 01:27–01:33 |       6 | Show the actual open [Upstream QM PR](https://github.com/yc-software/qm/pull/1671) as a closing add-on.               | Real browser page; title, repository, and Open state readable.   | We opened a QM pull request to bring this workflow upstream.                                                   |

The revised assembly targets exactly 93 seconds. If a genuine operation is shorter than a planned accelerated span, shorten that span and give the remaining time to a readable result or pause. Never stretch an idle state to imply a longer execution. The assembly script reports the true final duration; 85–95 seconds is acceptable if it protects clarity.

## Capture order and continuity

1. Capture the published upstream QM pull request first, using its exact live URL. Record this as an `upstream-pr` capture, never as local product footage. Then lock the source revision and working-tree digest. Complete one successful live end-to-end run before recording the hero sequence.
2. Capture the hero loop in the same real session: empty composer → Clone activation → instruction → execution → review → correction → result → Stop. Preserve each original recording and document any pickup in the source map.
3. Capture opening and ending, then Research/Product/Marketing, then Goals/Inbox, then Team/Garry/GBrain. Scene order in the film follows the table above.
4. Use `cua_repl` for every product and browser interaction. The user explicitly authorized the selected-Chrome-window-only ScreenCaptureKit fallback after native and browser recording entry points failed. Use the bounded recorder in this kit and confirm its source window through CUA before capture. Preserve at least two seconds before and after every interaction. Keep the entire app visible, use actual buttons for transitions, and move the pointer deliberately.
5. Record interaction timestamps in the manifest. Add key indicators only where a real captured key action occurred. Do not draw replacement prompts, results, model names, counters, or memory evidence over the app.
6. Film English-only sessions and examples. Use actual English history where available. If translating evidence for narration, identify it as a translation; do not present a translation as a verbatim source.

## Source truth

All product footage comes from this repository's QM extension during the hackathon. The user-approved visual direction uses full-app framing, selective composer emphasis, restrained music, and a traceable instruction, execution, review, and correction sequence.

The manifest records source path, SHA-256, capture time, app origin, Git revision, working-tree digest, scene in/out points, playback speed, and evidence notes. `assemble.py` only accepts product captures under ignored `demo/output/` or `data/`; it rejects missing capture metadata, hash mismatches, and timestamps before the event start.

A cut may omit waiting, and a 20× segment may accelerate waiting and execution. Every 20× segment receives the same visible speed label. Reviews and results return to normal speed. Do not claim parallel execution, autonomous completion, semantic retrieval, or real multiplayer participation without corresponding recorded evidence.

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
