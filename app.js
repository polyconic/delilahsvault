/* ==================================================================
   THE BROADCAST

   Resolves "what time is it" into "what is on air", and keeps the
   audio, the picture and the HUD agreeing with that answer.
   ================================================================== */

(function(){

  const $ = s => document.querySelector(s);

  const au    = $('#au');

  let ac, mix, master, analyser, mediaSrc;
  let curBlock = -1, curItem = -1, curVideo = -1;
  let transitioning = false, transitionTimer = null;
  let tunedIn = false;   // false until the gate is actually clicked
  let started = false;

  /* ---------- station clock -------------------------------------- */

  const stationSeconds = () => Date.now()/1000;

  /* The station reads Chicago's wall clock, so the day's shape follows
     the city through both clock changes. Intl holds the daylight-saving
     rules, which is why there are no transition dates written down
     anywhere here — asking it for the parts of the local time is the
     whole of it. Note that only the *shape* of the day moves: the
     rotation below is positioned off absolute time, so it can't stutter
     or repeat an hour when the clocks go back. */
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: STATION.tz, hourCycle:'h23',
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit',
  });

  function clock(){
    const s = stationSeconds();
    const p = {};
    for(const {type, value} of tzParts.formatToParts(s*1000)) p[type] = value;
    const sod = +p.hour*3600 + +p.minute*60 + +p.second + (s - Math.floor(s));
    const day = Math.round(Date.UTC(+p.year, +p.month-1, +p.day)/86400000);
    return {s, day, sod};
  }

  function onAir(){
    const {s, day, sod} = clock();
    let idx = 0;
    for(let i=0;i<SCHEDULE.length;i++){
      if(sod >= SCHEDULE[i].start*3600) idx = i;
    }
    const startS = SCHEDULE[idx].start*3600;
    const endS   = (idx+1 < SCHEDULE.length)
                 ? SCHEDULE[idx+1].start*3600
                 : 86400;
    return {
      block: SCHEDULE[idx], idx, day, sod, s,
      elapsed: sod - startS,
      remain:  endS - sod,
      length:  endS - startS,
    };
  }

  // Where the rotation is, straight off the clock. Every cycle holds
  // all of ROTATION exactly once, and the cycle number seeds the order
  // — so the set repeats but the sequence never does.
  const ROT_TOTAL = ROTATION.reduce((a,t)=>a+t.duration,0);

  function rotationPos(){
    const elapsed = stationSeconds() - STATION.epoch;
    const cycle   = Math.floor(elapsed / ROT_TOTAL);
    const order   = seededOrder(ROTATION.length, cycle);
    let off = ((elapsed % ROT_TOTAL) + ROT_TOTAL) % ROT_TOTAL;
    for(let n=0;n<order.length;n++){
      const track = ROTATION[order[n]];
      if(off < track.duration) return {track, n, off, cycle, order};
      off -= track.duration;
    }
    return {track:ROTATION[order[0]], n:0, off:0, cycle, order};
  }

  // at the end of a cycle the next track comes from the next shuffle
  function nextInRotation(p){
    if(p.n + 1 < p.order.length) return ROTATION[p.order[p.n+1]];
    return ROTATION[seededOrder(ROTATION.length, p.cycle+1)[0]];
  }

  /* ---------- audio ---------------------------------------------- */

  function buildGraph(){
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC();
    /* everything → mix → analyser → master → speakers
       The mute lives in `master`, downstream of the analyser, so the
       picture carries on moving while the sound is off. Muting upstream
       would freeze the visualiser and make the page look broken. */
    mix    = ac.createGain();
    master = ac.createGain();
    analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.93;

    mix.connect(analyser);
    analyser.connect(master);
    master.connect(ac.destination);

    // can only ever be called once for this element
    mediaSrc = ac.createMediaElementSource(au);
    mediaSrc.connect(mix);

    Visuals.setAnalyser(analyser);
    // deliberately NOT resumed here — the context stays suspended until
    // the gate is clicked, otherwise a browser that allows autoplay
    // would play the station out loud behind the gate
  }

  function seekAndPlay(){
    transitioning = false;
    const p = rotationPos();
    if(p.n === curItem){ try{ au.currentTime = p.off; }catch(e){} }
    // seek it into position but stay silent until the gate is opened
    if(tunedIn) au.play().catch(()=>{});
  }

  /* ---------- picture -------------------------------------------- */

  const bg = [$('#bgA'), $('#bgB')];
  let bgFront = 0;
  const deadClips = new Set();   // clips that 404'd or wouldn't decode

  /* The picture is its own rotation, independent of the schedule. It
     runs continuously across block boundaries and reshuffles every time
     it has been through all the clips, so the order is never the same
     twice — but the shuffle is seeded from the cycle number, so it is
     still identical for every listener at any given moment. */

  // The clips are 34s each, so a 180s hold meant watching the same short
  // loop go round five times. 68s lets it play through cleanly twice.
  const CLIP_SECONDS = 68;           // how long one clip holds the screen
  let clipCycle = -1, clipOrder = null;

  function seededOrder(n, seed){
    const a = [...Array(n).keys()];
    let s = seed;
    const rnd = () => {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    for(let i = n - 1; i > 0; i--){
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function setVideo(now){
    const n = ALL_FOOTAGE.length;
    if(!n || deadClips.size >= n){
      bg.forEach(v=>v.classList.remove('on'));
      curVideo = -1;
      return;
    }

    const slot  = Math.floor(now / CLIP_SECONDS);
    const cycle = Math.floor(slot / n);
    const pos   = ((slot % n) + n) % n;

    // a fresh order each time the whole set has played through
    if(cycle !== clipCycle){
      clipCycle = cycle;
      clipOrder = seededOrder(n, cycle);
    }

    // skip anything that failed to load, keeping the rotation intact
    let src = null;
    for(let i = 0; i < n; i++){
      const cand = ALL_FOOTAGE[clipOrder[(pos + i) % n]];
      if(!deadClips.has(cand)){ src = cand; break; }
    }
    if(!src) return;

    if(src === curVideo) return;
    curVideo = src;

    const next = bg[bgFront ^ 1];
    const prev = bg[bgFront];

    next.onerror = () => {
      // don't let one missing file blank the screen — drop it and move on
      deadClips.add(src);
      curVideo = -1;
    };
    next.oncanplay = () => {
      next.play().catch(()=>{});
      next.classList.add('on');
      prev.classList.remove('on');
      bgFront ^= 1;
    };

    next.src = src;
    next.load();
  }

  /* ---------- putting it on air ---------------------------------- */

  function tuneTo(){
    const s = onAir();

    /* --- block changed: it only sets the mood now ---------------- */
    if(s.idx !== curBlock){
      curBlock = s.idx;
      // curItem is deliberately NOT reset here — the music runs as one
      // continuous rotation and carries on straight across a block change,
      // exactly as the picture does
      $('#blockName').textContent = s.block.name;
      $('#blockNote').textContent = s.block.note || '';
      document.body.dataset.visual = s.block.visual;
    }

    setVideo(s.s);

    /* --- the rotation, which owes nothing to the schedule -------- */
    const p = rotationPos();

    if(p.n !== curItem){
      curItem = p.n;

      $('#title').textContent  = p.track.title;
      fitTitle();
      $('#by').textContent     = p.track.by ? p.track.by + ' ·' : '';
      $('#trkNo').textContent  = p.n + 1;
      $('#trkTot').textContent = ROTATION.length;
      $('#upnext').textContent = 'up next — ' + nextInRotation(p).title;

      // au.load() briefly makes au.paused true while the new file's
      // metadata loads — a normal gap, not a browser autoplay block.
      // Suppress the "click for sound" check until playback resumes,
      // with a timeout so a genuine stall still gets caught.
      transitioning = true;
      clearTimeout(transitionTimer);
      transitionTimer = setTimeout(()=>{ transitioning = false; }, 4000);

      au.addEventListener('loadedmetadata', seekAndPlay, {once:true});
      au.src = p.track.file;
      au.load();
      return;
    }

    try{ au.currentTime = p.off; }catch(e){}
    if(tunedIn) au.play().catch(()=>{});
  }

  /* ---------- fitting the title ----------------------------------
     The title is set in vw, which is fine until a long word is simply
     wider than a phone screen — words can't break, so it spills off the
     edge. Measure the widest word and scale down only when it doesn't
     fit, so short titles keep their full size. */

  const titleEl = $('#title');
  let measureCtx = null;

  function fitTitle(){
    // Measure BEFORE resetting. The old order cleared the fitted size and
    // then bailed out if the width wasn't measurable yet, which left the
    // title at full size with no re-fit until something else nudged it —
    // that's how long titles ended up running off the screen.
    const avail = titleEl.clientWidth || (titleEl.parentElement||{}).clientWidth || 0;
    if(!avail){ requestAnimationFrame(fitTitle); return; }

    titleEl.style.fontSize = '';               // back to the CSS size

    const cs   = getComputedStyle(titleEl);
    const base = parseFloat(cs.fontSize);
    measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
    measureCtx.font = `${cs.fontWeight} ${base}px ${cs.fontFamily}`;

    let widest = 0;
    for(const w of titleEl.textContent.trim().split(/\s+/)){
      widest = Math.max(widest, measureCtx.measureText(w).width);
    }
    // 0.97 leaves a hair of margin — canvas measureText and the real
    // layout don't agree to the pixel, and exact-fit looked clipped
    const room = avail * 0.97;
    if(widest > room){
      titleEl.style.fontSize = Math.floor(base * (room / widest)) + 'px';
    }

    // a very long title can still stack up too many lines
    const maxH = innerHeight * 0.42;
    let guard = 0;
    while(titleEl.offsetHeight > maxH && guard++ < 12){
      titleEl.style.fontSize =
        (parseFloat(getComputedStyle(titleEl).fontSize) * 0.9) + 'px';
    }
  }

  addEventListener('resize', fitTitle);

  /* A resize event isn't enough on its own — the available width also
     changes on orientation flips and when the layout settles after load.
     Watch the container instead. Guarded on width so the height change
     that fitting itself causes can't loop back round. */
  if(window.ResizeObserver && titleEl.parentElement){
    let lastW = -1;
    new ResizeObserver(entries=>{
      const w = entries[0].contentRect.width;
      if(Math.abs(w - lastW) < 1) return;
      lastW = w;
      fitTitle();
    }).observe(titleEl.parentElement);
  }

  /* ---------- the HUD -------------------------------------------- */

  const pad = n => String(n).padStart(2,'0');
  const mmss = s => {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s/60)+':'+pad(s%60);
  };
  const hhmm = s => pad(Math.floor(s/3600)%24)+':'+pad(Math.floor(s/60)%60);

  // blocks run for hours, so mm:ss is useless here
  const longDur = s => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s/3600), m = Math.floor(s%3600/60);
    return h ? `${h}h ${pad(m)}m` : `${m}m ${pad(s%60)}s`;
  };

  function hud(){
    requestAnimationFrame(hud);
    const s = onAir();

    // station clock
    $('#clock').textContent  = hhmm(s.sod) + ':' + pad(Math.floor(s.sod)%60);
    $('#dayNo').textContent  = 'day ' + (s.day - Math.floor(STATION.epoch/86400)).toLocaleString();

    // how far through the block we are
    $('#blockBar').style.width = ((s.elapsed/s.length)*100).toFixed(2)+'%';
    $('#blockLeft').textContent = 'block ends in ' + longDur(s.remain);

    const p   = rotationPos();
    const dur = p.track.duration;
    $('#fill').style.width    = (p.off/dur*100).toFixed(3)+'%';
    $('#elapsed').textContent = mmss(p.off);
    $('#remain').textContent  = '−'+mmss(dur-p.off);
    $('#trkNo').textContent   = p.n+1;
    if(p.n !== curItem) tuneTo();

    if(s.idx !== curBlock) tuneTo();

    Visuals.draw(s.block.visual, s.s);
  }

  /* ---------- schedule panel ------------------------------------- */

  function buildSchedule(){
    const wrap = $('#sched');
    wrap.innerHTML = '';

    SCHEDULE.forEach((b,i)=>{
      const end = (i+1<SCHEDULE.length ? SCHEDULE[i+1].start : 24);
      const row = document.createElement('div');
      row.className = 'srow';
      row.dataset.i = i;
      row.innerHTML =
        `<span class="shour">${pad(b.start)}:00</span>` +
        `<span class="sname">${b.name}</span>` +
        `<span class="skind">${end-b.start}h</span>` +
        `<span class="sto">${pad(end%24)}:00</span>`;
      wrap.appendChild(row);
    });

    // the rotation belongs to no block, so it gets its own row at the
    // foot of the day — collapsed under `schedule`, open under `tracklist`
    const group = document.createElement('div');
    group.className = 'sgroup rot';
    group.innerHTML =
      `<div class="srow expandable">` +
        `<span class="shour"></span>` +
        `<span class="sname">THE ROTATION</span>` +
        `<span class="skind">${ROTATION.length} tracks</span>` +
        `<span class="sto">${longDur(ROT_TOTAL)}</span>` +
      `</div>` +
      `<div class="stracks"></div>`;
    group.querySelector('.srow').addEventListener('click', e=>{
      e.stopPropagation();              // don't let the scrim close the panel
      group.classList.toggle('open');
    });
    wrap.appendChild(group);
    fillRotation(rotationPos());
  }

  // The list is this cycle's running order, not the library's — so its
  // numbers are the same ones the counter shows, and what's below the
  // playing track is genuinely what's coming. Rebuilt when the cycle turns.
  let rotCycle = -1;

  function fillRotation(p){
    const box = document.querySelector('.sgroup.rot .stracks');
    if(!box) return;
    rotCycle = p.cycle;
    box.innerHTML = p.order.map((idx,n)=>{
      const t = ROTATION[idx];
      return `<div class="strack" data-file="${t.file}">` +
               `<span class="snum">${pad(n+1)}</span>` +
               `<span class="stitle">${t.title}</span>` +
               `<span class="slen">${mmss(t.duration)}</span>` +
             `</div>`;
    }).join('');
  }

  function markSchedule(){
    const s = onAir();
    document.querySelectorAll('.srow[data-i]').forEach(r=>{
      r.classList.toggle('now', +r.dataset.i === s.idx);
    });

    const p = rotationPos();
    if(p.cycle !== rotCycle) fillRotation(p);

    document.querySelectorAll('.strack.playing')
            .forEach(t=>t.classList.remove('playing'));
    const el = document.querySelectorAll('.strack')[p.n];
    if(el) el.classList.add('playing');
  }

  const setAllGroups = open => document.querySelectorAll('.sgroup').forEach(g=>{
    if(g.querySelector('.stracks')) g.classList.toggle('open', open);
  });

  // `schedule` is the overview — blocks collapsed. `tracklist` is the
  // same panel with everything already open. Two doors, one room.
  function toggleSchedule(expanded){
    const open = document.body.classList.toggle('sched-open');
    if(open){ setAllGroups(!!expanded); markSchedule(); }
  }

  /* ---------- start ---------------------------------------------- */

  $('#stationName').textContent = STATION.name;
  $('#gateName').textContent    = STATION.title;
  document.title = STATION.title;

  Visuals.init($('#viz'));
  buildSchedule();
  setInterval(markSchedule, 5000);

  /* The gate is unconditional: it is always shown and only a real click
     opens it. Deciding by "did the browser block autoplay" doesn't work
     — browsers grant autoplay to sites you've already interacted with,
     so anyone returning would be dropped straight into playing audio
     with no way to choose. Everything else (clock, HUD, muted video)
     runs behind it, so the station really is already in progress. */

  function audible(){
    return tunedIn && ac && ac.state === 'running' &&
           (!au.paused || transitioning);
  }

  function paintSound(){
    const on = audible() && volume > 0.001;
    const t = $('#soundToggle');
    t.textContent = on ? 'sound' : 'sound off';
    t.classList.toggle('off', !on);
  }

  function nudge(){
    if(!ac || !tunedIn) return;
    if(ac.state === 'suspended') ac.resume().catch(()=>{});
    au.play().catch(()=>{});
    setTimeout(paintSound, 350);
  }

  function tuneIn(){
    if(tunedIn) return;
    tunedIn = true;
    $('#gate').classList.add('gone');

    if(ac && ac.state === 'suspended') ac.resume().catch(()=>{});

    // jump to wherever the station actually is right now, not to
    // wherever the element happened to be left while gated
    const p = rotationPos();
    if(p.n === curItem){ try{ au.currentTime = p.off; }catch(e){} }
    au.play().catch(()=>{});
    setTimeout(paintSound, 350);
  }

  $('#gate').addEventListener('click', tuneIn);

  /* ---------- volume slider ---------------------------------------
     A continuous 0–1 value rather than the old on/off mute. The mute
     button becomes shorthand for "set it to 0, remember what it was". */

  let volume = 1, lastVolume = 1;

  function updateVolUI(v){
    const pct = Math.round(v*100);
    $('#volFill').style.height  = pct + '%';
    $('#volThumb').style.bottom = pct + '%';
    $('#volLabel').textContent  = pct;
    $('#volwrap').setAttribute('aria-valuenow', pct);
  }

  function applyVolume(v, instant){
    volume = Math.max(0, Math.min(1, v));
    if(master) master.gain.setTargetAtTime(volume, ac.currentTime, instant ? 0.001 : 0.05);
    updateVolUI(volume);
    try{ localStorage.setItem('delilah-volume', volume); }catch(e){}
    paintSound();
  }

  function toggleMute(){
    if(volume > 0.001){ lastVolume = volume; applyVolume(0); }
    else{ applyVolume(lastVolume || 1); }
  }

  $('#soundToggle').addEventListener('click', e=>{
    e.stopPropagation();
    if(!audible()){ nudge(); return; }   // not started yet — start it
    toggleMute();
  });

  // drag / click on the track
  const voltrack = $('#voltrack');
  let dragging = false;

  function volFromEvent(e){
    const rect = voltrack.getBoundingClientRect();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    return Math.max(0, Math.min(1, (rect.bottom - y) / rect.height));
  }

  voltrack.addEventListener('pointerdown', e=>{
    dragging = true;
    voltrack.classList.add('dragging');
    // capture can throw on an unrecognised pointer id; must not abort
    // the handler before the volume is actually applied
    try{ voltrack.setPointerCapture(e.pointerId); }catch(err){}
    applyVolume(volFromEvent(e));
  });
  voltrack.addEventListener('pointermove', e=>{
    if(dragging) applyVolume(volFromEvent(e));
  });
  ['pointerup','pointercancel'].forEach(ev => voltrack.addEventListener(ev, ()=>{
    dragging = false;
    voltrack.classList.remove('dragging');
  }));

  // arrow keys when the control has focus
  $('#volwrap').addEventListener('keydown', e=>{
    const step = 0.05;
    if(e.key==='ArrowUp'   || e.key==='ArrowRight'){ applyVolume(volume+step); e.preventDefault(); }
    else if(e.key==='ArrowDown' || e.key==='ArrowLeft'){  applyVolume(volume-step); e.preventDefault(); }
    else if(e.key==='Home'){ applyVolume(0); e.preventDefault(); }
    else if(e.key==='End'){  applyVolume(1); e.preventDefault(); }
  });

  started = true;
  buildGraph();

  // restore last session's level, applied instantly (no fade-up on load)
  let savedVol = 1;
  try{
    const raw = parseFloat(localStorage.getItem('delilah-volume'));
    if(!isNaN(raw)) savedVol = raw;
  }catch(e){}
  applyVolume(savedVol, true);
  lastVolume = savedVol > 0.001 ? savedVol : 1;


  // The station runs from the moment the page loads — clock, HUD, video,
  // and the audio element seeking to the live position — but the audio
  // context stays suspended until the gate is clicked, so none of it is
  // heard until then.
  tuneTo();
  hud();
  paintSound();

  setInterval(paintSound, 2000);

  /* ---------- fullscreen ------------------------------------------
     Only offered where it actually works. iOS Safari has no Fullscreen
     API for ordinary elements — only video — so on an iPhone the button
     stays hidden rather than sitting there doing nothing. */

  const fsRoot   = document.documentElement;
  const fsEnter  = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
  const fsLeave  = document.exitFullscreen  || document.webkitExitFullscreen;
  const fsActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  function paintFull(){
    $('#fullToggle').textContent = fsActive() ? 'exit fullscreen' : 'fullscreen';
  }

  function toggleFull(){
    if(!fsEnter) return;
    // the promise rejects if the gesture wasn't trusted; nothing to do
    if(fsActive()) { try{ fsLeave.call(document); }catch(e){} }
    else           { try{ Promise.resolve(fsEnter.call(fsRoot)).catch(()=>{}); }catch(e){} }
  }

  // fullscreenEnabled also covers being embedded in an iframe that wasn't
  // granted fullscreen — the method exists there but always rejects
  const fsAllowed = document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true;

  if(fsEnter && fsLeave && fsAllowed){
    // must be an explicit value — clearing the inline style would just
    // fall back to the display:none in the stylesheet
    $('#fullToggle').style.display = 'inline';
    $('#fullSep').style.display    = 'inline';
    $('#fullToggle').addEventListener('click', e=>{ e.stopPropagation(); toggleFull(); });
    // also fires when the user leaves with Esc, so the label stays honest
    ['fullscreenchange','webkitfullscreenchange'].forEach(ev=>
      document.addEventListener(ev, paintFull));
    paintFull();
  }

  $('#schedToggle').addEventListener('click',    ()=>toggleSchedule(false));
  $('#tracklistToggle').addEventListener('click',()=>toggleSchedule(true));

  $('#schedBack').addEventListener('click', e=>{
    e.stopPropagation();
    document.body.classList.remove('sched-open');
  });

  // clicking the scrim closes it; clicking anything inside the panel
  // (a row, a track, a link) must not
  document.querySelector('.schedwrap').addEventListener('click', e=>{
    if(e.target.closest('.schedinner')) return;
    document.body.classList.remove('sched-open');
  });
  addEventListener('keydown', e=>{
    if(e.key === 's' || e.key === 'S') toggleSchedule(false);
    if(e.key === 't' || e.key === 'T') toggleSchedule(true);
    if(e.key === 'f' || e.key === 'F') toggleFull();
    if(e.key === 'Escape') document.body.classList.remove('sched-open');
  });

  au.addEventListener('ended', tuneTo);

  /* Everything the SOUND depends on runs on timers, not on
     requestAnimationFrame. Browsers pause rAF in a background tab, and
     this is a station people leave running in one — on rAF alone track
     and block changes would be missed until the tab was looked at
     again. Timers are throttled in the background but they do keep
     firing. */

  // stay on the right block / right item, however long we've been hidden
  setInterval(()=>{
    if(!started) return;
    const s = onAir();

    /* The picture keeps its own time, so it has to be advanced here
       rather than only inside tuneTo(). tuneTo() runs on track and block
       changes, which meant that during a five-minute song the clip was
       never re-evaluated and simply looped for the whole track. This
       must also sit above the early returns below so the picture keeps
       moving regardless. setVideo() no-ops when the clip hasn't changed. */
    setVideo(s.s);

    if(s.idx !== curBlock){ tuneTo(); return; }
    if(au.paused) return;
    const p = rotationPos();
    if(p.n !== curItem || Math.abs(au.currentTime - p.off) > 1.5) tuneTo();
  }, 5000);

  // coming back to the tab: re-sync immediately rather than waiting
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden && started){ Visuals.fit(); tuneTo(); }
  });

})();
