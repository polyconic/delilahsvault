# Delilah's Vault

A station that is always on. Playing drones and strange footage. It's like treasure.

What plays is a pure function of the clock so everyone who arrives at the same moment hears the same
thing, already in progress.

The station keeps its own time zone rather than the visitor's, and the day is
divided into blocks that each sound and look different.

| from  | block             | source        |
|-------|-------------------|---------------|
| 00:00 | NIGHT SHIFT       | recorded      |
| 04:00 | CARRIER           | generated     |
| 06:00 | FIRST LIGHT       | generated     |
| 10:00 | DAY SERVICE       | recorded      |
| 15:00 | INTERVAL          | generated     |
| 17:00 | THE LONG EVENING  | recorded      |
| 21:00 | LATE TRANSMISSION | recorded      |

Blocks marked **generated** are not files. They are synthesized in the browser
as you listen, from oscillators and noise, and have never played before. They
are still a broadcast: every audible decision comes from a clock-seeded PRNG,
so two people listening at 04:00 hear the same drone.

## Running it locally

```bash
python3 serve.py
```

Then open <http://localhost:4747>.

Use this rather than opening `index.html` directly. Python's built-in
`http.server` ignores HTTP Range requests, which silently breaks seeking —
the clock says 03:12 while the audio sits at 00:09. `serve.py` answers ranges
properly and sends correct MIME types. Every real static host already does
both, so this script only exists to make local preview behave like production.

## Deploying

It is entirely static. Point any static host at the repository root — no build
step, no server, no environment variables.

## Adding to the station

Everything editable lives in [`station.js`](station.js):

- `STATION` — name, time zone, epoch
- `LIBRARY` — one entry per track. `duration` is in **seconds and must be
  accurate**; the whole broadcast clock is built on those numbers.
- `SCHEDULE` — the day. Each block runs until the next one starts.
- `FOOTAGE` — the video loops
- `IDENTS` — the lines that surface between items

To add a track: put the file in `audio/`, add a line to `LIBRARY`, reference it
from a block's `items`.

`tools/fetch_footage.py` pulls new clips from archive.org. It never downloads a
source whole — ffmpeg seeks over HTTP, so a 4 GB film costs only the seconds
actually kept.

## Files

| | |
|---|---|
| `index.html` | markup and all styling |
| `station.js` | **the only file you normally edit** |
| `app.js` | clock, schedule resolution, audio graph, HUD |
| `synth.js` | the generative blocks |
| `visuals.js` | the four canvas modes |
| `serve.py` | local preview server |

## Credits

The recorded music is **Manormouse — _Never Fully Recovered EP_** by Bruno
Tozzini, from archive.org, under
[CC BY-NC-SA 3.0](http://creativecommons.org/licenses/by-nc-sa/3.0/). The
credit is shown on screen during playback because that licence requires it.

Video loops, all from archive.org:

| source | licence |
|---|---|
| The many faces of a Torus | CC BY 3.0 |
| The PIRATE UTOPIA Experiments — Vivid Tribe Of Psychics | CC BY-NC-SA 3.0 |
| Freedom Highway (1956) | public domain |
| Introduction to the Cathode Ray Oscilloscope | not stated |
| Learning About Sound (2nd Ed) | courtesy Encyclopedia Britannica |
| Welcome To Cyberia | not stated |
