# Delilah's Vault

A radio station that's always live: delilahsvault.com

It's a website, not an app or a stream server — just static files — but it
behaves like a real 24-hour station. There's no play button and no track
list to browse. You just arrive, and whatever's on is already in progress,
the same for every listener at that moment, because what plays is worked out
from the current time rather than stored anywhere.

The station keeps its own clock (not the visitor's local time), and the day
is split into blocks that each sound and look different:

| from  | block             | what plays          |
|-------|-------------------|----------------------|
| 00:00 | NIGHT SHIFT       | music                |
| 07:00 | CARRIER           | generated live       |
| 09:00 | FIRST LIGHT       | generated live       |
| 11:00 | DAY SERVICE       | music                |
| 17:00 | THE LONG EVENING  | music                |
| 21:00 | LATE TRANSMISSION | music                |

The **generated live** blocks aren't audio files at all — they're built in
the browser out of oscillators and noise while you listen, and have never
played before. They're still perfectly in sync for everyone: the sound is
driven by a formula seeded from the clock, so two people tuned in at the
same moment hear the exact same thing, even though it's being made up on
the spot.

## Running it locally

```bash
python3 serve.py
```

Then open <http://localhost:4747>.

Don't just open `index.html` directly — Python's plain built-in server
breaks audio seeking, and this script fixes that so local testing behaves
like the real site.

## Deploying

It's entirely static — no build step, no backend, no environment variables.
Point any static host at the repo and it works. Currently deployed on
GitHub Pages.

## Adding or changing tracks

Everything you'd normally touch lives in one file: [`station.js`](station.js).

- `LIBRARY` — one entry per track (title, audio file, exact length in seconds)
- `SCHEDULE` — the day's blocks and what each one plays
- `FOOTAGE` — the background video clips
- `IDENTS` — the little lines that flash between tracks

To add a track: drop the audio file in `audio/`, add one line to `LIBRARY`,
then list it in a block's `items` in `SCHEDULE`.

`tools/fetch_footage.py` is a helper for pulling new video clips from
archive.org without downloading the full source file.

## Files

| | |
|---|---|
| `index.html` | the page — layout and all styling |
| `station.js` | the file you actually edit |
| `app.js` | the clock logic, audio, and on-screen display |
| `synth.js` | the generated-live blocks |
| `visuals.js` | the background visual effects |
| `serve.py` | local preview server only — not used in production |

## Credits

Music is Greg's own. Background video is short muted clips from archive.org:

| source | licence |
|---|---|
| Manormouse — video excerpt | Bruno Tozzini · CC BY-NC-SA 3.0 |
| The many faces of a Torus | CC BY 3.0 |
| The PIRATE UTOPIA Experiments — Vivid Tribe Of Psychics | CC BY-NC-SA 3.0 |
| Freedom Highway (1956) | public domain |
| Introduction to the Cathode Ray Oscilloscope | not stated |
| Learning About Sound (2nd Ed) | courtesy Encyclopedia Britannica |
| Welcome To Cyberia | not stated |
