import argparse
import hashlib
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
from media_tools import sha256, probe, validate_capture_origin

ROOT = Path(__file__).resolve().parents[1]

parser = argparse.ArgumentParser()
parser.add_argument("capture", type=Path)
parser.add_argument("--captured-at", required=True)
parser.add_argument("--app-url", default="http://127.0.0.1:4317")
parser.add_argument("--kind", choices=["product", "upstream-pr"], default="product")
args = parser.parse_args()
validate_capture_origin(args.kind, args.app_url)
when = datetime.fromisoformat(args.captured_at.replace("Z", "+00:00"))
if when.tzinfo is None:
    raise ValueError("Capture time must include the timezone.")
revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
files = subprocess.check_output(["git", "ls-files", "-co", "--exclude-standard", "plugins/clone-ui", "src", "scripts/clone-runtime"], cwd=ROOT, text=True).splitlines()
working = hashlib.sha256()
for name in sorted(set(files)):
    path = ROOT / name
    if path.is_file():
        working.update(name.encode())
        working.update(bytes.fromhex(sha256(path)))
path = args.capture.resolve()
capture_metadata_path = path.with_suffix(path.suffix + ".capture.json")
capture_metadata = json.loads(capture_metadata_path.read_text()) if capture_metadata_path.exists() else {}
receipt = {"kind": args.kind, "path": str(path), "sha256": sha256(path), "capturedAt": args.captured_at, "appUrl": args.app_url, "gitRevision": revision, "workingTreeSha256": working.hexdigest(), "metadata": probe(path), "method": capture_metadata.get("method", "browser MediaRecorder from visible controls"), "uiInteraction": "cua_repl", "nativeCaptureMetadata": capture_metadata}
receipt["receiptCreatedAt"] = datetime.now(timezone.utc).isoformat()
receipt["sourceStateTiming"] = "Git revision and working-tree digest are collected when this receipt is created, not by the screen recorder."
output = path.with_suffix(path.suffix + ".receipt.json")
output.write_text(json.dumps(receipt, indent=2) + "\n")
print(output)
