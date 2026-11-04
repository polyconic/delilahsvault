const Visuals = (function(){

  let cvs, ctx, analyser, freq;
  let W = 0, H = 0;

  function fit(){
    const r = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cvs.width = W*r; cvs.height = H*r;
    ctx.setTransform(r,0,0,r,0,0);
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

  function listen(){
    if(!analyser) return {low:0, high:0};
    analyser.getByteFrequencyData(freq);
    let low = 0, high = 0;
    for(let k=2;k<26;k++) low += freq[k];
    const a = Math.floor(freq.length*0.26);
    const b = Math.floor(freq.length*0.60);
    for(let k=a;k<b;k++) high += freq[k];
    return {low: low/(24*255), high: high/((b-a)*255)};
  }

  function bounds(){
    const meta = document.querySelector('.meta');
    const foot = document.querySelector('footer');
    const mid  = H*0.66;
    const top  = meta ? meta.getBoundingClientRect().bottom + 34 : H*0.42;
    const bot  = foot ? foot.getBoundingClientRect().top - 22 : H*0.92;
    return {mid, top, bot, room: Math.max(30, Math.min(mid-top, bot-mid))};
  }

  const LIGHT = '241,241,240';
  const a3 = n => Math.max(0, n).toFixed(3);

  function bloom(x, y, r, rgb, alpha){
    if(r <= 1 || alpha <= 0.001) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0,   `rgba(${rgb},${a3(alpha)})`);
    g.addColorStop(.40, `rgba(${rgb},${a3(alpha*0.46)})`);
    g.addColorStop(.72, `rgba(${rgb},${a3(alpha*0.13)})`);
    g.addColorStop(1,   `rgba(${rgb},0)`);
    ctx.fillStyle = g;

    const x0 = Math.max(0, x-r), y0 = Math.max(0, y-r);
    ctx.fillRect(x0, y0, Math.min(W, x+r)-x0, Math.min(H, y+r)-y0);
  }

  function ember(now, glow, air){
    const {mid, room} = bounds();
    const breath = 0.5 + 0.5*Math.sin(now*0.085);
    const sway   = Math.sin(now*0.047);

    bloom(W*(0.5 + sway*0.09), mid + room*0.34,
          room*(1.75 + breath*0.5 + glow*1.05),
          LIGHT, 0.050 + glow*0.115 + breath*0.011);

    bloom(W*(0.5 - sway*0.16), mid - room*0.22,
          room*(1.15 + glow*0.55),
          LIGHT, 0.013 + air*0.045);
  }

  function horizon(now, glow, air){
    const {mid, room} = bounds();
    const breath = 0.5 + 0.5*Math.sin(now*0.062);
    const amp    = Math.min(room*(0.80 + breath*0.22), 240);
    const lift   = Math.sin(now*0.033) * room*0.07;
    const y      = mid + lift;

    const g = ctx.createLinearGradient(0, y-amp, 0, y+amp);
    g.addColorStop(0,   `rgba(${LIGHT},0)`);
    g.addColorStop(.40, `rgba(${LIGHT},${a3(0.018+glow*0.048)})`);
    g.addColorStop(.50, `rgba(${LIGHT},${a3(0.062+glow*0.095)})`);
    g.addColorStop(.60, `rgba(${LIGHT},${a3(0.016+glow*0.044)})`);
    g.addColorStop(1,   `rgba(${LIGHT},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, y-amp, W, amp*2);

    bloom(W*(0.5 + Math.sin(now*0.028)*0.26), y,
          room*(1.3 + glow*0.6),
          LIGHT, 0.012 + air*0.042);
  }

  function drift(now, glow, air){
    const {mid, room} = bounds();
    const span  = room*2;
    const bands = 6;

    for(let i=0;i<bands;i++){
      const p = i/bands;
      const h = 26 + p*120;
      const y = mid - room + (((now*5.5*(0.35+p) + p*span) % (span + h*2)) - h);
      const a = (0.014 + (1-p)*0.034 + glow*0.028) * (0.7 + 0.3*Math.sin(now*0.09 + p*5));

      const g = ctx.createLinearGradient(0, y, 0, y+h);
      g.addColorStop(0,  `rgba(${LIGHT},0)`);
      g.addColorStop(.5, `rgba(${LIGHT},${a3(a)})`);
      g.addColorStop(1,  `rgba(${LIGHT},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, h);
    }

    bloom(W*0.5, mid, room*(1.5 + glow*0.7), LIGHT, 0.010 + air*0.034);
  }

  const MODES = {ember, horizon, drift};

  let glow = 0, air = 0;

  function draw(mode, now){
    ctx.clearRect(0,0,W,H);

    const r = listen();
    glow += (r.low  - glow) * 0.04;
    air  += (r.high - air ) * 0.03;

    (MODES[mode] || ember)(now, glow, air);
    return glow;
  }

  return {init, setAnalyser, draw, fit};
})();
