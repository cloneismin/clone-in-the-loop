# Demo production kit

[Demo on Loom](https://www.loom.com/share/f989c778d4f14d05acfe0a20d9bdfbc3). The corrected 120-second master restores the ambition, Research, Product, Marketing, Clone loop, Goals, Inbox, team, and memory sequence. The central lesson is simple: **Press Tab once to accept the suggestion. Press Tab twice to start Clone mode.**

The opening shows a genuinely empty composer, real typing, a gray prediction, acceptance, and Enter. The later two-Tab sequence shows the Clone toggle, blue border, actual alternating Clone and QM turns, and Stop. All selected footage and speech remain at their recorded speed. The verification record distinguishes local media checks, same-URL publication, and user acceptance.

Read the [storyboard](storyboard.md), [fresh narration](narration.txt), [measured voice timeline](narration-timeline.json), and [audio direction](audio-direction.md). All visible demo content and narration are English. Product footage comes from this repository's QM extension. Raw captures, audio, renders, and receipts remain in ignored `demo/output/`.

## Capture and verify the actual window

The user authorized selected-Chrome-window-only ScreenCaptureKit recording through [capture.swift](capture.swift). Use `cua_repl` for all browser and product interactions.

```sh
mkdir -p demo/output/bin demo/output/raw
swiftc -parse-as-library demo/capture.swift -o demo/output/bin/capture
demo/output/bin/capture --list
demo/output/bin/capture --window ACTUAL_CHROME_WINDOW_ID \
  --output demo/output/raw/fresh-take.mp4 --seconds 600 --hide-cursor
```

Decode and open a frame from that exact recording before a long take. A browser screenshot can refer to a different native window. During filming, confirm that captured frames change after a real interaction. A valid MP4 or an advancing frame count does not prove that ScreenCaptureKit received fresh pixels: static holds retain the last observed frame.

The cursor flag controls the native pointer only. Browser automation may inject a separate visual overlay. For this recording, a temporary local stylesheet suppressed only that overlay; it was removed after capture. Inspect the recorded pixels instead of assuming the flag removed it.

Touch the adjacent `.mp4.stop` file to finalize a take. Preserve its `.capture.json` and `.audit.json` files. Reject the entire affected interval if the capture freezes, shows another surface, or contains private material. Do not replace application text or state in postproduction.

The alternative [browser recorder](recorder.html) returned `InvalidStateError` in this environment and was not used. See [tooling](tooling.md).

## Preserve provenance

```sh
python3 demo/receipt.py demo/output/raw/fresh-take.mp4 \
  --captured-at ACTUAL_ISO_TIME_WITH_TIMEZONE \
  --app-url http://127.0.0.1:4317
```

The receipt records the source hash, capture time, Git state at receipt creation, dimensions, and origin. Git state at receipt creation is not a capture-time attestation. Preserve the original recording unchanged and record every selected source range.

The last shot shows the actual open [QM pull request](https://github.com/yc-software/qm/pull/1671), without implying a merge. Generic manifests support `upstreamPrPlacement: "closing-addon"` and require an exact numeric `yc-software/qm` PR URL, normal speed, and three to eight seconds for this closing shot.

## Speech and assembly

Generate the complete [script](narration.txt) with the user's registered ElevenLabs voice. Preserve the fresh download, selected voice, settings, generation time, and hash. The current recording lasts 50.155 seconds. Its 23 phrase blocks retain every decoded source sample; only silence is added between complete phrases.

The current 120-second source map, audio receipt, and assembly script are under ignored `demo/output/reference-arc-v6/`. The generic assembler remains available for new capture manifests:

```sh
python3 demo/assemble.py demo/output/manifest.json --check
python3 demo/assemble.py demo/output/manifest.json --output demo/output/final
```

Normalize the final picture to exact 30 fps timestamps and verify its decoded frame count independently of audio duration. Output is H.264 at 2560 × 1440, CRF 16, with AAC audio and fast-start playback. Crop and scale preserve actual captured content; the only constructed picture is the black product title. No source footage or speech is accelerated.

## Acceptance and handoff

Review the film as a story, not only as a list of matching timestamp anchors. The first QM response, Clone's specific correction, the changed QM response, and the actual Stop must remain understandable. Read every visible actor and result, follow the real pointer transitions, and confirm that narration describes the screen at that moment.

Check every selected frame for capture artifacts, wrong windows, errors, and private text. Confirm complete speech samples and foreground voice, then watch and listen to the entire final master at 1×. Full decode, transcription, and loudness measurements do not establish subjective listening or user acceptance.

Replace the media behind the existing Loom link. Verify the resulting share player, audience access, resolution, duration, 1× speed, and playback to the end. Keep the immutable master hash and replacement evidence together. The user personally submits the Google Form; these scripts do not upload or submit it.
