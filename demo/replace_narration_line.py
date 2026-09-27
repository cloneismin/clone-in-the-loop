import argparse
from datetime import datetime
import json
from pathlib import Path
from media_tools import ffmpeg, probe, run, sha256

DEMO = Path(__file__).resolve().parent
VOICE = "Registered owner voice"


def local_audio(path):
    path = path.resolve()
    if not path.is_relative_to((DEMO / "output").resolve()) or not path.is_file():
        raise ValueError("Narration files must exist under ignored demo/output.")
    return path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("replacement", type=Path)
    parser.add_argument("--line", required=True)
    parser.add_argument("--generated-at", required=True)
    parser.add_argument("--voice-label", default=VOICE)
    parser.add_argument("--timeline", type=Path, default=DEMO / "narration-timeline.json")
    parser.add_argument("--output", type=Path, default=DEMO / "output/audio/minchan/narration-90s-garry.wav")
    args = parser.parse_args()
    source = local_audio(args.source)
    replacement = local_audio(args.replacement)
    if source == args.output.resolve() or args.output.exists():
        raise ValueError("Choose a fresh output path; preserve the original narration.")
    generated_at = datetime.fromisoformat(args.generated_at.replace("Z", "+00:00"))
    if generated_at.tzinfo is None:
        raise ValueError("Generation time must include its timezone.")
    timeline = json.loads(args.timeline.read_text())
    line = next(line for line in timeline["lines"] if line["id"] == args.line)
    duration = probe(replacement)["duration"]
    if duration > line["latestEnd"] - line["start"]:
        raise ValueError(f"Fresh line needs {duration:.2f}s, beyond its scene slot. Adjust the slot or regenerate naturally; do not accelerate speech.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    delay = round(line["start"] * 1000)
    filters = f"[0:a]aeval='if(between(t,{line['start']},{line['latestEnd']}),0,val(0))|if(between(t,{line['start']},{line['latestEnd']}),0,val(1))'[base];[1:a]aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11,adelay={delay}|{delay}[replacement];[base][replacement]amix=inputs=2:normalize=0:duration=longest,apad,atrim=duration={timeline['duration']}[out]"
    run([ffmpeg(), "-v", "error", "-i", str(source), "-i", str(replacement), "-filter_complex", filters, "-map", "[out]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(args.output)])
    run([ffmpeg(), "-v", "error", "-i", str(args.output), "-f", "null", "-"])
    receipt = {"status": "replacement-line-listening-review-pending", "provider": "ElevenLabs", "voice": args.voice_label, "generatedAt": generated_at.isoformat(), "path": str(args.output.resolve()), "duration": probe(args.output)["duration"], "sha256": sha256(args.output), "baseNarration": str(source), "baseSha256": sha256(source), "replacement": {**line, "path": str(replacement), "sha256": sha256(replacement), "duration": duration, "actualEnd": round(line["start"] + duration, 3)}, "fullDecodePassed": True, "listeningReviewed": False}
    args.output.with_suffix(".receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({key: receipt[key] for key in ["status", "path", "duration", "sha256"]}, indent=2))


if __name__ == "__main__":
    main()
