# Phone remote (Redmi A5 → laptop)

The old Redmi A5 works as a dedicated remote for the laptop: PhoneBox is its home screen, with a black-and-white
interface, the mascot Tsuki, a live view of the laptop screen, and RustDesk for full access.

## What starts by itself when the laptop turns on

| What | How it starts | Window |
|---|---|---|
| PhoneBox agent | Startup folder → `%LOCALAPPDATA%\PhoneBox\app\PhoneBoxAgent.exe` | none, tray icon only |
| Screen server | Startup folder → `%LOCALAPPDATA%\PhoneRemote\ScreenServer.exe` | none |
| Keepalive | Scheduled task «PhoneRemote Keepalive»: at sign-in and every 5 min starts the screen server (a no-op while it runs); the server restarts the PhoneBox agent if it is not running (checked every 20 s) | none |
| Tailscale | Windows service, unattended mode (connects before sign-in) | tray only |
| `tailscale serve` | saved in Tailscale, comes back on its own | — |
| RustDesk | Windows service | tray only |

## Controller-only mode on the phone

- PhoneBox is the phone's home screen: Home always returns to the controller.
- Screen pinning is **off** since 24.11 (`pin=False` in `apply.py`). While the app was not pinned, PhoneBox asked Android
  to pin it on every settings change and every start. Android answered with a «Приложение закреплено» panel over the
  right half of the screen, and in landscape its «Нет, спасибо» / «ОК» buttons sat below the screen edge. Taps under
  the panel went nowhere, and only turning the screen off closed it. That was the "phone stops reacting" bug.
- Entertainment apps are switched off with `phone/apps.ps1`: TikTok, Instagram, Threads, Facebook, Twitch, games,
  Spotify, Beeline TV/Music and Steam Link. They are not deleted; their data stays.
  - Bring them back: `powershell -ExecutionPolicy Bypass -File phonebox/phone/apps.ps1 -On`
  - Switch them off again: `... -Off`
- Untouched: banks, 2FA (Authy, 2FA, Steam Guard), WhatsApp, Telegram, Tailscale, RustDesk.

## Tsuki (ツキ)

An original tsundere mascot on «Главная», with small copies of her on «Claude» and on the «Экран ноутбука» button.

- **Tap** pokes her: she gets surprised or angry. Five taps in a row offends her and costs a little affection.
- **Hold your finger** for half a second to pat her head: hearts float up and the 好感度 (affection) meter grows.
  - Low affection: she is "tsun" (prickly).
  - Medium: mixed.
  - From 4 hearts up: "dere" (sweet) lines.
  - Affection slowly drops back down (one step every 10 minutes).
- She has 7 moods (normal, angry, shy, happy, sleepy, smug, surprised) and around 60 lines.
- She reacts to CPU, memory, GPU temperature, ping, downloads, the music playing, Claude limits, the time of day,
  weekends and how long the laptop has been running.
- At night she falls asleep, with «z».

## Night mode (Tsuki asleep)

- `tiles/night.html` is a full-screen page with:
  - a clock, the date, the moon and stars;
  - Tsuki asleep, hugging a pillow, with a bubble from her nose. Every 40 seconds she mumbles in her sleep.
- **Turns on by itself** after 5 minutes without a touch, on any page. It is the panel's `homePage`, and
  `idleReturnSec = 300`.
- **Turns on manually**: with the «おやすみ» button on «Главная», or with the phone's «Back» key.
- **Turning it off**: tap the screen. Tsuki gets flustered («Ч-что?! Я не спала!») and the panel returns to «Главная».
- Dimming is **off** (`idleDimMin = 0`). It used to swallow the first touch (it only brightened the panel), and the
  night page took the second one, which read as "the phone doesn't react".
- PhoneBox's own night clock (23:00–07:00 and «when it's dark») is switched off. It would cover Tsuki.

## The bar at the bottom of the screen

That white bar belongs to Android's gesture navigation, not to PhoneBox (PhoneBox hides its own navigation bar).
To get rid of it:

1. Unpin: swipe up from the bottom and hold.
2. Settings → System → Gestures → System navigation → **3-button navigation**.
3. Press Home: PhoneBox opens and pins itself again.

With 3-button navigation the buttons are hidden while PhoneBox is full-screen. To exit, swipe from the bottom and
hold «Back» + «Recents».

## Wallpapers

- `wallpaper/tsuki-desktop-hd.png` (3840×2160, a manga page) is the current laptop wallpaper. It is built from
  `desktop-hd.html` + `detail.js`. Windows uses a copy in `%LOCALAPPDATA%\PhoneRemote`, so OneDrive file syncing
  can't leave the desktop black.
- `wallpaper/tsuki-desktop.png` is the simpler first version.
- `wallpaper/tsuki-phone.png` (1440×3280) is for the phone's lock screen.
- To redraw them: edit `wallpaper/desktop.html`, `phone.html` or `tsuki.js`, then render with headless Edge.
- Your previous wallpaper is recorded in `%LOCALAPPDATA%\PhoneRemote\previous-wallpaper.json`.

## Pages (left to right)

1. Главная: Tsuki, the anime clock, music, system
2. Пульт: wide trackpad with a key row under it (Esc, Tab, ⌫, Enter, Пуск, Alt+Tab), the «Экран ноутбука» button, dictation, volume
3. Экран
4. Приложения: apps, and the «Питание» tile (`tiles/power.html`): tap = lock / screen off, hold 1.1 s = sleep / restart /
   shutdown (shortcuts `pw-*` in `apply.py`; sleep is real S3, not hibernation)
5. Клавиши
6. Система
7. Claude
8. Музыка
9. Процессы

The phone always starts on «Главная» and goes back to it after 2 minutes without touches.

## Files

- `apply.py` builds every page and button and writes them into PhoneBox. Run it again after edits:
  `python -I -X utf8 phonebox/apply.py` (preview without saving: `--dry-run`).
- `tiles/*.html` are your own black-and-white tiles (Custom HTML widgets):
  - `sys-strip.html`: CPU / GPU / memory / network
  - `sys-chart.html`: chart
  - `sys-details.html`: laptop details
  - `claude-quota.html`: Claude limits
  - `mascot.html`: Tsuki (screentone, speed lines, katakana sound effects)
  - `anime-clock.html`: clock with kanji and weather
  - `screen.html`: the laptop screen
  - `screen-button.html`: the «Экран ноутбука» button
- `screen-server/` holds the screen server (C#, built by the compiler that ships with Windows) and its installer, which
  also registers the keepalive task: `powershell -ExecutionPolicy Bypass -File phonebox/screen-server/install.ps1`.

## How the «Экран» page works

`ScreenServer.exe` (v2) listens only on `127.0.0.1:8790` and takes a snapshot only when the phone asks for one.
`tailscale serve` publishes it as `https://<laptop>.<tailnet>.ts.net`, which is reachable only from your own Tailscale
devices, **from any network** (home Wi-Fi, another Wi-Fi, mobile data). Every request also needs the key from
`%LOCALAPPDATA%\PhoneRemote\key.txt`.

The page is the whole screen: the picture in the middle, two rails at the sides.

- **Касание** mode (default): tap = left click, two quick taps = double click, hold = right click,
  hold and move = drag (select text, move windows), swipe = scroll, pinch = zoom in (swipe then pans; «1:1» resets).
- **Тачпад** mode: move your finger = move the cursor, tap = click, two-finger tap = right click,
  two-finger move = scroll, hold and move = drag.
- Left rail: ДОМОЙ, mode, quality (АВТО / HD / SD), КЛАВ. (text field + keys: Esc, Tab, Win, arrows, Ctrl+C/V/Z/A/S,
  Alt+Tab, Win+D, Alt+F4, F5, Home/End, PgUp/PgDn, language), ПАУЗА.
- Right rail: ПКМ (right click where the cursor is), КОЛЕСО (drag up/down to scroll), ПУЛЬТ.
- АВТО quality measures every frame: on Wi-Fi it goes up to 1360–1700 px, on slow mobile data down to 640 px
  (≈17 KB a frame). The status pill shows frames per second, delay and width.
- The stream stops at once when you swipe to another page, and after 3 minutes without a touch.
- Server API (all GET, `k=KEY`): `/ping`, `/info`, `/frame.jpg?w&q`, `/click?x&y&b`, `/move`, `/moverel?dx&dy`,
  `/down`, `/up`, `/scroll?d`, `/hscroll?d`, `/key?c=ctrl+shift+t`, `/type?s=text`.
- Keystrokes cannot reach windows running as administrator (Windows blocks that); use RustDesk there.
- It cannot see Windows' lock screen or admin (UAC) prompts. Use RustDesk for those: open recent apps
  (swipe up and hold) → RustDesk → `<laptop-tailscale-ip>`.

## Working from anywhere

Nothing on the laptop needs port forwarding: both PhoneBox (`<laptop-tailscale-ip>:8766`) and the screen go through Tailscale.

- Phone: Tailscale is the **Always-on VPN** (`always_on_vpn_app=com.tailscale.ipn`, checked with adb). Tailscale and
  PhoneBox are exempt from Doze (`dumpsys deviceidle whitelist`).
- The phone has no SIM, so "another network" means another Wi-Fi (a hotspot, school, a friend's). On 24.11 it was paired
  again from the laptop (`/api/pair/start` + `adb shell am start -d <link>`), so it now knows both addresses:
  `<laptop-lan-ip>` and `<laptop-tailscale-ip>`. It tries them in turn (1.5 s each). Checked from the phone: `nc` reaches
  <laptop-tailscale-ip>:8766 (agent) and :443 (screen) through `tun1`. Not tried yet: actually being on another Wi-Fi.
- Laptop: Tailscale runs unattended (`ForceDaemon: true`), `tailscale serve` is saved.
- The laptop must be awake: on mains it never sleeps; **on battery it sleeps after 10 minutes**, and then nothing
  reaches it until it wakes up.
- If PhoneBox on the phone only knows the Wi-Fi address (paired before Tailscale): Settings › Wi-Fi & Tailscale →
  pair again; the QR code carries both addresses.

## Smoothness (why taps could get lost)

Measured on the phone over adb (USB data cable), 24.11:

| | before | after |
|---|---|---|
| PhoneBox app process CPU | 100 % (one core, all day) | ~3 % |
| WebView renderer CPU | 93 % | ~3–7 % |
| night page, frames in 6 s | 362 (26 ms each) | 7 |
| «Главная» idle, frames in 6 s | 316 (19 ms each) | 12 |

The cost was frame drawing (RenderThread, the Mali driver, the Chrome GPU thread, Viz and Compositor), not JavaScript.
Every endless CSS animation or transition made the WebView draw 60 full frames a second, and this phone needs 19–26 ms
per frame, so it ran flat out. The rule for tiles is now: **no endless CSS animations and no transitions on things that
update every second**. Motion is stepped from a JS timer (one frame per step) or runs only for a few seconds after a
touch (perf guard `calm`). Measure with `adb shell dumpsys gfxinfo net.oxog.phonebox.deskpanel` (reset, wait 6 s, read).

The phone: Redmi A5 (25028RN03A), Android 15 **Go edition**, Unisoc UMS9230E, Mali GPU, 2.8 GB RAM, **no SIM card**.

Findings from the PhoneBox 0.9.29 sources (panel JS inside the agent, Android shell on GitHub) and the agent log:

- Over Wi-Fi the phone's live stream reconnects every 61 s by design; over USB it stays open.
- The panel counts only touches on its own document, never inside a tile's iframe, so a big tile (the screen, Tsuki)
  could send the panel to the night page mid-use. Every tile now calls `phonebox.goto(<its page>)` on a touch (at most
  every 15 s): it moves nothing, but resets the idle timer.
- The night page reacts on finger-down and goes home after 0.28 s (it used to wait for `click`, then 1.1 s, and ignored
  taps for 2.5 s).
- 24.11 12:00: «Выключить экран» and then «Калькулятор» twice ran on the laptop while the phone "did not react": taps
  were arriving while the phone was drawing frames at its limit, and the pinning panel (above) covered half the screen.

PhoneBox keeps every page mounted, and each HTML tile is its own sandboxed iframe. The Redmi A5's WebView repaints
SVG/CSS animations on the main thread, so ~20 endless animations on pages you were not looking at made taps late.
`apply.py` now puts a perf guard in front of every decorative tile: its animations freeze while it is off screen or the
app is hidden, and Tsuki / the Claude tile / the screen button also freeze after 30–40 s without a touch (the next touch
wakes them). The screen tile decodes frames off the main thread and stops streaming when it leaves the screen.

## If the remote stops connecting after a reboot

The Claude app runs as an MSIX package. Anything its terminal writes into `AppData` and HKCU goes to a hidden virtual
copy (`%LOCALAPPDATA%\Packages\Claude_…\LocalCache`). Windows doesn't see that copy at startup.

On 24.11 this broke PhoneBox: after a reboot it started without its settings. Fixed with `fix/migrate.ps1`: everything
was moved to the real folders.

- Check what's in the real folders: `fix/diag.ps1`. Run it from a **normal** PowerShell, not from the Claude app.
- Windows Firewall rules are tied to the `.exe` path. If PhoneBox moves, allow it again on port 8766.
- Don't reinstall the components from the Claude app's terminal. Use a normal PowerShell window, or start the script
  outside the container:
  `Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='powershell -ExecutionPolicy Bypass -File <full path>\install.ps1'}`
  (the log goes to `%USERPROFILE%\phoneremote-install.txt`).

## Undo / remove

- Screen server: delete `PhoneRemote Screen.lnk` from the Startup folder, the scheduled task
  (`Unregister-ScheduledTask 'PhoneRemote Keepalive'`) and the `%LOCALAPPDATA%\PhoneRemote` folder; `tailscale serve reset`.
- PhoneBox: `scripts/uninstall.ps1` from its repository, or Settings › Apps.
- The settings from before the latest `apply.py` run are in `%LOCALAPPDATA%\PhoneRemote\settings.backup.json`
  (kept out of this folder on purpose: they contain the Wi-Fi pairing key, and the Desktop syncs to OneDrive).
