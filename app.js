(function(){

  const $ = s => document.querySelector(s);

  const au    = $('#au');

  let ac, mix, master, analyser, mediaSrc;
  let curBlock = -1, curItem = -1, curVideo = -1;
  let transitioning = false, transitionTimer = null;
  let tunedIn = false;
  let started = false;

  const stationSeconds = () => Date.now()/1000;

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

  function nextInRotation(p){
    if(p.n + 1 < p.order.length) return ROTATION[p.order[p.n+1]];
    return ROTATION[seededOrder(ROTATION.length, p.cycle+1)[0]];
  }

  function buildGraph(){
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC();

    mix    = ac.createGain();
    master = ac.createGain();
    analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.93;

    mix.connect(analyser);
    analyser.connect(master);
    master.connect(ac.destination);

    mediaSrc = ac.createMediaElementSource(au);
    mediaSrc.connect(mix);

    Visuals.setAnalyser(analyser);

  }

  function seekAndPlay(){
    transitioning = false;
    const p = rotationPos();
    if(p.n === curItem){ try{ au.currentTime = p.off; }catch(e){} }

    if(tunedIn) au.play().catch(()=>{});
  }

  const bg = [$('#bgA'), $('#bgB')];
  let bgFront = 0;
  const deadClips = new Set();

  const CLIP_SECONDS = 68;
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

    if(cycle !== clipCycle){
      clipCycle = cycle;
      clipOrder = seededOrder(n, cycle);
    }

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
      next.onerror = null;

      deadClips.add(src);
      curVideo = -1;
    };
    next.oncanplay = () => {
      next.oncanplay = null;
      next.play().catch(()=>{});
      next.classList.add('on');
      prev.classList.remove('on');
      bgFront ^= 1;

      setTimeout(()=>{ if(prev !== bg[bgFront]) prev.pause(); }, 2800);
    };

    next.src = src;
    next.load();
  }

  function keepPicturePlaying(){
    const v = bg[bgFront];
    if(!v.getAttribute('src') || !v.classList.contains('on')) return;
    if(v.paused) v.play().catch(()=>{});
  }

  function tuneTo(){
    const s = onAir();

    if(s.idx !== curBlock){
      curBlock = s.idx;

      $('#blockName').textContent = s.block.name;
      $('#blockNote').textContent = s.block.note || '';
      document.body.dataset.visual = s.block.visual;
    }

    setVideo(s.s);

    const p = rotationPos();

    if(p.n !== curItem){
      curItem = p.n;

      $('#title').textContent  = p.track.title;
      fitTitle();
      $('#by').textContent     = p.track.by ? p.track.by + ' ·' : '';
      $('#trkNo').textContent  = p.n + 1;
      $('#trkTot').textContent = ROTATION.length;
      $('#upnext').textContent = 'up next — ' + nextInRotation(p).title;

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

  const titleEl = $('#title');
  let measureCtx = null;

  function fitTitle(){

    const box   = titleEl.parentElement;
    const avail = (box && box.clientWidth) || 0;
    if(!avail){ setTimeout(fitTitle, 50); return; }

    titleEl.style.fontSize = '';

    const cs   = getComputedStyle(titleEl);
    const base = parseFloat(cs.fontSize);
    measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
    measureCtx.font = `${cs.fontWeight} ${base}px ${cs.fontFamily}`;

    let widest = 0;
    for(const w of titleEl.textContent.trim().split(/\s+/)){
      widest = Math.max(widest, measureCtx.measureText(w).width);
    }

    const room = avail * 0.97;
    if(widest > room){
      titleEl.style.fontSize = Math.floor(base * (room / widest)) + 'px';
    }

    const bs = getComputedStyle(box);
    let used = (parseFloat(bs.paddingTop)||0) + (parseFloat(bs.paddingBottom)||0)
             + (parseFloat(bs.rowGap)||0) * Math.max(0, box.children.length - 1);
    for(const el of box.children) if(el !== titleEl) used += el.offsetHeight;
    const maxH = Math.max(80, box.clientHeight - used);
    let guard = 0;
    while(titleEl.offsetHeight > maxH && guard++ < 12){
      titleEl.style.fontSize =
        (parseFloat(getComputedStyle(titleEl).fontSize) * 0.9) + 'px';
    }
  }

  let fitQueued = null;

  function queueFit(){
    if(fitQueued) return;
    fitQueued = setTimeout(()=>{ fitQueued = null; fitTitle(); }, 0);
  }

  addEventListener('resize', queueFit);

  if(window.ResizeObserver && titleEl.parentElement){
    let lastW = -1;
    new ResizeObserver(entries=>{
      const w = entries[0].contentRect.width;
      if(Math.abs(w - lastW) < 1) return;
      lastW = w;
      queueFit();
    }).observe(titleEl.parentElement);
  }

  const pad = n => String(n).padStart(2,'0');
  const mmss = s => {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s/60)+':'+pad(s%60);
  };
  const hhmm = s => pad(Math.floor(s/3600)%24)+':'+pad(Math.floor(s/60)%60);

  const longDur = s => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s/3600), m = Math.floor(s%3600/60);
    return h ? `${h}h ${pad(m)}m` : `${m}m ${pad(s%60)}s`;
  };

  function hud(){
    requestAnimationFrame(hud);
    const s = onAir();

    $('#clock').textContent  = hhmm(s.sod) + ':' + pad(Math.floor(s.sod)%60);
    $('#dayNo').textContent  = 'day ' + (s.day - Math.floor(STATION.epoch/86400)).toLocaleString();

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
      e.stopPropagation();
      if(document.body.classList.contains('tracklist')) return;
      group.classList.toggle('open');
    });
    wrap.appendChild(group);
    fillRotation(rotationPos());
  }

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

  function toggleSchedule(expanded){
    const open = document.body.classList.toggle('sched-open');
    document.body.classList.toggle('tracklist', open && !!expanded);
    if(open){ setAllGroups(!!expanded); markSchedule(); }
  }

  $('#stationName').textContent = STATION.name;
  document.title                = STATION.title;
  document.title = STATION.title;

  Visuals.init($('#viz'));
  buildSchedule();
  setInterval(markSchedule, 5000);

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

    const p = rotationPos();
    if(p.n === curItem){ try{ au.currentTime = p.off; }catch(e){} }
    au.play().catch(()=>{});
    setTimeout(paintSound, 350);
  }

  $('#gate').addEventListener('click', tuneIn);

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
    if(!audible()){ nudge(); return; }
    toggleMute();
  });

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

  $('#volwrap').addEventListener('keydown', e=>{
    const step = 0.05;
    if(e.key==='ArrowUp'   || e.key==='ArrowRight'){ applyVolume(volume+step); e.preventDefault(); }
    else if(e.key==='ArrowDown' || e.key==='ArrowLeft'){  applyVolume(volume-step); e.preventDefault(); }
    else if(e.key==='Home'){ applyVolume(0); e.preventDefault(); }
    else if(e.key==='End'){  applyVolume(1); e.preventDefault(); }
  });

  started = true;
  buildGraph();

  let savedVol = 1;
  try{
    const raw = parseFloat(localStorage.getItem('delilah-volume'));
    if(!isNaN(raw)) savedVol = raw;
  }catch(e){}
  applyVolume(savedVol, true);
  lastVolume = savedVol > 0.001 ? savedVol : 1;

  tuneTo();
  hud();
  paintSound();

  setInterval(paintSound, 2000);

  const fsRoot   = document.documentElement;
  const fsEnter  = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
  const fsLeave  = document.exitFullscreen  || document.webkitExitFullscreen;
  const fsActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  function paintFull(){
    $('#fullToggle').textContent = fsActive() ? 'exit fullscreen' : 'fullscreen';
  }

  function toggleFull(){
    if(!fsEnter) return;

    if(fsActive()) { try{ fsLeave.call(document); }catch(e){} }
    else           { try{ Promise.resolve(fsEnter.call(fsRoot)).catch(()=>{}); }catch(e){} }
  }

  const fsAllowed = document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true;

  if(fsEnter && fsLeave && fsAllowed){

    $('#fullToggle').style.display = 'inline';
    $('#fullSep').style.display    = 'inline';
    $('#fullToggle').addEventListener('click', e=>{ e.stopPropagation(); toggleFull(); });

    ['fullscreenchange','webkitfullscreenchange'].forEach(ev=>
      document.addEventListener(ev, paintFull));
    paintFull();
  }

  $('#schedToggle').addEventListener('click',    ()=>toggleSchedule(false));
  $('#tracklistToggle').addEventListener('click',()=>toggleSchedule(true));

  $('#schedBack').addEventListener('click', e=>{
    e.stopPropagation();
    document.body.classList.remove('sched-open','tracklist');
  });

  document.querySelector('.schedwrap').addEventListener('click', e=>{
    if(e.target.closest('.schedinner')) return;
    document.body.classList.remove('sched-open','tracklist');
  });
  addEventListener('keydown', e=>{
    if(e.key === 's' || e.key === 'S') toggleSchedule(false);
    if(e.key === 't' || e.key === 'T') toggleSchedule(true);
    if(e.key === 'f' || e.key === 'F') toggleFull();
    if(e.key === 'Escape') document.body.classList.remove('sched-open','tracklist');
  });

  au.addEventListener('ended', tuneTo);

  setInterval(()=>{
    if(!started) return;
    const s = onAir();

    setVideo(s.s);
    keepPicturePlaying();

    if(s.idx !== curBlock){ tuneTo(); return; }
    if(au.paused) return;
    const p = rotationPos();
    if(p.n !== curItem || Math.abs(au.currentTime - p.off) > 1.5) tuneTo();
  }, 5000);

  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden && started){
      Visuals.fit(); tuneTo(); keepPicturePlaying(); queueFit();
    }
  });

})();
