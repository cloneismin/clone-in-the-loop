# Narration and voice direction

The film uses the user's registered personal ElevenLabs voice. Confirm the selected voice and account in the visible interface before generating. Preserve the exact voice label in the ignored receipt. A system voice is permitted only for a timing draft.

## Generate and align

Use [narration.txt](narration.txt) as the fresh English script. The user-approved settings are Eleven Multilingual v2, speed 1, stability 0.5, similarity 0.75, style 0, and speaker boost enabled. Use `cua_repl` for browser interaction. Existing account access is sufficient; no new purchase is part of this pipeline.

Preserve the download as `demo/output/audio/minchan/source.mp3`. The [timeline](narration-timeline.json) places 21 short lines across 90 seconds. The alignment helper uses an existing local Whisper model or a supplied transcript and preserves the voice's pitch and pace.

```sh
python3 demo/align_narration.py demo/output/audio/minchan/source.mp3 \
  --model /ABSOLUTE/PATH/TO/EXISTING/faster-whisper-small-int8 \
  --voice-label 'ACTUAL_REGISTERED_VOICE_NAME' \
  --generated-at ACTUAL_ISO_TIME_WITH_TIMEZONE
```

The selected Python environment needs `faster-whisper` when using `--model`. The helper does not download a model. It writes the transcript, candidate cuts, a 90-second WAV, and a receipt under ignored output. Low-confidence or overlong lines stop assembly for correction. Inspect `alignment.json`, then use `--alignment` for reviewed timing corrections. Transcript matching does not verify speaker identity or replace listening.

## Replace a single line

The teammate line is “Garry's Clone uses synthetic demo history.” A freshly generated replacement from the same registered voice can occupy the exact scene slot:

```sh
python3 demo/replace_narration_line.py \
  demo/output/audio/minchan/narration-90s.wav \
  demo/output/audio/minchan/garry-source.mp3 \
  --line garry --voice-label 'ACTUAL_REGISTERED_VOICE_NAME' \
  --generated-at ACTUAL_ISO_TIME_WITH_TIMEZONE
```

Set the manifest's narration path to the replacement helper's output. Preserve both source hashes, generation time, and selected-voice evidence. The helper retains natural speech duration and rejects a line that exceeds its slot.

## Pacing and music

The PR line starts at 00:00.25, ambition at 00:03.60, Clone activation at 00:32.60, review at 00:44.20, correction at 00:50.40, and Stop at 00:56.35. Goals and Inbox follow at 01:01.70 and 01:06.40. “Own Your Clone” begins at 01:27.60 over the black title card.

The user-approved instrumental direction is continuous and restrained. The prepared 90-second bed is normalized to −28 LUFS and fades over the final three seconds. Its ignored receipt records source provenance and hashes. Set manifest music gain to 1 for this already attenuated bed; use a lower gain for an unprocessed source.

Listen to the complete film after assembly. Confirm the registered voice, natural phrasing, QM and GBrain pronunciation, clear words over music, and complete sentence boundaries. The assembler targets −16 LUFS and −1.5 dBTP; measured levels complement listening review.
