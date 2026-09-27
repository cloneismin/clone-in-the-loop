import argparse
from datetime import datetime, timezone
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
from media_tools import ffmpeg, probe, run, sha256

DEMO = Path(__file__).resolve().parent
VOICE = "Registered owner voice"


def tokens(text):
    normalized = text.lower().replace("'", "")
    normalized = re.sub(r"\bqm\b", "q m", normalized)
    normalized = re.sub(r"\bgbrain\b", "g brain", normalized)
    normalized = re.sub(r"\bagi\b", "a g i", normalized)
    return re.findall(r"[a-z0-9]+", normalized)


def transcribe(source, model_path):
    from faster_whisper import WhisperModel
    model = WhisperModel(str(model_path), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    segments, _ = model.transcribe(str(source), language="en", word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    return [{"start": word.start, "end": word.end, "text": word.word} for segment in segments for word in segment.words]


def align(lines, words):
    expected, ranges, actual, word_indexes = [], [], [], []
    for line in lines:
        start = len(expected)
        expected.extend(tokens(line["text"]))
        ranges.append((start, len(expected)))
    for index, word in enumerate(words):
        pieces = tokens(word["text"])
        actual.extend(pieces)
        word_indexes.extend([index] * len(pieces))
    matcher = SequenceMatcher(None, expected, actual, autojunk=False)
    mapping = {}
    for block in matcher.get_matching_blocks():
        for offset in range(block.size):
            mapping[block.a + offset] = word_indexes[block.b + offset]
    exact_mapping = dict(mapping)
    for kind, expected_start, expected_end, actual_start, actual_end in matcher.get_opcodes():
        if kind == "replace" and actual_end > actual_start:
            for index in range(expected_start, expected_end):
                relative = (index - expected_start) / max(1, expected_end - expected_start)
                mapped = min(actual_end - 1, actual_start + int(relative * (actual_end - actual_start)))
                mapping[index] = word_indexes[mapped]
    result = []
    for line, (start, end) in zip(lines, ranges):
        indexes = [mapping[index] for index in range(start, end) if index in mapping]
        ratio = sum(index in exact_mapping for index in range(start, end)) / max(1, end - start)
        if not indexes or ratio < 0.65:
            raise ValueError(f"{line['id']}: transcription alignment is uncertain ({ratio:.2f}); inspect transcript and supply a corrected --alignment file.")
        result.append({**line, "sourceStart": max(0, round(words[indexes[0]]["start"] - 0.04, 3)), "sourceEnd": round(words[indexes[-1]]["end"] + 0.08, 3), "wordMatchRatio": round(ratio, 3)})
    for previous, following in zip(result, result[1:]):
        if previous["sourceEnd"] > following["sourceStart"]:
            midpoint = round((previous["sourceEnd"] - 0.08 + following["sourceStart"] + 0.04) / 2, 3)
            previous["sourceEnd"] = midpoint
            following["sourceStart"] = midpoint
    return result, matcher.ratio()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--model", type=Path)
    parser.add_argument("--transcript", type=Path)
    parser.add_argument("--alignment", type=Path)
    parser.add_argument("--timeline", type=Path, default=DEMO / "narration-timeline.json")
    parser.add_argument("--output", type=Path, default=DEMO / "output/audio/minchan")
    parser.add_argument("--generated-at", required=True)
    parser.add_argument("--voice-label", default=VOICE)
    args = parser.parse_args()
    source = args.source.resolve()
    allowed = [(DEMO / "output").resolve(), (DEMO.parent / "data").resolve()]
    if not any(source.is_relative_to(base) for base in allowed):
        raise ValueError("Preserve the fresh ElevenLabs download under ignored demo/output or data first.")
    generated_at = datetime.fromisoformat(args.generated_at.replace("Z", "+00:00"))
    if generated_at.tzinfo is None:
        raise ValueError("Generation time must include its timezone.")
    args.output.mkdir(parents=True, exist_ok=True)
    timeline = json.loads(args.timeline.read_text())
    duration = probe(source)["duration"]
    if args.alignment:
        alignment = json.loads(args.alignment.read_text())
        lines = alignment["lines"]
        if [line["id"] for line in lines] != [line["id"] for line in timeline["lines"]]:
            raise ValueError("Reviewed alignment must contain every timeline line in order.")
        ratio = alignment.get("transcriptMatchRatio")
    else:
        if args.transcript:
            words = json.loads(args.transcript.read_text())["words"]
        else:
            if not args.model or not args.model.is_dir():
                raise ValueError("Supply an existing cached Whisper model with --model, or an existing --transcript; no model download is performed.")
            words = transcribe(source, args.model)
            (args.output / "source-transcript.json").write_text(json.dumps({"source": str(source), "sha256": sha256(source), "words": words}, indent=2) + "\n")
        lines, ratio = align(timeline["lines"], words)
    alignment = {"status": "automatic-alignment-listening-review-pending", "source": str(source), "sourceSha256": sha256(source), "transcriptMatchRatio": ratio, "lines": lines}
    (args.output / "alignment.json").write_text(json.dumps(alignment, indent=2) + "\n")
    filters = []
    for index, line in enumerate(lines):
        spoken = line["sourceEnd"] - line["sourceStart"]
        available = line["latestEnd"] - line["start"]
        if spoken <= 0 or line["sourceStart"] < 0 or line["sourceEnd"] > duration + 0.1:
            raise ValueError(f"{line['id']}: source timing is invalid.")
        if spoken > available:
            raise ValueError(f"{line['id']}: {spoken:.2f}s exceeds its {available:.2f}s slot. Adjust wording or the timeline; speech is never automatically accelerated.")
        delay = round(line["start"] * 1000)
        filters.append(f"[0:a]atrim=start={line['sourceStart']}:end={line['sourceEnd']},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,adelay={delay}|{delay}[line{index}]")
    labels = "".join(f"[line{index}]" for index in range(len(lines)))
    filters.append(f"{labels}amix=inputs={len(lines)}:normalize=0:duration=longest,apad,atrim=duration={timeline['duration']},loudnorm=I=-16:TP=-1.5:LRA=11[out]")
    target = args.output / "narration-90s.wav"
    run([ffmpeg(), "-v", "error", "-y", "-i", str(source), "-filter_complex", ";".join(filters), "-map", "[out]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(target)])
    receipt = {"status": "aligned-listening-review-pending", "provider": "ElevenLabs", "voice": args.voice_label, "voiceIdentityVerification": "operator must confirm selected registered account voice", "generatedAt": generated_at.isoformat(), "assembledAt": datetime.now(timezone.utc).isoformat(), "path": str(target.resolve()), "sha256": sha256(target), "duration": probe(target)["duration"], "source": str(source), "sourceSha256": sha256(source), "lines": lines, "listeningReviewed": False}
    (args.output / "narration-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({key: receipt[key] for key in ["status", "path", "duration", "sha256"]}, indent=2))


if __name__ == "__main__":
    main()
