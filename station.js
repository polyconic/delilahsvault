const STATION = {
  name:  "DELILAH'S VAULT",
  title: "Delilah's Vault",

  tz: "America/Chicago",

  epoch: 1787875200,
};

const LIBRARY = {

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
                        file:"audio/breakfastinthemorning.m4a",   duration:65.43 },
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

const FOOTAGE = {

  cro:        ["video/cro1.mp4", "video/cro2.mp4", "video/cro3.mp4"],

  torus:      ["video/torus1.mp4", "video/torus2.mp4"],

  sound:      ["video/sound1.mp4", "video/sound2.mp4", "video/sound3.mp4"],

  manormouse: ["video/manormouse1.mp4", "video/manormouse2.mp4"],

  highway:    ["video/highway1.mp4", "video/highway2.mp4"],

  pirate:     ["video/pirate1.mp4", "video/pirate2.mp4"],

  cyberia:    ["video/cyberia1.mp4", "video/cyberia2.mp4", "video/cyberia3.mp4"],
};

const ALL_FOOTAGE = Object.values(FOOTAGE).flat();

const ROTATION = Object.values(LIBRARY);

const SCHEDULE = [
  {
    start: 0,
    name:  "NIGHT SHIFT",
    note:  "uninterrupted, for those still awake",
    visual:"ember",
  },
  {
    start: 7,
    name:  "CARRIER",
    note:  "the signal, unattended",
    visual:"drift",
  },
  {
    start: 9,
    name:  "FIRST LIGHT",
    note:  "slow music for an empty hour",
    visual:"horizon",
  },
  {
    start: 11,
    name:  "DAY SERVICE",
    note:  "",
    visual:"drift",
  },
  {
    start: 17,
    name:  "THE LONG EVENING",
    note:  "",
    visual:"horizon",
  },
  {
    start: 21,
    name:  "LATE TRANSMISSION",
    note:  "louder as it gets later",
    visual:"ember",
  },
];
