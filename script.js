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
let axisLength = 100; // Longueur des axes en pixels
let axisColor = {
    x: 'red',
    y: 'green',
    z: 'blue'
};
let previousPosition = { x: 0, y: 0, z: 0 };
let previousTime = 0;

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

    // Origine (centre du canvas)
    const originX = axisCanvas.width / 2;
    const originY = axisCanvas.height / 2;

    // Dessiner l'axe X (rouge)
    axisContext.strokeStyle = axisColor.x;
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX + axisLength, originY);
    axisContext.stroke();
    // Graduations X
    for (let i = 10; i <= axisLength; i += 10) {
        axisContext.fillStyle = axisColor.x;
        axisContext.fillRect(originX + i, originY - 2, 1, 4);
    }

    // Dessiner l'axe Y (vert)
    axisContext.strokeStyle = axisColor.y;
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX, originY - axisLength);
    axisContext.stroke();
    // Graduations Y
    for (let i = 10; i <= axisLength; i += 10) {
        axisContext.fillStyle = axisColor.y;
        axisContext.fillRect(originX - 2, originY - i, 4, 1);
    }

    // Dessiner l'axe Z (bleu, en perspective)
    axisContext.strokeStyle = axisColor.z;
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX - axisLength * 0.7, originY + axisLength * 0.3);
    axisContext.stroke();
    // Graduations Z
    for (let i = 10; i <= axisLength; i += 10) {
        const x = originX - i * 0.7;
        const y = originY + i * 0.3;
        axisContext.fillStyle = axisColor.z;
        axisContext.fillRect(x, y - 2, 4, 1);
    }

    // Légendes
    axisContext.fillStyle = axisColor.x;
    axisContext.fillText('X', originX + axisLength + 5, originY);
    axisContext.fillStyle = axisColor.y;
    axisContext.fillText('Y', originX, originY - axisLength - 5);
    axisContext.fillStyle = axisColor.z;
    axisContext.fillText('Z', originX - axisLength * 0.7 - 5, originY + axisLength * 0.3);
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
    console.log("Bouton 'Lancer l'enregistrement' cliqué !");

    if (isRecording) {
        console.log("Un enregistrement est déjà en cours.");
        return;
    }

    if (!video.srcObject) {
        console.error("video.srcObject n'est pas défini !");
        alert("La caméra n'est pas accessible. Veuillez d'abord autoriser l'accès à la caméra.");
        return;
    }

    // Masquer le canvas pendant l'enregistrement
    canvas.style.display = 'none';

    recordedChunks = [];
    try {
        const options = { mimeType: 'video/webm;codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.warn(`${options.mimeType} n'est pas supporté. Utilisation du type par défaut.`);
            mediaRecorder = new MediaRecorder(video.srcObject);
        } else {
            mediaRecorder = new MediaRecorder(video.srcObject, options);
        }
    } catch (err) {
        console.error("Erreur lors de la création de MediaRecorder :", err);
        alert("Impossible de démarrer l'enregistrement. Vérifiez que votre navigateur supporte MediaRecorder.");
        return;
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        console.log("Enregistrement terminé. Traitement des données...");
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        console.log("Vidéo enregistrée :", blob);
        isRecording = false;
        canvas.style.display = 'block'; // Réafficher le canvas après l'enregistrement
    };

    mediaRecorder.start(100);
    isRecording = true;
    console.log("Enregistrement démarré. isRecording =", isRecording);
});

// Bouton : Arrêter l'enregistrement
document.getElementById('stop-recording').addEventListener('click', () => {
    console.log("Bouton 'Arrêter l'enregistrement' cliqué !");
    if (!isRecording) {
        console.log("Aucun enregistrement en cours.");
        return;
    }
    mediaRecorder.stop();
    console.log("Enregistrement arrêté. isRecording =", isRecording);
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

// Fonction : Calculer l'angle entre deux points
function calculateAngle(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.atan2(dy, dx) * (180 / Math.PI);
}

// Fonction : Calculer la vitesse entre deux points
function calculateSpeed(x1, y1, x2, y2, time1, time2) {
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const timeDiff = (time2 - time1) / 1000; // Convertir en secondes
    return distance / timeDiff;
}

// Fonction : Mettre à jour les résultats
function updateResults(x, y, z, time) {
    const originX = axisCanvas.width / 2;
    const originY = axisCanvas.height / 2;

    // Calculer l'angle
    const angle = calculateAngle(originX, originY, x, y);
    document.getElementById('angle-value').textContent = angle.toFixed(2);

    // Calculer la vitesse
    if (previousTime !== 0) {
        const speed = calculateSpeed(previousPosition.x, previousPosition.y, x, y, previousTime, time);
        document.getElementById('speed-value').textContent = speed.toFixed(2);
    }

    // Mettre à jour la position précédente
    previousPosition = { x, y, z };
    previousTime = time;
}

// Exemple d'utilisation : Mettre à jour les résultats lors du suivi d'un objet
// Supposons que vous ayez une fonction qui détecte la position (x, y, z) de l'objet
// Vous pouvez appeler updateResults(x, y, z, Date.now()) pour mettre à jour les résultats.
