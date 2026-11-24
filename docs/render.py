"""Renders the README images into docs/img from the real tile code (no hand-drawn mockups).

Run:  python -I -X utf8 docs/render.py            (needs Microsoft Edge or Google Chrome; no agent, no phone)
      python -I -X utf8 docs/render.py --device   (also grabs the phone's current screen over adb into docs/src)

How: apply.py --preview assembles every tile exactly as the phone gets it, fed with sample data; the pages in docs/src
put them into a phone frame or a grid; a headless browser takes the screenshots (transparent background, 2x) and
builds the animated hero SVG. A throwaway local web server serves it all, so the grids can drive the tiles.
"""
from __future__ import annotations

import html
import http.server
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS, SRC, OUT = ROOT / "docs", ROOT / "docs" / "src", ROOT / "docs" / "img"
PREVIEW = ROOT / "phonebox" / "preview"
BROWSERS = [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]

# (page under docs/, output file, window width, height, virtual time in ms)
SHOTS = [
    ("shot-home.html", "home.png", 932, 474, 5000),
    ("shot-screen.html?src=../idle.html%3Ft%3D10%3A24%26act%3Dread", "idle-day.png", 932, 474, 4500),
    ("shot-screen.html?src=../idle.html%3Ft%3D14%3A05%26act%3Dstudy%26focus%3D18", "idle-focus.png", 932, 474, 1500),
    ("shot-screen.html?img=device-night.png", "device-night.png", 932, 474, 800),
    ("grid-scenes.html?set=day", "activities.png", 1272, 1086, 4500),
    ("grid-scenes.html?set=night", "night-scenes.png", 1092, 326, 7000),
    ("grid-moods.html", "moods.png", 1228, 564, 800),
    ("grid-interact.html", "interactions.png", 926, 846, 4500),
]


def browser() -> str:
    for b in BROWSERS:
        if Path(b).exists():
            return b
    sys.exit("no Edge / Chrome found")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:  # one line per request would bury the results
        pass


def serve(directory: Path) -> tuple[http.server.ThreadingHTTPServer, int]:
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(directory)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def run(exe: str, profile: str, args: list[str], capture: bool = False) -> subprocess.CompletedProcess:
    base = [exe, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
            f"--user-data-dir={profile}", "--default-background-color=00000000", "--lang=ru"]
    return subprocess.run(base + args, capture_output=True, text=capture, encoding="utf-8" if capture else None, timeout=120)


def grab_device() -> None:
    """The phone's screen as it is right now (the idle screen at night makes the nicest picture)."""
    png = subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True, timeout=30).stdout
    if not png.startswith(b"\x89PNG"):
        sys.exit("adb screencap failed (is the phone connected and authorised?)")
    (SRC / "device-night.png").write_bytes(png)
    print("device screen saved:", SRC / "device-night.png")


def main() -> int:
    if "--device" in sys.argv:
        grab_device()
    sys.path.insert(0, str(ROOT / "phonebox"))
    import apply  # noqa: E402  (the preview builder)
    apply.write_preview()
    site = PREVIEW / "docs"
    if site.exists():
        shutil.rmtree(site)
    shutil.copytree(SRC, site)
    shutil.copy(ROOT / "phonebox" / "tiles" / "lib" / "tsuki.js", site / "tsuki.js")
    OUT.mkdir(parents=True, exist_ok=True)
    exe = browser()
    srv, port = serve(PREVIEW)
    profile = tempfile.mkdtemp(prefix="tsuki-render-")
    try:
        for page, name, w, h, budget in SHOTS:
            if "img=" in page and not (SRC / page.split("img=")[1]).exists():
                print("skip", name, "(no device screenshot; run with --device)")
                continue
            out = OUT / name
            run(exe, profile, ["--force-device-scale-factor=2", f"--window-size={w},{h}", f"--virtual-time-budget={budget}",
                               f"--screenshot={out}", f"http://127.0.0.1:{port}/docs/{page}"])
            print(f"{name:20} {out.stat().st_size // 1024:5} KB")
        dom = run(exe, profile, ["--virtual-time-budget=1500", "--dump-dom", f"http://127.0.0.1:{port}/docs/hero.html"], capture=True).stdout
        m = re.search(r'<pre id="out">(.*?)</pre>', dom or "", re.S)
        svg = html.unescape(m.group(1)) if m else ""
        if "<svg" not in svg:
            print("hero.svg: the page produced nothing")
            return 1
        (OUT / "hero.svg").write_text(svg, encoding="utf-8")
        print(f"{'hero.svg':20} {(OUT / 'hero.svg').stat().st_size // 1024:5} KB")
    finally:
        srv.shutdown()
        shutil.rmtree(profile, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
