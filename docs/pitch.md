# Presentation script

Draft for the live demonstration. Keep the final wording aligned with verified behavior.

## 30 seconds

Agents can do the work. You still have to decide what comes next.

We built Clone-in-the-Loop on QM. Your Clone uses your past conversations in GBrain to predict your next instruction, review the agent's work, and keep improving it until you press Stop.

Switch to a team workspace, and you can bring a teammate's shared judgment into the loop.

QM executes. GBrain remembers. Your Clone decides what comes next.

## 60 seconds

Every agent demo ends the same way: the agent finishes, and the human has to figure out what to ask next.

That human bottleneck is what we're working on.

Clone-in-the-Loop extends QM with a model of your next decision. GBrain retrieves relevant examples from your past conversations. Your Clone uses them to predict the next instruction in your voice. Press Tab to accept it, or turn on Clone mode.

Watch this: QM does the work. My Clone reviews the result, finds what is missing, and sends the next instruction. It keeps going until I press Stop.

In a team workspace, I can select a teammate's Clone and use their shared context. Today's teammate is clearly labelled demo data; my personal history stays separate.

We kept QM as the execution foundation and made GBrain part of the actual prediction path.

The idea is simple: own your memory, preserve your judgment, and let your agents keep working.

## If asked what was built here

We extended a QM source fork with the Clone interface, next-prompt prediction, a continuous review loop, scoped GBrain history retrieval, and a minimal team demonstration. We retain the upstream history and licenses. The repository documents setup, tested behavior, and remaining limitations.

## Demo cues

Pause after the first sentence. Show a prediction and press Tab while explaining memory. Start Clone mode before saying “Watch this.” Point at the visible review and next instruction. Switch workspace once, show the demo teammate label, then end on Stop.
