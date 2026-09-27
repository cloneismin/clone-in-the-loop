# Demo production kit

This directory prepares a 90-second film of Clone-in-the-Loop, the QM extension with GBrain-backed next-prompt prediction. Read the [storyboard](storyboard.md), [narration](narration.txt), and [tool requirements](tooling.md) first.

All capture, editing, narration, captions, and submission content must be English. Product footage must come from this repository's implementation during the hackathon. Keep every recording, audio file, rendered cut, and source receipt under ignored `demo/output/` or `data/`.

## 1. Record the selected Chrome window

The filming user explicitly authorized Chrome-window-only ScreenCaptureKit recording with [capture.swift](capture.swift). Use `cua_repl` for all browser navigation and product interaction. Confirm the intended source in CUA, then select only that Chrome window for capture.

```sh
mkdir -p demo/output/bin demo/output/raw
swiftc -parse-as-library demo/capture.swift -o demo/output/bin/capture
demo/output/bin/capture --list
demo/output/bin/capture --window ACTUAL_CHROME_WINDOW_ID \
  --output demo/output/raw/fresh-take.mp4 --seconds 600
```

The recorder captures the selected window at 30 fps, including its cursor, without microphone or system audio. It refuses non-Chrome windows and existing output files. When ScreenCaptureKit reports unchanged content, it retains the last observed pixels so static holds preserve their actual duration. Blank or suspended capture aborts the take. Keep the source window stable and avoid switching macOS Spaces during recording.

In another shell, `touch demo/output/raw/fresh-take.mp4.stop` stops and finalizes that recording. Preserve the MP4, `.capture.json` metadata, and `.audit.json` writer diagnostics. A successful writer exit is necessary but insufficient: decode the complete file and inspect frames before using it.

Capture [the actual open QM proposal](https://github.com/yc-software/qm/pull/1671) first. Its title, number, and Open state occupy the first three seconds. Then capture the new application at `4317` or `4318`, keeping the main instruction, execution, review, correction, and Stop sequence in one source take.

[recorder.html](recorder.html) is an alternative visible-button `getDisplayMedia` recorder. Serve it with `python3 -m http.server 4321 --bind 127.0.0.1 --directory demo`, then open it through CUA and use Chrome's real share picker. It requests 30 fps WebM with audio disabled by default. The filming browser returned `InvalidStateError` despite valid activation, so it was not used for the submitted footage. Details are in [tooling.md](tooling.md).

## 2. Record provenance

Set `FFMPEG` or put FFmpeg on `PATH`. After each capture, create a receipt using its actual capture start time:

```sh
python3 demo/receipt.py demo/output/raw/hero.mp4 \
  --captured-at ACTUAL_ISO_TIME_WITH_TIMEZONE \
  --app-url http://127.0.0.1:4317
```

For the opening contribution shot, record the exact published URL:

```sh
python3 demo/receipt.py demo/output/raw/upstream-pr.mp4 \
  --captured-at ACTUAL_ISO_TIME_WITH_TIMEZONE \
  --kind upstream-pr \
  --app-url https://github.com/yc-software/qm/pull/ACTUAL_NUMBER
```

Only a numeric PR URL under `yc-software/qm` is accepted for `upstream-pr`; arbitrary external pages are rejected. The assembler requires this capture as the first segment, exactly three seconds at normal speed.

The receipt stores the video hash, Git revision, working-tree digest, app origin, dimensions, and duration. Git state is collected when the receipt is created; it is not a capture-time attestation. Create the receipt before changing source files, and preserve the recorder's actual start time and sidecar. Copy its capture entry into a new manifest under `demo/output/`. Keep the raw file unchanged.

```sh
cp demo/manifest.example.json demo/output/manifest.json
```

Replace every pending value and every `start: null` with actual capture evidence. Add separate capture entries for separate takes. Set each segment's `start` to its source timestamp. `duration` is the output duration; at speed `20`, the script uses `duration × 20` seconds of source footage. Only real-time and 20× playback are accepted.

## 3. Record fresh narration

The final narration uses the user's registered personal voice in their existing ElevenLabs account. Paste [narration.txt](narration.txt) into the speech-generation UI through `cua_repl`, with the settings in [audio direction](audio-direction.md). Preserve the exact selected voice label in the ignored audio receipt.

Preserve the fresh download under `demo/output/audio/minchan/source.mp3`. The [alignment helper](align_narration.py) uses an already cached local Whisper model to create candidate source cuts and place 21 lines across [the 90-second timeline](narration-timeline.json):

```sh
python3 demo/align_narration.py demo/output/audio/minchan/source.mp3 \
  --model /ABSOLUTE/PATH/TO/EXISTING/faster-whisper-small-int8 \
  --voice-label 'ACTUAL_REGISTERED_VOICE_NAME' \
  --generated-at ACTUAL_ISO_TIME_WITH_TIMEZONE
```

The selected Python environment must contain `faster-whisper`. No model download is performed. The helper rejects uncertain or overlong lines instead of automatically speeding the voice. Review its transcript, source cuts, and full output with audio. Apply the fresh Garry line as described in [audio direction](audio-direction.md), then set the manifest's `narration` to `{"path":"output/audio/minchan/narration-90s-garry.wav"}`.

A local Samantha timing draft is available under `demo/output/audio/aligned/`: 90.00 seconds, 21 lines, final speech at 88.49 seconds. It is **not permitted for final submission**. Optional music requires an original or licensed file and a manifest `music.path`.

## 4. Assemble and verify

```sh
python3 demo/assemble.py demo/output/manifest.json --check
python3 demo/assemble.py demo/output/manifest.json --output demo/output/final
python3 -m http.server 4320 --bind 127.0.0.1 --directory demo/output/final
```

Open `http://127.0.0.1:4320` and watch the entire film. The renderer preserves source pixels apart from trimming, playback speed, crop/scale, and the visible speed indicator. It adds a black closing title card. It never reconstructs application UI or inserts fake results.

Output is H.264, yuv420p, AAC, 30 fps, with fast-start playback. The renderer normalizes audio toward −16 LUFS and −1.5 dBTP, performs a full media decode, and writes `production-report.json` with every source mapping. Full decode is a technical check; the report deliberately leaves human playback review and Loom verification false.

Before accepting the cut, check:

- The first three seconds show the actual upstream QM PR and its current status, without implying a merge.
- Prediction appears before Tab; Tab accepts it; Send is visibly real.
- The hero loop shows an actual instruction, execution, review, specific correction, and improved result from the continuous source take.
- Execution acceleration is consistently 20× and labeled. Review text remains readable.
- Sessions come before Inbox; team switching uses a visible action; Garry's identity is clear, and narration discloses that its history is synthetic.
- GBrain evidence is English, truthful, and appropriate for sharing. Private records are not exposed accidentally.
- The final model label, cursor, interaction cues, crop, timing, and narration agree with the recorded app.
- Stop is visibly applied, and the closing prediction and Send occur before the black card.
- Entire local playback has been watched with audio; no missing or frozen segments, clipping, or unreadable text.

## 5. Upload and hand off

Upload the accepted MP4 to Loom using the authorized account, open the returned share URL, and play it to the end. Verify visibility using the intended audience settings. Put the verified share URL into the draft submission fields and README. Keep the video, source map, and report paired. Hand off the complete submission package by **16:30 Pacific**, preserving the deadline buffer. The user will personally submit the Google Form; do not submit it on their behalf.

No upload or form submission is performed by these scripts.
