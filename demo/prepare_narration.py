import argparse
import json
from pathlib import Path
import shutil
import subprocess
from media_tools import ffmpeg, probe, run, sha256

DEMO = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeline", type=Path, default=DEMO / "narration-timeline.json")
    parser.add_argument("--output", type=Path, default=DEMO / "output/audio/aligned")
    parser.add_argument("--voice", default="Samantha")
    parser.add_argument("--rate", type=int, default=150)
    args = parser.parse_args()
    if not shutil.which("say"):
        raise RuntimeError("This helper requires the already installed macOS say command.")
    timeline = json.loads(args.timeline.read_text())
    args.output.mkdir(parents=True, exist_ok=True)
    receipts = []
    for item in timeline["lines"]:
        target = args.output / f"{item['id']}.aiff"
        subprocess.run(["say", "-v", args.voice, "-r", str(args.rate), "-o", str(target), item["text"]], check=True)
        duration = probe(target)["duration"]
        available = item["latestEnd"] - item["start"]
        if duration > available:
            raise RuntimeError(f"{item['id']} needs {duration:.2f}s but its scene allows {available:.2f}s. Shorten the wording or adjust that line's slot; no automatic speech speed-up was applied.")
        receipts.append({**item, "path": str(target.resolve()), "duration": duration, "actualEnd": round(item["start"] + duration, 3), "sha256": sha256(target)})
    args_ffmpeg = [ffmpeg(), "-v", "error", "-y"]
    filters = []
    for index, item in enumerate(receipts):
        args_ffmpeg += ["-i", item["path"]]
        delay = round(item["start"] * 1000)
        filters.append(f"[{index}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={delay}|{delay}[line{index}]")
    labels = "".join(f"[line{index}]" for index in range(len(receipts)))
    filters.append(f"{labels}amix=inputs={len(receipts)}:normalize=0:duration=longest,apad,atrim=duration={timeline['duration']},loudnorm=I=-16:TP=-1.5:LRA=11[out]")
    target = args.output / "narration-90s.wav"
    args_ffmpeg += ["-filter_complex", ";".join(filters), "-map", "[out]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(target)]
    run(args_ffmpeg)
    result = {"status": "timing-draft-only-not-for-submission", "approvedForSubmission": False, "voice": args.voice, "wordsPerMinute": args.rate, "duration": probe(target)["duration"], "path": str(target.resolve()), "sha256": sha256(target), "lines": receipts}
    (args.output / "narration-receipt.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"output": str(target), "duration": result["duration"], "lines": len(receipts), "finalSpeechEnds": receipts[-1]["actualEnd"], "listeningReview": "pending"}, indent=2))


if __name__ == "__main__":
    main()
