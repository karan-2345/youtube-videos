"""tools/export.py -- cache/data.json for the scene: sentence timings (from tools/tts.py) and every number from
config/facts.py. The scene formats these numbers; it never types one in."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from config import facts as F  # noqa: E402


def main():
    tim = json.loads((ROOT / "cache/timings.json").read_text())
    chk = F.checks()
    data = {
        "fps": 60, "duration": tim["duration"], "sentences": tim["sentences"], "sections": tim["sections"],
        "facts": {"T": F.T, "MOON_M": F.MOON_M, "LY_M": F.LY_M, "MILKY_WAY_LY": F.MILKY_WAY_LY, "AU_M": F.AU_M,
                  "SUN_R_M": F.SUN_R_M, "EARTH_R_M": F.EARTH_R_M, "MOON_R_M": F.MOON_R_M,
                  "ROLL_2002_M": F.ROLL_2002_M, "TAPE_2011_M": F.TAPE_2011_M, "FOLDS_2011": F.FOLDS_2011, "YEAR_CHALLENGE": F.YEAR_CHALLENGE, "YEAR_RECORD": F.YEAR_RECORD, "YEAR_2011": F.YEAR_2011, "FOLDS_GOAL": F.FOLDS_GOAL, "HOURS_2002": F.HOURS_2002, "GOLD_T": F.GOLD_T, **chk},
        "table": F.table(42),
    }
    (ROOT / "cache").mkdir(exist_ok=True)
    (ROOT / "cache/data.json").write_text(json.dumps(data, indent=1))
    print(f"cache/data.json: {data['duration']:.2f} s, {len(data['sentences'])} sentences")


if __name__ == "__main__":
    main()
