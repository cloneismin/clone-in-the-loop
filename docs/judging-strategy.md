# Presentation strategy

## The central message

**QM executes. GBrain remembers. Your Clone keeps your judgment in the loop.**

Clone focuses on the person directing the agents. Their past instructions and feedback help it decide what to ask next, what to correct, and how to continue. The clearest way to show this is to follow a review through to a changed result.

| Point to emphasize                             | Concrete support                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Build on the hackathon's foundations**       | QM runs the model turns and tools, while official GBrain retrieval provides context for prediction and review.                                                                                         |
| **Put personal judgment to work**              | A Clone suggests the instruction a person might give next, reviews the response against the Goal and past feedback, and asks QM for a correction.                                                      |
| **Make delegation simple**                     | **Tab → Tab → Stop** lets a user accept a suggestion, delegate the cycle, and take control back. Saved messages make each step available for review.                                                   |
| **Explore shared judgment and recurring work** | Separate personal and team memory scopes support a demo with a fictional teammate. The same loop works across Research, Product, and Marketing, with a reusable launch-review template as one example. |

The [README](../README.md#what-makes-clone-different) explains the contribution and implementation, the [loop diagram](assets/clone-decision-loop.svg) shows how the pieces connect, and the [30-second and 60-second scripts](pitch.md) provide speaking versions. Keep the upstream proposal brief and link to the working fork and demo for more detail.

## What the official pages establish

When checked on September 27, 2026, the [official event page](https://events.ycombinator.com/gstack-qm-river-memorable-hackathon) encouraged extensions to QM and GBrain, new agent workflows and interfaces, and multiplayer and software-factory ideas. It also welcomed ambitious, useful, or unexpected projects. The listed deadline was 5:00 PM Pacific, followed by judging from 5:00 to 5:45 PM.

The [official submission form](https://docs.google.com/forms/d/e/1FAIpQLSdiU5L7PhlkD7HQQouQKPSlm7WrobkdJuvSZLoi6O7jXRWKiQ/viewform) asks for a project description, GitHub and demo video URLs, and team contact details. It also includes side-quest selections and an optional note to the judges.

Neither page provided weighted scoring criteria or a rubric for individual prizes. The priorities below reflect our reading of the event's purpose, rather than official judging rules or a prediction about awards.

## The strongest case this build can make

| Presentation priority              | Evidence to show                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Build on QM                        | Show the source fork, a real QM run, its generated file, and the instructions for reproducing it.            |
| Show how memory affects a decision | Show a prediction or review alongside relevant GBrain evidence, then open one of its cited sources.          |
| Demonstrate the complete workflow  | Follow one session from the initial request through prediction, execution, review, correction, and Stop.     |
| Make team context concrete         | Show how Clone Garry retrieves shared history, making clear that the teammate and its history are fictional. |
| Connect the demo to recurring work | Show Research, Product, and Marketing sessions and the reusable launch-review template.                      |

Lead with a review that changes the result. Explain how memory guides the next instruction and review, then show QM carrying out the requested change. That sequence makes the contribution easier to understand than a list of integrations or an isolated chat response.

## Prepare the final presentation

1. Freeze the current product controls and profile assets before final capture.
2. Keep the memory source, review, revised artifact, and Stop visible. Show input cues only for actions that occurred, and label accelerated footage.
3. Use the 30-second script to introduce the idea or the 60-second script to include a concrete example. Save implementation details for Q&A.
4. Watch both the local video and the uploaded version before reporting either as verified. Preparing a submission link does not mean the form has been submitted.

Be precise about what the evidence establishes. Tests cover the separation of personal and team retrieval, but the app still assumes one trusted local operator. The generated publication checklist was inspected; publication itself has not been approved. The upstream PR contains a text proposal, while the working implementation is in the fork. Keeping these distinctions clear makes the project easier to evaluate.
