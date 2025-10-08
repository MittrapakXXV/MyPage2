
window.onload = function() {
  const audioElement = new Audio("Image/judgmentcut.mp3");
  const audioElement2 = new Audio("Image/BTL.mp3");
  
  document.getElementsByClassName("linkButton")[1].addEventListener('click',function(event) {

console.log("CLKICK")


audioElement2.play();
audioElement.play();

  const cvs = document.getElementById('myCanvas');
  const ctx = cvs.getContext('2d');

const GLOW_BLUR = 120;                          // halo size
const GLOW_COLOR = 'hsla(200 100% 70% / 0.9)'; // glow tint (match your stroke)


   const TOTAL_SLASHES   = 10;               // set 7 if you want seven
  const SPAWN_EVERY_MS  = 30;             // spacing between slashes
  const DURATION_MS     = 3000;             // life of one slash (controls grow time)
  const Draw_Speed =      100;
  const LINE_WIDTH      = 5;
  const COLOR           = 'hsla(0, 0%, 88%, 1.00)';     // stroke color
  const LENGTH_RANGE    = [3.60, 4.95];            // % of diagonal
  const CENTER_RADIUS_PX= 455;                     // how tightly around screen center
  const CURVED_PROB     = 0.2;                     // 60% curved
  const STRAIGHT_SEG    = 12;                      // segments for straight (for smooth growth)
  const CURVE_SEGMENTS  = 12;                      // segments for curved
  const CURVE_AMT_RANGE = [16, 64];                // perpendicular offset in px

  // transparent fade (no bg)
  const TRAIL_ALPHA     = 0.24;         // gentle erase during run (keeps a little trail while growing)
  const FADE_OUT_ALPHA  = 0.22;         // stronger erase after all done
  const FADE_OUT_FRAMES = 400;           // ~0.5s at 60fps



  function onBtnClickHandle(){
        setTimeout(function(){ 
        window.open("https://github.com/MittrapakXXV");
     }, DURATION_MS+100);
    }


  // ---------- FIT ----------
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio||1));
  function fit(){
    const w = innerWidth, h = innerHeight;
    cvs.width = Math.round(w*DPR);
    cvs.height= Math.round(h*DPR);
    cvs.style.width = w+'px';
    cvs.style.height= h+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  addEventListener('resize', fit); fit();

  // ---------- UTILS ----------
  const R = (a,b)=> a + Math.random()*(b-a);
  const easeIn  = t => t*t*t;              // for fade
  const easeOut = t => 1 - (1-t)**3;       // for grow
  const diag = () => Math.hypot(innerWidth, innerHeight);

  function randomNearCenter(radiusPx){
    const cx = innerWidth/2, cy = innerHeight/2;
    const r = Math.sqrt(Math.random()) * radiusPx;
    const th = Math.random()*Math.PI*2;
    return { x: cx + Math.cos(th)*r, y: cy + Math.sin(th)*r };
  }

  // make straight polyline between A→B
  function buildLinePoints(a, b, segments){
    const pts = [];
    for (let i=0;i<=segments;i++){
      const t = i/segments;
      pts.push({ x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t });
    }
    return pts;
  }

  // make curved polyline (bulge perpendicular to the main direction)
  function buildCurvePoints(start, end, segments, curveAmt){
    const pts = [];
    const dx = end.x - start.x, dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx/len, uy = dy/len;
    const px = -uy, py = ux; // perpendicular unit
    const sign = (Math.random()<0.5 ? -1 : 1);
    for (let i=0;i<=segments;i++){
      const t = i/segments;
      const bx = start.x + dx*t;
      const by = start.y + dy*t;
      // bulge strongest in middle; zero at ends
      const bulge = Math.sin(Math.PI*t) ** 1.1;
      const off = sign * bulge * curveAmt * R(0.9,1.15);
      pts.push({ x: bx + px*off, y: by + py*off });
    }
    return pts;
  }

  // draw polyline up to a fractional progress [0..1]
  function strokePathProgress(points, progress){
    if (points.length < 2) return;
    const segN = points.length - 1;
    const pos  = Math.min(1, Math.max(0, progress)) * segN;
    const whole = Math.floor(pos);
    const frac  = pos - whole;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    // draw whole segments
    for (let i=1;i<=whole;i++){
      ctx.lineTo(points[i].x, points[i].y);
    }
    // last partial segment
    if (whole < segN){
      const p0 = points[whole], p1 = points[whole+1];
      const lx = p0.x + (p1.x - p0.x) * frac;
      const ly = p0.y + (p1.y - p0.y) * frac;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
  }

  // transparent erase
  function fadeErase(alpha){
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.restore();
  }

  // ---------- MODEL ----------
  const slashes = [];
  let spawned = 0, lastSpawn = 0;
  const startTime = performance.now();
  let fadingOut = false, fadeFrames = 0;

  class Slash{
    constructor(){
      // centered geometry
      const L = diag()*R(LENGTH_RANGE[0], LENGTH_RANGE[1]);
      const angle = Math.random()*Math.PI*2;
      const mid = randomNearCenter(CENTER_RADIUS_PX);
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const a = { x: mid.x - dx*(L/2), y: mid.y - dy*(L/2) };
      const b = { x: mid.x + dx*(L/2), y: mid.y + dy*(L/2) };

      // path samples
      this.isCurved = Math.random() < CURVED_PROB;
      this.points = this.isCurved
        ? buildCurvePoints(a, b, CURVE_SEGMENTS, R(CURVE_AMT_RANGE[0], CURVE_AMT_RANGE[1]))
        : buildLinePoints  (a, b, STRAIGHT_SEG);

      // timing
      this.birth = performance.now();
      this.life  = R(DURATION_MS*0.9, DURATION_MS*1.1);
      this.drawSpeed  = R(Draw_Speed*0.9, Draw_Speed*1.1);
      // width jitter
      this.w  = LINE_WIDTH * R(0.9, 1.2);
    }
    draw(now){
      const t = Math.min(1, (now - this.birth)/this.drawSpeed);
      const grow = easeOut(t);           // how far along the path is drawn
      const alpha = 1 - easeIn(t)*0.2;   // keep slightly brighter at first

     ctx.save();

// ----- GLOW PASS (outer halo) -----
ctx.globalCompositeOperation = 'lighter'; // additive for brighter glow
ctx.shadowBlur  = GLOW_BLUR;
ctx.shadowColor = GLOW_COLOR;
ctx.strokeStyle = GLOW_COLOR;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// slightly wider, softer alpha
ctx.globalAlpha = 0.55 * alpha;                 // 'alpha' from your code
ctx.lineWidth   = this.w * (1.4 + 0.6 * grow);  // wider than core
strokePathProgress(this.points, grow);

// ----- CORE PASS (sharp center) -----
ctx.shadowBlur  = 0;               // no shadow on core line
ctx.globalAlpha = 0.95 * alpha;
ctx.strokeStyle = COLOR;           // your main stroke color
ctx.lineWidth   = this.w * (0.9 + 0.4 * grow);
strokePathProgress(this.points, grow);

// (optional) THIN HIGHLIGHT
ctx.globalAlpha = 0.55 * alpha;
ctx.lineWidth   = this.w * 0.38 * (0.9 + 0.4 * grow);
strokePathProgress(this.points, grow);

ctx.restore();
    }
    dead(now){ return (now - this.birth) > this.life; }
  }

  // ---------- LOOP ----------
  function tick(now){
    // transparent clear
    fadeErase(fadingOut ? FADE_OUT_ALPHA : TRAIL_ALPHA);
    if (fadingOut) fadeFrames++;

    // spawn centered slashes
    if (!fadingOut && spawned < TOTAL_SLASHES && (now - startTime) - lastSpawn >= SPAWN_EVERY_MS){
      slashes.push(new Slash());
      spawned++; lastSpawn += SPAWN_EVERY_MS;
    }

    // draw + prune
    for (let i=slashes.length-1;i>=0;i--){
      slashes[i].draw(now);
      if (slashes[i].dead(now)) slashes.splice(i,1);
    }

    // when done, start strong fade
    if (!fadingOut && spawned >= TOTAL_SLASHES && slashes.length === 0){
      fadingOut = true; fadeFrames = 0;
    }

    // keep running until fully clear
    if (slashes.length || spawned < TOTAL_SLASHES || (fadingOut && fadeFrames < FADE_OUT_FRAMES)){
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0,0,innerWidth,innerHeight); // fully transparent end
    }
  }
  requestAnimationFrame(tick);
  onBtnClickHandle();
});
};