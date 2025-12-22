/************************************************
 * PARAMÈTRES
 ************************************************/
const SCALE = 0.002; // m / pixel
const SMOOTH = 0.85; // lissage trajectoire

/************************************************
 * DOM
 ************************************************/
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const angleEl = document.getElementById("angle-value");
const speedEl = document.getElementById("speed-value");
const equationEl = document.getElementById("equation");
const stopwatchEl = document.getElementById("stopwatch");

/************************************************
 * VARIABLES
 ************************************************/
let backgroundFrame = null;
let trajectory = [];
let recording = false;
let startTime = 0;

let originLocked = false;
let x0 = 0, z0 = 0;

let lastX = 0;
let lastZ = 0;

/************************************************
 * WEBCAM (MOBILE OK)
 ************************************************/
navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false
}).then(stream => video.srcObject = stream);

/************************************************
 * CANVAS
 ************************************************/
video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
};

/************************************************
 * CAPTURE FOND
 ************************************************/
document.getElementById("capture-bg").onclick = () => {
    ctx.drawImage(video, 0, 0);
    backgroundFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/************************************************
 * ENREGISTREMENT
 ************************************************/
document.getElementById("start-recording").onclick = () => {
    if (!backgroundFrame) {
        alert("Capture le fond d'abord");
        return;
    }
    trajectory = [];
    originLocked = false;
    recording = true;
    startTime = performance.now();
    stopwatchEl.textContent = "00:00.00";
    requestAnimationFrame(processFrame);
};

document.getElementById("stop-recording").onclick = () => {
    recording = false;
};

/************************************************
 * TRAITEMENT VIDÉO
 ************************************************/
function processFrame(ts) {
    if (!recording) return;

    const t = (ts - startTime) / 1000;

    ctx.drawImage(video, 0, 0);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bg = backgroundFrame.data;
    const d = frame.data;

    let sx = 0, sy = 0, n = 0;

    for (let i = 0; i < d.length; i += 4) {
        const diff =
            Math.abs(d[i] - bg[i]) +
            Math.abs(d[i + 1] - bg[i + 1]) +
            Math.abs(d[i + 2] - bg[i + 2]);

        if (diff > 55) {
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);
            sx += x;
            sy += y;
            n++;
        }
    }

    if (n > 30) {
        const xc = sx / n;
        const zc = canvas.height - sy / n;

        if (!originLocked) {
            x0 = xc;
            z0 = zc;
            originLocked = true;
            lastX = 0;
            lastZ = 0;
        }

        const x = xc - x0;
        const z = -(zc - z0); // altitude physique

        // 🔧 LISSAGE
        lastX = SMOOTH * lastX + (1 - SMOOTH) * x;
        lastZ = SMOOTH * lastZ + (1 - SMOOTH) * z;

        trajectory.push({ t, x: lastX, z: lastZ });
    }

    drawPoint();
    updateStopwatch(t);
    requestAnimationFrame(processFrame);
}

/************************************************
 * POINT ROUGE (DERNIÈRE POSITION TOUJOURS)
 ************************************************/
function drawPoint() {
    ctx.beginPath();
    ctx.arc(
        canvas.width * 0.1 + lastX,
        canvas.height / 2 - lastZ,
        5,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = "red";
    ctx.fill();
}

/************************************************
 * CHRONOMÈTRE
 ************************************************/
function updateStopwatch(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const c = Math.floor((t % 1) * 100);
    stopwatchEl.textContent =
        `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

/************************************************
 * CALCULS & GRAPHES
 ************************************************/
document.getElementById("calculate").onclick = () => {
    if (trajectory.length < 10) {
        alert("Pas assez de données");
        return;
    }

    const zData = trajectory.map(p => ({
        t: p.t,
        v: p.z * SCALE
    }));

    const vData = [];
    for (let i = 1; i < trajectory.length; i++) {
        const dt = trajectory[i].t - trajectory[i - 1].t;
        if (dt > 0) {
            vData.push({
                t: trajectory[i].t,
                v: (trajectory[i].z - trajectory[i - 1].z) * SCALE / dt
            });
        }
    }

    const vLin = linearRegression(vData);
    const aVal = vLin.a;

    const aData = vData.map(p => ({
        t: p.t,
        v: aVal
    }));

    angleEl.textContent =
        (Math.atan(vLin.a) * 180 / Math.PI).toFixed(2);

    speedEl.textContent = Math.abs(vLin.b).toFixed(2);

    equationEl.textContent =
`z(t) = ${zData[0].v.toFixed(3)} + ${vLin.b.toFixed(3)} t
v(t) = ${vLin.a.toFixed(3)} t + ${vLin.b.toFixed(3)}
a(t) = ${aVal.toFixed(3)} m/s²`;

    drawGraph("graph-z", zData, "z(t)");
    drawGraph("graph-v", vData, "v(t)");
    drawGraph("graph-a", aData, "a(t)");
};

/************************************************
 * RÉGRESSION LINÉAIRE
 ************************************************/
function linearRegression(data) {
    const n = data.length;
    let st = 0, sv = 0, stt = 0, stv = 0;

    data.forEach(p => {
        st += p.t;
        sv += p.v;
        stt += p.t * p.t;
        stv += p.t * p.v;
    });

    const a = (n * stv - st * sv) / (n * stt - st * st);
    const b = (sv - a * st) / n;

    return { a, b };
}

/************************************************
 * GRAPHIQUES (TRAITS FINS NOIRS)
 ************************************************/
function drawGraph(id, data, label) {
    const c = document.getElementById(id);
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);

    const p = 30;
    const w = c.width - 2 * p;
    const h = c.height - 2 * p;

    g.strokeStyle = "#000";
    g.lineWidth = 1;
    g.strokeRect(p, p, w, h);

    if (data.length < 2) return;

    const t0 = data[0].t;
    const t1 = data[data.length - 1].t;
    const vMin = Math.min(...data.map(d => d.v));
    const vMax = Math.max(...data.map(d => d.v)) || 1;

    g.beginPath();
    data.forEach((pt, i) => {
        const x = p + (pt.t - t0) / (t1 - t0) * w;
        const y = p + h - (pt.v - vMin) / (vMax - vMin) * h;
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    });
    g.stroke();

    g.fillText(label, p + 5, p - 8);
}
