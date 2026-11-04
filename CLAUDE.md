# Delilah's Vault

A 24/7 radio station at delilahsvault.com. GitHub Pages, static, no build step.

**The one principle: what plays is a pure function of the wall clock.** Nothing is
stored, nothing is random at runtime, so every listener hears the same thing at the
same moment. Any change that breaks that is wrong, however convenient.

## Code style

No comments in the source. Anything worth knowing goes in this file instead.
Gregor commits and pushes himself — leave changes in the working tree and say what
changed. Commit titles lowercase, no co-author trailers.

## Files

| | |
|---|---|
| `station.js` | the only file meant to be edited by hand — library, schedule, epoch |
| `app.js` | clock → what's on air; audio, picture, HUD, panel |
| `visuals.js` | the canvas behind the type |
| `index.html` | markup and all CSS |
| `serve.py` | dev server; exists only because `http.server` ignores Range and that breaks seeking |
| `fonts/` | the wordmark face |

## Things that will bite you

**Timers, never requestAnimationFrame, for anything the sound depends on.** People
leave this running in a background tab, and a hidden tab fires no rAF at all — track
and block changes would be missed until the tab was looked at again. A hidden tab
also delivers no ResizeObserver callbacks, which is why the title fit is repeated on
`visibilitychange`. Timers are throttled in the background but they keep firing.

**The mute lives in `master`, downstream of the analyser.** Graph is
`mix → analyser → master → destination`. Mute upstream and the visuals freeze, which
makes the page look broken.

**The gate is unconditional.** It shows on every visit and only a real click opens
it. Do not make it conditional on whether autoplay was blocked: browsers grant
autoplay to sites you've already used, so returning visitors would be dropped
straight into playing audio. The AudioContext stays suspended until the click;
everything else — clock, HUD, muted video — runs behind it, so the station really is
already in progress.

**Durations in `LIBRARY` must be accurate to the hundredth.** The entire broadcast
clock is built on them.

**`STATION.epoch` must never change once live.** The day counter is measured from it.

**Two `<video>` elements, and the outgoing one must be paused** once its fade is
done. Phones will not give us two decoders alongside the audio, and the one they drop
is the one on screen. `keepPicturePlaying()` exists because a clip stops for reasons
we never hear about — app switch, memory pressure, Low Power Mode — and `setVideo()`
returns early while the clip is unchanged, so without it a stopped clip sat frozen
for the rest of its 68 seconds.

**`setVideo()` is called from the interval, not only from `tuneTo()`.** `tuneTo()`
runs on track and block changes, so during a five-minute song the clip would never be
re-evaluated and would just loop.

**`curItem` is deliberately not reset on a block change.** Music is one continuous
rotation and carries straight across boundaries, exactly as the picture does.

**The tracklist renders the current cycle's order,** not the library's, so its
numbers match the counter. Rebuilt when the cycle turns.

## The loader

Shown over everything (z-index 20) until three real milestones land: the stencil
font, the first video clip, and the audio's metadata. It is not a timed animation —
the bar reflects what has actually arrived.

**Its wordmark is hardcoded in the HTML**, not set from `STATION.name`, because it
has to paint before any script runs. Change the station name and you change it in two
places.

Two things keep it from trapping anyone: every milestone also completes on that
resource's `error`, and a 6s timeout closes it regardless. `closeLoader()` is
idempotent, so whichever fires first wins. Verified with every audio and video path
404ing — it still cleared in about a second.

## Layout and type

**`fitTitle()` measures the container's width, never the title's own.** `.centre` is
a column flex with `align-items:flex-start`, so the heading is sized to its content —
reading its own width feeds the fitted size back in as the room available and
ratchets the type down on every call. That was the shrink-restore-shrink flicker on a
drag-resize. The `0.97` is because canvas `measureText` and real layout don't agree
to the pixel.

**`.centre` needs `min-height:0`.** Without it a tall title grows the `1fr` grid row
past its share and pushes the footer off the bottom — and the fit measures that row,
so it has to report an honest height.

**The masthead's `calc(100cqw / 8.26)`.** 8.26 is the advance width of
`DELILAH'S VAULT` in this face plus its tracking. **Recompute it if the station name
changes.** `line-height:.8` is 1 minus the face's descent, which puts the cap tops
exactly on the page margin. The `11vw` line above it is the fallback for browsers
without container units.

**The stencil is a logo font.** `fonts/VaultStencil-Regular.ttf` holds 13 glyphs:
space, apostrophe, and `A D E H I L S T U V` — exactly the letters of the station
name. No B, C, F, G, M, N, O, P, R, W, no digits. Never point `--mark` at anything
typed; any other word falls back mid-string. Replace the file with a full character
set before using it for track titles.

**`text-size-adjust:100%` is not optional.** In-app browsers (Instagram, Facebook)
inflate text past what the CSS asked for, the JS fit measures one size and the
browser draws another, and long words spill off the edge.

**Grain and vignette sit below the text layer** (`.stage` is z-index 3). Above it,
the vignette washes over the header and the grain's blend mottles every label.

**Safe-area padding on all four sides.** In landscape a notch eats the left or right
edge, which is where the clock and day counter live.

**Fullscreen is hidden until JS confirms support.** iOS Safari has no Fullscreen API
for non-video elements.

**The on-air lamp is the only colour on the page.** A pass that tinted everything
warm turned the whole thing yellow; the softness comes from the gradients and the
grain, not from a tint.

## Picture

Clips are from archive.org, listed with their licences in the schedule panel and the
README.

## SEO

`og:image` must be an absolute URL; every platform ignores a relative path, and the
filename is case-sensitive once GitHub Pages serves it. Search Console will report
"Page with redirect" for the http/www/github.io variants and "No thumbnail URL" for
the background clips — both are correct behaviour, nothing to fix.
