"""Build a shareable zip of the extension: only the files Chrome needs (no tests, docs or tools).

Run: py -3.12 tools/package.py  -> dist/typekiwi-<version>.zip
The zip unpacks to a single "TypeKiwi" folder that can be loaded with chrome://extensions > Load unpacked.
Every file the manifest and popup.html refer to is checked before writing, so a missing file fails the build.
"""
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

INSTALL = """TypeKiwi {version}

How to install (Chrome, Edge, Brave):
1. Unzip this file. Keep the "TypeKiwi" folder somewhere permanent (Chrome loads it from there).
2. Open chrome://extensions and turn on "Developer mode" (top right).
3. Click "Load unpacked" and choose the "TypeKiwi" folder.
4. Click "Details" on the TypeKiwi card and set "Site access" to "On all sites".
5. Pin TypeKiwi from the puzzle icon, open it and pick your two languages.

Updating: replace the folder's contents with the new version, then press the reload button on the
TypeKiwi card and refresh open tabs.

TypeKiwi is source-available, not open source: it is shared with you for personal use. Please don't
redistribute it. See LICENSE.
"""


def referenced_files() -> list[str]:
    m = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    files = {"manifest.json", "LICENSE"}
    worker = m["background"]["service_worker"]
    files.add(worker)
    # Files the service worker loads itself (importScripts resolves next to the worker): a missing one stops the
    # whole background, so every online translation fails.
    worker_src = (ROOT / worker).read_text(encoding="utf-8")
    for call in re.findall(r"importScripts\(([^)]*)\)", worker_src):
        for a, b in re.findall(r"'([^']+)'|\"([^\"]+)\"", call):
            files.add((Path(worker).parent / (a or b)).as_posix())
    files.add(m["action"]["default_popup"])
    files.update(m.get("icons", {}).values())
    files.update(m["action"].get("default_icon", {}).values())
    for cs in m["content_scripts"]:
        files.update(cs.get("js", []))
        files.update(cs.get("css", []))
    popup = (ROOT / m["action"]["default_popup"]).read_text(encoding="utf-8")
    files.update(re.findall(r'(?:src|href)="([^":#]+)"', popup))
    return sorted(files)


def main():
    m = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    version = m["version"]
    files = referenced_files()
    missing = [f for f in files if not (ROOT / f).is_file()]
    if missing:
        raise SystemExit("missing files: " + ", ".join(missing))
    DIST.mkdir(exist_ok=True)
    out = DIST / f"typekiwi-{version}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(ROOT / f, f"TypeKiwi/{f}")
        z.writestr("TypeKiwi/INSTALL.txt", INSTALL.format(version=version))
    print(out.relative_to(ROOT), len(files) + 1, "files")


if __name__ == "__main__":
    main()
