/*******************************************************
 * RÉFÉRENCES DOM
 *******************************************************/
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const axisCanvas = document.getElementById('3d-axis');
const axisCtx = axisCanvas.getContext('2d');

const luxValue = document.getElementById('lux-value');
const stopwatchElement = document.getElementById('stopwatch');

const angleEl = document.getElementById('angle');
const speedEl = document.getElementById('speed');
const positionEl = document.getElementById('position');
const errorAbsEl = document.getElementById('error-abs');
const errorRelEl = document.getElementById('error-rel');
const equationEl = document.getElementById('equation');

/*******************************************************
 * VARIABLES GLOBALES
 *******************************************************/
let backgroundImage = null;
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];

// Mouvement
let trajectory = [];
let motionDetected = false;

// Paramètres détection
let pixelThreshold = 20;
let minMotionPixels = 200;

// Chronomètre
let stopwatchStartTime = 0;
let stopwatchInterval = null;

/*******************************************************
 * CHRONOMÈTRE
 *******************************************************/
function formatTime(ms) {
    const cs = Math.floor((ms % 1000) / 10);
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}`;
}

function startStopwatch() {
    stopwatchStartTime = Date.now();
    stopwatchInterval = setInterval(() => {
        stopwatchElement.textContent = formatTime(Date.now() - stopwatchStartTime);
    }, 10);
}

function stopStopwatch() {
    clearInterval(stopwatchInterval);
}

/*******************************************************
 * INITIALISATION CAMÉRA
 *******************************************************/
navigator.mediaDevices.getUserMedia({ video: true })
.then(stream => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        axisCanvas.width = video.videoWidth;
        axisCanvas.height = video.videoHeight;
        draw3DAxis();
    };
})
.catch(() => alert("Accès caméra refusé"));

/*******************************************************
 * REPÈRE 3D SIMPLIFIÉ
 *******************************************************/
function draw3DAxis() {
    axisCtx.clearRect(0,0,axisCanvas.width,axisCanvas.height);
    const OX = 0, OY = axisCanvas.height;

    axisCtx.strokeStyle = 'red';
    axisCtx.beginPath();
    axisCtx.moveTo(OX,OY);
    axisCtx.lineTo(axisCanvas.width,OY);
    axisCtx.stroke();
    axisCtx.fillText('X', axisCanvas.width - 20, OY - 10);

    axisCtx.strokeStyle = 'blue';
    axisCtx.beginPath();
    axisCtx.moveTo(OX,OY);
    axisCtx.lineTo(OX,0);
    axisCtx.stroke();
    axisCtx.fillText('Z', 10, 20);

    axisCtx.strokeStyle = 'green';
    axisCtx.beginPath();
    axisCtx.moveTo(OX,OY);
    axisCtx.lineTo(axisCanvas.width * 0.4, axisCanvas.height * 0.6);
    axisCtx.stroke();
    axisCtx.fillText('Y', axisCanvas.width * 0.4 + 5, axisCanvas.height * 0.6);
}

/*******************************************************
 * CAPTURE DU FOND
 *******************************************************/
document.getElementById('capture-bg').addEventListener('click', () => {
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    backgroundImage = ctx.getImageData(0,0,canvas.width,canvas.height);
    luxValue.textContent = calculateLux(backgroundImage);
});

/*******************************************************
 * ENREGISTREMENT
 *******************************************************/
document.getElementById('start-recording').addEventListener('click', () => {
    if (!backgroundImage) {
        alert("Capture du fond obligatoire.");
        return;
    }

    trajectory = [];
    motionDetected = false;
    recordedChunks = [];

    mediaRecorder = new MediaRecorder(video.srcObject);
    mediaRecorder.start();

    isRecording = true;
    startStopwatch();
    motionLoop();
});

document.getElementById('stop-recording').addEventListener('click', () => {
    if (!isRecording) return;

    isRecording = false;
    mediaRecorder.stop();
    stopStopwatch();
});

/*******************************************************
 * DÉTECTION DE MOUVEMENT
 *******************************************************/
function detectMotion() {
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const frame = ctx.getImageData(0,0,canvas.width,canvas.height);

    let count = 0, sx = 0, sy = 0;

    for (let i=0; i<frame.data.length; i+=4) {
        const diff =
            Math.abs(frame.data[i]   - backgroundImage.data[i]) +
            Math.abs(frame.data[i+1] - backgroundImage.data[i+1]) +
            Math.abs(frame.data[i+2] - backgroundImage.data[i+2]);

        if (diff > pixelThreshold) {
            const p = i / 4;
            sx += p % canvas.width;
            sy += Math.floor(p / canvas.width);
            count++;
        }
    }

    if (count > minMotionPixels) {
        if (!motionDetected) motionDetected = true;

        trajectory.push({
            x: sx / count,
            y: 0,
            z: canvas.height - (sy / count),
            t: (Date.now() - stopwatchStartTime) / 1000
        });
    }
}

function motionLoop() {
    if (!isRecording) return;
    detectMotion();
    requestAnimationFrame(motionLoop);
}

/*******************************************************
 * CALCUL VIA BOUTON "CALCULER"
 *******************************************************/
document.getElementById('calculate').addEventListener('click', () => {
    if (trajectory.length < 2) {
        alert("Mouvement insuffisant détecté.");
        return;
    }
    computeMotionResults();
});

/*******************************************************
 * CALCULS PHYSIQUES & AFFICHAGE
 *******************************************************/
function computeMotionResults() {

    const p0 = trajectory[0];
    const pN = trajectory[trajectory.length - 1];

    const dx = pN.x - p0.x;
    const dy = pN.y - p0.y;
    const dz = pN.z - p0.z;
    const dt = pN.t - p0.t;

    if (dt <= 0) {
        alert("Temps invalide.");
        return;
    }

    const vx = dx / dt;
    const vy = dy / dt;
    const vz = dz / dt;

    const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
    const angleXZ = Math.atan2(dz, dx) * 180 / Math.PI;

    const e1 = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const e2 = e1 !== 0 ? e1 / speed : 0;

    angleEl.textContent = angleXZ.toFixed(2);
    speedEl.textContent = speed.toFixed(2);
    positionEl.textContent = `(${pN.x.toFixed(1)}, ${pN.y.toFixed(1)}, ${pN.z.toFixed(1)})`;
    errorAbsEl.textContent = e1.toFixed(2);
    errorRelEl.textContent = e2.toFixed(4);

    equationEl.textContent =
`Équation du mouvement (repère XYZ) :

x(t) = ${p0.x.toFixed(2)} + ${vx.toFixed(2)} t
y(t) = ${p0.y.toFixed(2)} + ${vy.toFixed(2)} t
z(t) = ${p0.z.toFixed(2)} + ${vz.toFixed(2)} t

Angle XZ = ${angleXZ.toFixed(2)} °
Vitesse = ${speed.toFixed(2)} px/s
`;
}

/*******************************************************
 * LUMINOSITÉ
 *******************************************************/
function calculateLux(imageData) {
    let sum = 0;
    for (let i=0; i<imageData.data.length; i+=4) {
        sum += 0.2126*imageData.data[i]
             + 0.7152*imageData.data[i+1]
             + 0.0722*imageData.data[i+2];
    }
    return (sum / (imageData.data.length/4)).toFixed(2);
}
