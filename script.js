/************************************************************
 * script.js - exAO_02 (version intégrée : MRUA/MRUV/X(t)/CSV)
 * Compatible webcam USB + smartphone (caméra arrière)
 ************************************************************/

/* -------------------------
   CONFIG
   ------------------------- */
const REAL_DIAM_M = 0.15; // 15 cm
const MIN_PIXELS_FOR_DETECT = 40;

/* -------------------------
   STATE
   ------------------------- */
let recordedChunks = [];
let recordedBlob = null;
let videoURL = null;
let t0_detect = null;

let pxToMeter = null;
let samplesRaw = [];
let samplesFilt = [];
let slowMotionFactor = 1;

let mediaRecorder = null;

/* -------------------------
   DOM
   ------------------------- */
const preview = document.getElementById("preview");
const previewCanvas = document.getElementById("previewCanvas");
if (previewCanvas) {
  previewCanvas.width = 640;
  previewCanvas.height = 480;
}
const ctx = previewCanvas?.getContext("2d");

const startBtn = document.getElementById("startRecBtn");
const stopBtn  = document.getElementById("stopRecBtn");
const loadBtn  = document.getElementById("loadFileBtn");
const fileInput = document.getElementById("fileInput");

const processBtn = document.getElementById("processBtn");
const slowMoBtn = document.getElementById("slowMoBtn");

const frameStepMsInput = document.getElementById("frameStepMs");
const angleInput = document.getElementById("angleInput");

const recStateP = document.getElementById("recState");
const blobSizeP = document.getElementById("blobSize");

const nSamplesSpan = document.getElementById("nSamples");
const aEstimatedSpan = document.getElementById("aEstimated");
const aTheorySpan = document.getElementById("aTheory");
const regEquationP = document.getElementById("regEquation");

const exportCSVBtn = document.getElementById("exportCSVBtn");

/* Charts */
let posChart = null, velChart = null, fitChart = null;
let doc2Chart = null, doc3Chart = null;

/* -------------------------
   Utilities: RGB -> HSV
   ------------------------- */
function rgbToHsv(r,g,b){
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h=0, s=0, v=max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (d !== 0){
    if (max === r) h = (g - b)/d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r)/d + 2;
    else h = (r - b)/d + 4;
    h *= 60;
  }
  return {h, s, v};
}

/* -------------------------
   Detection
   ------------------------- */
function detectBall(imgData, stride=2){
  const data = imgData.data;
  const W = imgData.width, H = imgData.height;
  let sumX=0, sumY=0, count=0;

  for (let y=0; y<H; y+=stride){
    for (let x=0; x<W; x+=stride){
      const i = (y*W + x)*4;
      const r = data[i], g = data[i+1], b = data[i+2];
      const hsv = rgbToHsv(r,g,b);
      const ok = hsv.h >= 28 && hsv.h <= 55 && hsv.s >= 0.22 && hsv.v >= 0.45;
      if (!ok) continue;
      if (r+g+b < 120) continue;
      sumX += x; sumY += y; count++;
    }
  }
  if (count < MIN_PIXELS_FOR_DETECT) return null;
  return { x: sumX/count, y: sumY/count, count };
}

/* -------------------------
   Calibration
   ------------------------- */
function estimatePxToMeter(imgData){
  const data = imgData.data;
  const W = imgData.width, H = imgData.height;
  let found = [];
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i = (y*W + x)*4;
      const r = data[i], g = data[i+1], b = data[i+2];
      const hsv = rgbToHsv(r,g,b);
      if (hsv.h >= 28 && hsv.h <= 55 && hsv.s >= 0.22 && hsv.v >= 0.45 && (r+g+b>120)){
        found.push({x,y});
      }
    }
  }
  if (found.length < 200) return null;
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  for (const p of found){
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const diamPx = Math.max(maxX-minX, maxY-minY);
  if (diamPx <= 2) return null;
  return REAL_DIAM_M / diamPx;
}

/* -------------------------
   Kalman
   ------------------------- */
function createKalman(){
  let x = [[0],[0],[0],[0]];
  let P = identity(4, 1e3);
  const qPos = 1e-5, qVel = 1e-3;
  let Q = [[qPos,0,0,0],[0,qVel,0,0],[0,0,qPos,0],[0,0,0,qVel]];
  const H = [ [1,0,0,0], [0,0,1,0] ];
  let R = [ [1e-6,0], [0,1e-6] ];

  function predict(dt){
    const F = [[1,dt,0,0],[0,1,0,0],[0,0,1,dt],[0,0,0,1]];
    x = matMul(F, x);
    P = add( matMul( matMul(F,P), transpose(F) ), Q );
  }
  function update(z){
    const y_resid = sub(z, matMul(H, x));
    const S = add( matMul( matMul(H, P), transpose(H) ), R );
    const K = matMul( matMul(P, transpose(H)), inv2x2(S) );
    x = add(x, matMul(K, y_resid));
    const I = identity(4);
    const KH = matMul(K,H);
    P = matMul( sub(I, KH), P );
  }
  function setFromMeasurement(z){
    x = [[z[0][0]],[0],[z[1][0]],[0]];
    P = identity(4, 1e-1);
  }
  function getState(){ return { x: x[0][0], vx: x[1][0], y: x[2][0], vy: x[3][0] }; }
  return { predict, update, getState, setFromMeasurement };
}

/* -------------------------
   Matrix helpers
   ------------------------- */
function identity(n, scale=1){ return Array.from({length:n}, (_,i)=>Array.from({length:n}, (_,j)=>i===j?scale:0)); }
function transpose(A){ return A[0].map((_,c)=>A.map(r=>r[c])); }
function matMul(A,B){
  const aR=A.length,aC=A[0].length,bC=B[0].length;
  const C=Array.from({length:aR},()=>Array.from({length:bC},()=>0));
  for (let i=0;i<aR;i++) for (let k=0;k<aC;k++) for (let j=0;j<bC;j++) C[i][j]+=A[i][k]*B[k][j];
  return C;
}
function add(A,B){ return A.map((row,i)=>row.map((v,j)=>v+B[i][j])); }
function sub(A,B){ return A.map((row,i)=>row.map((v,j)=>v-B[i][j])); }
function inv2x2(M){ const [a,b,c,d]=[M[0][0],M[0][1],M[1][0],M[1][1]]; const det=a*d-b*c; if(Math.abs(det)<1e-12) return [[1e12,0],[0,1e12]]; return [[d/det,-b/det],[-c/det,a/det]]; }

/* -------------------------
   Camera preview
   ------------------------- */
async function startPreview(){
  if(!ctx || !preview) return;
  try {
    let constraints = { video:{ width:640, height:480 } };
    if (navigator.userAgent.match(/iPhone|iPad|iPod|Android/i)){
      constraints.video.facingMode = { exact:"environment" };
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    preview.srcObject = stream;
    setInterval(()=>{
      try{
        ctx.drawImage(preview,0,0,previewCanvas.width,previewCanvas.height);
        const img = ctx.getImageData(0,0,previewCanvas.width,previewCanvas.height);
        const pos = detectBall(img,4);
        if(pos){ ctx.beginPath(); ctx.strokeStyle="lime"; ctx.lineWidth=3; ctx.arc(pos.x,pos.y,12,0,Math.PI*2); ctx.stroke(); }
      }catch(e){}
    },120);
  } catch(e){ console.warn("preview failed", e); }
}
startPreview();

/* -------------------------
   Recording handlers
   ------------------------- */
startBtn?.addEventListener("click", async ()=>{
  if(!preview.srcObject){ 
    try{ preview.srcObject=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480}}); } 
    catch(e){ alert("Accès caméra refusé"); return; } 
  }
  recordedChunks=[];
  try{ mediaRecorder=new MediaRecorder(preview.srcObject,{ mimeType:"video/webm;codecs=vp9"}); } 
  catch(e){ mediaRecorder=new MediaRecorder(preview.srcObject); }
  mediaRecorder.ondataavailable = e=>{ if(e.data?.size) recordedChunks.push(e.data); };
  mediaRecorder.onstop = async ()=>{
    recordedBlob=new Blob(recordedChunks,{ type:"video/webm" });
    videoURL=URL.createObjectURL(recordedBlob);
    processBtn.disabled=false; slowMoBtn.disabled=false;
    blobSizeP&&(blobSizeP.textContent=`Vidéo enregistrée (${(recordedBlob.size/1024/1024).toFixed(2)} MB)`);
    try{ processBtn.click(); } catch(e){ console.error(e); }
  };
  mediaRecorder.start();
  recStateP&&(recStateP.textContent="État : enregistrement...");
  startBtn.disabled=true; stopBtn.disabled=false;
});
stopBtn?.addEventListener("click",()=>{
  if(mediaRecorder && mediaRecorder.state!=="inactive") mediaRecorder.stop(); 
  recStateP&&(recStateP.textContent="État : arrêté"); 
  startBtn.disabled=false; stopBtn.disabled=true;
});
loadBtn?.addEventListener("click",()=>fileInput.click());
fileInput?.addEventListener("change",()=>{
  const f=fileInput.files[0]; 
  if(!f) return; 
  recordedBlob=f; 
  videoURL=URL.createObjectURL(f); 
  processBtn.disabled=false; slowMoBtn.disabled=false; 
  blobSizeP&&(blobSizeP.textContent=`Fichier chargé (${(f.size/1024/1024).toFixed(2)} MB)`); 
  try{ processBtn.click(); } catch(e){ console.error(e); } 
});

/* -------------------------
   Process video
   ------------------------- */
processBtn?.addEventListener("click", async ()=>{
  if (!videoURL) { alert("Aucune vidéo. Enregistre ou charge un fichier."); return; }

  samplesRaw = []; samplesFilt = []; pxToMeter = null;
  t0_detect = null;
  nSamplesSpan&&(nSamplesSpan.textContent = "0");
  aEstimatedSpan&&(aEstimatedSpan.textContent = "—");
  aTheorySpan&&(aTheorySpan.textContent = "—");
  regEquationP&&(regEquationP.textContent = "Équation : —");
  exportCSVBtn.disabled = true;

  const vid = document.createElement("video");
  vid.src = videoURL;
  vid.muted = true;

  await new Promise((res,rej)=> { vid.onloadedmetadata = ()=> res(); vid.onerror = e=> rej(e); });

  const stepSec = Math.max(1, Number(frameStepMsInput?.value) || 10)/1000;

  const kf = createKalman();
  let initialized = false;
  let prevT = null;

  function processFrame(){
    try {
      ctx.drawImage(vid, 0, 0, previewCanvas.width, previewCanvas.height);
      const img = ctx.getImageData(0,0,previewCanvas.width,previewCanvas.height);

      if (!pxToMeter){
        const cal = estimatePxToMeter(img);
        if (cal) {
          pxToMeter = cal;
          const pxDisp = document.getElementById("pxToMeterDisplay");
          if (pxDisp) pxDisp.textContent = pxToMeter.toFixed(6) + " m/px";
        }
      }

      const pos = detectBall(img, 2);
      const absT = vid.currentTime * slowMotionFactor;

      let relT = null;
      if (pos){
        if (t0_detect === null) t0_detect = absT;
        relT = absT - t0_detect;
      }

      if (pos){
        const x_px = pos.x, y_px = pos.y;
        const x_m = pxToMeter ? x_px * pxToMeter : NaN;
        const y_m = pxToMeter ? y_px * pxToMeter : NaN;

        samplesRaw.push({t: relT, x_px, y_px, x_m, y_m});

        if (pxToMeter && Number.isFinite(x_m) && Number.isFinite(y_m)){
          const z = [[x_m],[y_m]];
          if (!initialized){
            kf.setFromMeasurement(z);
            initialized = true;
            prevT = relT;
          } else {
            const dt = Math.max(1e-6, relT - prevT);
            kf.predict(dt);
            kf.update(z);
            prevT = relT;
          }
          const st = kf.getState();
          samplesFilt.push({t: relT, x: st.x, y: st.y, vx: st.vx, vy: st.vy});

          ctx.beginPath(); ctx.strokeStyle = "rgba(255,0,0,0.7)"; ctx.lineWidth = 2;
          ctx.arc(x_px, y_px, 6, 0, Math.PI*2); ctx.stroke();

          const fx_px = pxToMeter ? st.x / pxToMeter : st.x;
          const fy_px = pxToMeter ? st.y / pxToMeter : st.y;
          ctx.beginPath(); ctx.strokeStyle = "cyan"; ctx.lineWidth = 2;
          ctx.arc(fx_px, fy_px, 10, 0, Math.PI*2); ctx.stroke();

          nSamplesSpan&&(nSamplesSpan.textContent = String(samplesRaw.length));
        }
      }

      if (vid.currentTime + 0.0001 < vid.duration) {
        vid.currentTime = Math.min(vid.duration, vid.currentTime + stepSec);
      } else {
        finalize();
        return;
      }
    } catch(err){
      console.error("processFrame error", err);
      finalize();
      return;
    }
  }

  vid.onseeked = processFrame;
  vid.currentTime = 0;
});

/* -------------------------
   Finalize analysis
   ------------------------- */
function finalize(){
  if (samplesFilt.length < 3){
    alert("Données insuffisantes après filtrage (vérifie détection / calibration).");
    return;
  }

  const T = samplesFilt.map(s=>s.t);
  const V = samplesFilt.map(s=>Math.hypot(s.vx, s.vy));
  const Y = samplesFilt.map(s=>s.y);
  const X = samplesFilt.map(s=>s.x);

  let num=0, den=0;
  for (let i=0;i<T.length;i++){
    if (Number.isFinite(V[i]) && Number.isFinite(T[i])){
      num += T[i]*V[i];
      den += T[i]*T[i];
    }
  }
  const aEst = den ? num/den : NaN;

  const alphaDeg = Number(angleInput?.value || 0);
  const aTheory = 9.8 * Math.sin(alphaDeg * Math.PI/180);

  aEstimatedSpan&&(aEstimatedSpan.textContent = Number.isFinite(aEst) ? aEst.toFixed(4) : "—");
  aTheorySpan&&(aTheorySpan.textContent = aTheory.toFixed(4));
  regEquationP&&(regEquationP.textContent = Number.isFinite(aEst) ? `v = ${aEst.toFixed(4)} · t` : "Équation : —");

  buildCharts(samplesFilt, aEst);

  const y0 = samplesFilt[0].y;
  const v0_y = samplesFilt[0].vy;
  const a_theo = aTheory;
  const y_theo = T.map(t => y0 + v0_y * t + 0.5 * a_theo * t * t);

  if (alphaDeg === 0) {
    buildDoc2_MRU(samplesFilt);
  } else {
    buildDoc3_MRUV(samplesFilt);
    if (doc3Chart) {
      const labels = T;
      const ds = { label: `Théorie a=g·sinθ (${a_theo.toFixed(4)} m/s²)`, data: y_theo, borderColor: 'green', borderDash:[6,4], fill:false, pointRadius:0 };
      let found = false;
      doc3Chart.data.datasets.forEach((d,i)=>{
        if (d.label && d.label.startsWith("Théorie a=g·sinθ")) { doc3Chart.data.datasets[i] = ds; found = true; }
      });
      if (!found) doc3Chart.data.datasets.push(ds);
      doc3Chart.update();
    }
  }

  exportCSVBtn.disabled = false;
  try { exportCSVAuto(); } catch(e){ console.error("export CSV auto failed", e); }
}

/* -------------------------
   Build charts
   ------------------------- */
function buildCharts(filteredSamples, aEst){
  const T = filteredSamples.map(s=>s.t);
  const Y = filteredSamples.map(s=>s.y);
  const X = filteredSamples.map(s=>s.x);
  const V = filteredSamples.map(s=>Math.hypot(s.vx, s.vy));

  if (posChart) posChart.destroy();
  posChart = new Chart(document.getElementById("posChart"), {
    type: 'line',
    data: {
      labels: T,
      datasets: [
        { label: 'Position filtrée y (m)', data: Y, borderColor:'cyan', fill:false },
        { label: 'Position filtrée x (m)', data: X, borderColor:'red', fill:false }
      ]
    },
    options: { scales:{ x:{ title:{display:true,text:'t (s)'} }, y:{ title:{display:true,text:'position (m)'} } } }
  });

  if (velChart) velChart.destroy();
  velChart = new Chart(document.getElementById("velChart"), {
    type: 'line',
    data: { labels: T, datasets: [{ label: 'Vitesse filtrée (m/s)', data: V, borderColor:'magenta', fill:false }] },
    options: { scales:{ x:{ title:{display:true,text:'t (s)'} }, y:{ title:{display:true,text:'v (m/s)'} } } }
  });

  const points = T.map((t,i)=>({x:t, y: V[i]}));
  const fitLine = T.map(t => ({x:t, y: aEst * t}));

  if (fitChart) fitChart.destroy();
  fitChart = new Chart(document.getElementById("fitChart"), {
    type: 'scatter',
    data: {
      datasets: [
        { label: 'Vitesse filtrée', data: points, pointRadius:3 },
        { label: 'Ajustement v = a·t', data: fitLine, type:'line', borderColor:'orange', fill:false }
      ]
    },
    options: { scales:{ x:{ title:{display:true,text:'t (s)'} }, y:{ title:{display:true,text:'v (m/s)'} } } }
  });
}

/* -------------------------
   Export CSV
   ------------------------- */
function exportCSVAuto(){
  if (!samplesFilt.length) { console.warn("Aucune donnée filtrée : CSV non généré."); return; }
  const alphaDeg = Number(angleInput?.value || 0);
  const aTheory = 9.8 * Math.sin(alphaDeg * Math.PI/180);
  const y0 = samplesFilt[0].y;
  const v0 = samplesFilt[0].vy;

  const header = ['t(s)','x(m)','y(m)','vx(m/s)','vy(m/s)','y_theo(m)','aTheory(m/s2)'];
  const rows = samplesFilt.map(s => {
    const y_theo = (s.t===0) ? y0 : (y0 + v0*s.t + 0.5*aTheory*s.t*s.t);
    return [s.t.toFixed(4), s.x.toFixed(6), s.y.toFixed(6), s.vx.toFixed(6), s.vy.toFixed(6), y_theo.toFixed(6), aTheory.toFixed(6)].join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `exao_kalman_filtered_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  console.log("CSV exporté automatiquement.");
}

exportCSVBtn?.addEventListener("click", exportCSVAuto);

/* -------------------------
   Ralenti toggle
   ------------------------- */
slowMoBtn?.addEventListener("click", ()=>{
  if (slowMotionFactor === 1) {
    slowMotionFactor = 0.25;
    slowMoBtn.textContent = "Ralenti ×1 (normal)";
  } else {
    slowMotionFactor = 1;
    slowMoBtn.textContent = "Ralenti ×0.25";
  }
});
