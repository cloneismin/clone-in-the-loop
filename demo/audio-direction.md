# Narration and voice direction

The current narration was freshly generated in the user's existing ElevenLabs account with their registered personal voice. The exact selected voice label stays in the ignored receipt. Settings are Eleven Multilingual v2, speed 1, stability 0.5, similarity 0.75, style 0, and speaker boost enabled. Browser actions use `cua_repl`; no new purchase is part of this pipeline.

The complete [script](narration.txt) restores the reference narrative and explains the two Tab actions. Its fresh source lasts 50.155 seconds. The selected voice, visible settings, generation time, original download, and SHA-256 are preserved in the ignored voice receipt.

## Complete phrases

The [120-second timeline](narration-timeline.json) places 23 complete phrase blocks against observed actions. Joining the consecutive source blocks reproduces every decoded PCM sample exactly. Only silence is inserted between phrases. No speech is faded, overlapped, accelerated, or deleted.

“Press Tab once to accept the suggestion” accompanies the gray suggestion becoming accepted input. “Press Tab twice to start the Clone mode” accompanies the actual second key press, blue border, and enabled toggle. The Clone and QM sentences follow their real alternating turns. The Stop sentence accompanies the square Stop action. Keep the upstream PR sentence last.

Source boundaries are specific to this download and cannot be reused for another generation. Automatic transcription helps locate phrases but does not establish listening acceptance. Earlier recordings and word-level alignments are superseded.

## Foreground voice and restrained music

Normalize the voice toward -16 LUFS. Normalize the authorized instrumental bed to -32 LUFS, reduce it by another 6 dB, and duck it under speech. The music-only repeat uses a four-second crossfade; speech is unaffected. The final mix targets -16 LUFS and a -1.5 dBTP ceiling.

Preserve the instrumental source and authorization receipt. Do not reuse old narration or interaction sounds. The audio report distinguishes source-sample continuity, measured loudness, full playback, and subjective listening.

Listen to the entire final master before publication. Check every sentence ending, QM and GBrain pronunciation, the connection between voice and picture, and clear speech over music. Neither a waveform check nor a successful media decode substitutes for this review.
