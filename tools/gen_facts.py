"""
tools/gen_facts.py -- regenerate facts.md from config/facts.py.

facts.md is an output: it prints every section's code next to the numbers that
code produced, plus the sanity checks against published values. Edit config/facts.py,
never facts.md.
"""

from __future__ import annotations

import inspect
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import facts as facts_mod  # noqa: E402


def _md_escape(s: str) -> str:
    return s.replace("|", r"\|")


def generate(force=False) -> tuple[str, bool]:
    F = facts_mod.load(force=force)
    checks = facts_mod.run_checks(F)
    all_ok = all(c[-1] for c in checks)
    out: list[str] = []
    w = out.append

    w("# facts.md: every number in the Short (how fast chess explodes)\n")
    w(f"> **Generated file.** Edit `config/facts.py`, then run `python build.py facts`. "
      f"Last generated {date.today().isoformat()}; {len(list(F.items()))} facts.\n")
    w("Every value on screen, in the narration and in the captions is read from `config/facts.py`. A row marked "
      "**input** is a published value or a design choice and cites its source (tags are resolved in "
      "`research/notes.md`). Every other row is **computed**: the move counts by our own legal move generator "
      "(`config/chess.py`, checked against six published perft positions in `tests/`), the atoms from the Planck "
      "2018 parameters (`config/cosmos.py`).\n")
    from config import tree
    t = tree.counts()
    w("The eight two-move checkmates (computed): " + "; ".join(" ".join(g) for g in t["mates4"]) + "\n")
    w("## Sanity checks against published values\n")
    w(f"**{'ALL PASS' if all_ok else 'FAILURES PRESENT'}** "
      f"({sum(c[-1] for c in checks)}/{len(checks)})\n")
    w("| Check | Fact | Expected | Computed | Tolerance | Result |")
    w("|---|---|---:|---:|---:|:---:|")
    for label, key, exp, got, tol, unit, ok in checks:
        w(f"| {label} | `{key}` | {exp:,.6g} {unit} | {got:,.6g} {unit} | ±{tol:g} | "
          f"{'PASS' if ok else '**FAIL**'} |")
    w("")
    sections = F.by_section()
    for i, (title, blurb, fn) in enumerate(facts_mod.SECTIONS, 1):
        w(f"## {i}. {title}\n")
        if blurb:
            w(blurb + "\n")
        w("| Key | Value | Unit | Meaning | Kind / source |")
        w("|---|---:|---|---|---|")
        for f in sections.get(title, []):
            kind = f"**input**: {f.source}" if f.kind == "input" else "computed"
            w(f"| `{f.key}` | {format(f.value, f.fmt)} | {f.unit} | {_md_escape(f.desc)} | "
              f"{_md_escape(kind)} |")
        w("")
        w("<details><summary>Code</summary>\n")
        w("```python\n" + inspect.getsource(fn).rstrip() + "\n```\n")
        w("</details>\n")

    w("## Appendix: the functions behind the numbers\n")
    from config import chess, cosmos
    for fn in (chess.Position.pseudo, chess.Position.legal, chess.perft, chess.perft_stats, chess.mated_games,
               cosmos.atoms, cosmos.baryons, cosmos.horizon_m):
        w(f"<details><summary><code>{fn.__module__}.{fn.__qualname__}</code></summary>\n")
        w("```python\n" + inspect.getsource(fn).rstrip() + "\n```\n")
        w("</details>\n")

    return "\n".join(out) + "\n", all_ok


def main():
    text, ok = generate(force="--force" in sys.argv)
    (ROOT / "facts.md").write_text(text, encoding="utf-8")
    print(f"facts.md written ({len(text.splitlines())} lines); checks {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
