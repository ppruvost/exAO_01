/************************************************
 * PARAMÈTRES
 ************************************************/
const SCALE = 2; // mm / pixel

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
const luxValueEl = document.getElementById("lux-value");

/************************************************
 * VARIABLES
 ************************************************/
let backgroundFrame = null;
let trajectory = [];
let recording = false;
let startTime = 0;

let originLocked = false;
let x0 = 0, y0 = 0, z0 = 0;
let lastX = 0, lastY = 0, lastZ = 0;
let refSize = null;

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
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.5;
    const ratio = Math.min(maxWidth / video.videoWidth, maxHeight / video.videoHeight);
    canvas.width = axisCanvas.width = video.videoWidth * ratio;
    canvas.height = axisCanvas.height = video.videoHeight * ratio;
};

/************************************************
 * CAPTURE DU FOND
 ************************************************/
document.getElementById("capture-bg").onclick = () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    backgroundFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/************************************************
 * DETECTION NOMBRE DE LUX
 ************************************************/
function estimateLux(frameData) {
    let sum = 0;
    for (let i = 0; i < frameData.length; i += 4) {
        const r = frameData[i];
        const g = frameData[i + 1];
        const b = frameData[i + 2];
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += luminance;
    }
    const avgLuminance = sum / (frameData.length / 4);
    const lux = avgLuminance * 0.05; // Ajustement pour des valeurs réalistes
    return lux.toFixed(2);
}

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

    const lux = estimateLux(d);
    luxValueEl.textContent = lux;

    let sx = 0, sy = 0, n = 0;
    let minPx = canvas.width, maxPx = 0;
    let minPy = canvas.height, maxPy = 0;

    for (let i = 0; i < d.length; i += 4) {
        const diff = Math.abs(d[i] - bg[i]) + Math.abs(d[i + 1] - bg[i + 1]) + Math.abs(d[i + 2] - bg[i + 2]);
        if (diff > 60) {
            const px = (i / 4) % canvas.width;
            const py = Math.floor((i / 4) / canvas.width);
            sx += px;
            sy += py;
            n++;
            if (px < minPx) minPx = px;
            if (px > maxPx) maxPx = px;
            if (py < minPy) minPy = py;
            if (py > maxPy) maxPy = py;
        }
    }

    if (n > 40) {
        const xc = sx / n;
        const zc_screen = canvas.height - sy / n;
        const blobWidth = maxPx - minPx;
        const blobHeight = maxPy - minPy;
        const blobSize = blobWidth * blobHeight;

        if (!originLocked) {
            x0 = xc;
            z0 = zc_screen;
            refSize = blobSize;
            y0 = 0;
            originLocked = true;
        }

        const sizeRatio = refSize / blobSize;
        const y = y0 + (1 - sizeRatio) * 100;
        const x = xc - x0;
        const z = -(zc_screen - z0);

        trajectory.push({ t, x, y, z });
        lastX = x;
        lastY = y;
        lastZ = z;
    }

    drawPoint();
    updateStopwatch(t);
    requestAnimationFrame(processFrame);
}

/************************************************
 * POINT ROUGE
 ************************************************/
function drawPoint() {
    ctx.beginPath();
    ctx.arc(canvas.width * 0.1 + lastX, canvas.height / 2 - lastZ, 4, 0, Math.PI * 2);
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
    stopwatchEl.textContent = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cent).padStart(2, "0")}`;
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
    const aResult = computeAcceleration(vMod);

    // Correction des signes pour l'affichage
    const formatSign = (value) => (value >= 0 ? `+ ${value.toFixed(3)}` : `- ${Math.abs(value).toFixed(3)}`).replace("+ -", "-");

    angleEl.textContent = Math.abs(Math.atan(zLin.a) * 180 / Math.PI).toFixed(2); // Angle toujours positif
    speedEl.textContent = Math.abs(vMod.b).toFixed(2);

    const finalPosition = trajectory[trajectory.length - 1];
    const finalX = finalPosition.x * SCALE;
    const finalY = finalPosition.y * SCALE;
    const finalZ = finalPosition.z * SCALE;
    positionEl.textContent = `(${finalX.toFixed(3)}, ${finalY.toFixed(3)}, ${finalZ.toFixed(3)}) mm`;

    const theoreticalZ = 0;
    const errorAbs = Math.abs(finalZ - theoreticalZ);
    const errorRel = theoreticalZ !== 0 ? (errorAbs / Math.abs(theoreticalZ)) * 100 : 0;
    error1El.textContent = `Erreur absolue : ${errorAbs.toFixed(3)} mm`;
    error2El.textContent = `Erreur relative : ${errorRel.toFixed(2)} %`;

    equationEl.textContent =
`z(t) = ${formatSign(zLin.b)} ${formatSign(zLin.a)} t
x(t) = ${formatSign(xLin.b)} ${formatSign(xLin.a)} t
y(t) = ${formatSign(yLin.b)}
v(t) = ${formatSign(vMod.b)} ${formatSign(vMod.a)} t
a(t) = ${formatSign(vMod.a)} mm/s²`;

    drawGraph("graph-z", zLin.data, "z(t)");
    drawGraph("graph-x", xLin.data, "x(t)");
    drawGraph("graph-y", yLin.data, "y(t)");
    drawGraph("graph-v", vMod.data, "v(t)");
    drawGraph("graph-a-regression", aResult.regressionData, "a(t)");
};
