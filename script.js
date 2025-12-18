// Variables globales
let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d');
let crosshair = document.getElementById('crosshair');
let luxValue = document.getElementById('lux-value');
let angleValue = document.getElementById('angle-value');
let speedValue = document.getElementById('speed-value');
let error1Value = document.getElementById('error1-value');
let error2Value = document.getElementById('error2-value');

let backgroundImage = null;
let isRecording = false;
let recordedChunks = [];
let mediaRecorder;
let motionPixels = [];
let objectPositions = [];
let startTime = null;
let endTime = null;

// Initialisation de la caméra
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    })
    .catch(err => {
        console.error("Erreur d'accès à la caméra :", err);
    });

// Bouton : Capturer le fond
document.getElementById('capture-bg').addEventListener('click', () => {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    backgroundImage = context.getImageData(0, 0, canvas.width, canvas.height);
    const lux = calculateLux(backgroundImage);
    luxValue.textContent = lux;
});

// Bouton : Lancer l'enregistrement
document.getElementById('start-recording').addEventListener('click', () => {
    if (!backgroundImage) {
        alert("Veuillez d'abord capturer le fond.");
        return;
    }
    isRecording = true;
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(video.srcObject);
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
        }
    };
    mediaRecorder.start(100); // Collecte des données toutes les 100ms
    startTime = Date.now();
    objectPositions = [];
});

// Bouton : Arrêter l'enregistrement
document.getElementById('stop-recording').addEventListener('click', () => {
    if (!isRecording) return;
    isRecording = false;
    mediaRecorder.stop();
    endTime = Date.now();
    processMotionData();
});

// Fonction : Calculer la luminosité
function calculateLux(imageData) {
    let sum = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += luminance;
    }
    const avgLuminance = sum / (imageData.data.length / 4);
    return avgLuminance.toFixed(2);
}

// Fonction : Détecter le mouvement
function detectMotion() {
    if (!isRecording || !backgroundImage) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrame = context.getImageData(0, 0, canvas.width, canvas.height);
    const { diffData, motionPixels } = getMotionPixels(currentFrame, backgroundImage);

    // Afficher les pixels en mouvement (pour débogage)
    context.putImageData(diffData, 0, 0);

    // Calculer le centre de masse des pixels en mouvement
    if (motionPixels.length > 0) {
        const center = calculateCenterOfMass(motionPixels);
        crosshair.style.left = `${center.x}px`;
        crosshair.style.top = `${center.y}px`;
        crosshair.style.display = 'block';
        objectPositions.push({ x: center.x, y: center.y, t: Date.now() });
    } else {
        crosshair.style.display = 'none';
    }

    requestAnimationFrame(detectMotion);
}

// Fonction : Obtenir les pixels en mouvement
function getMotionPixels(currentFrame, background) {
    const diffData = context.createImageData(canvas.width, canvas.height);
    let motionPixels = [];

    for (let i = 0; i < currentFrame.data.length; i += 4) {
        const diffR = Math.abs(currentFrame.data[i] - background.data[i]);
        const diffG = Math.abs(currentFrame.data[i + 1] - background.data[i + 1]);
        const diffB = Math.abs(currentFrame.data[i + 2] - background.data[i + 2]);
        const diff = diffR + diffG + diffB;

        if (diff > 30) { // Seuil de détection
            diffData.data[i] = 255;
            diffData.data[i + 1] = 255;
            diffData.data[i + 2] = 255;
            diffData.data[i + 3] = 255;
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);
            motionPixels.push({ x, y });
        } else {
            diffData.data[i] = 0;
            diffData.data[i + 1] = 0;
            diffData.data[i + 2] = 0;
            diffData.data[i + 3] = 255;
        }
    }

    return { diffData, motionPixels };
}

// Fonction : Calculer le centre de masse
function calculateCenterOfMass(pixels) {
    let sumX = 0, sumY = 0;
    pixels.forEach(pixel => {
        sumX += pixel.x;
        sumY += pixel.y;
    });
    return {
        x: sumX / pixels.length,
        y: sumY / pixels.length
    };
}

// Fonction : Traiter les données de mouvement
function processMotionData() {
    if (objectPositions.length < 2) return;

    // Calculer l'angle moyen
    const startPoint = objectPositions[0];
    const endPoint = objectPositions[objectPositions.length - 1];
    const angle = calculateAngle(startPoint, endPoint);
    angleValue.textContent = angle.toFixed(2);

    // Calculer la vitesse ou l'accélération
    const totalTime = (endTime - startTime) / 1000; // en secondes
    const distance = Math.sqrt(
        Math.pow(endPoint.x - startPoint.x, 2) +
        Math.pow(endPoint.y - startPoint.y, 2)
    );

    if (angle < 1) {
        // Mouvement horizontal : v = distance / temps
        const speed = distance / totalTime;
        speedValue.textContent = `Vitesse : ${speed.toFixed(2)} px/s`;
    } else {
        // Mouvement incliné : calculer l'accélération
        const acceleration = calculateAcceleration(objectPositions, totalTime);
        speedValue.textContent = `Accélération : ${acceleration.toFixed(2)} px/s²`;
    }

    // Calculer les erreurs (exemple simplifié)
    error1Value.textContent = (0.5).toFixed(2); // e1
    error2Value.textContent = (0.1).toFixed(2); // e2
}

// Fonction : Calculer l'angle
function calculateAngle(startPoint, endPoint) {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = Math.abs(angleRad * 180 / Math.PI);
    return angleDeg;
}

// Fonction : Calculer l'accélération
function calculateAcceleration(positions, totalTime) {
    let totalDistance = 0;
    for (let i = 1; i < positions.length; i++) {
        const dx = positions[i].x - positions[i - 1].x;
        const dy = positions[i].y - positions[i - 1].y;
        totalDistance += Math.sqrt(dx * dx + dy * dy);
    }
    return totalDistance / (totalTime * totalTime);
}

// Lancer la détection de mouvement
video.addEventListener('play', () => {
    detectMotion();
});
