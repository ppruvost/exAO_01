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
    .then(stream => {
        video.srcObject = stream;
    })
    .catch(err => {
        alert("Erreur webcam : " + err);
    });

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
    if (!backgroundFrame) {
        alert("Capture le fond d'abord");
        return;
    }
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

    let sumX = 0, sumY = 0, count = 0;
    let luxSum = 0;

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

    if (count > 50) {
        const x = sumX / count;
        const z = canvas.height - (sumY / count);
        const y = 0;

        trajectory.push({ t, x, y, z });

        ctx.beginPath();
        ctx.arc(x, canvas.height - z, 5, 0, Math.PI * 2);
        ctx.fillStyle = "red";
        ctx.fill();
    }

    drawAxes();
    updateStopwatch(t);

    animationId = requestAnimationFrame(processFrame);
}

/*********************************************************
 * CHRONO
 *********************************************************/
function updateStopwatch(t) {
    const ms = Math.floor((t % 1) * 100);
    const s = Math.floor(t % 60);
    const m = Math.floor(t / 60);
    stopwatchEl.textContent =
        `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

/*********************************************************
 * AXES XYZ
 *********************************************************/
function drawAxes() {
    axisCtx.clearRect(0, 0, axisCanvas.width, axisCanvas.height);

    axisCtx.strokeStyle = "blue";
    axisCtx.beginPath();
    axisCtx.moveTo(0, axisCanvas.height);
    axisCtx.lineTo(150, axisCanvas.height);
    axisCtx.stroke();

    axisCtx.strokeStyle = "green";
    axisCtx.beginPath();
    axisCtx.moveTo(0, axisCanvas.height);
    axisCtx.lineTo(0, axisCanvas.height - 150);
    axisCtx.stroke();
}

/*********************************************************
 * CALCULS PHYSIQUES
 *********************************************************/
document.getElementById("calculate").onclick = computeMotionResults;

function computeMotionResults() {
    if (trajectory.length < 2) return;

    const p0 = trajectory[0];
    const p1 = trajectory[trajectory.length - 1];

    const dt = p1.t - p0.t;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dz = p1.z - p0.z;

    const speed = Math.sqrt(dx * dx + dz * dz) / dt;
    const angleXZ = Math.atan2(dz, dx) * 180 / Math.PI;

    angleEl.textContent = angleXZ.toFixed(2);
    speedEl.textContent = speed.toFixed(2);
    positionEl.textContent = `(${p1.x.toFixed(1)}, ${p1.y.toFixed(1)}, ${p1.z.toFixed(1)})`;

    error1El.textContent = "0";
    error2El.textContent = "0";

    // Équations
    const ax = dx / dt;
    const ay = dy / dt;
    const az = dz / dt;

    equationEl.textContent =
`Équation du mouvement (repère XYZ)

x(t) = ${p0.x.toFixed(2)} + ${ax.toFixed(2)} t
y(t) = ${p0.y.toFixed(2)} + ${ay.toFixed(2)} t
z(t) = ${p0.z.toFixed(2)} + ${az.toFixed(2)} t

Angle XZ = ${angleXZ.toFixed(2)} °
Vitesse = ${speed.toFixed(2)} px/s`;

    drawAllGraphs();
}

/*********************************************************
 * GRAPHIQUES
 *********************************************************/
function drawAllGraphs() {
    drawGraph("graph-x", trajectory.map(p => ({ t: p.t, v: p.x }), "x(t)", "red");
    drawGraph("graph-y", trajectory.map(p => ({ t: p.t, v: p.y }), "y(t)", "green");
    drawGraph("graph-z", trajectory.map(p => ({ t: p.t, v: p.z }), "z(t)", "blue");
}

function drawGraph(id, data, label, color) {
    const c = document.getElementById(id);
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);

    const pad = 30;
    const w = c.width - 2 * pad;
    const h = c.height - 2 * pad;

    g.strokeStyle = "#000";
    g.beginPath();
    g.moveTo(pad, pad);
    g.lineTo(pad, pad + h);
    g.lineTo(pad + w, pad + h);
    g.stroke();

    const tMin = Math.min(...data.map(p => p.t));
    const tMax = Math.max(...data.map(p => p.t));
    const vMin = Math.min(...data.map(p => p.v));
    const vMax = Math.max(...data.map(p => p.v));

    g.strokeStyle = color;
    g.beginPath();
    data.forEach((p, i) => {
        const x = pad + ((p.t - tMin) / (tMax - tMin)) * w;
        const y = pad + h - ((p.v - vMin) / (vMax - vMin || 1)) * h;
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    });
    g.stroke();

    g.fillStyle = "#000";
    g.fillText(label, pad + 5, pad - 8);
}
