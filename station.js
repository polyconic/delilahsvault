/* ==================================================================
   THE STATION

   Everything the broadcast is, declared in one place.

   The whole schedule is a pure function of the clock: given a moment
   in time, exactly one thing is on air, and it's the same thing for
   everyone. Nothing is stored, nothing is random at runtime.
   ================================================================== */

const STATION = {
  name:  "DELILAH'S VAULT",     // shown on the page
  title: "Delilah's Vault",     // browser tab

  // The station keeps its own time. Offset in hours from UTC.
  // Change this and the whole day's programming shifts with it.
  tzOffset: 0,
  tzLabel:  "STATION TIME",

  // Never change once live — the day counter is measured from here.
  // Set so today reads Day 2; it climbs by one every real day from now on.
  epoch: 1787875200,            // 2026-08-28 00:00:00 UTC
};


/* ---------- the library -------------------------------------------
   One entry per piece of audio. `duration` in SECONDS and it must be
   accurate — the entire broadcast clock is built on these numbers.
   ------------------------------------------------------------------ */
const LIBRARY = {
  // ---- Manormouse, "Never Fully Recovered EP" (Bruno Tozzini)
  //      archive.org · CC BY-NC-SA 3.0 · attribution required ----
  floor13:       { title:"13TH FLOOR",    by:"Manormouse",
                   file:"audio/floor13.m4a",       duration:262.79 },
  superstitious: { title:"SUPERSTITIOUS", by:"Manormouse",
                   file:"audio/superstitious.m4a", duration:181.39 },
  highstate:     { title:"HIGH STATE",    by:"Manormouse",
                   file:"audio/highstate.m4a",     duration:196.23 },
  shoot:         { title:"SHOOT",         by:"Manormouse",
                   file:"audio/shoot.m4a",         duration:240.07 },
  lowonice:      { title:"LOW ON ICE",    by:"Manormouse",
                   file:"audio/lowonice.m4a",      duration:296.52 },
};


/* ---------- the picture -------------------------------------------
   Short muted loops, greyscaled by the page. One clip holds the screen
   for three minutes, then the next. Encoded with no audio track and no
   chroma, so a whole evening of picture costs less than one song.

   Sourced from archive.org. Licences differ — CC / public domain ones
   are safe to broadcast publicly; the ones marked (unstated) are fine
   locally but worth checking before this points at a real domain.
   ------------------------------------------------------------------ */
const FOOTAGE = {
  // Introduction to the Cathode Ray Oscilloscope        (unstated)
  cro:        ["video/cro1.mp4", "video/cro2.mp4", "video/cro3.mp4"],
  // The many faces of a Torus, oscilloscope             (CC BY 3.0)
  torus:      ["video/torus1.mp4", "video/torus2.mp4"],
  // Learning About Sound, 2nd Ed        (courtesy Enc. Britannica)
  sound:      ["video/sound1.mp4", "video/sound2.mp4", "video/sound3.mp4"],
  // Manormouse — Never Fully Recovered EP          (CC BY-NC-SA 3.0)
  manormouse: ["video/manormouse1.mp4", "video/manormouse2.mp4"],
  // Freedom Highway, 1956                           (public domain)
  highway:    ["video/highway1.mp4", "video/highway2.mp4"],
  // The PIRATE UTOPIA Experiments                  (CC BY-NC-SA 3.0)
  pirate:     ["video/pirate1.mp4", "video/pirate2.mp4"],
  // Welcome To Cyberia                                   (unstated)
  cyberia:    ["video/cyberia1.mp4", "video/cyberia2.mp4", "video/cyberia3.mp4"],
};

const mix = (...keys) => keys.flatMap(k => FOOTAGE[k] || []);


/* ---------- the day -----------------------------------------------
   Blocks run from their `start` hour until the next block begins.
   Must be sorted, and the first must start at 0.

   mode: "playlist"    — plays files from `items`
         "generative"  — synthesized live in the browser, never repeats
   visual: which canvas mode paints behind it
   ------------------------------------------------------------------ */
const SCHEDULE = [
  {
    start: 0,
    name:  "NIGHT SHIFT",
    note:  "uninterrupted, for those still awake",
    mode:  "playlist",
    visual:"spectrum",
    video: mix('cyberia','pirate'),
    items: [LIBRARY.lowonice, LIBRARY.shoot, LIBRARY.floor13],
  },
  {
    start: 4,
    name:  "CARRIER",
    note:  "the signal, unattended",
    mode:  "generative",
    preset:"carrier",
    visual:"testcard",
    video: mix('cro','torus'),
  },
  {
    start: 6,
    name:  "FIRST LIGHT",
    note:  "slow music for an empty hour",
    mode:  "generative",
    preset:"firstlight",
    visual:"horizon",
    video: mix('highway','sound'),
  },
  {
    start: 10,
    name:  "DAY SERVICE",
    note:  "from the archive",
    mode:  "playlist",
    visual:"drift",
    video: mix('sound','highway'),
    items: [LIBRARY.floor13, LIBRARY.superstitious, LIBRARY.highstate,
            LIBRARY.shoot, LIBRARY.lowonice],
  },
  {
    start: 15,
    name:  "INTERVAL",
    note:  "nothing is scheduled",
    mode:  "generative",
    preset:"interval",
    visual:"testcard",
    video: mix('torus','cro'),
  },
  {
    start: 17,
    name:  "THE LONG EVENING",
    note:  "",
    mode:  "playlist",
    visual:"horizon",
    video: mix('pirate','manormouse'),
    items: [LIBRARY.highstate, LIBRARY.lowonice,
            LIBRARY.superstitious, LIBRARY.floor13],
  },
  {
    start: 21,
    name:  "LATE TRANSMISSION",
    note:  "louder as it gets later",
    mode:  "playlist",
    visual:"spectrum",
    video: mix('cyberia','manormouse'),
    items: [LIBRARY.shoot, LIBRARY.floor13, LIBRARY.lowonice],
  },
];


/* ---------- idents -------------------------------------------------
   Shown briefly between items. Chosen by the clock, so everyone sees
   the same one at the same moment.
   ------------------------------------------------------------------ */
const IDENTS = [
  "you are listening to a station that does not know you are there",
  "this has been playing for some time",
  "no announcer will be joining us",
  "the transmitter is in a room with the door closed",
  "recorded somewhere, played back here",
  "if you can hear this, the signal reached further than intended",
  "there is no schedule beyond the one already running",
  "we will not be taking requests",
  "the next item follows without pause",
  "nothing here is live except the clock",
];
