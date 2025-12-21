/*********************************************************
 * PARAMÈTRES D'ÉTALONNAGE
 *********************************************************/
const SCALE = 0.002; // m / pixel  (ex : 1 px = 2 mm → À AJUSTER)

/*********************************************************
 * VARIABLES GLOBALES
 *********************************************************/
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const axisCanvas = document.getElementById("3d-axis");
const axisCtx = axisCanvas.getContext("2d");

const luxValue = document.getElementById("lux-value");
const stopwatchEl = document.getElementById("stopwatch");

const angleEl = document.getElementById("angle-value");
const speedEl = document.getElementById("speed-value");
const positionEl = document.getElementById("position-value");
const error1El = document.getElementById("error1-value");
const error2El = document.getElementById("error2-value");
const equationEl = document.getElementById("equation");

let backgroundFrame = null;
let recording = false;
let trajectory = [];
let startTime = null;
let animationId = null;

/*********************************************************
 * ACCÈS WEBCAM
 *********************************************************/
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => video.srcObject = stream)
    .catch(err => alert("Erreur webcam : " + err.message));

video.addEventListener("loadedmetadata", () => {
    canvas.width = axisCanvas.width = video.videoWidth;
    canvas.height = axisCanvas.height = video.videoHeight;
});

/*********************************************************
 * CAPTURE DU FOND
 *********************************************************/
document.getElementById("capture-bg").onclick = () => {
    ctx.drawImage(video, 0, 0);
    backgroundFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/*********************************************************
 * ENREGISTREMENT
 *********************************************************/
document.getElementById("start-recording").onclick = () => {
    if (!backgroundFrame) return alert("Capturer le fond d'abord");
    trajectory = [];
    recording = true;
    startTime = performance.now();
    requestAnimationFrame(processFrame);
};

document.getElementById("stop-recording").onclick = () => {
    recording = false;
    cancelAnimationFrame(animationId);
};

/*********************************************************
 * TRAITEMENT IMAGE
 *********************************************************/
function processFrame(timestamp) {
    if (!recording) return;

    const t = (timestamp - startTime) / 1000;
    ctx.drawImage(video, 0, 0);

    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bg = backgroundFrame.data;
    const data = frame.data;

    let sumX = 0, sumY = 0, count = 0, luxSum = 0;

    for (let i = 0; i < data.length; i += 4) {
        const diff =
            Math.abs(data[i] - bg[i]) +
            Math.abs(data[i + 1] - bg[i + 1]) +
            Math.abs(data[i + 2] - bg[i + 2]);

        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        luxSum += brightness;

        if (diff > 60) {
            const px = (i / 4) % canvas.width;
            const py = Math.floor((i / 4) / canvas.width);
            sumX += px;
            sumY += py;
            count++;
        }
    }

    luxValue.textContent = (luxSum / (data.length / 4)).toFixed(1);

    if (count > 40) {
        const x = sumX / count;
        const z = canvas.height - (sumY / count);
        trajectory.push({ t, x, z });
        ctx.beginPath();
        ctx.arc(x, canvas.height - z, 4, 0, Math.PI * 2);
        ctx.fillStyle = "red";
        ctx.fill();
    }

    drawAxes();
    updateStopwatch(t);
    animationId = requestAnimationFrame(processFrame);
}

/*********************************************************
 * CHRONOMÈTRE
 *********************************************************/
function updateStopwatch(t) {
    const ms = Math.floor((t % 1) * 100);
    const s = Math.floor(t % 60);
    const m = Math.floor(t / 60);
    stopwatchEl.textContent =
        `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(ms).padStart(2,"0")}`;
}

/*********************************************************
 * AXES
 *********************************************************/
function drawAxes() {
    axisCtx.clearRect(0, 0, axisCanvas.width, axisCanvas.height);
    axisCtx.strokeStyle = "red";
    axisCtx.beginPath();
    axisCtx.moveTo(0, axisCanvas.height / 2);
    axisCtx.lineTo(axisCanvas.width, axisCanvas.height / 2);
    axisCtx.stroke();
}

/*********************************************************
 * CALCULS PHYSIQUES
 *********************************************************/
document.getElementById("calculate").onclick = computeResults;

function computeResults() {
    if (trajectory.length < 5) return alert("Pas assez de données");

    const p0 = trajectory[0];
    const pN = trajectory.at(-1);
    const dt = pN.t - p0.t;

    const dx = (pN.x - p0.x) * SCALE;
    const dz = (pN.z - p0.z) * SCALE;

    const speed = Math.sqrt(dx * dx + dz * dz) / dt;
    const angle = Math.atan2(dz, dx) * 180 / Math.PI;

    angleEl.textContent = angle.toFixed(2);
    speedEl.textContent = speed.toFixed(3);
    positionEl.textContent = `(${dx.toFixed(2)} , ${dz.toFixed(2)}) m`;
    error1El.textContent = "—";
    error2El.textContent = "—";

    equationEl.textContent =
`Équation du mouvement (repère XZ)

x(t) = ${(p0.x*SCALE).toFixed(2)} + ${(dx/dt).toFixed(2)} t
z(t) = ${(p0.z*SCALE).toFixed(2)} + ${(dz/dt).toFixed(2)} t

Angle XZ = ${angle.toFixed(2)} °
Vitesse moyenne = ${speed.toFixed(3)} m/s`;

    drawAllGraphs();
}

/*********************************************************
 * GRAPHIQUES
 *********************************************************/
function drawAllGraphs() {

    drawGraph("graph-x", trajectory.map(p => ({ t: p.t, v: p.x * SCALE })), "x(t) m");
    drawGraph("graph-z", trajectory.map(p => ({ t: p.t, v: p.z * SCALE })), "z(t) m");

    const vData = [];
    const dData = [];
    const aData = [];
    let d = 0;

    for (let i = 1; i < trajectory.length; i++) {
        const dt = trajectory[i].t - trajectory[i-1].t;
        const dx = (trajectory[i].x - trajectory[i-1].x) * SCALE;
        const dz = (trajectory[i].z - trajectory[i-1].z) * SCALE;
        const v = Math.sqrt(dx*dx + dz*dz) / dt;

        d += v * dt;
        vData.push({ t: trajectory[i].t, v });
        dData.push({ t: trajectory[i].t, v: d });

        if (vData.length > 1) {
            const dv = v - vData.at(-2).v;
            aData.push({ t: trajectory[i].t, v: dv / dt });
        }
    }

    drawGraph("graph-v", vData, "v(t) m/s");
    drawGraph("graph-d", dData, "d(t) m");
    drawGraph("graph-a", aData, "a(t) m/s²");
}

/*********************************************************
 * FONCTION DE DESSIN GÉNÉRIQUE
 *********************************************************/
function drawGraph(id, data, label) {
    const c = document.getElementById(id);
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);

    const pad = 30;
    const w = c.width - 2 * pad;
    const h = c.height - 2 * pad;

    g.strokeRect(pad, pad, w, h);
    if (data.length < 2) return;

    const tMin = data[0].t;
    const tMax = data.at(-1).t;
    const vMin = Math.min(...data.map(p => p.v));
    const vMax = Math.max(...data.map(p => p.v));

    g.beginPath();
    data.forEach((p, i) => {
        const x = pad + ((p.t - tMin) / (tMax - tMin)) * w;
        const y = pad + h - ((p.v - vMin) / (vMax - vMin || 1)) * h;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
    });
    g.strokeStyle = "#000";
    g.stroke();

    g.fillText(label, pad + 5, pad - 8);
}
