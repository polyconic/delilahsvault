# Delilah's Vault

A stream in perpetuity.

Just static files, but it behaves like a real 24-hour station. There's no play button and no track
list to browse. You just arrive, and whatever's on is already in progress,
the same for every listener at that moment. 

The station keeps Chicago's clock, daylight saving included. Music runs
as a rotation through the catalogue, reshuffled every time it has been
all the way round, so the set repeats but the running order never does.

The day is split into blocks:

| from  | block             | vibe    |
|-------|-------------------|---------|
| 00:00 | NIGHT SHIFT       |         |
| 07:00 | CARRIER           | morning |
| 09:00 | FIRST LIGHT       | morning |
| 11:00 | DAY SERVICE       |         |
| 17:00 | THE LONG EVENING  | evening |
| 21:00 | LATE TRANSMISSION |         |

Blocks set the name on screen, the note under it, and which background
visual is painted. What they mostly don't do is choose tracks.

The exception is **vibe**. A track tagged `morning` or `evening` in
`LIBRARY` only joins the rotation during hours carrying the same tag, so
THE EVENING can't turn up at nine in the morning and BREAKFAST IN THE
MORNING can't close the night. Everything untagged plays at any hour.

That means the pool isn't the same all day, so the rotation runs in
stretches rather than one endless loop. Neighbouring blocks wanting the
same tracks merge into one stretch — including across midnight, so LATE
TRANSMISSION runs into NIGHT SHIFT without the music restarting:

| stretch       | pool | length |
|---------------|------|--------|
| 07:00–11:00   | 32   | 77m    |
| 11:00–17:00   | 28   | 67m    |
| 17:00–21:00   | 29   | 69m    |
| 21:00–07:00   | 28   | 67m    |

## Running it locally

```bash
python3 serve.py
```

Then open <http://localhost:4747>.

Don't just open `index.html` directly — Python's plain built-in server
breaks audio seeking, and this script fixes that so local testing behaves
like the real site.

## Deploying

It's static so no build step, no backend, and no environment variables.
Point any static host at the repo and it works. Currently deployed on
GitHub Pages.

## Adding or changing tracks

Everything you'd normally touch lives in one file: [`station.js`](station.js).

- `LIBRARY` — one entry per track (title, audio file, exact length in
  seconds, and optionally `vibe`)
- `ROTATION` — every track in `LIBRARY`, as one pool
- `SCHEDULE` — the day's blocks (name, note, visual, vibes)
- `FOOTAGE` — the background video clips

To add a track: drop the audio file in `audio/` and add one line to
`LIBRARY`. It joins the rotation on its own — there's nothing to schedule.

The `duration` must be accurate to a fraction of a second. The whole
broadcast clock is built on those numbers, so a wrong one puts every
listener out of step with the audio.

`tools/fetch_footage.py` is a helper for pulling new video clips from
archive.org without downloading the full source file.

## Files

| | |
|---|---|
| `index.html` | the page — layout and all styling |
| `station.js` | the file you actually edit |
| `app.js` | the clock logic, audio, and on-screen display |
| `visuals.js` | the background visual effects |
| `serve.py` | local preview server only — not used in production |

## Credits

Music is Gregor's own work from 2020 to 2023. Background video is short muted clips from archive.org:

| source | licence |
|---|---|
| Manormouse — video excerpt | Bruno Tozzini · CC BY-NC-SA 3.0 |
| The many faces of a Torus | CC BY 3.0 |
| The PIRATE UTOPIA Experiments — Vivid Tribe Of Psychics | CC BY-NC-SA 3.0 |
| Freedom Highway (1956) | public domain |
| Introduction to the Cathode Ray Oscilloscope | not stated |
| Learning About Sound (2nd Ed) | courtesy Encyclopedia Britannica |
| Welcome To Cyberia | not stated |
