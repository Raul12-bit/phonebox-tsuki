"""Applies the personal black-and-white PhoneBox layout through the local agent API (http://127.0.0.1:8765).

Run:  python -I -X utf8 phonebox/apply.py [--dry-run]
Safe to re-run: it rebuilds pages/shortcuts from this file and keeps every other setting as it is.
A copy of the settings before the change is written to %LOCALAPPDATA%\\PhoneRemote\\settings.backup.json
(not next to this script: it contains the Wi-Fi pairing key and this folder is synced by OneDrive).

The "Экран" page needs the screen server (screen-server/install.ps1) and `tailscale serve` (see README.md).
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

AGENT = "http://127.0.0.1:8765"
HERE = Path(__file__).resolve().parent
SCREEN_BASE = "https://<laptop>.<tailnet>.ts.net"  # `tailscale serve` -> 127.0.0.1:8790 (tailnet devices only)
SCREEN_KEY_FILE = Path(os.environ.get("LOCALAPPDATA", "")) / "PhoneRemote" / "key.txt"
# The agent only returns/accepts the full settings for same-origin requests from its own settings page.
SAME_ORIGIN = {"Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", "Origin": AGENT}

# --- monochrome line icons (24x24, white stroke) --------------------------------------------------------------
ICON = {
    # apps
    "files": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    "firefox": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    "chrome": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5h8.2M9 13.8L4.9 6.6M15 13.8l-4.1 7.1"/>',
    "vscode": '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4M13.5 5l-3 14"/>',
    "cursor": '<path d="M5 3l14 8-6 1.5L10 19z"/>',
    "terminal": '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15H17"/>',
    "telegram": '<path d="M21 4L3 11l6.5 2.2L12 20l3-5 5 3z"/><path d="M9.5 13.2L21 4"/>',
    "discord": '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 3v-3H6a2 2 0 0 1-2-2z"/><path d="M9 10.5h.01M15 10.5h.01"/>',
    "claude": '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
    "steam": '<path d="M7 9h10a4 4 0 0 1 3.9 4.9l-.7 3A2.5 2.5 0 0 1 16 18l-2-2h-4l-2 2a2.5 2.5 0 0 1-4.2-1.1l-.7-3A4 4 0 0 1 7 9z"/><path d="M8 12v3M6.5 13.5h3M15.5 13h.01M17.5 14.5h.01"/>',
    "arduino": '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    "tasks": '<path d="M3 12h4l2.5-6 5 12 2.5-6H21"/>',
    "settings": '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    "calc": '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    "notepad": '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
    "youtube": '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/>',
    # keys
    "desktop": '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    "taskview": '<rect x="3" y="5" width="8" height="6" rx="1.5"/><rect x="13" y="5" width="8" height="6" rx="1.5"/><rect x="3" y="13" width="8" height="6" rx="1.5"/><rect x="13" y="13" width="8" height="6" rx="1.5"/>',
    "snip": '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/>',
    "clipboard": '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',
    "copy": '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    "cut": '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M7.8 16.2L17 4M16.2 16.2L7 4"/>',
    "paste": '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 3h6v4H9z"/>',
    "undo": '<path d="M9 6L4 11l5 5"/><path d="M4 11h11a5 5 0 0 1 0 10h-3"/>',
    "redo": '<path d="M15 6l5 5-5 5"/><path d="M20 11H9a5 5 0 0 0 0 10h3"/>',
    "selectall": '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
    "save": '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8 3v5h7V3M8 21v-6h8v6"/>',
    "find": '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    "newtab": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 9v6M9 12h6"/>',
    "closetab": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>',
    "reopen": '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
    "refresh": '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5"/><path d="M20 4v4.5h-4.5"/>',
    "fullscreen": '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    "minimize": '<path d="M5 19h14"/><path d="M12 5v9M8 10l4 4 4-4"/>',
    "maximize": '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16"/>',
    "close": '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M9 9l6 6M15 9l-6 6"/>',
    "lang": '<path d="M4 6h9M8.5 4v2M6 6c.5 3 2.5 5.5 5 7M11 6c-.5 3-2.5 5.5-6 7.5"/><path d="M13 20l3.5-9 3.5 9M14.2 17h4.6"/>',
    "emoji": '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    "enter": '<path d="M20 5v7a3 3 0 0 1-3 3H5"/><path d="M9 11l-4 4 4 4"/>',
    "esc": '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
    # keys under the trackpad on «Пульт»
    "tab": '<path d="M4 12h13M13 8l4 4-4 4M20 6v12"/>',
    "bksp": '<path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
    "win": '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    "alttab": '<rect x="3" y="6" width="13" height="10" rx="2"/><path d="M8 19h11a2 2 0 0 0 2-2V9"/>',
    # power tile (tiles/power.html runs these through phonebox.run)
    "pw-lock": '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    "pw-monitor": '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M9 8.5l6 5M15 8.5l-6 5"/>',
    "pw-sleep": '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    "pw-restart": '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5"/><path d="M20 4v4.5h-4.5"/>',
    "pw-shutdown": '<path d="M12 3.5v8"/><path d="M7 6.5a7.5 7.5 0 1 0 10 0"/>',
}


def svg(paths: str) -> bytes:
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" '
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + paths + "</svg>").encode()


WHITE = "#ffffff"
APPS = [  # id, label, cmd, args
    ("files", "Проводник", "explorer.exe", None),
    ("firefox", "Firefox", r"shell:AppsFolder\308046B0AF4A39CB", None),
    ("chrome", "Chrome", r"shell:AppsFolder\Chrome", None),
    ("vscode", "VS Code", r"shell:AppsFolder\Microsoft.VisualStudioCode", None),
    ("cursor", "Cursor", r"shell:AppsFolder\Anysphere.Cursor", None),
    ("terminal", "Терминал", "wt.exe", None),
    ("telegram", "Telegram", r"shell:AppsFolder\Telegram.TelegramDesktop", None),
    ("discord", "Discord", r"shell:AppsFolder\com.squirrel.Discord.Discord", None),
    ("claude", "Claude", r"shell:AppsFolder\Claude_pzs8sxrjxfjjc!Claude", None),
    ("steam", "Steam", r"shell:AppsFolder\{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}\Steam\Steam.exe", None),
    ("arduino", "Arduino", r"shell:AppsFolder\cc.arduino.IDE2", None),
    ("tasks", "Диспетчер", "taskmgr.exe", None),
    ("settings", "Параметры", "ms-settings:", None),
    ("calc", "Калькулятор", "calc.exe", None),
    ("notepad", "Блокнот", "notepad.exe", None),
    ("youtube", "YouTube", "https://www.youtube.com", None),
]
KEYS = [  # id, label, key combination (builtin:keys)
    ("desktop", "Рабочий стол", "win+d"), ("taskview", "Все окна", "win+tab"), ("snip", "Скриншот", "win+shift+s"),
    ("clipboard", "Буфер", "win+v"), ("copy", "Копировать", "ctrl+c"), ("cut", "Вырезать", "ctrl+x"),
    ("paste", "Вставить", "ctrl+v"), ("undo", "Отменить", "ctrl+z"), ("redo", "Повторить", "ctrl+y"),
    ("selectall", "Выделить всё", "ctrl+a"), ("save", "Сохранить", "ctrl+s"), ("find", "Найти", "ctrl+f"),
    ("newtab", "Вкладка +", "ctrl+t"), ("closetab", "Вкладка ×", "ctrl+w"), ("reopen", "Вернуть", "ctrl+shift+t"),
    ("refresh", "Обновить", "f5"), ("fullscreen", "Полный экран", "f11"), ("minimize", "Свернуть", "win+down"),
    ("maximize", "Развернуть", "win+up"), ("close", "Закрыть окно", "alt+f4"), ("lang", "Язык", "win+space"),
    ("emoji", "Эмодзи", "win+."), ("enter", "Enter", "enter"), ("esc", "Esc", "esc"),
]
# Laptop power for tiles/power.html (tap: lock, screen off; hold 1.1 s: sleep, restart, shutdown). Sleep is the real S3
# sleep through WinForms: rundll32 powrprof SetSuspendState would hibernate here, because hibernation is enabled.
POWER = [  # id, label, cmd, args
    ("pw-lock", "Блокировка", "builtin:lock", None),
    ("pw-monitor", "Экран выкл", "builtin:monitor-off", None),
    ("pw-sleep", "Сон", "powershell.exe",
     "-NoProfile -WindowStyle Hidden -Command \"Add-Type -AssemblyName System.Windows.Forms; "
     "[System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)\""),
    ("pw-restart", "Перезагрузка", "shutdown.exe", "/r /t 0"),
    ("pw-shutdown", "Выключение", "shutdown.exe", "/s /t 0"),
]
PAD_KEYS = [  # only under the trackpad on «Пульт» (not on «Клавиши», whose 3 x 8 grid stays full)
    ("tab", "Tab", "tab"), ("bksp", "Стереть", "backspace"), ("win", "Пуск", "win"), ("alttab", "Alt+Tab", "alt+tab"),
]


# Perf guard, put in front of every decorative tile. PhoneBox keeps all pages mounted, and the Redmi A5's WebView
# repaints SVG/CSS animations on the main thread: a dozen endless animations on pages you are not even looking at
# were enough to make taps land late or not at all. The guard freezes a tile's animations while it is off screen,
# while the app is hidden, and (calm > 0) after `calm` seconds without a touch on it; the next touch wakes it.
# `window.pbLive()` tells a tile's own timers whether it is worth doing work right now.
# Keepalive: the panel counts only touches on its own document, never inside a tile's iframe, so using a big tile
# (the screen, Tsuki) for 5 minutes used to throw you onto the night page mid-use. A touch in the tile now calls
# phonebox.goto(<its own page>) at most every 15 s: going to the page you are on moves nothing, but resets the timer.
PERF_GUARD = """<style>html.pb-still *, html.pb-still *::before, html.pb-still *::after { animation-play-state: paused !important; }</style>
<script>(function () {
  var d = document.documentElement, vis = true, last = Date.now(), CALM = __CALM__ * 1000, PAGE = '__PAGE__', ping = 0;
  function upd() { var live = vis && !document.hidden && (!CALM || Date.now() - last < CALM); d.classList.toggle('pb-still', !live); return live; }
  try { new IntersectionObserver(function (e) { vis = e[e.length - 1].isIntersecting; if (vis) last = Date.now(); upd(); }).observe(d); } catch (e) {}
  document.addEventListener('visibilitychange', function () { if (!document.hidden) last = Date.now(); upd(); });
  addEventListener('pointerdown', function () {
    last = Date.now(); upd();
    if (PAGE && last - ping > 15000) { ping = last; try { phonebox.goto(PAGE); } catch (e) {} }
  }, true);
  setInterval(upd, 4000);
  window.pbLive = function () { return vis && !document.hidden; };
})();</script>
"""


def tile(name: str, calm: int | None = None, page: str = "", **subst: str) -> str:
    """A tile's HTML with __KEY__ placeholders filled in; calm=None means no perf guard, 0 = only off-screen pausing.
    page: the id of the page the tile sits on, for the idle keepalive (empty = no keepalive)."""
    text = (HERE / "tiles" / name).read_text(encoding="utf-8")
    for k, v in {**subst, "PAGE": page}.items():
        text = text.replace(f"__{k}__", v)
    if calm is not None:
        text = PERF_GUARD.replace("__CALM__", str(calm)).replace("__PAGE__", page) + text
    return text


def w(id_, type_, x, y, ww, hh, **options):
    item = {"id": id_, "type": type_, "x": x, "y": y, "w": ww, "h": hh}
    if options:
        item["options"] = options
    return item


def html(id_, x, y, ww, hh, name, calm=None, page="", **subst):
    return w(id_, "html", x, y, ww, hh, html=tile(name, calm, page, **subst), transparent=False)


def build_pages(old: list[dict], screen_key: str) -> list[dict]:
    keep = {p["id"]: p for p in old}
    pages = [
        {"id": "remote", "title": "Пульт", "icon": "🖱️", "enabled": True, "widgets": [
            # music lives on «Главная» and «Музыка»; here only what a remote needs
            w("pad", "trackpad", 0, 0, 7, 5, control=True, scrollBar="right"),
            w("padkeys", "shortcuts", 0, 5, 7, 1, columns=6, ids=["esc", "tab", "bksp", "enter", "win", "alttab"]),
            html("screenbtn", 7, 0, 5, 3, "screen-button.html", calm=4, page="remote"),
            w("voice", "dictate", 7, 3, 3, 3, control=True, language="ru-RU"),
            w("vol", "volume", 10, 3, 2, 3),
        ]},
        {"id": "screen", "title": "Экран", "icon": "🖥️", "enabled": True, "widgets": [
            # full width: the tile has its own rails (mode, quality, keyboard, wheel), see tiles/screen.html
            html("screen", 0, 0, 12, 6, "screen.html", page="screen", BASE=SCREEN_BASE, KEY=screen_key),
        ]},
        {"id": "home", "title": "Главная", "icon": "🏠", "enabled": True, "widgets": [
            html("tsuki", 0, 0, 4, 6, "mascot.html", calm=8, page="home"),
            html("clock", 4, 0, 4, 4, "anime-clock.html", calm=0, page="home"),
            w("media", "media", 8, 0, 4, 4),
            html("sys", 4, 4, 8, 2, "sys-strip.html", calm=0, page="home"),
        ]},
        {"id": "control", "title": "Приложения", "icon": "🎛️", "enabled": True, "widgets": [
            w("apps", "shortcuts", 0, 0, 12, 3, columns=8, ids=[a[0] for a in APPS]),
            html("power", 0, 3, 12, 3, "power.html", calm=0, page="control"),
        ]},
        {"id": "keys", "title": "Клавиши", "icon": "⌨️", "enabled": True, "widgets": [
            w("keys", "shortcuts", 0, 0, 12, 6, columns=8, ids=[k[0] for k in KEYS]),
        ]},
        {"id": "system", "title": "Система", "icon": "📈", "enabled": True, "widgets": [
            html("chart", 0, 0, 8, 6, "sys-chart.html", calm=0, page="system"),
            html("details", 8, 0, 4, 6, "sys-details.html", calm=0, page="system"),
        ]},
        {"id": "claude", "title": "Claude", "icon": "✳️", "enabled": True, "widgets": [
            html("quota", 0, 0, 6, 6, "claude-quota.html", calm=4, page="claude"),
            w("sessions", "sessions", 6, 0, 6, 6),
        ]},
    ]
    for pid, title in (("music", "Музыка"), ("procs", "Процессы")):  # stock pages, renamed
        if pid in keep:
            p = dict(keep[pid]); p["enabled"] = True; p["title"] = title; pages.append(p)
    # night mode: Tsuki asleep, full screen. It is the panel's "home page", so 5 minutes without a touch and the
    # Back key bring it up; it stays until touched (idleSec 0); a tap goes back to «Главная».
    pages.append({"id": "night", "title": "Ночь", "icon": "🌙", "enabled": True, "idleSec": 0,
                  "appearance": {"style": "borderless", "gap": 0, "padding": 0, "pagePadding": 0, "radius": 0,
                                 "border": False, "shadow": False},
                  "widgets": [w("night", "html", 0, 0, 12, 6, html=tile("night.html", 0), transparent=True)]})
    # the phone opens on the home page (Tsuki + clock), the remote is one swipe away
    first = [p for p in pages if p["id"] == "home"]
    return first + [p for p in pages if p["id"] != "home"]


def request(method: str, path: str, body: bytes | None = None, headers: dict | None = None):
    req = urllib.request.Request(AGENT + path, data=body, method=method, headers={**SAME_ORIGIN, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, dict(r.headers), r.read()


def main() -> int:
    dry = "--dry-run" in sys.argv
    screen_key = SCREEN_KEY_FILE.read_text(encoding="ascii").strip() if SCREEN_KEY_FILE.exists() else ""
    if not screen_key:
        print("warning: no screen-server key yet (run screen-server/install.ps1); the Экран page will show 'no picture'")
    _, hdr, raw = request("GET", "/api/settings")
    version = hdr.get("X-Config-Version")
    cfg = json.loads(raw)
    # The backup holds secrets (Wi-Fi pairing key): keep it out of the project folder, which OneDrive syncs.
    SCREEN_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    (SCREEN_KEY_FILE.parent / "settings.backup.json").write_bytes(raw)

    cfg["weather"].update(city="Алматы", lat=43.2389, lon=76.8897, unit="celsius")
    d = cfg["display"]
    # The phone starts on the first page («Главная»); after 5 minutes without a touch it goes to the night page.
    # PhoneBox's own night clock is off (it would cover Tsuki). Dimming is off too: a dimmed panel swallows the first
    # touch (it only brightens), then the night page takes the second one, and that read as "the phone doesn't react".
    cfg["night"]["enabled"] = False
    d.update(nightWhenDark=False, idleDimMin=0)
    d.update(language="ru", theme="amoled", accent=WHITE, artTint=False, homePage="night", idleReturnSec=300,
             pageBar="dots", showSeconds=True,
             homeScreen=True,  # PhoneBox is the phone's launcher: Home always comes back here
             # No screen pinning. While the app is not pinned, PhoneBox calls startLockTask() on every settings change and
             # every start, and Android answers with a «Приложение закреплено» confirmation panel. On this phone in
             # landscape that panel covers the right half and its buttons are below the screen edge: the panel could only
             # be closed by turning the screen off, and taps under it went nowhere (seen with adb on 24.11).
             pin=False)
    d["appearance"] = {"style": "cards", "font": "rounded", "radius": 22, "gap": 10, "padding": 12,
                       "border": True, "shadow": False}
    cfg["codexBar"].update(providers=["claude"], codexLiveQuota=False)
    cfg["controls"]["allowPower"] = True  # sleep / restart / shutdown, each needs a hold to confirm on the phone
    cfg["pages"] = build_pages(cfg["pages"], screen_key)
    cfg["shortcuts"] = (
        [{"id": i, "label": label, "icon": "", "color": WHITE, "cmd": cmd, **({"args": a} if a else {}), "toggle": False}
         for i, label, cmd, a in APPS + POWER]
        + [{"id": i, "label": label, "icon": "", "color": WHITE, "cmd": "builtin:keys", "args": combo, "toggle": False}
           for i, label, combo in KEYS + PAD_KEYS]
    )
    missing = [s["id"] for s in cfg["shortcuts"] if s["id"] not in ICON]
    if missing:
        print("missing icons:", missing)
        return 1

    if dry:
        print([(p["id"], p["title"], len(p["widgets"])) for p in cfg["pages"]], len(cfg["shortcuts"]), "shortcuts")
        return 0

    body = json.dumps(cfg, ensure_ascii=False).encode("utf-8")
    try:
        _, _, out = request("PUT", "/api/settings", body, {"Content-Type": "application/json", "X-Config-Version": version})
    except urllib.error.HTTPError as e:
        print("settings rejected:", e.code, e.read().decode("utf-8", "replace"))
        return 1
    version = json.loads(out)["version"]
    print("settings saved, version", version)

    for s in cfg["shortcuts"]:
        try:
            _, _, out = request("POST", f"/api/settings/shortcut-icon?id={s['id']}", svg(ICON[s["id"]]),
                                {"Content-Type": "image/svg+xml", "X-Config-Version": version})
            version = json.loads(out)["version"]
        except urllib.error.HTTPError as e:
            print(f"icon {s['id']} rejected:", e.code, e.read().decode("utf-8", "replace"))
            return 1
    print("icons uploaded:", len(cfg["shortcuts"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
