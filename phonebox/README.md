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

An original tsundere mascot on «Главная» (`tiles/mascot.html`), with small copies of her on «Claude» and on the
«Экран ноутбука» button. She is drawn by one shared rig, `tiles/lib/tsuki.js` (see "Files").

**Touching her.** Where you touch matters:

| Where | What happens |
|---|---|
| Head (hold ½ s, or rub back and forth) | head pat: hearts, affection grows; after many pats in a row she "melts" |
| Head (short tap) | a light pat, «Эй! …Ну ладно.» |
| Ahoge (the hair antenna) | it springs (ピョン), she protests |
| Cheeks | ぷに: she puffs her cheeks |
| Ribbons / twin tails | she gets angry (and the tails jump) |
| Body | tickling: she laughs; four times in a row and she is angry |
| Eyes, nose | surprised |
| Empty space | she looks where you tapped |
| Six taps within 6 s | offended: affection −4, she ignores you for 15 s |

Her eyes follow your finger while it is on the tile.

**The dock** under her:

- **Еда**: strawberry (her favourite), pudding, onigiri, tea, chocolate («это что, признание?!»), green pepper
  (a crime). She takes it, eats it (もぐもぐ), then reacts by affection level. More than four in 10 minutes: «Я лопну!».
- **Подарок**: flower, gift box, plush bunny, manga, a love letter (spiral eyes), a rock. More than three in
  30 minutes makes her suspicious.
- **Игра**: rock-paper-scissors with a result card and a rematch button; the score is remembered.
- **Болтать**: one of 12 questions with two answers (her reaction depends on your answer), or a "fact".
- **Фокус**: a 25 / 50 minute focus timer and a 5 minute break. A pill on her tile counts down, she cheers you on,
  scolds you for poking her during focus, and counts the focus sessions of the day. The idle screen shows the
  countdown too (she studies with you).
- **Tap the hearts** (好感度) for her notebook: days together, pats, food, gifts, the rock-paper-scissors score,
  the visit streak, focus sessions today.

**Moods.** 26 faces (normal, tsun, angry, rage, shy, flustered, happy, love, smug, surprised, sad, cry, sleepy, yawn,
sleep, pout, wink, eat, think, determined, bored, pat, laugh, shock, read, focus) and 17 arm poses (crossed, hands on
hips, waving, peace sign, pointing, hands on cheeks, fists, holding, offering, poking fingers together, yawning,
stretching, thinking, a heart, ...).

**Affection** (好感度, 0–100, five hearts): pats, food, gifts and good answers raise it; spam gains less and less;
poking her too much, the pepper and some answers lower it; it fades slowly while you are away. Four levels change
what she says: tsun → cool → warm → dere.

**She notices things**: CPU, memory, GPU temperature, ping, downloads, the music playing (she hums along), Claude
limits, Claude Code waiting for your answer, rain / snow / cold from the weather, lunch time, late nights, weekends,
how long the laptop has been running, how long you were away (on «Главная» after the idle screen she greets you back,
sleepy at night), and the visit streak. Every hour she may ask whether you drank water.

**Memory.** Affection and stats are kept by the screen server (`/mem`, see "How the «Экран» page works") because
PhoneBox tiles are sandboxed iframes without `localStorage`. Without the screen server she still works and remembers
until the panel reloads (her notebook says so).

## The idle screen (Заставка)

`tiles/idle.html`, a full-screen page. It is the panel's `homePage`, so it turns on by itself after 5 minutes without
a touch (`IDLE_AFTER_SEC` in `apply.py`), with the phone's «Back» key, and with the button on the clock tile.
A tap: Tsuki reacts and the panel returns to «Главная» (the first touch is never swallowed: it reacts on finger-down).

- **Day** (07:00–20:00, `NIGHT_TO` / `NIGHT_FROM` in `apply.py`): a manga page of three panels. Clock and date;
  weather, sunset and «Цуки сейчас: …»; and a room scene with a window onto the Alatau. The window follows the real
  sunrise and sunset of the day (sun, sunset, or moon and stars after dark). The wall calendar and the wall clock show
  the real date and time.
  **Each time the screen opens she is doing something else** (never the same twice in a row): reading manga, tea,
  a handheld game, onigiri, music in headphones, drawing (she may show you a doodle of you), working at a laptop
  (with your laptop's real CPU and memory), watering a plant, knitting a scarf, scrolling her phone, petting Moti the
  cat, studying in glasses; stretching only in the morning, a nap at the desk only after lunch. Every half a minute
  or so she says something about it.
- **Night** (20:00–07:00): a dim clock under the stars, the moon, tomorrow's forecast, and Tsuki asleep in pyjamas and
  a night cap, one of three ways: hugging a pillow, asleep at her desk under the lamp, or on a futon under a blanket.
  Stars twinkle, now and then a shooting star, z's and a nose bubble, and she talks in her sleep (sweeter at high
  affection; after 1 a.m. she tells you to go to bed). The clock drifts a few pixels every minute.
- **20:00 with the screen on**: she yawns, says she is not sleepy at all, and falls asleep. At 07:00 the alarm wakes her.
- **Focus timer running**: the clock panel shows the countdown and a progress bar, and she studies with you.
- Dimming is **off** (`idleDimMin = 0`). It used to swallow the first touch (it only brightened the panel).
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

1. Главная: Tsuki, the anime clock (with today's daylight, sunrise to sunset, and the button to the idle screen:
   «заставка» by day, «おやすみ» at night), music, system
2. Пульт: wide trackpad with a key row under it (Esc, Tab, ⌫, Enter, Пуск, Alt+Tab), the «Экран ноутбука» button, dictation, volume
3. Экран
4. Приложения: apps, and the «Питание» tile (`tiles/power.html`): tap = lock / screen off, hold 1.1 s = sleep / restart /
   shutdown (shortcuts `pw-*` in `apply.py`; sleep is real S3, not hibernation)
5. Клавиши
6. Система
7. Claude
8. Музыка
9. Процессы
10. Заставка: the idle screen (above); not reached by swiping on purpose, it comes up by itself

The phone starts on «Главная»; after 5 minutes without a touch it shows the idle screen.

## Files

- `apply.py` builds every page and button and writes them into PhoneBox. Run it again after edits:
  `python -I -X utf8 phonebox/apply.py` (check without saving: `--dry-run`).
  - `NIGHT_FROM` / `NIGHT_TO` (20:00 / 07:00) and `IDLE_AFTER_SEC` (300) at the top set the idle screen.
  - `--preview` writes every tile, assembled exactly as the phone gets it but fed with sample data, to
    `phonebox/preview/` (git-ignored). No agent needed. Open `preview/index.html`; on a tile's URL, `?t=21:30` sets
    the time, `?act=read` (or `futon`, `desk`, `hug`, ...) picks the idle scene, `?focus=18` fakes a running focus
    timer. `preview/rig.html` shows every mood, pose and prop of the rig on one page.
- `tiles/lib/tsuki.js`: the Tsuki rig, shared by the Главная tile and the idle screen (`apply.py` inlines it where a
  tile says `__INCLUDE_TSUKI__`, because a sandboxed tile cannot load a script file). Expressions are slots (eyes,
  mouth, brows, blush, effects) switched by attributes; each arm is a tube shoulder → elbow → hand, so a pose is two
  pairs of points; held props follow the hand. Nothing in it animates by itself.
- `tiles/*.html` are your own black-and-white tiles (Custom HTML widgets):
  - `sys-strip.html`: CPU / GPU / memory / network
  - `sys-chart.html`: chart
  - `sys-details.html`: laptop details
  - `claude-quota.html`: Claude limits
  - `mascot.html`: Tsuki on «Главная» (touch zones, the dock, memory)
  - `idle.html`: the idle screen (day activities, night, focus)
  - `anime-clock.html`: clock with kanji, daylight and weather
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
  `/down`, `/up`, `/scroll?d`, `/hscroll?d`, `/key?c=ctrl+shift+t`, `/type?s=text`, and Tsuki's memory:
  `/mem` (read) and `/mem?set={json}` (one JSON object, at most 4096 characters, written atomically to
  `%LOCALAPPDATA%\PhoneRemote\tsuki-memory.json`). After changing `ScreenServer.cs`, run `install.ps1` again (from a
  normal PowerShell, or through `Invoke-CimMethod Win32_Process` from the Claude app; see the last section).
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

### The Tsuki redesign (24.11, evening): measured A/B on the phone

Same protocol for both versions: apply, wait 25 s, `/api/goto/<page>` on the agent, wait (6 s, or 70 s for "no touch"),
then CPU from `/proc/<pid>/stat` over 12–20 s and frames from `gfxinfo`. "Before" is commit `ce6d7c3` applied again.

| Page | before (app + renderer CPU, frames) | after |
|---|---|---|
| Клавиши (nothing animated; the baseline) | 3.8 % + 5.6 % | 3.1 % + 5.3 % |
| «Главная», 6 s after opening | 81 % + 71 %, 558 frames / 12 s | 24 % + 20 %, 114 frames / 12 s |
| «Главная», 70 s without a touch | 34 % + 23 %, 219 frames / 20 s | 20 % + 16 %, 137 frames / 20 s |
| Night (old night page / new idle screen, desk scene) | 9 % + 13 %, 4 frames, 81 ms median | 12 % + 14 %, 13 frames, 27 ms median |

What keeps the new screens cheap:

- Tsuki has no endless animation at all: blinks, glances and head tilts are single attribute swaps on a timer; the
  CSS animations (bubble pop, katakana, hearts, the ahoge spring) run only right after a touch. Lines she says on her
  own (nobody touched her for a minute) appear in one repaint, without typing or effects.
- The idle screen gives every part that changes on its own a compositing layer (`will-change`): the scenery with its
  patterns and masks is rasterised once, a twinkling star repaints the star layer only, a pose the character layer.
  Chrome on Android rasterises a layer in full-width strips, so with one shared layer every step redrew the masks
  and Tsuki's outlines in that strip: 105 ms per step (median), now 27 ms. At night steps alternate between the
  star layer and her z's; she no longer "breathes" by moving her whole body.

The phone: Redmi A5 (25028RN03A), Android 15 **Go edition**, Unisoc UMS9230E, Mali GPU, 2.8 GB RAM, **no SIM card**.

Findings from the PhoneBox 0.9.29 sources (panel JS inside the agent, Android shell on GitHub) and the agent log:

- Over Wi-Fi the phone's live stream reconnects every 61 s by design; over USB it stays open.
- The panel counts only touches on its own document, never inside a tile's iframe, so a big tile (the screen, Tsuki)
  could send the panel to the idle page mid-use. Every tile now calls `phonebox.goto(<its page>)` on a touch (at most
  every 15 s): it moves nothing, but resets the idle timer.
- The idle page reacts on finger-down and goes home after 0.28 s (the old night page used to wait for `click`, then
  1.1 s, and ignored taps for 2.5 s).
- 24.11 12:00: «Выключить экран» and then «Калькулятор» twice ran on the laptop while the phone "did not react": taps
  were arriving while the phone was drawing frames at its limit, and the pinning panel (above) covered half the screen.

PhoneBox keeps every page mounted, and each HTML tile is its own sandboxed iframe. The Redmi A5's WebView repaints
SVG/CSS animations on the main thread, so ~20 endless animations on pages you were not looking at made taps late.
`apply.py` now puts a perf guard in front of every decorative tile: its animations freeze while it is off screen or the
app is hidden, and the Claude tile / the screen button also freeze a few seconds after the last touch (the next touch
wakes them). Tsuki and the idle screen have no endless animations, so the guard only stops them off screen. The screen tile decodes frames off the main thread and stops streaming when it leaves the screen.

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
