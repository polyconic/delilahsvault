/* ==================================================================
   GENERATIVE BLOCKS

   Audio that isn't a file. Built live in the browser, so it never
   repeats and costs nothing to serve.

   The hard requirement: it must be the SAME for everyone. A station
   where two listeners hear different things at the same moment isn't
   a broadcast. So every audible decision is derived from the wall
   clock — never from Math.random() and never from ctx.currentTime,
   which starts whenever a given listener happened to arrive.

   Oscillator phase can't be aligned across machines, but everything
   perceptible — which notes, when events fire, how the timbre moves —
   is a pure function of station time.
   ================================================================== */

const Synth = (function(){

  let ctx, out, master;
  let voices = [];          // running oscillator/gain pairs
  let preset = null;
  let lastEvent = -1;

  /* deterministic PRNG — same seed, same sequence, everywhere */
  function rng(seed){
    return function(){
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* a small reverb, no impulse file needed */
  function makeReverb(seconds, decay){
    const rate = ctx.sampleRate;
    const len  = Math.floor(rate*seconds);
    const buf  = ctx.createBuffer(2, len, rate);
    for(let c=0;c<2;c++){
      const ch = buf.getChannelData(c);
      for(let i=0;i<len;i++){
        ch[i] = (Math.random()*2-1) * Math.pow(1 - i/len, decay);
      }
    }
    const cv = ctx.createConvolver();
    cv.buffer = buf;
    return cv;
  }

  function osc(type, freq, gain, dest){
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0;
    o.connect(g); g.connect(dest || master);
    o.start();
    // fade in so nothing clicks
    g.gain.setTargetAtTime(gain, ctx.currentTime, 3.5);
    voices.push({o, g});
    return {o, g};
  }

  function noiseBed(gain, dest){
    const len = ctx.sampleRate*4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch  = buf.getChannelData(0);
    for(let i=0;i<len;i++) ch[i] = Math.random()*2-1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 620; flt.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(flt); flt.connect(g); g.connect(dest || master);
    src.start();
    g.gain.setTargetAtTime(gain, ctx.currentTime, 4);
    voices.push({o:src, g, flt});
    return {src, g, flt};
  }

  /* a single struck tone that decays away */
  function ping(freq, dur, level, dest){
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0+dur+0.1);
  }

  /* ---------------- presets ------------------------------------- */

  const PRESETS = {

    /* 04:00 — a carrier left running. low, patient, with a tone that
       marks time every twelve seconds like a station identifying
       itself to nobody. */
    carrier: {
      every: 12,
      build(verb){
        osc('sine',      55,   0.16);
        osc('sine',      82.5, 0.07);
        osc('triangle', 110,   0.03, verb);
        noiseBed(0.014, verb);
      },
      event(i, verb){
        const r = rng(i*2654435761);
        if(r() < 0.28) return;                     // sometimes it says nothing
        const scale = [220, 247, 262, 294, 330, 392];
        const f = scale[Math.floor(r()*scale.length)];
        ping(f, 2.6, 0.10, verb);
        if(r() < 0.3) setTimeout(()=>ping(f*1.5, 2.0, 0.06, verb), 420);
      },
      move(t){
        // slow filter drift, identical on every machine
        return 0.5 + 0.5*Math.sin(t*0.013);
      }
    },

    /* 06:00 — a chord that turns over very slowly, with the occasional
       high bell. meant to be almost not there. */
    firstlight: {
      every: 21,
      build(verb){
        [110, 165, 220, 277, 330].forEach((f,i)=>{
          osc('sine', f*(1 + (i%2?0.0015:-0.0015)), 0.052, verb);
        });
        osc('sine', 55, 0.10);
        noiseBed(0.008, verb);
      },
      event(i, verb){
        const r = rng(i*40503);
        if(r() < 0.45) return;
        const bells = [880, 988, 1047, 1175, 1319];
        ping(bells[Math.floor(r()*bells.length)], 5.5, 0.045, verb);
      },
      move(t){ return 0.5 + 0.5*Math.sin(t*0.008); }
    },
  };

  /* ---------------- api ----------------------------------------- */

  let verb, filt;

  function start(ctx_, destination, name){
    ctx = ctx_;
    out = destination;
    stop();

    preset = PRESETS[name] || PRESETS.carrier;

    master = ctx.createGain();
    master.gain.value = 0;

    filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 900;
    filt.Q.value = 0.5;

    verb = makeReverb(4.5, 2.6);
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.55;

    master.connect(filt);
    filt.connect(out);
    verb.connect(verbGain);
    verbGain.connect(filt);

    preset.build(verb);

    master.gain.setTargetAtTime(0.9, ctx.currentTime, 2.5);
    lastEvent = -1;
  }

  function stop(){
    voices.forEach(v=>{
      try{
        v.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        setTimeout(()=>{ try{ v.o.stop(); }catch(e){} }, 1400);
      }catch(e){}
    });
    voices = [];
    preset = null;
  }

  // called every frame with station time; fires scheduled events and
  // moves the timbre
  function tick(now){
    if(!preset || !ctx) return;

    const i = Math.floor(now / preset.every);
    if(i !== lastEvent){
      if(lastEvent !== -1) preset.event(i, verb);   // skip the one at load
      lastEvent = i;
    }

    const m = preset.move(now);
    filt.frequency.setTargetAtTime(420 + m*1500, ctx.currentTime, 0.4);
  }

  // what the HUD shows instead of a track title
  function label(now){
    if(!preset) return {title:'—', seq:''};
    const i = Math.floor(now / preset.every);
    return { seq: String(i % 10000).padStart(4,'0') };
  }

  function progress(now){
    if(!preset) return 0;
    return (now % preset.every) / preset.every;
  }

  return {start, stop, tick, label, progress,
          isRunning: ()=>!!preset};
})();
