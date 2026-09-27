# Demo production kit

[Watch the 93-second demo on Loom](https://www.loom.com/share/f989c778d4f14d05acfe0a20d9bdfbc3). This is the revised cut with complete narration, the Goals board, and the QM PR as a closing add-on. See the [verification record](../docs/verification.md) for playback and sharing checks. The user's acceptance and submission remain pending.

This directory prepares a 93-second revised film of Clone-in-the-Loop, the QM extension with GBrain-backed next-prompt prediction. Read the [storyboard](storyboard.md), [narration](narration.txt), and [tool requirements](tooling.md) first.

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

Capture [the actual open QM proposal](https://github.com/yc-software/qm/pull/1671) first. Its title, number, and Open state occupy the final six seconds as an add-on after the product logo. Then capture the new application at `4317` or `4318`, keeping the main instruction, execution, review, correction, and Stop sequence in the same real session.

[recorder.html](recorder.html) is an alternative visible-button `getDisplayMedia` recorder. Serve it with `python3 -m http.server 4321 --bind 127.0.0.1 --directory demo`, then open it through CUA and use Chrome's real share picker. It requests 30 fps WebM with audio disabled by default. The filming browser returned `InvalidStateError` despite valid activation, so it was not used for the submitted footage. Details are in [tooling.md](tooling.md).

## 2. Record provenance

Set `FFMPEG` or put FFmpeg on `PATH`. After each capture, create a receipt using its actual capture start time:

```sh
python3 demo/receipt.py demo/output/raw/hero.mp4 \
  --captured-at ACTUAL_ISO_TIME_WITH_TIMEZONE \
  --app-url http://127.0.0.1:4317
```

For the closing contribution shot, record the exact published URL:

```sh
python3 demo/receipt.py demo/output/raw/upstream-pr.mp4 \
  --captured-at ACTUAL_ISO_TIME_WITH_TIMEZONE \
  --kind upstream-pr \
  --app-url https://github.com/yc-software/qm/pull/ACTUAL_NUMBER
```

Only a numeric PR URL under `yc-software/qm` is accepted for `upstream-pr`; arbitrary external pages are rejected. Set `upstreamPrPlacement` to `"closing-addon"` for the final approved order. The assembler then requires this capture as the last segment, three to eight seconds at normal speed. Omitting this option preserves the original opening-shot validation.

The receipt stores the video hash, Git revision, working-tree digest, app origin, dimensions, and duration. Git state is collected when the receipt is created; it is not a capture-time attestation. Create the receipt before changing source files, and preserve the recorder's actual start time and sidecar. Copy its capture entry into a new manifest under `demo/output/`. Keep the raw file unchanged.

```sh
cp demo/manifest.example.json demo/output/manifest.json
```

Replace every pending value and every `start: null` with actual capture evidence. Add separate capture entries for separate takes. Set each segment's `start` to its source timestamp. `duration` is the output duration; at speed `20`, the script uses `duration × 20` seconds of source footage. Only real-time and 20× playback are accepted.

## 3. Record fresh narration

The final narration uses the user's registered personal voice in their existing ElevenLabs account. Paste [narration.txt](narration.txt) into the speech-generation UI through `cua_repl`, with the settings in [audio direction](audio-direction.md). Preserve the exact selected voice label in the ignored audio receipt.

Preserve the fresh download and its receipt under ignored `demo/output/audio/`. The revised [93-second timeline](narration-timeline.json) places ten complete passages at measured pauses. The [audio direction](audio-direction.md) documents source-sample continuity, reviewed alignment, and the final speech-first mix. Preserve all speech samples, use no voice time stretching, and adjust the picture rather than cutting words.

Earlier line-level alignment and system-voice timing drafts are superseded and must not be submitted. Optional music requires an original or licensed source and a manifest `music.path`; set `music.duckUnderNarration` to `true` to lower it automatically while the voice speaks.

## 4. Assemble and verify

```sh
python3 demo/assemble.py demo/output/manifest.json --check
python3 demo/assemble.py demo/output/manifest.json --output demo/output/final
python3 -m http.server 4320 --bind 127.0.0.1 --directory demo/output/final
```

Open `http://127.0.0.1:4320` and watch the entire film. The renderer preserves source pixels apart from trimming, playback speed, crop/scale, and editorial speed or key indicators. It adds a black closing title card. It never reconstructs application UI or inserts fake results.

A real-time segment may include `keyCue` with `keys` (`["Tab"]`, `["Tab", "Tab"]`, or `["Enter"]`), scene-relative `at`, `duration`, and `evidence` for the actual recorded action. Keep these cues small and consistent at the lower left; never add a key action that did not occur.

Output is H.264, yuv420p, AAC, 30 fps, with fast-start playback. The renderer normalizes audio toward −16 LUFS and −1.5 dBTP, performs a full media decode, and writes `production-report.json` with every source mapping. Full decode is a technical check; the report deliberately leaves human playback review and Loom verification false.

Before accepting the cut, check:

- The final add-on shows the actual upstream QM PR and its current status, without implying a merge.
- Prediction appears before Tab; Tab accepts it; Send is visibly real.
- The hero loop shows an actual instruction, execution, review, specific correction, and improved result from the same real session.
- Execution acceleration is consistently 20× and labeled. Review text remains readable.
- The saved sessions in Goals come before Inbox; team switching uses a visible action; Garry's identity is clear; the README and memory evidence disclose its fictional history.
- GBrain evidence is English, truthful, and appropriate for sharing. Private records are not exposed accidentally.
- The final model label, cursor, interaction cues, crop, timing, and narration agree with the recorded app.
- Stop is visibly applied. The product logo appears before the upstream PR add-on.
- Entire local playback has been watched with audio; no missing or frozen segments, clipping, or unreadable text.

## 5. Upload and hand off

Upload the accepted MP4 to Loom using the authorized account, open the returned share URL, and play it to the end. Verify visibility using the intended audience settings. Put the verified share URL into the draft submission fields and README. Keep the video, source map, and report paired. Hand off the complete submission package by **16:30 Pacific**, preserving the deadline buffer. The user will personally submit the Google Form; do not submit it on their behalf.

No upload or form submission is performed by these scripts.
