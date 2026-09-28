# Clone-in-the-Loop: presentation script

**Your agent does the work. Your Clone decides what comes next.**

Follow the reference arc: an ambition and next-prompt suggestion, Research, Product, Marketing, the Clone loop, Goals, Inbox, team context, GBrain, and the closing ambition. Keep one clear review-and-correction sequence at the center. The durations below are speaking targets, not measured recordings.

## 30 seconds

Your agent does the work. You still decide what comes next.

Clone-in-the-Loop extends QM with your judgment. GBrain retrieves relevant Codex and Claude history and explicitly shared team feedback, so your Clone can suggest the next prompt.

Press Tab once to accept the suggestion. Press Tab twice to start the Clone mode.

QM executes. Your Clone reviews the result and sends one clear correction. They keep taking turns until you press Stop.

## 60 seconds

What if your past feedback could guide your agent's next step?

Clone-in-the-Loop is a QM fork for that workflow. GBrain retrieves relevant Codex and Claude sessions and explicitly shared team feedback to personalize the next prompt. Use it across Research, Product, and Marketing.

Press Tab once to accept the suggestion. Press Tab twice to start the Clone mode.

QM does the work. Your Clone reviews the result and asks for a specific correction. In the recorded launch example, QM reported an unverified draft. Clone asked it to use five known product behaviors and keep the post to exactly 50 words. QM revised the brief against the recorded facts. Stop paused the loop. The recording does not establish independent build verification or approval to publish.

Goals show the work. Inbox suggests what comes next. In the team workspace, choose Clone Garry for another perspective, with shared memory kept separate from personal history.

QM executes. Your Clone carries your judgment.

## Demo cues

| Moment       | Show                                                                    | Say                                                                     |
| ------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Ambition     | Empty composer, character typing, real next-prompt suggestion           | "Everyone should own their Personal AGI."                               |
| Accept       | First Tab turns the gray suggestion into accepted text; Enter sends     | "Press Tab once to accept the suggestion."                              |
| Workflows    | Research, Product, then Marketing, with actual outputs                  | "Developing research. Building products. Running marketing."            |
| Clone mode   | A distinct first Tab accepts; a second Tab enables the blue Clone state | "Press Tab twice to start the Clone mode."                              |
| Review       | QM's draft, one coherent Clone correction, then QM's revised response   | "The Clone asked for five known behaviors and an exactly 50-word post." |
| Result       | Read the revised QM response and its remaining verification boundary    | "QM revised the brief against the recorded facts."                      |
| Stop         | Actual square Stop click, followed by paused state                      | "The loop continues until I press Stop."                                |
| Next work    | Goals, then Inbox, through actual navigation                            | "Goals show the work. Inbox suggests what comes next."                  |
| Team         | Company workspace, Clone Garry, grounded suggestion                     | "Bring your team's perspective into the loop."                          |
| Memory       | Personal Codex/Claude scope, then explicitly shared history             | "Personal and team memory stay separate."                               |
| Closing      | Return to the Personal AGI composer, then black product title           | "Clone-in-the-Loop just killed Human-in-the-Loop. Own Your Clone."      |
| Contribution | Actual open upstream QM PR after the title                              | "We opened an upstream QM pull request, too."                           |

Keep the product story at the center of the demo, then briefly show the upstream PR after the closing logo. Use current app footage and mark only actions that actually occurred. Keep selected source footage at 1×, and leave enough time to read the review, requested correction, and revised result. These scripts are for live delivery; they do not require changes to the video's narration.

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

In the current recorded Marketing example, QM reported an unverified draft. Clone requested five known product behaviors and an exactly 50-word post. QM revised the brief against the recorded facts, and Stop left the loop paused. This records an execution-and-review cycle; it does not independently verify the product build or authorize publication.

Separately, an earlier verification run reached ten iterations with 21 alternating Clone and QM messages linked to preceding turns. Stop left that session paused with no active run or further continuation. An earlier Product task generated a command-line tool whose three tests passed independently. These are separate checks, not additional events claimed in the current film.

**How private is the memory?**

Imported history is stored locally, and team retrieval excludes personal sources. Relevant excerpts are sent to the configured model provider for prediction and review. The prototype is intended for one trusted local operator. A production team deployment would require additional authentication and access controls.

**Is Clone Garry the real Garry?**

No. Clone Garry is a fictional demo teammate with invented shared history. It shows how a teammate's review preferences could guide the loop.

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
