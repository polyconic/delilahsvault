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
  let started = false;

  /* ---------- station clock -------------------------------------- */

  const stationSeconds = () => Date.now()/1000 + STATION.tzOffset*3600;

  function clock(){
    const s   = stationSeconds();
    const day = Math.floor(s/86400);
    return {s, day, sod: s - day*86400};
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

  // Where a block's playlist is, given how long the block has been
  // running. The day number shifts the running order, so the same
  // hour doesn't play the same thing every day.
  function playlistPos(block, elapsed, day){
    const items = block.items;
    const total = items.reduce((a,t)=>a+t.duration,0);
    const shift = (day*7919) % total;
    let off = ((elapsed + shift) % total + total) % total;
    for(let i=0;i<items.length;i++){
      if(off < items[i].duration) return {i, off, total};
      off -= items[i].duration;
    }
    return {i:0, off:0, total};
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
    if(ac.state === 'suspended') ac.resume();
  }

  function seekAndPlay(){
    transitioning = false;
    const s = onAir();
    if(s.idx !== curBlock || s.block.mode !== 'playlist') return;
    const p = playlistPos(s.block, s.elapsed, s.day);
    if(p.i === curItem){ try{ au.currentTime = p.off; }catch(e){} }
    au.play().catch(()=>{});
  }

  /* ---------- picture -------------------------------------------- */

  const bg = [$('#bgA'), $('#bgB')];
  let bgFront = 0;
  const deadClips = new Set();   // clips that 404'd or wouldn't decode

  function setVideo(block, elapsed){
    const all = block.video || [];
    const clips = all.filter(c => !deadClips.has(c));

    if(!clips.length){
      bg.forEach(v=>v.classList.remove('on'));
      curVideo = -1;
      return;
    }

    // a clip holds the screen for three minutes, then the next
    const i = Math.floor(elapsed/180) % clips.length;
    const src = clips[i];
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

    /* --- block changed: swap the whole programme ---------------- */
    if(s.idx !== curBlock){
      curBlock = s.idx;
      curItem  = -1;
      curVideo = -1;

      $('#blockNote').textContent = s.block.note || '';
      document.body.dataset.visual = s.block.visual;

      if(s.block.mode === 'generative'){
        au.pause();
        au.removeAttribute('src');
        Synth.start(ac, mix, s.block.preset);
        // the block name IS the title here, so leave the label empty and
        // let the italic note carry the line on its own
        $('#blockName').textContent = '';
        $('#title').textContent     = s.block.name;
        $('#by').textContent        = '';
        $('#counter').style.display = 'none';
        $('#upnext').textContent = 'up next — ' + nextBlock().name;
      }else{
        Synth.stop();
        $('#blockName').textContent = s.block.name;
        $('#counter').style.display = '';
      }
    }

    setVideo(s.block, s.elapsed);

    /* --- playlist blocks: keep the right item playing ------------ */
    if(s.block.mode === 'playlist'){
      const p = playlistPos(s.block, s.elapsed, s.day);

      if(p.i !== curItem){
        curItem = p.i;
        const item = s.block.items[p.i];

        $('#title').textContent = item.title;
        $('#by').textContent    = item.by ? item.by + ' ·' : '';
        $('#trkNo').textContent = p.i + 1;
        $('#trkTot').textContent = s.block.items.length;
        $('#upnext').textContent =
          'up next — ' + s.block.items[(p.i+1) % s.block.items.length].title;

        // au.load() briefly makes au.paused true while the new file's
        // metadata loads — a normal gap, not a browser autoplay block.
        // Suppress the "click for sound" check until playback resumes,
        // with a timeout so a genuine stall still gets caught.
        transitioning = true;
        clearTimeout(transitionTimer);
        transitionTimer = setTimeout(()=>{ transitioning = false; }, 4000);

        au.addEventListener('loadedmetadata', seekAndPlay, {once:true});
        au.src = item.file;
        au.load();
        return;
      }

      try{ au.currentTime = p.off; }catch(e){}
      au.play().catch(()=>{});
    }
  }

  function nextBlock(){
    const s = onAir();
    return SCHEDULE[(s.idx+1) % SCHEDULE.length];
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

    if(s.block.mode === 'playlist' && s.block.items){
      const p = playlistPos(s.block, s.elapsed, s.day);
      const dur = s.block.items[p.i].duration;
      $('#fill').style.width  = (p.off/dur*100).toFixed(3)+'%';
      $('#elapsed').textContent = mmss(p.off);
      $('#remain').textContent  = '−'+mmss(dur-p.off);
      $('#trkNo').textContent   = p.i+1;
      if(p.i !== curItem) tuneTo();
    }else{
      const g = Synth.progress(s.s);
      $('#fill').style.width = (g*100).toFixed(2)+'%';
      const l = Synth.label(s.s);
      $('#elapsed').textContent = 'seq ' + l.seq;
      $('#remain').textContent  = '';
    }

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
        `<span class="skind">${b.mode==='generative'?'generated':'recorded'}</span>` +
        `<span class="sto">${pad(end%24)}:00</span>`;
      wrap.appendChild(row);
    });
  }

  function markSchedule(){
    const s = onAir();
    document.querySelectorAll('.srow').forEach(r=>{
      r.classList.toggle('now', +r.dataset.i === s.idx);
    });
  }

  function toggleSchedule(){
    const open = document.body.classList.toggle('sched-open');
    if(open) markSchedule();
  }

  /* ---------- start ---------------------------------------------- */

  $('#stationName').textContent = STATION.name;
  document.title = STATION.title;

  Visuals.init($('#viz'));
  buildSchedule();
  setInterval(markSchedule, 5000);

  /* No front door. The station is simply already on when you arrive.

     Browsers won't let a page make noise until it has been interacted
     with, so: build everything and start it immediately, then check
     whether the browser actually allowed it. If it didn't, the first
     click/key/touch anywhere starts the sound, and a quiet line says so.
     The picture and the clock run either way — muted video autoplays
     fine — so the page never looks like it's waiting for permission. */

  function audible(){
    return ac && ac.state === 'running' &&
           (onAir().block.mode !== 'playlist' || !au.paused || transitioning);
  }

  function paintSound(){
    const on = audible() && volume > 0.001;
    const t = $('#soundToggle');
    t.textContent = on ? 'sound' : 'sound off';
    t.classList.toggle('off', !on);
    // the prompt is only for the browser blocking us, never for a
    // deliberate mute
    $('#hint').classList.toggle('on', !audible());
  }

  function nudge(){
    if(!ac) return;
    if(ac.state === 'suspended') ac.resume().catch(()=>{});
    if(onAir().block.mode === 'playlist') au.play().catch(()=>{});
    setTimeout(paintSound, 350);
  }

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
    voltrack.setPointerCapture(e.pointerId);
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

  tuneTo();
  hud();
  nudge();

  // any first interaction anywhere satisfies the browser's gesture rule
  ['pointerdown','keydown','touchstart','wheel'].forEach(ev=>{
    addEventListener(ev, nudge, {passive:true});
  });
  setInterval(paintSound, 2000);

  $('#schedToggle').addEventListener('click', toggleSchedule);
  // clicking anywhere on the scrim closes it again
  document.querySelector('.schedwrap').addEventListener('click', ()=>{
    document.body.classList.remove('sched-open');
  });
  addEventListener('keydown', e=>{
    if(e.key === 's' || e.key === 'S') toggleSchedule();
    if(e.key === 'Escape') document.body.classList.remove('sched-open');
  });

  au.addEventListener('ended', tuneTo);

  /* Everything the SOUND depends on runs on timers, not on
     requestAnimationFrame. Browsers pause rAF in a background tab, and
     this is a station people leave running in one — on rAF alone the
     generative blocks would freeze mid-drone and block changes would
     be missed until the tab was looked at again. Timers are throttled
     in the background but they do keep firing. */

  // keep the synth evolving and firing its scheduled events
  setInterval(()=>{ if(started) Synth.tick(stationSeconds()); }, 250);

  // stay on the right block / right item, however long we've been hidden
  setInterval(()=>{
    if(!started) return;
    const s = onAir();
    if(s.idx !== curBlock){ tuneTo(); return; }
    if(s.block.mode !== 'playlist' || au.paused) return;
    const p = playlistPos(s.block, s.elapsed, s.day);
    if(p.i !== curItem || Math.abs(au.currentTime - p.off) > 1.5) tuneTo();
  }, 5000);

  // coming back to the tab: re-sync immediately rather than waiting
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden && started){ Visuals.fit(); tuneTo(); }
  });

})();
