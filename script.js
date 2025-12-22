/************************************************
 * PARAMÈTRES
 ************************************************/
const SCALE = 0.002; // m / pixel

/************************************************
 * DOM
 ************************************************/
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const axisCanvas = document.getElementById("3d-axis");
const axisCtx = axisCanvas.getContext("2d");

const angleEl = document.getElementById("angle-value");
const speedEl = document.getElementById("speed-value");
const positionEl = document.getElementById("position-value");
const equationEl = document.getElementById("equation");
const stopwatchEl = document.getElementById("stopwatch");
const error1El = document.getElementById("error1-value");
const error2El = document.getElementById("error2-value");

/************************************************
 * VARIABLES
 ************************************************/
let backgroundFrame = null;
let trajectory = [];
let recording = false;
let startTime = 0;

let originLocked = false;
let x0 = 0, z0 = 0;
let lastX = 0, lastZ = 0;

/************************************************
 * WEBCAM (COMPATIBLE MOBILE)
 ************************************************/
navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false
})
.then(stream => video.srcObject = stream)
.catch(err => alert("Erreur webcam : " + err.message));

/************************************************
 * DIMENSIONS CANVAS
 ************************************************/
video.onloadedmetadata = () => {
    canvas.width = axisCanvas.width = video.videoWidth;
    canvas.height = axisCanvas.height = video.videoHeight;
};

/************************************************
 * CAPTURE DU FOND
 ************************************************/
document.getElementById("capture-bg").onclick = () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    backgroundFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/************************************************
 * ENREGISTREMENT
 ************************************************/
document.getElementById("start-recording").onclick = () => {
    if (!backgroundFrame) {
        alert("Veuillez d'abord capturer le fond");
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
function processFrame(tStamp) {
    if (!recording) return;

    const t = (tStamp - startTime) / 1000;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bg = backgroundFrame.data;
    const d = frame.data;

    let sx = 0, sy = 0, n = 0;

    for (let i = 0; i < d.length; i += 4) {
        const diff =
            Math.abs(d[i] - bg[i]) +
            Math.abs(d[i + 1] - bg[i + 1]) +
            Math.abs(d[i + 2] - bg[i + 2]);

        if (diff > 60) {
            const px = (i / 4) % canvas.width;
            const py = Math.floor((i / 4) / canvas.width);
            sx += px;
            sy += py;
            n++;
        }
    }

    if (n > 40) {
        const xc = sx / n;
        const zc_screen = canvas.height - sy / n;

        if (!originLocked) {
            x0 = xc;
            z0 = zc_screen;
            originLocked = true;
        }

        const x = xc - x0;
        const z = -(zc_screen - z0);

        trajectory.push({ t, x, z });
        lastX = x;
        lastZ = z;
    }

    drawPoint();
    updateStopwatch(t);
    requestAnimationFrame(processFrame);
}

/************************************************
 * POINT ROUGE (t=0 À GAUCHE)
 ************************************************/
function drawPoint() {
    ctx.beginPath();
    ctx.arc(
        canvas.width * 0.1 + lastX,
        canvas.height / 2 - lastZ,
        4,
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
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    const cent = Math.floor((t % 1) * 100);

    stopwatchEl.textContent =
        `${String(min).padStart(2, "0")}:` +
        `${String(sec).padStart(2, "0")}.` +
        `${String(cent).padStart(2, "0")}`;
}

/************************************************
 * CALCULS & GRAPHES
 ************************************************/
document.getElementById("calculate").onclick = () => {
    if (trajectory.length < 5) {
        alert("Pas assez de données");
        return;
    }

    const zLin = computeZLinear(trajectory, SCALE);
    const xLin = computeXLinear(trajectory, SCALE);
    const yLin = computeYLinear(trajectory, SCALE);
    const vMod = computeVelocityModel(trajectory, SCALE);
    const aData = computeAcceleration(vMod);

    // Débogage : afficher les données de a(t)
    console.log("Données de a(t) :", aData);
    console.log("Valeur de l'accélération (vMod.a) :", vMod.a);

    angleEl.textContent = (Math.atan(zLin.a) * 180 / Math.PI).toFixed(2);
    speedEl.textContent = Math.abs(vMod.b).toFixed(2);

    // Calculer la position finale
    const finalPosition = trajectory[trajectory.length - 1];
    const finalX = finalPosition.x * SCALE;
    const finalZ = finalPosition.z * SCALE;
    positionEl.textContent = `(${finalX.toFixed(3)}, 0, ${finalZ.toFixed(3)})`;

    // Exemple de calcul d'erreur
    const theoreticalZ = 0;
    const errorAbs = Math.abs(finalZ - theoreticalZ);
    const errorRel = theoreticalZ !== 0 ? (errorAbs / Math.abs(theoreticalZ)) * 100 : 0;
    error1El.textContent = `Erreur absolue : ${errorAbs.toFixed(3)} m`;
    error2El.textContent = `Erreur relative : ${errorRel.toFixed(2)} %`;

    equationEl.textContent =
`z(t) = ${zLin.b.toFixed(3)} + ${zLin.a.toFixed(3)} t
x(t) = ${xLin.b.toFixed(3)} + ${xLin.a.toFixed(3)} t
y(t) = ${yLin.b.toFixed(3)}
v(t) = ${vMod.a.toFixed(3)} t + ${vMod.b.toFixed(3)}
a(t) = ${vMod.a.toFixed(3)} m/s²`;

    drawGraph("graph-z", zLin.data, "z(t)");
    drawGraph("graph-x", xLin.data, "x(t)");
    drawGraph("graph-y", yLin.data, "y(t)");
    drawGraph("graph-v", vMod.data, "v(t)");
    drawGraph("graph-a", aData, "a(t)");
};

/************************************************
 * GRAPHIQUES (TRAITS NOIRS, SANS POINTS)
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

    if (data.length < 2) {
        console.warn(`Pas assez de données pour dessiner le graphe ${label}`);
        return;
    }

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

    g.fillStyle = "#000";
    g.fillText(label, p + 5, p - 8);
}
