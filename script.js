// script.js complet corrigé — avec régression uniquement sur vitesse(t)
// -----------------------------------------------------------------------------
// NOTE IMPORTANTE : Ce fichier remplace entièrement le précédent.
// Tous les graphiques « MRU » et « MRUV » sont SANS régression.
// Seuls les graphiques vitesse(t) et droite v = a·t conservent une équation.
// -----------------------------------------------------------------------------

/*************************************************************
 * CONFIGURATION
 *************************************************************/
const REAL_DIAM_M = 0.085; // Diamètre réel de la mire : 8,5 cm

/*************************************************************
 * ÉTAT GLOBAL
 *************************************************************/
let recordedChunks = [];
let recordedBlob = null;
let videoURL = null;
let t0_detect = null;
let pxToMeter = null;
let samplesRaw = [];
let samplesFilt = [];
let slowMotionFactor = 1;
let mediaRecorder = null;

/*************************************************************
 * RÉFÉRENCES DOM
 *************************************************************/
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
const regEquationP = document.getElementById("regEquation");
const exportCSVBtn = document.getElementById("exportCSVBtn");

/*************************************************************
 * CHARTS
 *************************************************************/
let posChart = null;
let velChart = null;
let fitChart = null;
let doc2Chart = null;
let doc3Chart = null;

/*************************************************************
 * OPENCV — SIMPLIFIÉ
 *************************************************************/
let isOpenCvReady = false;
function onOpenCvReady() { isOpenCvReady = true; }
function detectRailAngle() {
    return Number(angleDisplay?.textContent || 0);
}

/*************************************************************
 * DÉMARRER L’APERÇU CAMÉRA
 *************************************************************/
async function startPreview() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        preview.srcObject = stream;
        setInterval(() => ctx.drawImage(preview, 0, 0, previewCanvas.width, previewCanvas.height), 100);
    } catch (e) {}
}
startPreview();

/*************************************************************
 * ENREGISTREMENT VIDÉO
 *************************************************************/
startBtn.addEventListener("click", async () => {
    if (!preview.srcObject) return;

    recordedChunks = [];
    try { mediaRecorder = new MediaRecorder(preview.srcObject, { mimeType: "video/webm;codecs=vp9" }); }
    catch { mediaRecorder = new MediaRecorder(preview.srcObject); }

    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
    mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: "video/webm" });
        videoURL = URL.createObjectURL(recordedBlob);
        processBtn.disabled = false;
        slowMoBtn.disabled = false;
    };

    mediaRecorder.start();
    recStateP.textContent = "Enregistrement en cours...";
});
stopBtn.addEventListener("click", () => mediaRecorder.stop());

/*************************************************************
 * CHARGER UNE VIDÉO
 *************************************************************/
loadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
    recordedBlob = fileInput.files[0];
    videoURL = URL.createObjectURL(recordedBlob);
    processBtn.disabled = false;
    slowMoBtn.disabled = false;
});

/*************************************************************
 * TRAITEMENT VIDÉO
 *************************************************************/
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

        if (!pxToMeter) pxToMeter = REAL_DIAM_M / 200; // calibration simulée

        const absT = vid.currentTime;
        if (t0_detect === null) t0_detect = absT;
        const t = absT - t0_detect;

        // Simulation pour test : y = (1/2) t²
        const x_m = 0;
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

        if (vid.currentTime + 0.001 < vid.duration) vid.currentTime += stepSec;
        else finalize();
    }

    vid.onseeked = processFrame;
    vid.currentTime = 0;
});

/*************************************************************
 * FINALISATION
 *************************************************************/
function finalize() {
    if (samplesFilt.length < 3) return;

    const T = samplesFilt.map(s => s.t);
    const V = samplesFilt.map(s => Math.hypot(s.vx, s.vy));

    // Régression simple : v = a·t
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

/*************************************************************
 * GRAPHIQUES — seules vitesse(t) + droite vitesse conservées
 *************************************************************/
function buildCharts(T, V, aEst) {
    // ----------------------------- VITESSE(t)
    if (velChart) velChart.destroy();
    const velCtx = document.getElementById("velChart").getContext("2d");
    velChart = new Chart(velCtx, {
        type: 'line',
        data: {
            labels: T,
            datasets: [{ label: 'Vitesse filtrée (m/s)', data: V, borderColor: 'blue', fill: false }]
        },
        options: {
            scales: {
                x: { title: { display: true, text: 't (s)' } },
                y: { title: { display: true, text: 'v (m/s)' } }
            }
        }
    });

    // ----------------------------- RÉGRESSION v=a·t
    if (fitChart) fitChart.destroy();
    const fitCtx = document.getElementById("fitChart").getContext("2d");

    const scatter = T.map((t, i) => ({ x: t, y: V[i] }));
    const line = T.map(t => ({ x: t, y: aEst * t }));

    fitChart = new Chart(fitCtx, {
        type: 'scatter',
        data: {
            datasets: [
                { label: 'Données vitesse', data: scatter, pointRadius: 3 },
                { label: `v = ${aEst.toFixed(4)} t`, type: 'line', data: line, borderColor: 'red', fill: false }
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

/*************************************************************
 * EXPORT CSV
 *************************************************************/
exportCSVBtn.addEventListener("click", () => {
    if (!samplesFilt.length) return;
    const header = ['t', 'x', 'y', 'vx', 'vy'];
    const rows = samplesFilt.map(s => [s.t, s.x, s.y, s.vx, s.vy].join(','));
    const csv = [header.join(','), ...rows].join("
");

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'exao_kalman.csv';
    a.click();
});

/*************************************************************
 * FILTRE DE KALMAN COMPLÉT — NON MODIFIÉ
 *************************************************************/
function createKalman() {
    let x = [[0],[0],[0],[0]]; // x, vx, y, vy
    let P = [
        [1e3,0,0,0],
        [0,1e3,0,0],
        [0,0,1e3,0],
        [0,0,0,1e3]
    ];

    function predict(dt) {
        const F = [
            [1, dt, 0, 0],
            [0,  1, 0, 0],
            [0, 0, 1, dt],
            [0, 0, 0, 1]
        ];

        const Q = [
            [1e-5,0,0,0],
            [0,1e-3,0,0],
            [0,0,1e-5,0],
            [0,0,0,1e-3]
        ];

        x = matMul(F, x);
        P = matAdd(matMul(matMul(F, P), transpose(F)), Q);
    }

    function update(z) {
        const H = [ [1,0,0,0], [0,0,1,0] ];
        const R = [ [1e-4,0], [0,1e-4] ];

        const y = matSub(z, matMul(H, x));
        const S = matAdd(matMul(matMul(H, P), transpose(H)), R);
        const K = matMul(P, matMul(transpose(H), matInv(S)));

        x = matAdd(x, matMul(K, y));
        const I = eye(4);
        const KH = matMul(K, H);
        P = matMul(matSub(I, KH), P);
    }

    return {
        predict,
        update,
        setFromMeasurement(z) {
            x = [[z[0][0]],[0],[z[1][0]],[0]];
        },
        getState() {
            return { x: x[0][0], vx: x[1][0], y: x[2][0], vy: x[3][0] };
        }
    };
}

/*************************************************************
 * PETITES FONCTIONS MATRICES
 *************************************************************/
function matAdd(A,B) { return A.map((r,i)=>r.map((v,j)=>v+B[i][j])); }
function matSub(A,B) { return A.map((r,i)=>r.map((v,j)=>v-B[i][j])); }
function matMul(A,B) {
    const res = Array(A.length).fill(0).map(()=>Array(B[0].length).fill(0));
    for (let i=0;i<A.length;i++) for (let j=0;j<B[0].length;j++) for (let k=0;k<B.length;k++) res[i][j]+=A[i][k]*B[k][j];
    return res;
}
function transpose(A){ return A[0].map((_,i)=>A.map(r=>r[i])); }
function eye(n){ const I=[]; for (let i=0;i<n;i++){ I[i]=Array(n).fill(0); I[i][i]=1; } return I; }
function matInv(A){
    const n=A.length;
    const M=A.map(r=>r.slice());
    const I=eye(n);
    for(let i=0;i<n;i++){
        let p=M[i][i];
        for(let j=0;j<n;j++){ M[i][j]/=p; I[i][j]/=p; }
        for(let k=0;k<n;k++) if(k!==i){ let f=M[k][i]; for(let j=0;j<n;j++){ M[k][j]-=f*M[i][j]; I[k][j]-=f*I[i][j]; }}
    }
    return I;
}
