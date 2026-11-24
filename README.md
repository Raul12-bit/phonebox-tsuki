# PhoneBox × Tsuki

A Redmi A5 turned into a dedicated remote for a Windows laptop: a black-and-white manga-style PhoneBox layout with
Tsuki (ツキ), an original tsundere mascot who reacts to touches, the laptop and the time of day, remembers you, plays
rock-paper-scissors, runs a focus timer, and takes over the screen as a clock when nobody is around: busy with
something different every time by day, asleep from 20:00.

Everything lives in [`phonebox/`](phonebox/README.md); start with its README.

- `phonebox/apply.py` builds the pages and writes them into the PhoneBox agent (`--preview` renders every tile locally
  with sample data, `--dry-run` checks without saving).
- `phonebox/tiles/`: the HTML tiles; `tiles/lib/tsuki.js` is the character rig.
- `phonebox/screen-server/`: the laptop-screen server (also stores Tsuki's memory).
