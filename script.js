/********************************************************
 * VARIABLES GLOBALES
 ********************************************************/
let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d', { willReadFrequently: true });

let axisCanvas = document.getElementById('3d-axis');
let axisContext = axisCanvas.getContext('2d');

let backgroundImage = null;
let luxValue = document.getElementById('lux-value');

let isRecording = false;
let mediaRecorder;
let recordedChunks = [];

// Chronomètre
let stopwatchInterval;
let stopwatchStartTime;
let stopwatchElement = document.getElementById('stopwatch');

// Mouvement
let motionDetected = false;
let motionStartTime = 0;
let motionEndTime = 0;
let trajectory = [];

let pixelThreshold = 30;
let minMotionPixels = 500;


/********************************************************
 * CHRONOMÈTRE
 ********************************************************/
function formatTime(ms) {
    let cs = Math.floor((ms % 1000) / 10);
    let s = Math.floor(ms / 1000) % 60;
    let m = Math.floor(ms / 60000) % 60;
    let h = Math.floor(ms / 3600000);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}`;
}

function startStopwatch() {
    stopwatchStartTime = Date.now();
    clearInterval(stopwatchInterval);
    stopwatchInterval = setInterval(() => {
        stopwatchElement.textContent = formatTime(Date.now() - stopwatchStartTime);
    }, 10);
}

function stopStopwatch() {
    clearInterval(stopwatchInterval);
}

function resetStopwatch() {
    stopwatchElement.textContent = '00:00:00.00';
}


/********************************************************
 * INITIALISATION CAMÉRA
 ********************************************************/
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
.catch(err => {
    console.error(err);
    alert("Accès caméra refusé");
});


/********************************************************
 * REPÈRE 3D
 ********************************************************/
function draw3DAxis() {
    axisContext.clearRect(0,0,axisCanvas.width,axisCanvas.height);

    const OX = 0;
    const OY = axisCanvas.height;

    // X
    axisContext.strokeStyle = 'red';
    axisContext.beginPath();
    axisContext.moveTo(OX,OY);
    axisContext.lineTo(axisCanvas.width,OY);
    axisContext.stroke();
    axisContext.fillText('X', axisCanvas.width - 20, OY - 10);

    // Z
    axisContext.strokeStyle = 'blue';
    axisContext.beginPath();
    axisContext.moveTo(OX,OY);
    axisContext.lineTo(OX,0);
    axisContext.stroke();
    axisContext.fillText('Z', 10, 20);

    // Y (diagonal)
    axisContext.strokeStyle = 'green';
    axisContext.beginPath();
    axisContext.moveTo(OX,OY);
    axisContext.lineTo(axisCanvas.width*0.4, axisCanvas.height*0.6);
    axisContext.stroke();
    axisContext.fillText('Y', axisCanvas.width*0.4+10, axisCanvas.height*0.6);
}


/********************************************************
 * CAPTURE DU FOND
 ********************************************************/
document.getElementById('capture-bg').addEventListener('click', () => {
    context.drawImage(video,0,0,canvas.width,canvas.height);
    backgroundImage = context.getImageData(0,0,canvas.width,canvas.height);
    luxValue.textContent = calculateLux(backgroundImage);
    draw3DAxis();
});


/********************************************************
 * ENREGISTREMENT
 ********************************************************/
document.getElementById('start-recording').addEventListener('click', () => {
    if (!backgroundImage) {
        alert("Capture du fond requise");
        return;
    }

    trajectory = [];
    motionDetected = false;
    recordedChunks = [];
    resetStopwatch();

    mediaRecorder = new MediaRecorder(video.srcObject);
    mediaRecorder.ondataavailable = e => e.data.size && recordedChunks.push(e.data);
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

    if (trajectory.length > 1) {
        motionEndTime = Date.now();
        computeMotionResults();
    }
});


/********************************************************
 * DÉTECTION DE MOUVEMENT
 ********************************************************/
function detectMotion() {
    if (!isRecording) return;

    context.drawImage(video,0,0,canvas.width,canvas.height);
    const frame = context.getImageData(0,0,canvas.width,canvas.height);

    let count = 0, sx = 0, sy = 0;

    for (let i=0; i<frame.data.length; i+=4) {
        const diff =
            Math.abs(frame.data[i] - backgroundImage.data[i]) +
            Math.abs(frame.data[i+1] - backgroundImage.data[i+1]) +
            Math.abs(frame.data[i+2] - backgroundImage.data[i+2]);

        if (diff > pixelThreshold) {
            const p = i / 4;
            const x = p % canvas.width;
            const y = Math.floor(p / canvas.width);
            sx += x;
            sy += y;
            count++;
        }
    }

    if (count > minMotionPixels) {
        const cx = sx / count;
        const cy = sy / count;

        if (!motionDetected) {
            motionDetected = true;
            motionStartTime = Date.now();
        }

        trajectory.push({
            x: cx,
            y: 0,
            z: canvas.height - cy,
            t: (Date.now() - motionStartTime) / 1000
        });
    }
}

function motionLoop() {
    detectMotion();
    if (isRecording) requestAnimationFrame(motionLoop);
}


/********************************************************
 * CALCULS PHYSIQUES
 ********************************************************/
function computeMotionResults() {
    const p0 = trajectory[0];
    const p1 = trajectory[trajectory.length - 1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dz = p1.z - p0.z;

    const angleXZ = Math.atan2(dz, dx) * 180 / Math.PI;
    const dt = (motionEndTime - motionStartTime) / 1000;

    const vx = dx / dt;
    const vy = dy / dt;
    const vz = dz / dt;

    console.log("Angle XZ :", angleXZ.toFixed(2), "°");
    console.log("Équation du mouvement :");
    console.log(`x(t) = ${vx.toFixed(2)} t`);
    console.log(`y(t) = ${vy.toFixed(2)} t`);
    console.log(`z(t) = ${vz.toFixed(2)} t`);
}


/********************************************************
 * LUMINOSITÉ
 ********************************************************/
function calculateLux(imageData) {
    let sum = 0;
    for (let i=0;i<imageData.data.length;i+=4) {
        sum += 0.2126*imageData.data[i]
             + 0.7152*imageData.data[i+1]
             + 0.0722*imageData.data[i+2];
    }
    return (sum / (imageData.data.length/4)).toFixed(2);
}
