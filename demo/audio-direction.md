# Narration and voice direction

The film uses the user's registered personal ElevenLabs voice. Confirm the selected voice and account in the visible interface before generating. Preserve the exact voice label in the ignored receipt. A system voice is permitted only for a timing draft.

## Generate and preserve complete speech

Use [narration.txt](narration.txt) as the fresh English script. The user-approved settings are Eleven Multilingual v2, speed 1, stability 0.5, similarity 0.75, style 0, and speaker boost enabled. Use `cua_repl` for browser interaction. Existing account access is sufficient; no new purchase is part of this pipeline.

The revised script has ten complete passages. It explains the QM fork, GBrain-backed personal next-prompt prediction, Tab once and twice, execution and review, Stop, team perspective, separate memory scopes, the product logo, and the upstream PR as the final bonus. Fictional teammate provenance remains in the README and memory evidence rather than a spoken disclaimer.

Preserve the full fresh download and its hash under ignored `demo/output/audio/`. The [96-second timeline](narration-timeline.json) records measured paragraph boundaries for that exact recording. The original narration was partitioned at measured pauses, and rejoining those partitions reproduced its PCM hash. The final cut uses a freshly recorded correction passage and tagline; each replacement is kept complete. Do not apply these source offsets to a different recording.

Earlier word-level alignment clipped sentence endings. Final paragraph boundaries must fall inside verified pauses and preserve every source sample. Do not fade, accelerate, or delete speech to fit the picture. Add silence between paragraphs and adjust picture timing instead. Automatic transcription is a candidate alignment only and never substitutes for listening.

For a new recording, review its complete waveform and create a matching alignment before using the helper:

```sh
python3 demo/align_narration.py demo/output/audio/ACTUAL_SOURCE.mp3 \
  --alignment demo/output/audio/REVIEWED_ALIGNMENT.json \
  --voice-label 'ACTUAL_REGISTERED_VOICE_NAME' \
  --generated-at ACTUAL_ISO_TIME_WITH_TIMEZONE
```

## Pacing and music

Paragraph starts are 00:00.20, 00:04.30, 00:17.40, 00:26.30, 00:39.20, 00:57.10, and 01:10.10. The fresh tagline starts at 01:22.20. "Own Your Clone" starts at 01:27.30; the closing PR line starts at 01:30.20 and finishes at approximately 01:34.00. The picture ends at 01:36.00.

A three-second silent pause begins at 00:46.56, after the revised-result sentence and before the Stop sentence. Removing that pause reproduces the prior narration PCM exactly. The revised result stays visible before the recorded Stop action.

The instrumental bed stays continuous and restrained. Set `music.duckUnderNarration` to `true` so speech lowers the music automatically. The assembler normalizes voice before mixing and targets -16 LUFS with a -1.5 dBTP ceiling for the final mix. Preserve music provenance and hashes in ignored receipts.

Listen to the complete replacement film before publishing it. Verify natural causal flow, every sentence ending, QM and GBrain pronunciation, and clear words over music. Measured loudness and PCM continuity support this check but do not establish listening acceptance.
