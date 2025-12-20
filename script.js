// Variables globales
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
let previousPosition = { x: 0, y: 0, z: 0 };
let previousTime = 0;

// Variables pour le chronomètre
let stopwatchInterval;
let stopwatchStartTime;
let stopwatchElement = document.getElementById('stopwatch');

// Fonction pour formater le temps (ms → HH:MM:SS.ss)
function formatTime(ms) {
    let centiseconds = Math.floor((ms % 1000) / 10);
    let seconds = Math.floor(ms / 1000) % 60;
    let minutes = Math.floor(ms / (1000 * 60)) % 60;
    let hours = Math.floor(ms / (1000 * 60 * 60)) % 24;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// Fonction pour démarrer le chronomètre
function startStopwatch() {
    stopwatchStartTime = Date.now();
    clearInterval(stopwatchInterval);
    stopwatchInterval = setInterval(() => {
        const elapsedTime = Date.now() - stopwatchStartTime;
        stopwatchElement.textContent = formatTime(elapsedTime);
    }, 10);
}

// Fonction pour arrêter le chronomètre
function stopStopwatch() {
    clearInterval(stopwatchInterval);
}

// Fonction pour réinitialiser le chronomètre
function resetStopwatch() {
    stopwatchElement.textContent = '00:00:00.00';
}

// Initialisation de la caméra
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            axisCanvas.width = video.videoWidth;
            axisCanvas.height = video.videoHeight;
            draw3DAxis();
            console.log("Caméra prête, dimensions :", canvas.width, canvas.height);
        };
    })
    .catch(err => {
        console.error("Erreur d'accès à la caméra :", err);
        alert("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.");
    });

// Fonction : Dessiner le repère 3D
function draw3DAxis() {
    axisContext.clearRect(0, 0, axisCanvas.width, axisCanvas.height);

    // Origine (coin bas-gauche)
    const originX = 0;
    const originY = axisCanvas.height;
    const axisLengthX = axisCanvas.width;   // Longueur de l'axe X sur toute la largeur de l'écran
    const axisLengthZ = axisCanvas.height;  // Longueur de l'axe Z sur toute la hauteur de l'écran
    const axisLengthY = Math.min(axisCanvas.width, axisCanvas.height) * 0.7; // Longueur de l'axe Y

    // Dessiner l'axe X (rouge, gauche → droite)
    axisContext.strokeStyle = 'red';
    axisContext.lineWidth = 2;
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX + axisLengthX, originY);
    axisContext.stroke();

    // Graduations X (tous les 10 mm, nombres tous les 50 mm)
    for (let i = 0; i <= axisLengthX; i += 10) {
        if (i % 50 === 0) {
            axisContext.fillStyle = 'red';
            axisContext.fillRect(originX + i, originY - 6, 2, 12);
            axisContext.fillText((i / 10).toFixed(0), originX + i - 10, originY - 10);
        } else {
            axisContext.fillStyle = 'red';
            axisContext.fillRect(originX + i, originY - 3, 1, 6);
        }
    }
    axisContext.fillStyle = 'red';
    axisContext.fillText('X (mm)', originX + axisLengthX - 30, originY - 20);

    // Dessiner l'axe Y (vert, vers l'intérieur du repère XZ)
    axisContext.strokeStyle = 'green';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX + axisLengthY * Math.cos(Math.PI / 4), originY - axisLengthY * Math.sin(Math.PI / 4));
    axisContext.stroke();

    // Graduations Y (tous les 10 mm, nombres tous les 50 mm)
    for (let i = 0; i <= axisLengthY; i += 10) {
        const x = originX + i * Math.cos(Math.PI / 4);
        const y = originY - i * Math.sin(Math.PI / 4);
        if (i % 50 === 0) {
            axisContext.fillStyle = 'green';
            axisContext.fillRect(x - 1, y - 1, 2, 2);
            axisContext.fillText((i / 10).toFixed(0), x + 5, y + 15);
        } else {
            axisContext.fillStyle = 'green';
            axisContext.fillRect(x - 1, y - 1, 2, 2);
        }
    }
    axisContext.fillStyle = 'green';
    axisContext.fillText('Y (mm)', originX + axisLengthY * Math.cos(Math.PI / 4) + 10, originY - axisLengthY * Math.sin(Math.PI / 4) - 10);

    // Dessiner l'axe Z (bleu, bas → haut)
    axisContext.strokeStyle = 'blue';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX, originY - axisLengthZ);
    axisContext.stroke();

    // Graduations Z (tous les 10 mm, nombres tous les 50 mm)
    for (let i = 0; i <= axisLengthZ; i += 10) {
        if (i % 50 === 0) {
            axisContext.fillStyle = 'blue';
            axisContext.fillRect(originX - 6, originY - i, 12, 2);
            axisContext.fillText((i / 10).toFixed(0), originX - 30, originY - i + 5);
        } else {
            axisContext.fillStyle = 'blue';
            axisContext.fillRect(originX - 3, originY - i, 6, 1);
        }
    }
    axisContext.fillStyle = 'blue';
    axisContext.fillText('Z (mm)', originX - 30, originY - axisLengthZ + 20);

    // Origine
    axisContext.fillStyle = 'black';
    axisContext.fillText('O', originX + 10, originY - 10);
}

// Bouton : Capturer le fond
document.getElementById('capture-bg').addEventListener('click', () => {
    if (!video.srcObject) {
        alert("La caméra n'est pas accessible. Veuillez d'abord autoriser l'accès à la caméra.");
        return;
    }

    if (video.readyState < 2) {
        alert("La vidéo n'est pas prête. Veuillez patienter.");
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    axisCanvas.width = video.videoWidth;
    axisCanvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    backgroundImage = context.getImageData(0, 0, canvas.width, canvas.height);
    const lux = calculateLux(backgroundImage);
    luxValue.textContent = lux;
    draw3DAxis();
    console.log("Fond capturé avec succès.");
});

// Bouton : Lancer l'enregistrement
document.getElementById('start-recording').addEventListener('click', () => {
    if (isRecording) {
        console.log("Un enregistrement est déjà en cours.");
        return;
    }

    if (!video.srcObject) {
        alert("La caméra n'est pas accessible. Veuillez d'abord autoriser l'accès à la caméra.");
        return;
    }

    recordedChunks = [];
    resetStopwatch();

    try {
        const options = { mimeType: 'video/webm;codecs=vp9' };
        mediaRecorder = MediaRecorder.isTypeSupported(options.mimeType)
            ? new MediaRecorder(video.srcObject, options)
            : new MediaRecorder(video.srcObject);
    } catch (err) {
        console.error("Erreur lors de la création de MediaRecorder :", err);
        alert("Impossible de démarrer l'enregistrement.");
        return;
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        console.log("Vidéo enregistrée :", blob);
        isRecording = false;
    };

    mediaRecorder.start(100);
    isRecording = true;
    startStopwatch(); // Démarrer le chronomètre
});

// Bouton : Arrêter l'enregistrement
document.getElementById('stop-recording').addEventListener('click', () => {
    if (!isRecording) return;
    mediaRecorder.stop();
    stopStopwatch(); // Arrêter le chronomètre
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
    return (sum / (imageData.data.length / 4)).toFixed(2);
}
