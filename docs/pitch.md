# Presentation script

Use the live application for the demonstration. The teammate is synthetic and labeled; personal and team memory stay separate.

## 30 seconds

Agents can do the work. You still decide what comes next.

Clone-in-the-Loop extends QM with your judgment. GBrain recalls relevant conversations. Your Clone predicts your next instruction, reviews the result, and keeps improving it.

Press Tab once to accept. Press Tab twice to enable Clone mode. Stop whenever you want.

QM executes. GBrain remembers. Your Clone closes the loop.

## 60 seconds

The agent finishes. You still have to decide what to ask next.

Clone-in-the-Loop puts that next decision inside QM. GBrain retrieves relevant conversations from your history. Your Clone uses that context to predict your next instruction.

Press Tab once to accept the prediction. Press Tab twice to enable Clone mode.

Now QM executes. Your Clone reviews the result, finds what is missing, and sends the next instruction. It keeps going until you press Stop.

This is real execution: QM researched primary sources and built a command-line tool whose tests we ran independently.

In Company workspace, Clone Jun brings a teammate's shared context into the same workflow. Jun is a labeled demo persona; personal memory stays separate.

QM executes. GBrain remembers. Your Clone keeps your judgment in the loop.

## If asked what was built here

We extended a QM source fork with next-prompt prediction, Clone mode, scoped GBrain history retrieval, and a minimal team workflow. QM runs prediction, execution, and review turns. Official GBrain stores and retrieves the human-history evidence. The implementation is in the fork; the open upstream PR is a text proposal under QM's contribution policy.

## Demo cues

Pause after the first sentence. Show a prediction and press Tab once while explaining memory. Press Tab a second time to enable Clone mode. Show a visible review and next instruction, then a concrete execution result. Switch workspace once, keep the demo teammate label visible, and end on Stop.
