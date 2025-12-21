/*********************************************************
 * PARAMÈTRES
 *********************************************************/
const SCALE = 0.002; // mètre par pixel (À ÉTALONNER)

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
 * WEBCAM
 *********************************************************/
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => video.srcObject = stream)
    .catch(console.error);

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
    if (!backgroundFrame) return alert("Capture le fond d'abord");
    trajectory = [];
    recording = true;
    startTime = performance.now();
    animationId = requestAnimationFrame(processFrame);
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

        luxSum += (data[i] + data[i + 1] + data[i + 2]) / 3;

        if (diff > 60) {
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);
            sumX += x;
            sumY += y;
            count++;
        }
    }

    luxValue.textContent = (luxSum / (data.length / 4)).toFixed(1);

    if (count > 50) {
        const x = sumX / count;
        const z = canvas.height - sumY / count;
        trajectory.push({ t, x, z });
    }

    updateStopwatch(t);
    drawAxes();
    animationId = requestAnimationFrame(processFrame);
}

/*********************************************************
 * CALCULS PHYSIQUES
 *********************************************************/
document.getElementById("calculate").onclick = () => {
    if (trajectory.length < 5) return alert("Pas assez de données");

    const regX = linearRegression(trajectory.map(p => p.t), trajectory.map(p => p.x));
    const regZ = linearRegression(trajectory.map(p => p.t), trajectory.map(p => p.z));

    const vx = regX.a * SCALE;
    const vz = regZ.a * SCALE;

    const speed = Math.sqrt(vx * vx + vz * vz);
    const angle = Math.atan2(vz, vx) * 180 / Math.PI;

    angleEl.textContent = angle.toFixed(2);
    speedEl.textContent = speed.toFixed(2);
    positionEl.textContent =
        `(${(trajectory.at(-1).x * SCALE).toFixed(2)}, ${(trajectory.at(-1).z * SCALE).toFixed(2)}) m`;

    equationEl.textContent =
`Équation du mouvement

x(t) = ${regX.b.toFixed(2)} + ${regX.a.toFixed(2)} t
z(t) = ${regZ.b.toFixed(2)} + ${regZ.a.toFixed(2)} t

v = ${speed.toFixed(2)} m/s
Angle = ${angle.toFixed(2)} °`;

    drawAllGraphs();
};

/*********************************************************
 * RÉGRESSION LINÉAIRE
 *********************************************************/
function linearRegression(x, y) {
    const n = x.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;

    for (let i = 0; i < n; i++) {
        sx += x[i];
        sy += y[i];
        sxy += x[i] * y[i];
        sx2 += x[i] * x[i];
    }

    const a = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    const b = (sy - a * sx) / n;
    return { a, b };
}

/*********************************************************
 * GRAPHIQUES
 *********************************************************/
function drawAllGraphs() {
    drawGraph("graph-x", trajectory.map(p => ({ t: p.t, v: p.x * SCALE })), "x(t) (m)");
    drawGraph("graph-z", trajectory.map(p => ({ t: p.t, v: p.z * SCALE })), "z(t) (m)");

    const vData = [];
    const dData = [];
    let d = 0;

    for (let i = 1; i < trajectory.length; i++) {
        const dt = trajectory[i].t - trajectory[i - 1].t;
        const dx = (trajectory[i].x - trajectory[i - 1].x) * SCALE;
        const dz = (trajectory[i].z - trajectory[i - 1].z) * SCALE;
        const v = Math.sqrt(dx * dx + dz * dz) / dt;
        d += v * dt;

        vData.push({ t: trajectory[i].t, v });
        dData.push({ t: trajectory[i].t, v: d });
    }

    drawGraph("graph-y", vData, "v(t) (m/s)");
    drawGraph("graph-z", dData, "d(t) (m)");
}

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
    const vMax = Math.max(...data.map(p => p.v)) || vMin + 1;

    g.beginPath();
    data.forEach((p, i) => {
        const x = pad + (p.t - tMin) / (tMax - tMin) * w;
        const y = pad + h - (p.v - vMin) / (vMax - vMin) * h;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();

    g.fillText(label, pad + 5, pad - 8);
}
