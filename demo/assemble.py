import argparse
from datetime import datetime
import json
import math
from pathlib import Path
import re
from media_tools import ffmpeg, filter_path, font, probe, run, sha256, validate_capture_origin

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demo"


def local_media(value):
    path = (DEMO / value).resolve()
    allowed = [(DEMO / "output").resolve(), (ROOT / "data").resolve()]
    if not any(path.is_relative_to(base) for base in allowed):
        raise ValueError("Media must be fresh local output under demo/output or data.")
    if not path.is_file():
        raise ValueError(f"Capture or audio file is missing: {path}")
    return path


def validate(manifest):
    if manifest.get("language") != "en":
        raise ValueError("This submission requires English narration and visible demo content.")
    for audio_kind in ["narration", "music"]:
        audio = manifest.get(audio_kind)
        if audio:
            audio_path = local_media(audio["path"])
            if audio.get("sha256") and sha256(audio_path) != audio["sha256"]:
                raise ValueError(f"{audio_kind}: audio does not match its recorded SHA-256.")
    start = datetime.fromisoformat(manifest["eventStart"].replace("Z", "+00:00"))
    if start.tzinfo is None:
        raise ValueError("eventStart must include its timezone.")
    captures = {}
    for key, item in manifest["captures"].items():
        path = local_media(item["path"])
        captured = datetime.fromisoformat(item["capturedAt"].replace("Z", "+00:00"))
        if captured.tzinfo is None or captured < start:
            raise ValueError(f"{key}: capture must be dated during the hackathon.")
        validate_capture_origin(item.get("kind", "product"), item.get("appUrl"))
        required_branding = manifest.get("requiredProductBranding")
        if required_branding and item.get("kind", "product") == "product" and item.get("verifiedVisibleBranding") != required_branding:
            raise ValueError(f"{key}: inspect a source frame and record the required visible product branding.")
        if not re.fullmatch(r"[0-9a-f]{40}", item.get("gitRevision", "")):
            raise ValueError(f"{key}: record the actual Git revision.")
        if not re.fullmatch(r"[0-9a-f]{64}", item.get("workingTreeSha256", "")):
            raise ValueError(f"{key}: record the actual working-tree digest.")
        digest = sha256(path)
        if digest != item.get("sha256"):
            raise ValueError(f"{key}: source file does not match its recorded SHA-256.")
        captures[key] = {**item, "absolutePath": str(path), "metadata": probe(path)}
    pr_placement = manifest.get("upstreamPrPlacement", "opening")
    if pr_placement not in ["opening", "closing-addon"]:
        raise ValueError("The upstream PR placement must be opening or closing-addon.")
    pr_segment = manifest["segments"][-1 if pr_placement == "closing-addon" else 0]
    pr_capture = captures.get(pr_segment.get("capture"), {})
    pr_duration = float(pr_segment["duration"])
    valid_pr_duration = math.isfinite(pr_duration) and (3 <= pr_duration <= 8 if pr_placement == "closing-addon" else pr_duration == 3)
    if pr_capture.get("kind") != "upstream-pr" or not valid_pr_duration or float(pr_segment.get("speed", 1)) != 1:
        raise ValueError("Show the actual upstream QM pull request at normal speed: three seconds for the opening, or three to eight seconds for a closing add-on.")
    timeline = []
    position = 0.0
    for segment in manifest["segments"]:
        duration = float(segment["duration"])
        if duration <= 0:
            raise ValueError("Each segment needs a positive output duration.")
        if segment.get("kind") == "title":
            if segment.get("text") != "Clone-in-the-Loop":
                raise ValueError("The closing title card must use the product name Clone-in-the-Loop.")
        else:
            capture = captures[segment["capture"]]
            speed = float(segment.get("speed", 1))
            if speed not in [1, 20]:
                raise ValueError("Use real time or the agreed 20x execution treatment.")
            source_start = float(segment["start"])
            source_end = source_start + duration * speed
            if source_start < 0 or source_end > capture["metadata"]["duration"] + 0.05:
                raise ValueError(f"{segment['id']}: source trim exceeds the captured duration.")
            if not segment.get("evidence") or segment["evidence"].startswith("PENDING"):
                raise ValueError(f"{segment['id']}: record what the real interaction proves.")
            cue = segment.get("keyCue")
            if cue:
                if cue.get("keys") not in [["Tab"], ["Tab", "Tab"], ["Enter"]]:
                    raise ValueError("Key cues support only the recorded Tab and Enter actions.")
                cue_evidence = cue.get("evidence")
                if speed != 1 or not isinstance(cue_evidence, str) or not cue_evidence.strip() or cue_evidence.lstrip().startswith("PENDING"):
                    raise ValueError("Key cues need real-time footage and actual action evidence.")
                cue_start = float(cue.get("at", 0))
                cue_duration = float(cue.get("duration", 0.8))
                if not math.isfinite(cue_start) or not math.isfinite(cue_duration) or cue_start < 0 or cue_duration <= 0 or cue_start + cue_duration > duration + 0.001:
                    raise ValueError(f"{segment['id']}: key cue exceeds the scene.")
        timeline.append({**segment, "outputStart": round(position, 3), "outputEnd": round(position + duration, 3)})
        position += duration
    return captures, timeline, position


def render(manifest, destination):
    captures, timeline, duration = validate(manifest)
    destination.mkdir(parents=True, exist_ok=True)
    binary = ffmpeg()
    width, height, fps = manifest.get("width", 1920), manifest.get("height", 1080), manifest.get("fps", 30)
    typeface = filter_path(font())
    chunks = []
    for index, segment in enumerate(timeline):
        target = destination / f"segment-{index:02d}-{segment['id']}.mp4"
        args = [binary, "-hide_banner", "-loglevel", "error", "-y"]
        if segment.get("kind") == "title":
            args += ["-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r={fps}:d={segment['duration']}"]
            filters = [f"drawtext=fontfile='{typeface}':text='Clone-in-the-Loop':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2"]
        else:
            capture = captures[segment["capture"]]
            speed = segment.get("speed", 1)
            source_duration = min(segment["duration"] * speed + speed / fps, capture["metadata"]["duration"] - segment["start"])
            args += ["-ss", str(segment["start"]), "-t", str(source_duration), "-i", capture["absolutePath"]]
            filters = [f"setpts=(PTS-STARTPTS)/{speed}"]
            crop = segment.get("crop")
            if crop:
                if any(not isinstance(crop.get(key), int) for key in ["width", "height", "x", "y"]):
                    raise ValueError("Crop must use integer source-pixel coordinates.")
                filters.append(f"crop={crop['width']}:{crop['height']}:{crop['x']}:{crop['y']}")
            filters += [f"scale={width}:{height}:force_original_aspect_ratio=decrease", f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black", "setsar=1"]
            if speed == 20:
                filters.append(f"drawtext=fontfile='{typeface}':text='20x':fontcolor=white:fontsize=28:box=1:boxcolor=black@0.65:boxborderw=12:x=w-tw-40:y=h-th-35")
            cue = segment.get("keyCue")
            if cue:
                cue_start = float(cue.get("at", 0))
                cue_end = cue_start + float(cue.get("duration", 0.8))
                for key_index, key in enumerate(cue["keys"]):
                    filters.append(f"drawtext=fontfile='{typeface}':text='{key}':fontcolor=white:fontsize=26:box=1:boxcolor=black@0.72:boxborderw=12:x={44 + key_index * 86}:y=h-150:enable='between(t,{cue_start},{cue_end})'")
        filters.append(f"fps={fps}")
        frame_count = round(segment["duration"] * fps)
        if abs(frame_count / fps - segment["duration"]) > 0.001:
            raise ValueError(f"{segment['id']}: duration must align with the output frame rate.")
        args += ["-vf", ",".join(filters), "-frames:v", str(frame_count), "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-threads", "4", str(target)]
        run(args)
        if abs(probe(target)["duration"] - segment["duration"]) > 0.015:
            raise ValueError(f"{segment['id']}: rendered video duration differs from the planned frame count.")
        chunks.append(target)
        print(f"Rendered {index + 1}/{len(timeline)}: {segment['id']}", flush=True)
    concat = destination / "segments.txt"
    concat.write_text("".join(f"file '{path.name}'\n" for path in chunks))
    picture = destination / "picture.mp4"
    run([binary, "-v", "error", "-y", "-f", "concat", "-safe", "1", "-i", str(concat), "-c", "copy", str(picture)])
    final = destination / "clone-in-the-loop.mp4"
    audio = manifest.get("narration")
    music = manifest.get("music")
    args = [binary, "-v", "error", "-y", "-i", str(picture)]
    if audio:
        args += ["-i", str(local_media(audio["path"]))]
    else:
        args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
    audio_filter = "[1:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11,apad[narration]"
    if music:
        args += ["-stream_loop", "-1", "-i", str(local_media(music["path"]))]
        music_gain = float(music.get("gain", 0.08))
        if not 0 <= music_gain <= 1:
            raise ValueError("Music gain must be between 0 and 1.")
        duck = music.get("duckUnderNarration", False)
        if not isinstance(duck, bool):
            raise ValueError("Music duckUnderNarration must be a boolean.")
        audio_filter += f";[2:a]volume={music_gain}[bed]"
        if duck and audio:
            audio_filter += ";[narration]asplit=2[voice][sidechain];[bed][sidechain]sidechaincompress=threshold=0.025:ratio=8:attack=10:release=300:makeup=1[ducked];[voice][ducked]amix=inputs=2:duration=first:normalize=0[mixed]"
        else:
            audio_filter += ";[narration][bed]amix=inputs=2:duration=first:normalize=0[mixed]"
        audio_filter += ";[mixed]loudnorm=I=-16:TP=-1.5:LRA=11[out]"
    else:
        audio_filter += ";[narration]loudnorm=I=-16:TP=-1.5:LRA=11[out]"
    args += ["-filter_complex", audio_filter, "-map", "0:v:0", "-map", "[out]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(duration), "-movflags", "+faststart", str(final)]
    run(args)
    run([binary, "-v", "error", "-i", str(final), "-f", "null", "-"])
    report = {"status": "assembled-not-human-reviewed", "artifact": str(final), "sha256": sha256(final), "duration": duration, "metadata": probe(final), "narrated": bool(audio), "narration": audio, "music": music, "fullDecodePassed": True, "captures": captures, "timeline": timeline, "localPlaybackReviewed": False, "loomUrl": None, "loomPlaybackReviewed": False}
    (destination / "production-report.json").write_text(json.dumps(report, indent=2) + "\n")
    (destination / "index.html").write_text('<!doctype html><meta charset="utf-8"><title>Clone demo review</title><style>body{background:#0b0d12;color:white;font:16px system-ui;margin:24px}video{width:100%;max-height:85vh}p{opacity:.7}</style><h1>Clone-in-the-Loop</h1><p>Review cut. Full playback and source checks are required.</p><video controls src="clone-in-the-loop.mp4"></video>')
    print(json.dumps({"output": str(final), "seconds": duration, "decode": "passed", "playbackReview": "pending"}, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, default=DEMO / "output/final")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    if args.check:
        captures, timeline, duration = validate(manifest)
        print(json.dumps({"captures": len(captures), "segments": len(timeline), "seconds": duration}, indent=2))
    else:
        render(manifest, args.output.resolve())


if __name__ == "__main__":
    main()
