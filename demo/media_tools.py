import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess


def ffmpeg():
    binary = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if not binary:
        try:
            import imageio_ffmpeg
            binary = imageio_ffmpeg.get_ffmpeg_exe()
        except ImportError as error:
            raise RuntimeError("Set FFMPEG, add ffmpeg to PATH, or install imageio-ffmpeg.") from error
    return str(binary)


def run(args):
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-5000:])
    return result.stdout


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(path):
    binary = os.environ.get("FFPROBE") or shutil.which("ffprobe")
    if binary:
        data = json.loads(run([binary, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]))
        video = next((stream for stream in data["streams"] if stream["codec_type"] == "video"), {})
        measured = data.get("format", {}).get("duration") or decoded_duration(path)
        return {"duration": float(measured), "width": video.get("width"), "height": video.get("height"), "audio": any(stream["codec_type"] == "audio" for stream in data["streams"])}
    result = subprocess.run([ffmpeg(), "-hide_banner", "-i", str(path)], text=True, capture_output=True)
    duration = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", result.stderr)
    measured = int(duration[1]) * 3600 + int(duration[2]) * 60 + float(duration[3]) if duration else decoded_duration(path)
    dimensions = re.search(r"Video:.*?\b(\d{2,5})x(\d{2,5})\b", result.stderr)
    return {"duration": measured, "width": int(dimensions[1]) if dimensions else None, "height": int(dimensions[2]) if dimensions else None, "audio": "Audio:" in result.stderr}


def font():
    supplied = os.environ.get("DEMO_FONT")
    choices = [supplied, "/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    for path in choices:
        if path and Path(path).is_file():
            return str(path)
    raise RuntimeError("Set DEMO_FONT to a TrueType font for title and speed labels.")


def filter_path(path):
    return str(path).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def validate_capture_origin(kind, url):
    if kind == "product" and url in ["http://127.0.0.1:4317", "http://127.0.0.1:4318"]:
        return
    if kind == "upstream-pr" and re.fullmatch(r"https://github\.com/yc-software/qm/pull/[1-9][0-9]*", str(url)):
        return
    raise ValueError("Capture origin must be the local product or an exact yc-software/qm pull-request URL for an upstream-pr shot.")


def decoded_duration(path):
    progress = run([ffmpeg(), "-v", "error", "-nostats", "-progress", "pipe:1", "-i", str(path), "-f", "null", "-"])
    times = re.findall(r"out_time_us=(\d+)", progress)
    if not times or int(times[-1]) <= 0:
        raise RuntimeError(f"Could not determine media duration: {path}")
    return int(times[-1]) / 1000000
