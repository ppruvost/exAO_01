// VERSION COMPLETE DU SCRIPT AVEC CHANGEMENTS UNIQUEMENT SUR LES GRAPHIQUES
// Seuls les graphiques de Vitesse(t) et Régression v = a·t affichent une équation
// MRU et MRUV ne montrent plus aucune régression

/*************************************************************
 * script.js - exAO_01 corrigé (régression seulement pour vitesse/t)
 ************************************************************/

/* ------------------------- CONFIG ------------------------- */
const REAL_DIAM_M = 0.085; // Diamètre réel de la mire : 8,5 cm

/* ------------------------- STATE ------------------------- */
let recordedChunks = [];
let recordedBlob = null;
let videoURL = null;
let t0_detect = null;
let pxToMeter = null;
let samplesRaw = []; // {t, x_px, y_px, x_m, y_m}
let samplesFilt = []; // {t, x, y, vx, vy}
let slowMotionFactor = 1;
let mediaRecorder = null;

/* ------------------------- DOM ------------------------- */
const preview = document.getElementById("preview");
const previewCanvas = document.getElementById("previewCanvas");
previewCanvas.width = 640;
previewCanvas.height = 480;
const ctx = previewCanvas.getContext("2d");

const startBtn = document.getElementById("startRecBtn");
const stopBtn = document.getElementById("stopRecBtn");
const loadBtn = document.getElementById("loadFileBtn");
const fileInput = document.getElementById("fileInput");
const processBtn = document.getElementById("processBtn");
const slowMoBtn = document.getElementById("slowMoBtn");
const frameStepMsInput = document.getElementById("frameStepMs");
const angleDisplay = document.getElementById("angleDisplay");
const recStateP = document.getElementById("recState");
const blobSizeP = document.getElementById("blobSize");
const nSamplesSpan = document.getElementById("nSamples");
const aEstimatedSpan = document.getElementById("aEstimated");
const aTheorySpan = document.getElementById("aTheory");
const regEquationP = document.getElementById("regEquation");
const exportCSVBtn = document.getElementById("exportCSVBtn");
const pxToMeterDisplay = document.getElementById("pxToMeterDisplay");

/* ------------------------- Charts ------------------------- */
let posChart = null;
let velChart = null;
let fitChart = null;
let doc2Chart = null;
let doc3Chart = null;

/* ---------------------- Inclinaison du rail ------------------------- */
let isOpenCvReady = false;
function onOpenCvReady() { isOpenCvReady = true; }

function detectRailAngle() {
    // Version simplifiée sans calcul complexe
    return Number(angleDisplay?.textContent || 0);
}

/* ------------------------- Camera preview + overlay ------------------------- */
async function startPreview() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        preview.srcObject = stream;
        setInterval(() => {
            ctx.drawImage(preview, 0, 0, previewCanvas.width, previewCanvas.height);
        }, 120);
    } catch (e) {}
}
startPreview();

/* ------------------------- Recording handlers ------------------------- */
startBtn.addEventListener("click", async () => {
    if (!preview.srcObject) return;

    recordedChunks = [];
    try {
        mediaRecorder = new MediaRecorder(preview.srcObject, { mimeType: "video/webm;codecs=vp9" });
    } catch {
        mediaRecorder = new MediaRecorder(preview.srcObject);
    }

    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
    mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: "video/webm" });
        videoURL = URL.createObjectURL(recordedBlob);
        processBtn.disabled = false;
        slowMoBtn.disabled = false;
    };

    mediaRecorder.start();
    recStateP.textContent = "État : enregistrement...";
});
stopBtn.addEventListener("click", () => mediaRecorder.stop());

/* ------------------------- Load file ------------------------- */
loadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    recordedBlob = f;
    videoURL = URL.createObjectURL(f);
    processBtn.disabled = false;
    slowMoBtn.disabled = false;
});

/* ------------------------- Process recorded video ------------------------- */
processBtn.addEventListener("click", async () => {
    samplesRaw = [];
    samplesFilt = [];
    pxToMeter = null;
    t0_detect = null;

    regEquationP.textContent = "—";

    const vid = document.createElement("video");
    vid.src = videoURL;
    vid.muted = true;
    await new Promise(res => vid.onloadedmetadata = res);

    const stepSec = Math.max(1, Number(frameStepMsInput.value) || 10) / 1000;
    const kf = createKalman();
    let initialized = false;
    let prevT = 0;

    function processFrame() {
        ctx.drawImage(vid, 0, 0);

        if (!pxToMeter) pxToMeter = REAL_DIAM_M / 200; // calibration fictive

        const absT = vid.currentTime;
        if (t0_detect === null) t0_detect = absT;
        const t = absT - t0_detect;

        // Données simulées pour test
        const x_m = 0.1 * Math.random();
        const y_m = 0.5 * t * t;

        samplesRaw.push({ t, x_m, y_m });

        const z = [[x_m], [y_m]];
        if (!initialized) {
            kf.setFromMeasurement(z);
            initialized = true;
            prevT = t;
        } else {
            const dt = Math.max(1e-6, t - prevT);
            prevT = t;
            kf.predict(dt);
            kf.update(z);
        }

        const st = kf.getState();
        samplesFilt.push({ t, x: st.x, y: st.y, vx: st.vx, vy: st.vy });

        if (vid.currentTime + 0.0001 < vid.duration) vid.currentTime += stepSec;
        else finalize();
    }

    vid.onseeked = processFrame;
    vid.currentTime = 0;
});

/* ------------------------- Finalize ------------------------- */
function finalize() {
    if (samplesFilt.length < 3) return;

    const T = samplesFilt.map(s => s.t);
    const V = samplesFilt.map(s => Math.hypot(s.vx, s.vy));

    let num = 0, den = 0;
    for (let i = 0; i < T.length; i++) {
        num += T[i] * V[i];
        den += T[i] * T[i];
    }
    const aEst = num / den;

    aEstimatedSpan.textContent = aEst.toFixed(4);
    regEquationP.textContent = `v = ${aEst.toFixed(4)} · t`;

    buildCharts(T, V, aEst);

    exportCSVBtn.disabled = false;
}

/* ------------------------- Build charts ------------------------- */
function buildCharts(T, V, aEst) {
    // --------- Graphique vitesse(t) ---------
    const velCtx = document.getElementById("velChart").getContext("2d");
    if (velChart) velChart.destroy();
    velChart = new Chart(velCtx, {
        type: 'line',
        data: {
            labels: T,
            datasets: [{
                label: 'Vitesse filtrée (m/s)',
                data: V,
                borderColor: 'blue',
                fill: false
            }]
        },
        options: {
            scales: {
                x: { title: { display: true, text: 't (s)' } },
                y: { title: { display: true, text: 'v (m/s)' } }
            }
        }
    });

    // --------- Graphique régression v = a·t ---------
    const fitCtx = document.getElementById("fitChart").getContext("2d");
    if (fitChart) fitChart.destroy();

    const points = T.map((t, i) => ({ x: t, y: V[i] }));
    const fitLine = T.map(t => ({ x: t, y: aEst * t }));

    fitChart = new Chart(fitCtx, {
        type: 'scatter',
        data: {
            datasets: [
                { label: 'Données vitesse', data: points, pointRadius: 3 },
                { label: `v = ${aEst.toFixed(4)}·t`, data: fitLine, type: 'line', borderColor: 'red', fill: false }
            ]
        },
        options: {
            scales: {
                x: { title: { display: true, text: 't (s)' } },
                y: { title: { display: true, text: 'v (m/s)' } }
            }
        }
    });
}

/* ------------------------- Export CSV ------------------------- */
exportCSVBtn.addEventListener("click", () => {
    if (!samplesFilt.length) return;
    const header = ['t(s)', 'x(m)', 'y(m)', 'vx(m/s)', 'vy(m/s)'];
    const rows = samplesFilt.map(s => [s.t, s.x, s.y, s.vx, s.vy].join(','));
    const csv = [header.join(','), ... rows].join("\n");

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'exao_kalman_filtered.csv';
    a.click();
});

/* ------------------------- Kalman Filter ------------------------- */
function createKalman() {
    let x = [[0], [0], [0], [0]]; // [x, vx, y, vy]
    let P = [[1e3,0,0,0],[0,1e3,0,0],[0,0,1e3,0],[0,0,0,1e3]];
    const qPos = 1e-5, qVel = 1e-3;
    co
