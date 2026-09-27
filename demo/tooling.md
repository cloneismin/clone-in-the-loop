# Production tools

The production kit runs locally. Media and private receipts stay under ignored `demo/output/`.

| Tool       | Requirement                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Python     | Python 3.9 or newer for capture receipts and assembly.                                             |
| FFmpeg     | Tested with 7.1; requires H.264, AAC, drawtext, crop, scale, and loudnorm.                         |
| Swift      | macOS compiler with AppKit and ScreenCaptureKit for the selected-window recorder.                  |
| Whisper    | Optional `faster-whisper` with an existing local model for narration alignment.                    |
| ElevenLabs | The user's existing account and registered personal voice, selected through its visible interface. |

Set `FFMPEG` to an installed binary, put `ffmpeg` on PATH, or install `imageio-ffmpeg` in the chosen Python environment. `FFPROBE` is optional; the scripts can inspect FFmpeg metadata directly. Narration alignment accepts an existing transcript as an alternative to local Whisper. Exact workstation paths and voice labels belong in the ignored production receipts.

## Capture

The user authorized the Chrome-window-only ScreenCaptureKit recorder. It initializes AppKit before capture, keeps actual static holds at 30 fps, writes two-second MP4 fragments, and records writer diagnostics. It rejects non-Chrome windows, blank or suspended capture, and existing output paths. All product and browser interaction uses `cua_repl`.

The alternative browser recorder exposes activation diagnostics. On the filming workstation it returned `InvalidStateError` despite a trusted click, active user gesture, focused visible top-level document, and secure context. Native QuickTime and Screenshot entry points were also unavailable, so ScreenCaptureKit was used.

Keep the dedicated window stable. Operating-system Space animations can shift a captured window; inspect the source and omit those transitions when editing. Keep source excerpts in chronological order, and apply the visible 20× label to every accelerated excerpt.

## Audio and delivery

Generate fresh English narration with the registered owner voice. The local system voice helper is a timing draft only. Keep the selected voice, source hash, generation time, alignment, and music provenance in ignored receipts. Review the complete mix before uploading.

The assembler checks source hashes and scene ranges, renders exact frame counts, validates each segment's duration, and fully decodes the final MP4. It leaves full playback and Loom verification pending in `production-report.json`; technical media checks do not establish those outcomes. The user personally submits the Google Form after receiving the verified Loom URL and completed draft fields.
