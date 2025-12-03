/* script.js
   - Suivi simple couleur HSV -> centroïde
   - Estimation a via régression sur v = a * t (origine forcée)
*/

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const stopBtn  = document.getElementById('stopBtn');
const captureBtn = document.getElementById('captureBtn');

const angleInput = document.getElementById('angleInput');
const targetMsInput = document.getElementById('targetMs');
const scaleMetersInput = document.getElementById('scaleMeters');
const calibrateBtn = document.getElementById('calibrateBtn');

const nSamplesSpan = document.getElementById('nSamples');
const aEstimatedSpan = document.getElementById('aEstimated');
const aTheorySpan = document.getElementById('aTheory');

const dataTableBody = document.querySelector('#dataTable tbody');

let animationId = null;
let running = false;
let baseTime = null;
let lastProcessed = 0;
let targetMs = Number(targetMsInput.value) || 10;

let pxToMeter = null; // after calibration: meters per pixel

// store samples: {t:seconds, xV, yV, xP, yP}
let samples = [];

// calibration clicks
let calibrateClicks = [];
calibrateBtn.onclick = () => {
  calibrateClicks = [];
  alert('Cliquez 2 points distincts sur la vidéo pour définir une distance connue.');
};
canvas.addEventListener('click', (e) => {
  if (calibrateClicks === null) return;
  if (calibrateClicks.length < 2) {
    const rect = canvas.getBoundingClientRect();
    calibrateClicks.push({x: e.clientX - rect.left, y: e.clientY - rect.top});
    if (calibrateClicks.length === 2) {
      const dx = calibrateClicks[0].x - calibrateClicks[1].x;
      const dy = calibrateClicks[0].y - calibrateClicks[1].y;
      const distPx = Math.hypot(dx, dy);
      const meters = parseFloat(scaleMetersInput.value);
      if (!meters || meters <= 0) {
        alert('Entrez une distance d\'étalonnage (m) correcte avant de calibrer.');
      } else {
        pxToMeter = meters / distPx;
        alert(`Calibré: ${distPx.toFixed(1)} px = ${meters} m → pxToMeter = ${pxToMeter.to6 ? pxToMeter.toFixed(6) : pxToMeter}`);
      }
      calibrateClicks = null;
    } else {
      alert('Point 1 enregistré, cliquez le point 2.');
    }
  }
});

// start camera
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    alert('Impossible d\'accéder à la caméra: ' + err.message);
    console.error(err);
  }
}

startBtn.addEventListener('click', () => {
  if (!running) startTracking();
});
stopBtn.addEventListener('click', () => {
  stopTracking();
});
captureBtn.addEventListener('click', () => {
  exportCSV();
});

targetMsInput.addEventListener('change', () => {
  targetMs = Number(targetMsInput.value) || 10;
});

async function startTracking() {
  await initCamera();
  samples = [];
  baseTime = performance.now();
  lastProcessed = 0;
  running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  loop();
}

function stopTracking() {
  running = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
  updateStatsAndCharts();
}

function loop() {
  animationId = requestAnimationFrame(loop);
  const now = performance.now();
  const elapsed = now - baseTime;
  if (elapsed - lastProcessed >= targetMs) {
    // process frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tSec = Math.round(elapsed) / 1000; // time in seconds (rounded ms), we'll output centiseconds later
    const pos = detectTwoColors(frame);
    // pos: {green: {x,y} | null, pink: {x,y} | null}
    const sample = {
      t: tSec,
      xV: pos.green ? (pxToMeter ? pos.green.x * pxToMeter : pos.green.x) : NaN,
      yV: pos.green ? (pxToMeter ? pos.green.y * pxToMeter : pos.green.y) : NaN,
      xP: pos.pink  ? (pxToMeter ? pos.pink.x  * pxToMeter : pos.pink.x)  : NaN,
      yP: pos.pink  ? (pxToMeter ? pos.pink.y  * pxToMeter : pos.pink.y)  : NaN,
    };
    samples.push(sample);
    lastProcessed = elapsed;
    renderOverlay(pos);
    updateTableRow(sample);
    updateStatsAndCharts();
  }
}

// simple HSV conversion
function rgbToHsv(r,g,b){
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h=0, s=0, v=max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (d !== 0) {
    switch(max){
      case r: h = ((g - b)/d) % 6; break;
      case g: h = ((b - r)/d) + 2; break;
      case b: h = ((r - g)/d) + 4; break;
    }
    h *= 60;
    if (h<0) h+=360;
  }
  return {h, s, v};
}

// detect two blobs: green and pink (ranges tuned empirically)
function detectTwoColors(frame){
  const w = frame.width, h = frame.height;
  const data = frame.data;
  let greenSumX=0, greenSumY=0, greenCount=0;
  let pinkSumX=0, pinkSumY=0, pinkCount=0;

  // iterate with a stride for speed
  const stride = 2; // sample every 2 pixels (performance)
  for(let y=0; y<h; y+=stride){
    for(let x=0; x<w; x+=stride){
      const i = (y*w + x) * 4;
      const r = data[i], g = data[i+1], b = data[i+2];
      const hsv = rgbToHsv(r,g,b);
      // green range (approx): H 80-160, S>0.35, V>0.15
      if (hsv.h >= 70 && hsv.h <= 170 && hsv.s > 0.25 && hsv.v > 0.15 && g > r && g > b){
        greenSumX += x; greenSumY += y; greenCount++;
      }
      // pink/magenta range: H around 300-345 or 340-20 (wrap), S>0.25, V>0.15
      if ((hsv.h >= 300 || hsv.h <= 25) && hsv.s > 0.2 && hsv.v > 0.15 && r > g && r > b){
        pinkSumX += x; pinkSumY += y; pinkCount++;
      }
    }
  }
  const green = greenCount ? { x: greenSumX/greenCount, y: greenSumY/greenCount } : null;
  const pink  = pinkCount ? { x: pinkSumX/pinkCount, y: pinkSumY/pinkCount } : null;
  return {green, pink};
}

// draw overlay markers
function renderOverlay(pos){
  // draw existing frame already in canvas
  ctx.save();
  ctx.lineWidth = 2;
  if (pos.green){
    ctx.strokeStyle = 'lime';
    ctx.beginPath(); ctx.arc(pos.green.x, pos.green.y, 8, 0, Math.PI*2); ctx.stroke();
  }
  if (pos.pink){
    ctx.strokeStyle = 'magenta';
    ctx.beginPath(); ctx.arc(pos.pink.x, pos.pink.y, 8, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

// update table (append last sample)
function updateTableRow(sample){
  nSamplesSpan.textContent = samples.length;
  // show only last 50 rows
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${sample.t.toFixed(3)}</td>
    <td>${Number.isFinite(sample.xV)?sample.xV.toFixed(4):''}</td>
    <td>${Number.isFinite(sample.yV)?sample.yV.toFixed(4):''}</td>
    <td>${Number.isFinite(sample.xP)?sample.xP.toFixed(4):''}</td>
    <td>${Number.isFinite(sample.yP)?sample.yP.toFixed(4):''}</td>
    <td></td><td></td>`;
  dataTableBody.insertBefore(tr, dataTableBody.firstChild);
  // keep table short
  while (dataTableBody.children.length > 200) dataTableBody.removeChild(dataTableBody.lastChild);
}

// compute velocities (simple finite differences) and update charts & stats
let posChart = null, velChart = null;
function updateStatsAndCharts(){
  if (!samples.length) return;
  // compute positions along incline direction — for simplicity, use y coordinate (or x) depending on orientation
  // We'll compute scalar displacement along the direction of motion by difference of projected coordinate.
  // Here: use vertical axis (y) as displacement in pixels/meters (user should align camera).
  const t = samples.map(s => s.t);
  // pick green ball as primary for regression
  const posM = samples.map(s => // use yV (if pxToMeter defined then meters)
    Number.isFinite(s.yV) ? s.yV : NaN
  );

  // compute velocity via central differences (m/s)
  const vel = new Array(samples.length).fill(NaN);
  for (let i=1;i<samples.length;i++){
    const dt = t[i] - t[i-1];
    if (dt > 0) {
      const p1 = posM[i], p0 = posM[i-1];
      if (Number.isFinite(p1) && Number.isFinite(p0)) {
        vel[i] = (p1 - p0) / dt;
      }
    }
  }

  // compute regression for v = a * t (force intercept = 0). Use green ball velocities.
  // choose pairs where vel is finite
  const pairs = [];
  for (let i=0;i<vel.length;i++){
    if (Number.isFinite(vel[i]) && Number.isFinite(t[i])) pairs.push({t:t[i], v: vel[i]});
  }
  let aEst = NaN;
  if (pairs.length >= 2) {
    // least squares with intercept=0 => a = sum(t*v)/sum(t^2)
    let num=0, den=0;
    for (const p of pairs){ num += p.t * p.v; den += p.t * p.t; }
    aEst = den !== 0 ? num/den : NaN;
  }

  // theoretical
  const alphaDeg = Number(angleInput.value) || 0;
  const aTheory = 9.8 * Math.sin(alphaDeg * Math.PI/180);

  aEstimatedSpan.textContent = Number.isFinite(aEst) ? aEst.toFixed(4) : '—';
  aTheorySpan.textContent = aTheory.toFixed(4);

  // prepare chart data: positions (y) and velocity
  // x-axis in seconds
  const posSeries = samples.map((s,i) => ({x: s.t, y: Number.isFinite(s.yV) ? s.yV : null}));
  const velSeries = vel.map((v,i) => ({x: samples[i].t, y: Number.isFinite(v) ? v : null}));

  // create or update Chart.js charts
  if (!posChart) {
    posChart = new Chart(document.getElementById('posChart').getContext('2d'), {
      type: 'line',
      data: {
        datasets: [
          { label: 'Position (balle verte) [m or px]', data: posSeries, showLine: true, spanGaps: true, parsing: false }
        ]
      },
      options: { scales: { x: { type: 'linear', title: {display:true, text:'t (s)'} }, y: { title:{display:true,text:'position'} } } }
    });
  } else {
    posChart.data.datasets[0].data = posSeries;
    posChart.update('none');
  }

  if (!velChart) {
    velChart = new Chart(document.getElementById('velChart').getContext('2d'), {
      type: 'line',
      data: {
        datasets: [
          { label: 'Vitesse (balle verte) [m/s or px/s]', data: velSeries, showLine: true, spanGaps: true, parsing: false }
        ]
      },
      options: { scales: { x: { type: 'linear', title: {display:true, text:'t (s)'} }, y: { title:{display:true,text:'vitesse'} } } }
    });
  } else {
    velChart.data.datasets[0].data = velSeries;
    velChart.update('none');
  }

  // update last table columns for speeds (update first 200 rows)
  const rows = dataTableBody.querySelectorAll('tr');
  for (let i=0;i<rows.length;i++){
    const row = rows[i];
    const idx = samples.length - 1 - i; // mapping row->sample
    if (idx >= 0 && idx < vel.length) {
      const v = vel[idx];
      const vCell = row.cells[5];
      if (vCell) vCell.textContent = Number.isFinite(v) ? v.toFixed(4) : '';
    }
  }
}

// CSV export
function exportCSV(){
  if (!samples.length) { alert('Pas de données'); return; }
  const header = ['t (s)','xV','yV','xP','yP'];
  const rows = samples.map(s => [s.t.toFixed(3), Number.isFinite(s.xV)?s.xV:'', Number.isFinite(s.yV)?s.yV:'', Number.isFinite(s.xP)?s.xP:'', Number.isFinite(s.yP)?s.yP:''].join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'exao_data.csv'; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

// initialize UI
initCamera();
