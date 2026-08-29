/* ==================================================================
   VISUALS

   One canvas, several modes. Which one is painting is decided by the
   schedule, so the picture changes through the day along with the
   sound. All greyscale, all low contrast — this sits behind type and
   must never compete with it.
   ================================================================== */

const Visuals = (function(){

  let cvs, ctx, analyser, freq;
  let W = 0, H = 0;

  // spectrum state
  const EASE = 0.045;
  let N, target, level, shaped;

  function allocate(){
    const n = Math.max(56, Math.min(140, Math.round(innerWidth/6.5)));
    if(n === N) return;
    N = n;
    target = new Float32Array(N);
    level  = new Float32Array(N);
    shaped = new Float32Array(N);
  }

  function fit(){
    const r = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cvs.width = W*r; cvs.height = H*r;
    ctx.setTransform(r,0,0,r,0,0);
    allocate();
  }

  function init(canvas){
    cvs = canvas;
    ctx = cvs.getContext('2d');
    addEventListener('resize', fit);
    fit();
  }

  function setAnalyser(a){
    analyser = a;
    freq = new Uint8Array(a.frequencyBinCount);
  }

  /* ---------- shared reads --------------------------------------- */

  function readBands(){
    const usable = Math.floor(freq.length * 0.55);
    for(let i=0;i<N;i++){
      const lo = Math.floor(Math.pow(i/N, 1.85) * usable);
      const hi = Math.max(lo+1, Math.floor(Math.pow((i+1)/N, 1.85) * usable));
      let sum = 0;
      for(let k=lo;k<hi;k++) sum += freq[k];
      target[i] = (sum/(hi-lo))/255;
    }
    for(let i=0;i<N;i++) level[i] += (target[i]-level[i])*EASE;
    const R = 3;
    for(let i=0;i<N;i++){
      let s=0, w=0;
      for(let k=-R;k<=R;k++){
        const j=i+k; if(j<0||j>=N) continue;
        const q = 1 - Math.abs(k)/(R+1);
        s += level[j]*q; w += q;
      }
      shaped[i] = s/w;
    }
  }

  // the vertical extent the visuals are allowed to occupy, measured
  // from the real layout so nothing ever grows into the type
  function bounds(){
    const meta = document.querySelector('.meta');
    const foot = document.querySelector('footer');
    const mid  = H*0.66;
    const top  = meta ? meta.getBoundingClientRect().bottom + 34 : H*0.42;
    const bot  = foot ? foot.getBoundingClientRect().top - 22 : H*0.92;
    return {mid, top, bot, room: Math.max(30, Math.min(mid-top, bot-mid))};
  }

  /* ---------- modes ---------------------------------------------- */

  // mirrored spectrum of thin lines
  function spectrum(now, glow){
    readBands();
    const {mid, room} = bounds();
    const amp  = Math.min(H*0.30, 270, room/1.45);
    const gain = 0.80 + glow*0.35;
    const step = W/N;

    ctx.lineCap = 'round';
    ctx.lineWidth = 1;

    for(let i=0;i<N;i++){
      const u = i/(N-1);
      const x = u*W + step/2;
      const taper = Math.pow(Math.sin(Math.PI*u), 0.5);
      const swell = 1 + 0.26*Math.sin(now*0.30 - u*9.5);
      const v = Math.pow(shaped[i], 1.1);
      const h = v*amp*taper*swell*gain;
      if(h < 0.4) continue;
      ctx.strokeStyle = `rgba(240,240,240,${(0.05+v*0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(x, mid-h); ctx.lineTo(x, mid+h);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(240,240,240,${(0.05+glow*0.10).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(0,mid); ctx.lineTo(W,mid); ctx.stroke();
  }

  // a test card, drifting. for the hours when nobody is meant to be
  // watching.
  function testcard(now, glow){
    const {mid, room} = bounds();
    const R = Math.min(room*0.92, W*0.26);
    const cx = W*0.5, cy = mid;
    const breathe = 1 + 0.03*Math.sin(now*0.11);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(now*0.017)*0.045);

    // concentric rings
    ctx.lineWidth = 1;
    for(let i=1;i<=6;i++){
      const r = (R*breathe) * (i/6);
      ctx.strokeStyle = `rgba(240,240,240,${(0.030 + (i===4?0.05:0) + glow*0.04).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
    }

    // crosshair
    ctx.strokeStyle = `rgba(240,240,240,${(0.05+glow*0.05).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(-R*1.25,0); ctx.lineTo(R*1.25,0);
    ctx.moveTo(0,-R*1.25); ctx.lineTo(0,R*1.25);
    ctx.stroke();

    // greyscale step wedge under the rings
    const steps = 9, bw = (R*1.5)/steps;
    for(let i=0;i<steps;i++){
      const v = i/(steps-1);
      ctx.fillStyle = `rgba(240,240,240,${(0.018 + v*0.055).toFixed(3)})`;
      ctx.fillRect(-R*0.75 + i*bw, R*0.62, bw-1, R*0.13);
    }
    ctx.restore();

    // a slow sweep line, like something still scanning
    const sy = mid - room + ((now*26) % (room*2));
    const g = ctx.createLinearGradient(0, sy-40, 0, sy+40);
    g.addColorStop(0,'rgba(240,240,240,0)');
    g.addColorStop(.5,`rgba(240,240,240,${(0.030+glow*0.03).toFixed(3)})`);
    g.addColorStop(1,'rgba(240,240,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, sy-40, W, 80);
  }

  // a lit band on the horizon, breathing
  function horizon(now, glow){
    const {mid, room} = bounds();
    const amp = Math.min(room*0.85, 210);

    if(analyser) readBands();

    // luminous band
    const g = ctx.createLinearGradient(0, mid-amp, 0, mid+amp);
    g.addColorStop(0,   'rgba(240,240,240,0)');
    g.addColorStop(.42, `rgba(240,240,240,${(0.020+glow*0.05).toFixed(3)})`);
    g.addColorStop(.5,  `rgba(240,240,240,${(0.070+glow*0.10).toFixed(3)})`);
    g.addColorStop(.58, `rgba(240,240,240,${(0.020+glow*0.05).toFixed(3)})`);
    g.addColorStop(1,   'rgba(240,240,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, mid-amp, W, amp*2);

    // a slow curve riding it
    ctx.strokeStyle = `rgba(240,240,240,${(0.10+glow*0.16).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0;x<=W;x+=6){
      const u = x/W;
      const e = analyser ? shaped[Math.floor(u*(N-1))] : 0.3;
      const y = mid
              + Math.sin(u*5.2 + now*0.16)*amp*0.16
              + Math.sin(u*2.1 - now*0.09)*amp*0.10
              - e*amp*0.30;
      x ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    }
    ctx.stroke();
  }

  // wide slow bands, like a monitor slightly off-tune
  function drift(now, glow){
    const {mid, room} = bounds();
    if(analyser) readBands();

    const bands = 7;
    for(let i=0;i<bands;i++){
      const p = i/bands;
      const y = mid - room + ((now*7*(0.4+p) + p*room*2) % (room*2));
      const h = 2 + p*26;
      const a = (0.012 + (1-p)*0.030 + glow*0.02);
      ctx.fillStyle = `rgba(240,240,240,${a.toFixed(3)})`;
      ctx.fillRect(0, y, W, h);
    }

    // faint vertical ticks that respond to the music
    if(analyser){
      const step = W/N;
      for(let i=0;i<N;i+=2){
        const v = shaped[i];
        if(v < 0.08) continue;
        const x = i*step + step/2;
        const h = v*room*0.5;
        ctx.strokeStyle = `rgba(240,240,240,${(0.03+v*0.14).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, mid-h*0.2); ctx.lineTo(x, mid+h);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = `rgba(240,240,240,${(0.05+glow*0.06).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(0,mid); ctx.lineTo(W,mid); ctx.stroke();
  }

  const MODES = {spectrum, testcard, horizon, drift};

  /* ---------- frame ---------------------------------------------- */

  let glow = 0;

  function draw(mode, now){
    ctx.clearRect(0,0,W,H);

    let bass = 0;
    if(analyser){
      analyser.getByteFrequencyData(freq);
      for(let k=2;k<26;k++) bass += freq[k];
      bass /= (24*255);
    }
    glow += (bass - glow) * 0.04;

    (MODES[mode] || spectrum)(now, glow);
    return glow;
  }

  return {init, setAnalyser, draw, fit};
})();
