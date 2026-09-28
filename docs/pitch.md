# Clone-in-the-Loop: presentation script

**Your agent does the work. Your Clone decides what comes next.**

Build the demo around one complete review-and-correction sequence. The durations below are speaking targets, not measured recordings. Clone Garry is a fictional teammate whose history was created for the demo.

## 30 seconds

Your agent does the work. You still have to decide what comes next.

Clone-in-the-Loop uses your past instructions and feedback to help make that decision. GBrain retrieves the context, your Clone suggests the next instruction, and QM carries it out. Your Clone then reviews the result and asks for a correction.

Press Tab to accept a suggestion, Tab again to let the loop continue, and Stop to take control back.

QM executes. GBrain remembers. Your Clone keeps your judgment in the loop.

## 60 seconds

What if your past feedback could guide your agent's next step?

Founders use agents across research, product, and marketing, but they still have to write the follow-up, catch the missing detail, and start the next round.

We built Clone-in-the-Loop for that person. GBrain retrieves your past instructions and feedback so your Clone can suggest what you would ask next. QM carries out the instruction, and your Clone reviews the result and asks for any changes.

Press Tab to accept a suggestion, Tab again to let the loop continue, and Stop to take control back.

In our launch-review workflow, the Clone caught a repeated call to action and asked QM to revise the post. We checked the saved result: 50 words, one call to action, and a publication checklist. Pressing Stop left the Goal paused.

Shared team feedback can guide the same loop. Clone Garry demonstrates that idea using fictional history, kept separate from personal records.

QM executes. GBrain remembers. Your Clone keeps your judgment in the loop.

## Demo cues

| Moment  | Show                                                        | Say                                                                  |
| ------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Context | A next-prompt suggestion and its memory evidence            | "This is the context behind the next instruction."                   |
| Control | Tab once, then a second distinct Tab                        | "First I accept. Then I let my Clone continue."                      |
| Review  | A missing item, a request to fix it, and the revised result | "The Clone spotted what was missing and asked QM to fix it."         |
| Proof   | Open the generated template and its approval checklist      | "Here is what the agent actually changed."                           |
| Stop    | Square Stop or the Clone switch; paused state               | "I can take control back."                                           |
| Team    | Company workspace, Clone Garry, shared evidence             | "A fictional teammate shows how shared judgment changes the review." |

Keep the product story at the center of the demo, then briefly show the upstream PR after the closing logo. Use current app footage and mark only actions that actually occurred. Label any accelerated footage, and leave enough time to read the review, requested correction, and revised result. These scripts are for live delivery; they do not require changes to the video's narration.

## Short Q&A

**Why does this fit the hackathon?**

It brings several of the event's themes into one working prototype. We extended QM, used the official GBrain engine to inform predictions and reviews, and added a simple interface for delegating the next step. Personal and shared team context support recurring Research, Product, and Marketing work, with saved conversations and progress visible in Goals.

**What is distinctive about Clone?**

We focus on the person directing the agents. Their past instructions and feedback help determine what to ask next and what to change in the result. The Clone connects those decisions: it suggests an instruction, reviews what QM produces, and requests the next correction. You can accept a suggestion with Tab or let the loop continue with a second Tab. The prototype personalizes this process through retrieved history; it does not train new model weights.

**What did you build?**

We built a QM extension with next-prompt prediction, a continuous instruction-and-review loop, personal and team memory scopes, and teammate selection in a compact web interface. QM handles the model turns and execution. The working implementation is available in this fork.

**How is GBrain used?**

The official GBrain PGLite engine stores imported user messages and shared feedback. Before each prediction or review, the app retrieves relevant excerpts using bounded keyword queries restricted to the permitted sources. Those excerpts provide context for the model and appear in the interface so you can inspect them. This build does not use hosted federation or semantic vector search.

**What proves the loop is real?**

Recorded QM runs produced reviews, corrections, and files. In the launch task, the Clone caught a repeated call to action, requested tighter wording and specific sources, and asked for a stronger review checklist. We opened the saved template to check the changes, then separately confirmed that Stop left the session paused with no active run. A Product task also generated a command-line tool whose three tests passed when run independently.

**How private is the memory?**

Imported history is stored locally, and team retrieval excludes personal sources. Relevant excerpts are sent to the configured model provider for prediction and review. The prototype is intended for one trusted local operator. A production team deployment would require additional authentication and access controls.

**Is Clone Garry the real Garry?**

No. Clone Garry is a fictional demo teammate with invented shared history. It shows how a teammate's review preferences could guide the loop and does not represent Garry Tan's participation or endorsement.

**Why keep looping after one task is complete?**

Completing one step can reveal another useful improvement toward the same Goal, so Clone mode continues until you turn it off or press Stop. In the launch example, the generated publication template still required verification and explicit approval before publication.

**What is the upstream status?**

The working code is on this public fork's `main` branch. Following QM's contribution policy, the upstream PR contains a short text proposal. It remains open and has not been accepted or merged upstream.

## Links for judges

- [Demo on Loom](https://www.loom.com/share/f989c778d4f14d05acfe0a20d9bdfbc3)
- [Working source and quickstart](https://github.com/cloneismin/clone-in-the-loop)
- [Verification record](verification.md)
- [Upstream QM PR](https://github.com/yc-software/qm/pull/1671)
- [Official event and schedule](https://events.ycombinator.com/gstack-qm-river-memorable-hackathon)
- [Judging strategy and evidence boundaries](judging-strategy.md)
