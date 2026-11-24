"""Applies the black-and-white PhoneBox layout with Tsuki through the local agent API (http://127.0.0.1:8765).

Run:  python -I -X utf8 phonebox/apply.py [--dry-run | --preview]
Safe to re-run: it rebuilds pages/shortcuts from this file and keeps every other setting as it is.
--preview writes every tile, assembled exactly as the phone gets it but fed with sample data, to phonebox/preview/
(open preview/index.html; add ?t=21:30 to a tile's URL to see it at another time of day). Needs no agent.
A copy of the settings before the change is written to %LOCALAPPDATA%\\PhoneRemote\\settings.backup.json
(not next to this script: it contains the Wi-Fi pairing key, and a project folder may be synced or published).

Your own values (the screen server's address, the weather location, the night hours) live in config.json next to this
script, which git ignores; config.example.json shows every key. The "Экран" page and Tsuki's memory need the screen
server (screen-server/install.ps1) and `tailscale serve` (see README.md).
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
SCREEN_KEY_FILE = Path(os.environ.get("LOCALAPPDATA", "")) / "PhoneRemote" / "key.txt"


def load_config() -> dict:
    """config.example.json overlaid with config.json (git-ignored: it holds your own addresses)."""
    cfg = json.loads((HERE / "config.example.json").read_text(encoding="utf-8"))
    local = HERE / "config.json"
    if local.exists():
        mine = json.loads(local.read_text(encoding="utf-8"))
        cfg.update({k: ({**cfg[k], **v} if isinstance(v, dict) and isinstance(cfg.get(k), dict) else v) for k, v in mine.items()})
    return {k: v for k, v in cfg.items() if not k.startswith("_")}


CONFIG = load_config()
# `tailscale serve` -> 127.0.0.1:8790, reachable from your tailnet devices only. Empty: no «Экран» picture, and Tsuki
# remembers only until the panel reloads.
SCREEN_BASE = CONFIG["screen_base"].rstrip("/")
# The idle screen (the panel's home page after IDLE_AFTER_SEC without a touch): between NIGHT_FROM and NIGHT_TO Tsuki
# sleeps under a night clock, the rest of the day she is busy with something (a different activity every time it opens).
NIGHT_FROM, NIGHT_TO = CONFIG["night_from"], CONFIG["night_to"]
IDLE_AFTER_SEC = int(CONFIG["idle_after_sec"])
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
    page: the id of the page the tile sits on, for the idle keepalive (empty = no keepalive).
    __INCLUDE_TSUKI__ becomes the shared character rig (tiles/lib/tsuki.js): tiles are sandboxed srcdoc iframes and
    cannot load a script file of their own."""
    text = (HERE / "tiles" / name).read_text(encoding="utf-8")
    if "__INCLUDE_TSUKI__" in text:
        rig = (HERE / "tiles" / "lib" / "tsuki.js").read_text(encoding="utf-8")
        text = text.replace("__INCLUDE_TSUKI__", "<script>\n" + rig + "\n</script>")
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
    mem = {"BASE": SCREEN_BASE if screen_key else "", "KEY": screen_key}  # Tsuki's memory lives on the screen server
    night = {"NIGHT_FROM": NIGHT_FROM, "NIGHT_TO": NIGHT_TO}
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
            # calm=0: Tsuki paces her own motion (stepped blinks, short reactions); the guard only pauses her off screen
            html("tsuki", 0, 0, 4, 6, "mascot.html", calm=0, page="home", **mem),
            html("clock", 4, 0, 4, 4, "anime-clock.html", calm=0, page="home", **night),
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
    # The idle screen, full screen: a clock with Tsuki busy with something (day) or asleep (NIGHT_FROM..NIGHT_TO).
    # It is the panel's "home page", so IDLE_AFTER_SEC without a touch and the Back key bring it up; it stays until
    # touched (idleSec 0); a tap goes back to «Главная».
    pages.append({"id": "idle", "title": "Заставка", "icon": "🌙", "enabled": True, "idleSec": 0,
                  "appearance": {"style": "borderless", "gap": 0, "padding": 0, "pagePadding": 0, "radius": 0,
                                 "border": False, "shadow": False},
                  "widgets": [w("idle", "html", 0, 0, 12, 6, html=tile("idle.html", 0, **mem, **night), transparent=True)]})
    # the phone opens on the home page (Tsuki + clock), the remote is one swipe away
    first = [p for p in pages if p["id"] == "home"]
    return first + [p for p in pages if p["id"] != "home"]


# --- preview: every tile as a standalone page with sample data (python -X utf8 phonebox/apply.py --preview) ------------
# The prelude mirrors the panel's own (window.phonebox with on/run/goto), feeds sample data instead of the agent's, and
# lets ?t=HH:MM shift the clock (tiles read the time through pbNow()). The memory server is replaced by an in-page copy.
PREVIEW_PRELUDE = """<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><style>:root{color-scheme:dark}html,body{margin:0;height:100%;background:transparent;color:#eef2f6;font-family:Roboto,"Segoe UI",system-ui,sans-serif;overflow:hidden}</style>
<script>(function () {
  var q = new URLSearchParams(location.search), t = q.get('t'), off = 0;
  if (t && /^\\d{1,2}:\\d{2}$/.test(t)) { var n = new Date(), d = new Date(n); d.setHours(+t.split(':')[0], +t.split(':')[1], 0, 0); off = d - n; }
  window.PB_PREVIEW = { offsetMs: off, mem: q.get('mem') ? JSON.parse(q.get('mem')) : null };
  var subs = {}, data = __DATA__;
  if (q.get('focus')) data.focus = +q.get('focus');
  window.phonebox = { data: data,
    on: function (k, f) { (subs[k] = subs[k] || []).push(f); if (data[k] !== undefined) setTimeout(function () { f(data[k]); }, 30); },
    run: function (id) { console.log('[phonebox.run]', id); try { parent.postMessage({ pbPreview: 'run', id: id }, '*'); } catch (e) {} },
    goto: function (p) { console.log('[phonebox.goto]', p); try { parent.postMessage({ pbPreview: 'goto', page: p }, '*'); } catch (e) {} } };
  setInterval(function () { var s = data.state.pc; s.cpu = Math.max(3, Math.min(97, s.cpu + (Math.random() - .5) * 8)); (subs.state || []).forEach(function (f) { f(data.state); }); }, 1000);
})();</script>
"""
PREVIEW_DATA = {
    "state": {"pc": {"cpu": 14, "cpuName": "12th Gen Intel(R) Core(TM) i5-12450H", "ramUsedGb": 6.1, "ramTotalGb": 7.7,
                     "gpu": {"util": 12, "temp": 46, "power": 7.4, "vramUsed": 0.4, "vramTotal": 4, "clock": 622},
                     "netDownBps": 182000, "netUpBps": 24000, "uptimeSec": 190000,
                     "disks": [{"name": "C:", "usedGb": 446, "totalGb": 476}]},
              "media": {"app": "Spotify", "title": "Lunar Lo-Fi", "artist": "Night Owl Radio", "playing": True},
              "ping": {"ms": 34, "lossPct": 0}},
    "weather": {"current": {"temperature_2m": -3.4, "apparent_temperature": -8.1, "weather_code": 71, "is_day": 1},
                "daily": {"weather_code": [71, 3], "temperature_2m_max": [-1, 2], "temperature_2m_min": [-9, -6],
                          "precipitation_probability_max": [70, 10], "sunrise": ["2026-11-24T07:46", "2026-11-25T07:47"],
                          "sunset": ["2026-11-24T17:13", "2026-11-25T17:12"]}},
    "quotas": {"providers": [{"id": "claude", "plan": "Max", "updatedAt": None,
                              "limits": [{"label": "5-hour session", "percent": 42, "windowSec": 18000},
                                         {"label": "Weekly", "percent": 61, "windowSec": 604800}]}]},
    "work": {"sessions": []},
}
PREVIEW_INDEX = """<!doctype html><meta charset="utf-8"><title>PhoneBox preview</title>
<style>
  body { margin: 0; padding: 28px; background: #141414; color: #ddd; font: 14px system-ui, sans-serif; }
  h2 { font-weight: 500; margin: 26px 0 10px; color: #aaa; letter-spacing: .04em; }
  .phone { position: relative; width: 820px; height: 360px; background: #000; border-radius: 26px; box-shadow: 0 0 0 10px #050505, 0 18px 40px #0008; overflow: hidden; }
  .grid { position: absolute; inset: 12px; display: grid; grid-template-columns: repeat(12, 1fr); grid-template-rows: repeat(6, 1fr); gap: 10px; }
  .card { border: 1px solid #2a2a2a; border-radius: 22px; overflow: hidden; background: #000; }
  .card iframe, .full iframe { width: 100%; height: 100%; border: 0; display: block; }
  .full { position: absolute; inset: 0; }
  .row { display: flex; gap: 40px; flex-wrap: wrap; }
  .log { margin-top: 18px; font: 12px ui-monospace, monospace; color: #8a8a8a; }
</style>
<h2>Главная</h2>
<div class="phone"><div class="grid">
  <div class="card" style="grid-area:1/1/7/5"><iframe src="mascot.html"></iframe></div>
  <div class="card" style="grid-area:1/5/5/9"><iframe src="anime-clock.html"></iframe></div>
  <div class="card" style="grid-area:1/9/5/13;display:grid;place-items:center;color:#555">media (native widget)</div>
  <div class="card" style="grid-area:5/5/7/13"><iframe src="sys-strip.html"></iframe></div>
</div></div>
<h2>Заставка — день (каждая перезагрузка = новое занятие)</h2>
<div class="row"><div class="phone"><div class="full"><iframe src="idle.html?t=10:24"></iframe></div></div>
<div class="phone"><div class="full"><iframe src="idle.html?t=15:40"></iframe></div></div></div>
<h2>Заставка — ночь (с __NIGHT_FROM__)</h2>
<div class="row"><div class="phone"><div class="full"><iframe src="idle.html?t=23:12"></iframe></div></div>
<div class="phone"><div class="full"><iframe src="idle.html?t=19:59"></iframe></div></div></div>
<div class="log" id="log"></div>
<script>addEventListener('message', function (e) { if (e.data && e.data.pbPreview) document.getElementById('log').textContent = new Date().toLocaleTimeString() + '  phonebox.' + e.data.pbPreview + '(' + (e.data.page || e.data.id) + ')'; });</script>
"""


RIG_GALLERY = """<!doctype html><meta charset="utf-8"><title>Tsuki rig</title>
<style>
  body { margin: 0; padding: 20px; background: #000; color: #9a9a9a; font: 12px system-ui, sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, 150px); gap: 10px; margin-bottom: 26px; }
  figure { margin: 0; border: 1px solid #222; border-radius: 12px; padding: 4px 4px 6px; text-align: center; }
  svg { width: 100%; height: 170px; display: block; } .props svg { height: 90px; }
</style>
<h3>moods</h3><div class="grid" id="moods"></div><h3>poses</h3><div class="grid" id="poses"></div>
<h3>props</h3><div class="grid props" id="props"></div>
<script>__RIG__</script>
<script>
  function fig(parent, label, vb) {
    var f = document.createElement('figure');
    f.innerHTML = '<svg viewBox="' + (vb || '0 0 200 250') + '"><g></g></svg><figcaption>' + label + '</figcaption>';
    parent.appendChild(f); return f.querySelector('g');
  }
  Object.keys(Tsuki.MOODS).forEach(function (m) { Tsuki.create(fig(moods, m), { mood: m }); });
  Object.keys(Tsuki.POSES).forEach(function (p) { Tsuki.create(fig(poses, p), { pose: p }); });
  Tsuki.create(fig(poses, 'pj + cap'), { outfit: 'pj', acc: 'cap', mood: 'sleep', pose: 'hold' });
  Tsuki.create(fig(poses, 'glasses + phones'), { acc: 'glasses phones', mood: 'happy' });
  Object.keys(Tsuki.PROPS).forEach(function (k) { var f = document.createElement('figure'); f.innerHTML = Tsuki.icon(k, '-40 -50 80 70') + '<figcaption>' + k + '</figcaption>'; props.appendChild(f); });
</script>
"""


def write_preview() -> int:
    out = HERE / "preview"
    out.mkdir(exist_ok=True)
    prelude = PREVIEW_PRELUDE.replace("__DATA__", json.dumps(PREVIEW_DATA, ensure_ascii=False))
    mem = {"BASE": "", "KEY": ""}
    night = {"NIGHT_FROM": NIGHT_FROM, "NIGHT_TO": NIGHT_TO}
    tiles = {"mascot.html": (0, "home", {**mem}), "idle.html": (0, "", {**mem, **night}),
             "anime-clock.html": (0, "home", night), "sys-strip.html": (0, "home", {}),
             "claude-quota.html": (4, "claude", {}), "screen-button.html": (4, "remote", {}), "power.html": (0, "control", {})}
    for name, (calm, page, subst) in tiles.items():
        if not (HERE / "tiles" / name).exists():
            continue
        (out / name).write_text(prelude + tile(name, calm, page, **subst), encoding="utf-8")
    (out / "index.html").write_text(PREVIEW_INDEX.replace("__NIGHT_FROM__", NIGHT_FROM), encoding="utf-8")
    # every mood, pose and prop of the rig on one page, for drawing work
    rig = (HERE / "tiles" / "lib" / "tsuki.js").read_text(encoding="utf-8")
    (out / "rig.html").write_text(RIG_GALLERY.replace("__RIG__", rig), encoding="utf-8")
    print("preview written:", out / "index.html")
    return 0


def request(method: str, path: str, body: bytes | None = None, headers: dict | None = None):
    req = urllib.request.Request(AGENT + path, data=body, method=method, headers={**SAME_ORIGIN, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, dict(r.headers), r.read()


def main() -> int:
    if "--preview" in sys.argv:
        return write_preview()
    dry = "--dry-run" in sys.argv
    screen_key = SCREEN_KEY_FILE.read_text(encoding="ascii").strip() if SCREEN_KEY_FILE.exists() else ""
    if not screen_key:
        print("warning: no screen-server key yet (run screen-server/install.ps1); the Экран page will show 'no picture'")
    if not SCREEN_BASE:
        print("warning: no screen_base in config.json; the Экран page will show 'no picture' and Tsuki forgets on reload")
    _, hdr, raw = request("GET", "/api/settings")
    version = hdr.get("X-Config-Version")
    cfg = json.loads(raw)
    # The backup holds secrets (Wi-Fi pairing key): keep it out of the project folder (synced, possibly published).
    SCREEN_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    (SCREEN_KEY_FILE.parent / "settings.backup.json").write_bytes(raw)

    w = CONFIG["weather"]
    cfg["weather"].update(city=w["city"], lat=float(w["lat"]), lon=float(w["lon"]), unit="celsius")
    d = cfg["display"]
    # The phone starts on the first page («Главная»); after IDLE_AFTER_SEC without a touch it shows the idle page.
    # PhoneBox's own night clock is off (it would cover Tsuki). Dimming is off too: a dimmed panel swallows the first
    # touch (it only brightens), then the night page takes the second one, and that read as "the phone doesn't react".
    cfg["night"]["enabled"] = False
    d.update(nightWhenDark=False, idleDimMin=0)
    d.update(language="ru", theme="amoled", accent=WHITE, artTint=False, homePage="idle", idleReturnSec=IDLE_AFTER_SEC,
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
