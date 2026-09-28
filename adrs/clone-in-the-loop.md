# Clone-in-the-Loop

I'd like to extend QM with a Clone that uses GBrain to draw on my chat histories and the histories my team chooses to share. It predicts the next instruction or review I would give an agent. I can press Tab once to accept the suggestion, or press Tab twice to enable Clone mode and keep the instruction, execution, and review cycle going until I press Stop.

The part I want to carry forward is the person's judgment: what they would ask next and what they would change in the result. I also want a team workspace where I can use a teammate's Clone, grounded in shared context, for recurring research, product, and marketing work. QM supplies execution and persistence; GBrain retrieves relevant history for prediction and review.

I'm exploring this in [a hackathon prototype](https://github.com/cloneismin/clone-in-the-loop), with a [93-second demo](https://www.loom.com/share/f989c778d4f14d05acfe0a20d9bdfbc3) and [local setup instructions](https://github.com/cloneismin/clone-in-the-loop#quickstart). The runnable implementation lives in the fork's `main` branch; this PR is just the proposal. It's a local web app for one trusted operator, and the teammate history is synthetic and labeled. I'd love to know where this would fit best in QM.
