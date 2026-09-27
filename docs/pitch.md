# Clone-in-the-Loop: presentation script

**Your agent does the work. Your Clone decides what comes next.**

Use one complete review-and-correction sequence as the central demonstration. The scripts below are delivery targets, not timed voice recordings. Clone Garry is a fictional demo teammate with invented history.

## 30 seconds

Your agent does the work. You still supply every next decision.

Clone-in-the-Loop extends QM with a Clone grounded in your chat history. GBrain retrieves the relevant context. Your Clone predicts the next instruction and reviews the result.

Press Tab once to accept the suggested prompt. Press Tab again to hand over the loop. QM executes; your Clone requests corrections. Stop returns control to you.

Your judgment keeps working.

## 60 seconds

Agents can execute. Founders still write the follow-up, catch the missing detail, and start the next round.

We built Clone-in-the-Loop inside a QM source fork. Official GBrain retrieves relevant personal or shared chat history, with visible sources. Your Clone uses that context to propose your next instruction.

Press Tab once to accept it. Press Tab again and QM executes while your Clone reviews and directs the next step.

Watch this launch-review task. The Clone caught a repeated call to action, then requested tighter wording and specific sources. QM corrected the 50-word post and its review checklist. We inspected the template, stopped the loop, and checked that it stayed paused.

Switch to a team workspace to use shared judgment. Clone Garry is a fictional teammate with invented history; personal records stay outside team retrieval.

QM executes. GBrain remembers. Your Clone keeps your judgment in the loop.

## Demo cues

| Moment  | Show                                                    | Say                                                                  |
| ------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| Context | A next-prompt suggestion and its memory evidence        | "This is the context behind the next instruction."                   |
| Control | Tab once, then a second distinct Tab                    | "First I accept. Then I let my Clone continue."                      |
| Review  | A concrete missing item, correction, and changed result | "The next decision is the product."                                  |
| Proof   | Inspect the generated template and its approval gate    | "Here is what the agent actually changed."                           |
| Stop    | Square Stop or the Clone switch; paused state           | "I can take control back."                                           |
| Team    | Company workspace, Clone Garry, shared evidence         | "A fictional teammate shows how shared judgment changes the review." |

Keep the product story first and the upstream PR as a brief closing bonus after the product logo. Use current UI captures and genuine action cues. Label accelerated execution; keep the review, correction, and changed artifact legible. Do not replace the existing narration solely to match these live scripts.

## Short Q&A

**What did you build?**

A source extension of QM: next-prompt prediction, a continuous instruction/execution/review loop, personal and team memory scopes, teammate selection, and a compact web interface. QM supplies real model turns and execution; the implementation is in this fork.

**How is GBrain used?**

The official GBrain PGLite engine stores and retrieves imported human messages and shared records. Automatic recall uses bounded keyword queries with source allowlists. Retrieved excerpts enter prediction and review prompts and appear as inspectable evidence. Hosted federation and semantic vector retrieval are outside this build.

**What proves the loop is real?**

Recorded QM runs produced reviews, corrections, and actual files. In the launch task, the Clone caught a repeated call to action, requested tighter wording and specific sources, and strengthened the review checklist. We inspected that template and separately verified Stop left the session paused with no active run. A Product task also generated a command-line tool whose three tests passed independently.

**How private is the memory?**

Imported history is stored locally, and team retrieval excludes personal sources. Relevant excerpts are sent to the configured model provider for inference. This is a trusted local prototype with one operator, not a production multi-user isolation system.

**Is Clone Garry the real Garry?**

Clone Garry is a fictional demo teammate with invented shared history. It demonstrates how a teammate's review preferences can guide the loop.

**Why keep looping after one task is complete?**

The Clone proposes the next useful improvement within the current session. The operator can turn Clone off or press Stop. The generated publication template still requires verification and explicit approval; it does not claim those steps have happened.

**What is the upstream status?**

The working code is in the public QM fork. The open Upstream QM PR contains a short text proposal under the contribution policy. It has not been merged or accepted upstream.

## Links for judges

- [90-second demo on Loom](https://www.loom.com/share/57d5b73042f847e0a2ac072ff379d7b6)
- [Working source and quickstart](https://github.com/cloneismin/clone-in-the-loop)
- [Verification record](verification.md)
- [Upstream QM PR](https://github.com/yc-software/qm/pull/1671)
- [Official event and schedule](https://events.ycombinator.com/gstack-qm-river-memorable-hackathon)
- [Judging strategy and evidence boundaries](judging-strategy.md)
