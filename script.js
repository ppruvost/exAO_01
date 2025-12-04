/*************************************************************
 * script.js - exAO_01 avec calibration par mire (8,5 cm)
 ************************************************************/

/* ------------------------- CONFIG ------------------------- */
const REAL_DIAM_M = 0.085; // Diamètre réel de la mire : 8,5 cm
const MIN_PIXELS_FOR_DETECT = 40;

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
const angleInput = document.getElementById("angleInput");
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

/* ---------------------- inclinaison du rail ----------------------------------- */
let isOpenCvReady = false;

function onOpenCvReady() {
  console.log("OpenCV.js est prêt !");
  isOpenCvReady = true;
}

function detectRailAngle(imgData) {
  if (!isOpenCvReady) {
    console.error("OpenCV.js n'est pas prêt.");
    return null;
  }

  // Convertir l'image en format OpenCV
  const src = cv.imread(previewCanvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // Appliquer un filtre de Canny pour détecter les contours
  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150, 3);

  // Détecter les lignes avec la transformation de Hough
  const lines = new cv.Mat();
  cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 50, 10);

  // Trouver la ligne principale et calculer son angle
  let maxLength = 0;
  let mainLineAngle = 0;

  for (let i = 0; i < lines.rows; ++i) {
    const startPoint = new cv.Point(lines.data32S[i * 4], lines.data32S[i * 4 + 1]);
    const endPoint = new cv.Point(lines.data32S[i * 4 + 2], lines.data32S[i * 4 + 3]);

    // Calculer la longueur de la ligne
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Si cette ligne est plus longue que la ligne principale actuelle, la prendre comme nouvelle ligne principale
    if (length > maxLength) {
      maxLength = length;
      mainLineAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    }
  }

  // Convertir l'angle en une valeur positive et au 1/10 de degré près
  mainLineAngle = Math.abs(mainLineAngle);
  mainLineAngle = Math.round(mainLineAngle * 10) / 10;

  // Libérer les matrices OpenCV
  src.delete();
  gray.delete();
  edges.delete();
  lines.delete();

  return mainLineAngle;
}
/* ------------------------------------------------------------------------- */
function processFrame() {
  try {
    ctx.drawImage(vid, 0, 0, previewCanvas.width, previewCanvas.height);
    const img = ctx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);

    // Détecter l'angle du rail
    const railAngle = detectRailAngle(previewCanvas);
    if (railAngle !== null) {
      angleInput.value = railAngle;
    }

    // Suite du traitement...
  } catch (err) {
    console.error("processFrame error", err);
  }
}

/* ------------------------- Calibration: estimate pixels->meters using the mire ------------------------- */
function estimatePxToMeter(imgData) {
    // Simule la détection du diamètre du cercle de la mire (à remplacer par OpenCV.js)
    const diamPx = 200; // Exemple : diamètre en pixels
    if (!diamPx || diamPx <= 2) return null;
    return REAL_DIAM_M / diamPx;
}

/* ------------------------- Camera preview + overlay ------------------------- */
async function startPreview() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        preview.srcObject = stream;
        setInterval(() => {
            try {
                ctx.drawImage(preview, 0, 0, previewCanvas.width, previewCanvas.height);
                const img = ctx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
                const pos = detectBall(img, 4);
                if (pos) {
                    ctx.beginPath();
                    ctx.strokeStyle = "lime";
                    ctx.lineWidth = 3;
                    ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
                    ctx.stroke();
                }
            } catch (e) { }
        }, 120);
    } catch (e) {
        console.warn("preview failed", e);
    }
}

startPreview();

/* ------------------------- Recording handlers ------------------------- */
startBtn.addEventListener("click", async () => {
    if (!preview.srcObject) {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            preview.srcObject = s;
        } catch (e) {
            alert("Accès caméra refusé");
            return;
        }
    }
    recordedChunks = [];
    try {
        mediaRecorder = new MediaRecorder(preview.srcObject, { mimeType: "video/webm;codecs=vp9" });
    } catch (e) {
        mediaRecorder = new MediaRecorder(preview.srcObject);
    }
    mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: "video/webm" });
        videoURL = URL.createObjectURL(recordedBlob);
        processBtn.disabled = false;
        slowMoBtn.disabled = false;
        blobSizeP.textContent = `Vidéo enregistrée (${(recordedBlob.size / 1024 / 1024).toFixed(2)} MB)`;
    };
    mediaRecorder.start();
    recStateP.textContent = "État : enregistrement...";
    startBtn.disabled = true;
    stopBtn.disabled = false;
});

stopBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    recStateP.textContent = "État : arrêté";
    startBtn.disabled = false;
    stopBtn.disabled = true;
});

loadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (!f) return;
    recordedBlob = f;
    videoURL = URL.createObjectURL(f);
    processBtn.disabled = false;
    slowMoBtn.disabled = false;
    blobSizeP.textContent = `Fichier chargé (${(f.size / 1024 / 1024).toFixed(2)} MB)`;
});

/* ------------------------- Process recorded video ------------------------- */
processBtn.addEventListener("click", async () => {
    if (!videoURL) {
        alert("Aucune vidéo. Enregistrez ou chargez un fichier.");
        return;
    }

    // Réinitialisation des données
    samplesRaw = [];
    samplesFilt = [];
    pxToMeter = null;
    t0_detect = null;
    nSamplesSpan.textContent = "0";
    aEstimatedSpan.textContent = "—";
    aTheorySpan.textContent = "—";
    regEquationP.textContent = "Équation : —";
    exportCSVBtn.disabled = true;

    const vid = document.createElement("video");
    vid.src = videoURL;
    vid.muted = true;
    await new Promise((res, rej) => {
        vid.onloadedmetadata = () => res();
        vid.onerror = e => rej(e);
    });

    const stepSec = Math.max(1, Number(frameStepMsInput.value) || 10) / 1000;
    const kf = createKalman();
    let initialized = false;
    let prevT = null;

    function processFrame() {
        try {
            ctx.drawImage(vid, 0, 0, previewCanvas.width, previewCanvas.height);
            const img = ctx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);

            // Calibration avec la mire
            if (!pxToMeter) {
                pxToMeter = estimatePxToMeter(img);
                if (pxToMeter) {
                    pxToMeterDisplay.textContent = `Échelle : ${pxToMeter.toFixed(6)} m/px`;
                }
            }

            // Détection de la balle
            const pos = detectBall(img, 2);
            const absT = vid.currentTime * slowMotionFactor;
            let relT = null;
            if (pos) {
                if (t0_detect === null) t0_detect = absT;
                relT = absT - t0_detect;
            }

            if (pos) {
                const x_px = pos.x, y_px = pos.y;
                const x_m = pxToMeter ? x_px * pxToMeter : NaN;
                const y_m = pxToMeter ? y_px * pxToMeter : NaN;
                samplesRaw.push({ t: relT, x_px, y_px, x_m, y_m });

                if (pxToMeter && Number.isFinite(x_m) && Number.isFinite(y_m)) {
                    const z = [[x_m], [y_m]];
                    if (!initialized) {
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
                    samplesFilt.push({ t: relT, x: st.x, y: st.y, vx: st.vx, vy: st.vy });

                    // Affichage des positions
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(255,0,0,0.7)";
                    ctx.lineWidth = 2;
                    ctx.arc(x_px, y_px, 6, 0, Math.PI * 2);
                    ctx.stroke();

                    const fx_px = pxToMeter ? st.x / pxToMeter : st.x;
                    const fy_px = pxToMeter ? st.y / pxToMeter : st.y;
                    ctx.beginPath();
                    ctx.strokeStyle = "cyan";
                    ctx.lineWidth = 2;
                    ctx.arc(fx_px, fy_px, 10, 0, Math.PI * 2);
                    ctx.stroke();
                    nSamplesSpan.textContent = String(samplesRaw.length);
                }
            }

            if (vid.currentTime + 0.0001 < vid.duration) {
                vid.currentTime = Math.min(vid.duration, vid.currentTime + stepSec);
            } else {
                finalize();
                return;
            }
        } catch (err) {
            console.error("processFrame error", err);
            finalize();
            return;
        }
    }

    vid.onseeked = processFrame;
    vid.currentTime = 0;
});

/* ------------------------- Finalize analysis ------------------------- */
function finalize() {
    if (samplesFilt.length < 3) {
        alert("Données insuffisantes après filtrage (vérifiez détection / calibration).");
        return;
    }

    // Calcul de l'accélération estimée
    const T = samplesFilt.map(s => s.t);
    const V = samplesFilt.map(s => Math.hypot(s.vx, s.vy));
    let num = 0, den = 0;
    for (let i = 0; i < T.length; i++) {
        if (Number.isFinite(V[i]) && Number.isFinite(T[i])) {
            num += T[i] * V[i];
            den += T[i] * T[i];
        }
    }
    const aEst = den ? num / den : NaN;

    // Calcul de l'accélération théorique
    const alphaDeg = Number(angleInput.value) || 0;
    const aTheory = 9.8 * Math.sin(alphaDeg * Math.PI / 180);

    // Mise à jour des éléments HTML
    aEstimatedSpan.textContent = Number.isFinite(aEst) ? aEst.toFixed(4) : "—";
    aTheorySpan.textContent = aTheory.toFixed(4);
    regEquationP.textContent = Number.isFinite(aEst) ? `v = ${aEst.toFixed(4)} · t` : "Équation : —";

    // Création des graphiques
    buildCharts(samplesFilt, aEst);

    // Affichage des graphiques MRU ou MRUV selon l'angle
    if (alphaDeg === 0) {
        buildDoc2_MRU(samplesFilt);
    } else {
        buildDoc3_MRUV(samplesFilt);
    }

    // Activation du bouton d'export CSV
    exportCSVBtn.disabled = false;
}

/* ------------------------- Build charts ------------------------- */
function buildCharts(filteredSamples, aEst) {
    const T = filteredSamples.map(s => s.t);
    const Y = filteredSamples.map(s => s.y);
    const V = filteredSamples.map(s => Math.hypot(s.vx, s.vy));

    // Graphique de position
    const posCtx = document.getElementById("posChart").getContext("2d");
    if (posChart) posChart.destroy();
    posChart = new Chart(posCtx, {
        type: 'line',
        data: {
            labels: T,
            datasets: [{
                label: 'Position filtrée y (m)',
                data: Y,
                borderColor: 'cyan',
                fill: false
            }]
        },
        options: {
            scales: {
                x: { title: { display: true, text: 't (s)' } },
                y: { title: { display: true, text: 'y (m)' } }
            }
        }
    });

    // Graphique de vitesse
    const velCtx = document.getElementById("velChart").getContext("2d");
    if (velChart) velChart.destroy();
    velChart = new Chart(velCtx, {
        type: 'line',
        data: {
            labels: T,
            datasets: [{
                label: 'Vitesse filtrée (m/s)',
                data: V,
                borderColor: 'magenta',
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

    // Graphique de régression
    const fitCtx = document.getElementById("fitChart").getContext("2d");
    if (fitChart) fitChart.destroy();
    const points = T.map((t, i) => ({ x: t, y: V[i] }));
    const fitLine = T.map(t => ({ x: t, y: aEst * t }));
    fitChart = new Chart(fitCtx, {
        type: 'scatter',
        data: {
            datasets: [
                { label: 'Vitesse filtrée', data: points, pointRadius: 3, backgroundColor: 'red' },
                { label: 'Ajustement v = a·t', data: fitLine, type: 'line', borderColor: 'orange', fill: false }
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

/* ------------------------- Document MRU : (t, x) ------------------------- */
function buildDoc2_MRU(samples) {
    const canvas = document.getElementById("doc2Chart");
    if (!canvas) {
        console.warn("Canvas #doc2Chart non trouvé dans le DOM.");
        return;
    }
    const ctx = canvas.getContext("2d");
    if (doc2Chart) doc2Chart.destroy();
    const T = samples.map(s => s.t);
    const X = samples.map(s => s.x);
    doc2Chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: T,
            datasets: [{
                label: "Position x (m)",
                data: X,
                borderColor: "red",
                fill: false,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: true } },
            scales: {
                x: { title: { display: true, text: "t (s)" } },
                y: { title: { display: true, text: "x (m)" } }
            }
        }
    });
}

/* ------------------------- Document MRUV : (t, y) ------------------------- */
function buildDoc3_MRUV(samples) {
    const canvas = document.getElementById("doc3Chart");
    if (!canvas) {
        console.warn("Canvas #doc3Chart non trouvé dans le DOM.");
        return;
    }
    const ctx = canvas.getContext("2d");
    if (doc3Chart) doc3Chart.destroy();
    const T = samples.map(s => s.t);
    const Y = samples.map(s => s.y);

    // Régression quadratique
    const n = T.length;
    let S0 = n, S1 = 0, S2 = 0, S3 = 0, S4 = 0;
    let SX = 0, STX = 0, ST2X = 0;
    for (let i = 0; i < n; i++) {
        const t = T[i], x = Y[i], t2 = t * t;
        S1 += t;
        S2 += t2;
        S3 += t2 * t;
        S4 += t2 * t2;
        SX += x;
        STX += t * x;
        ST2X += t2 * x;
    }

    const M = [[S4, S3, S2], [S3, S2, S1], [S2, S1, S0]];
    const V = [ST2X, STX, SX];

    function solve3(M, V) {
        const [a, b, c] = M[0];
        const [d, e, f] = M[1];
        const [g, h, i] = M[2];
        const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
        if (Math.abs(det) < 1e-12) return [0, 0, 0];
        const Dx = (V[0] * (e * i - f * h) - b * (V[1] * i - f * V[2]) + c * (V[1] * h - e * V[2]));
        const Dy = (a * (V[1] * i - f * V[2]) - V[0] * (d * i - f * g) + c * (d * V[2] - V[1] * g));
        const Dz = (a * (e * V[2] - V[1] * h) - b * (d * V[2] - V[1] * g) + V[0] * (d * h - e * g));
        return [Dx / det, Dy / det, Dz / det];
    }

    const [A, B, C] = solve3(M, V);
    const a = 2 * A;
    const fit = T.map(t => A * t * t + B * t + C);

    doc3Chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: T,
            datasets: [
                { label: "Position y (m)", data: Y, borderColor: "blue", fill: false, pointRadius: 3 },
                { label: `Fit: a=${a.toFixed(3)} m/s²`, data: fit, borderColor: "darkblue", fill: false, pointRadius: 0, borderDash: [6, 4] }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: true } },
            scales: {
                x: { title: { display: true, text: "t (s)" } },
                y: { title: { display: true, text: "y (m)" } }
            }
        }
    });
}

/* ------------------------- Export CSV ------------------------- */
exportCSVBtn.addEventListener("click", () => {
    if (!samplesFilt.length) {
        alert("Aucune donnée filtrée.");
        return;
    }
    const header = ['t(s)', 'x(m)', 'y(m)', 'vx(m/s)', 'vy(m/s)'];
    const rows = samplesFilt.map(s => [s.t.toFixed(4), s.x.toFixed(6), s.y.toFixed(6), s.vx.toFixed(6), s.vy.toFixed(6)].join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'exao_kalman_filtered.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
});

/* ------------------------- Ralenti toggle ------------------------- */
slowMoBtn.addEventListener("click", () => {
    if (slowMotionFactor === 1) {
        slowMotionFactor = 0.25;
        slowMoBtn.textContent = "Ralenti ×1 (normal)";
    } else {
        slowMotionFactor = 1;
        slowMoBtn.textContent = "Ralenti ×0.25";
    }
});

/* ------------------------- Kalman Filter ------------------------- */
function createKalman() {
    let x = [[0], [0], [0], [0]]; // [x, vx, y, vy]
    let P = [[1e3, 0, 0, 0], [0, 1e3, 0, 0], [0, 0, 1e3, 0], [0, 0, 0, 1e3]];
    const qPos = 1e-5, qVel = 1e-3;
    const Q = [[qPos, 0, 0, 0], [0, qVel, 0, 0], [0, 0, qPos, 0], [0, 0, 0, qVel]];
    const H = [[1, 0, 0, 0], [0, 0, 1, 0]];
    const R = [[1e-6, 0], [0, 1e-6]];

    function predict(dt) {
        const F = [[1, dt, 0, 0], [0, 1, 0, 0], [0, 0, 1, dt], [0, 0, 0, 1]];
        x = matMul(F, x);
        P = add(matMul(matMul(F, P), transpose(F)), Q);
    }

    function update(z) {
        const y_resid = sub(z, matMul(H, x));
        const S = add(matMul(matMul(H, P), transpose(H)), R);
        const K = matMul(matMul(P, transpose(H)), inv2x2(S));
        x = add(x, matMul(K, y_resid));
        const I = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
        const KH = matMul(K, H);
        P = matMul(sub(I, KH), P);
    }

    function setFromMeasurement(z) {
        x = [[z[0][0]], [0], [z[1][0]], [0]];
        P = [[1e-1, 0, 0, 0], [0, 1e-1, 0, 0], [0, 0, 1e-1, 0], [0, 0, 0, 1e-1]];
    }

    function getState() {
        return { x: x[0][0], vx: x[1][0], y: x[2][0], vy: x[3][0] };
    }

    return { predict, update, getState, setFromMeasurement };
}

/* ------------------------- Matrix helpers ------------------------- */
function identity(n, scale = 1) {
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? scale : 0))
    );
}

function transpose(A) {
    return A[0].map((_, c) => A.map(r => r[c]));
}

function matMul(A, B) {
    const aR = A.length, aC = A[0].length, bC = B[0].length;
    const C = Array.from({ length: aR }, () =>
        Array.from({ length: bC }, () => 0)
    );
    for (let i = 0; i < aR; i++) {
        for (let k = 0; k < aC; k++) {
            const aik = A[i][k];
            for (let j = 0; j < bC; j++) {
                C[i][j] += aik * B[k][j];
            }
        }
    }
    return C;
}

function add(A, B) {
    return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}

function sub(A, B) {
    return A.map((row, i) => row.map((v, j) => v - B[i][j]));
}

function inv2x2(M) {
    const a = M[0][0], b = M[0][1], c = M[1][0], d = M[1][1];
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-12) return [[1e12, 0], [0, 1e12]];
    return [[d / det, -b / det], [-c / det, a / det]];
}
