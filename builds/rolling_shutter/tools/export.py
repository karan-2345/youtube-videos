"""tools/export.py -- cache/data.json for the scene: sentence timings (tools/tts.py) and every number from config/facts.py.
The scene formats these numbers; it never types one in."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from config import facts as F  # noqa: E402


def main():
    tim = json.loads((ROOT / "cache/timings.json").read_text())
    names = [n for n in dir(F) if n.isupper()]
    facts = {n: getattr(F, n) for n in names}
    facts.update(F.checks())
    data = {"fps": 60, "duration": tim["duration"], "sentences": tim["sentences"], "sections": tim["sections"], "facts": facts}
    (ROOT / "cache").mkdir(exist_ok=True)
    (ROOT / "cache/data.json").write_text(json.dumps(data, indent=1))
    print(f"cache/data.json: {data['duration']:.2f} s, {len(data['sentences'])} sentences, {len(facts)} facts")


if __name__ == "__main__":
    main()
