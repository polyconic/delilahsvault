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

  // The station broadcasts from Reykjavik, Iceland — which is UTC+0
  // year-round (no DST observed), so this offset happens to be 0. If
  // Iceland ever changes that, this is the only number to touch.
  // Change it and the whole day's programming shifts with it.
  tzOffset: 0,

  // Never change once live — the day counter is measured from here.
  // Set so today reads Day 2; it climbs by one every real day from now on.
  epoch: 1787875200,            // 2026-08-28 00:00:00 UTC
};


/* ---------- the library -------------------------------------------
   One entry per piece of audio. `duration` in SECONDS and it must be
   accurate — the entire broadcast clock is built on these numbers.
   ------------------------------------------------------------------ */
const LIBRARY = {
  // Greg's own back-catalogue — no licence to track, no attribution needed.
  metaphysics:        { title:"METAPHYSICS",
                        file:"audio/metaphysics.m4a",            duration:316.07 },
  ethereal:           { title:"ETHEREAL",
                        file:"audio/ethereal.m4a",                duration:134.12 },
  noforest:           { title:"NO FOREST",
                        file:"audio/noforest.m4a",                duration:314.05 },
  beautifulview:      { title:"BEAUTIFUL VIEW",
                        file:"audio/beautifulview.m4a",           duration:194.05 },
  avillainnarrative:  { title:"A VILLAIN NARRATIVE",
                        file:"audio/avillainnarrative.m4a",       duration:206.05 },
  usandvoyager:       { title:"US & VOYAGER",
                        file:"audio/usandvoyager.m4a",            duration:140.06 },
  theevening:         { title:"THE EVENING",
                        file:"audio/theevening.m4a",              duration:105.07 },
  parallelearthcycle: { title:"PARALLEL EARTH CYCLE",
                        file:"audio/parallelearthcycle.m4a",      duration:116.05 },
  interstellar:       { title:"INTERSTELLAR!",
                        file:"audio/interstellar.m4a",            duration:236.05 },
  leavingearth:       { title:"LEAVING EARTH",
                        file:"audio/leavingearth.m4a",            duration:212.07 },
  hypotheticalpoint:  { title:"A HYPOTHETICAL POINT IN TIME",
                        file:"audio/ahypotheticalpointintime.m4a",duration:64.11  },
  avillainconclusion: { title:"A VILLAIN CONCLUSION",
                        file:"audio/avillainconclusion.m4a",      duration:234.06 },
  artificialinterlude:{ title:"ARTIFICIAL (INTERLUDE)",
                        file:"audio/artificialinterlude.m4a",     duration:34.11  },
  byansel:            { title:"BY ANSEL",
                        file:"audio/byansel.m4a",                 duration:102.10 },
  electronicmontage:  { title:"ELECTRONIC MONTAGE INTRO",
                        file:"audio/electronicmontageintro.m4a",  duration:74.05  },
  forgottenentity:    { title:"FORGOTTEN ENTITY FOUND AGAIN",
                        file:"audio/forgottenentityfoundagain.m4a",duration:70.10 },
  howcanthey:         { title:"HOW CAN THEY EXPLAIN US",
                        file:"audio/howcantheyexplainus.m4a",     duration:130.10 },
  introwaveorian:     { title:"INTRO TO THE WAVEORIAN",
                        file:"audio/introtothewaveorian.m4a",     duration:50.13  },
  foundupintheair:    { title:"IT IS FOUND UP IN THE AIR",
                        file:"audio/itisfoundupintheair.m4a",     duration:120.12 },
  lyricalhappiness:   { title:"LYRICAL HAPPINESS",
                        file:"audio/lyricalhappiness.m4a",        duration:102.10 },
  memorable:          { title:"MEMORABLE",
                        file:"audio/memorable.m4a",               duration:264.06 },
  relevance:          { title:"RELEVANCE & RELATIVITY",
                        file:"audio/relevanceandrelativity.m4a",  duration:118.12 },
  somethingspecial:   { title:"SOMETHING SPECIAL",
                        file:"audio/somethingspecial.m4a",        duration:141.60 },
  todayisnotless:     { title:"TODAY IS NOT LESS TIME",
                        file:"audio/todayisnotlesstime.m4a",      duration:38.10  },
  wavorian:           { title:"WAVORIAN",
                        file:"audio/wavorian.m4a",                duration:133.12 },
  lovedithere:        { title:"YOU WOULD HAVE LOVED IT HERE",
                        file:"audio/youwouldhavelovedithere.m4a", duration:200.06 },

  argyreianervosa:    { title:"ARGYREIA NERVOSA",
                        file:"audio/argyreianervosa.m4a",         duration:102.10 },
  breakfast:          { title:"BREAKFAST IN THE MORNING",
                        file:"audio/breakfastinthemorning.m4a",   duration:65.43  },
  jamwithjacques:     { title:"JAM WITH JACQUES, PT 2",
                        file:"audio/jamwithjacques2.m4a",         duration:117.08 },
  evidently:          { title:"EVIDENTLY BY UNDERSTANDING",
                        file:"audio/evidentlybyunderstanding.m4a",duration:110.11 },
  futuresequoia:      { title:"FUTURE SEQUOIA",
                        file:"audio/futuresequoia.m4a",           duration:112.11 },
  inacontinuation:    { title:"IN A CONTINUATION",
                        file:"audio/inacontinuation.m4a",         duration:122.11 },
  prairie:            { title:"WALKING THROUGH A PRAIRIE IN AN ENDING THUNDERSTORM",
                        file:"audio/walkingthroughaprairie.m4a",  duration:264.06 },
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

/* Every clip, as one pool. The picture is deliberately NOT tied to the
   schedule — it runs as a single continuous rotation that carries on
   across block boundaries, reshuffled each time it has been through the
   whole set, so the order is never the same twice. */
const ALL_FOOTAGE = Object.values(FOOTAGE).flat();


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
    // deep, mysterious — the tracks that read as "late and alone"
    items: [LIBRARY.metaphysics, LIBRARY.argyreianervosa, LIBRARY.wavorian,
            LIBRARY.inacontinuation, LIBRARY.forgottenentity,
            LIBRARY.artificialinterlude, LIBRARY.jamwithjacques,
            LIBRARY.byansel, LIBRARY.introwaveorian],
  },
  {
    // 07:00–11:00 UTC is the one window that's genuinely nighttime in
    // every continental US timezone at once (11pm–6am local, worked out
    // across all four zones) — that's who's actually listening, so the
    // generative hours live here rather than on Iceland's own clock.
    start: 7,
    name:  "CARRIER",
    note:  "the signal, unattended",
    mode:  "generative",
    preset:"carrier",
    visual:"testcard",
  },
  {
    start: 9,
    name:  "FIRST LIGHT",
    note:  "slow music for an empty hour",
    mode:  "generative",
    preset:"firstlight",
    visual:"horizon",
  },
  {
    // absorbs what used to be the INTERVAL slot (15:00–17:00) — that sat
    // at 10am–noon Eastern / 7–9am Pacific, i.e. the middle of the US
    // workday, which is the worst possible time to have nothing playing.
    start: 11,
    name:  "DAY SERVICE",
    note:  "",
    mode:  "playlist",
    visual:"drift",
    // calm, open, unhurried — the daytime tracks
    items: [LIBRARY.ethereal, LIBRARY.noforest, LIBRARY.breakfast,
            LIBRARY.beautifulview, LIBRARY.hypotheticalpoint,
            LIBRARY.futuresequoia, LIBRARY.electronicmontage,
            LIBRARY.relevance, LIBRARY.todayisnotless],
  },
  {
    start: 17,
    name:  "THE LONG EVENING",
    note:  "",
    mode:  "playlist",
    visual:"horizon",
    // reflective, warm, a little wistful — the tracks that read as dusk
    items: [LIBRARY.theevening, LIBRARY.leavingearth, LIBRARY.lovedithere,
            LIBRARY.prairie, LIBRARY.parallelearthcycle, LIBRARY.memorable,
            LIBRARY.foundupintheair, LIBRARY.lyricalhappiness],
  },
  {
    start: 21,
    name:  "LATE TRANSMISSION",
    note:  "louder as it gets later",
    mode:  "playlist",
    visual:"spectrum",
    // dramatic, propulsive — builds toward the night
    items: [LIBRARY.avillainnarrative, LIBRARY.avillainconclusion,
            LIBRARY.usandvoyager, LIBRARY.evidently, LIBRARY.interstellar,
            LIBRARY.howcanthey, LIBRARY.somethingspecial],
  },
];
