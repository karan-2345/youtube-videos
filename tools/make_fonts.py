"""
tools/make_fonts.py -- static font instances for libass (captions), cut from the variable fonts.

libass picks a variable font's default instance (Work Sans: Thin), so the captions use a static Bold instance with
its own family name, "Work Sans Captions".

    .venv\\Scripts\\python tools\\make_fonts.py   ->  assets/fonts/WorkSans-Captions700.ttf
"""

from __future__ import annotations

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "assets" / "fonts"


def static(src: str, dst: str, family: str, axes: dict) -> Path:
    inst = instancer.instantiateVariableFont(TTFont(FONTS / src), axes, updateFontNames=False)
    name = inst["name"]
    for rec in list(name.names):
        if rec.nameID in (1, 4, 16):
            name.setName(family, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID in (2, 17):
            name.setName("Regular", rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID == 6:
            name.setName(family.replace(" ", ""), rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    inst["OS/2"].usWeightClass = 400
    out = FONTS / dst
    inst.save(out)
    return out


if __name__ == "__main__":
    # captions: Archivo ExtraBold, semi-condensed (the look-test captions: weight 800, width 87.5)
    p = static("Archivo[wdth,wght].ttf", "Archivo-Captions800.ttf", "Archivo Captions", {"wght": 800, "wdth": 87.5})
    print(p.relative_to(ROOT), p.stat().st_size)
