# Narration and voice direction

The current narration was freshly generated in the user's existing ElevenLabs account with their registered personal voice. The exact selected voice label stays in the ignored receipt. Settings are Eleven Multilingual v2, speed 1, stability 0.5, similarity 0.75, style 0, and speaker boost enabled. Browser actions use `cua_repl`; no new purchase is part of this pipeline.

The complete [script](narration.txt) describes the observed launch-brief conversation. Its fresh source lasts 41.979 seconds. The selected voice, visible settings, generation time, original download, and SHA-256 are preserved in the ignored voice receipt.

## Complete phrases

The [115-second timeline](narration-timeline.json) partitions the decoded recording at 12 measured quiet pauses. Joining its 13 consecutive blocks reproduces every source PCM sample exactly. Only silence is inserted between phrases. No speech is faded, overlapped, accelerated, or deleted.

Phrase starts are 00:00, 00:06.751, 00:10.10, 00:17.60, 00:25.10, 00:28, 00:44.80, 00:59.90, 01:17, 01:28.50, 01:41.50, 01:44.50, and 01:48. The final sentence ends at approximately 01:51.30; the picture ends at 01:55.

The first QM sentence accompanies the real draft. The correction sentence accompanies Clone's single coherent feedback. The revision sentence accompanies the changed QM response. The Stop sentence ends across the actual click. Keep narration silent while the operator revisits the original draft; that view must not be mistaken for the revised result.

Source boundaries are specific to this download and cannot be reused for another generation. Automatic transcription helps locate phrases but does not establish listening acceptance. Earlier recordings and word-level alignments are superseded.

## Foreground voice and restrained music

Normalize the voice toward -16 LUFS. Normalize the authorized instrumental bed to -32 LUFS, reduce it by another 6 dB, and duck it under speech. The music-only repeat uses a four-second crossfade; speech is unaffected. The final mix targets -16 LUFS and a -1.5 dBTP ceiling.

Preserve the instrumental source and authorization receipt. Do not reuse old narration or interaction sounds. The audio report distinguishes source-sample continuity, measured loudness, full playback, and subjective listening.

Listen to the entire final master before publication. Check every sentence ending, QM and GBrain pronunciation, the connection between voice and picture, and clear speech over music. Neither a waveform check nor a successful media decode substitutes for this review.
