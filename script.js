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
    const axisLength = 100;

    // Dessiner l'axe X (gauche/droite, rouge)
    axisContext.strokeStyle = 'red';
    axisContext.beginPath();
    axisContext.moveTo(originX - axisLength, originY);
    axisContext.lineTo(originX + axisLength, originY);
    axisContext.stroke();

    // Graduations X
    for (let i = -axisLength; i <= axisLength; i += 20) {
        axisContext.fillStyle = 'red';
        axisContext.fillRect(originX + i - 1, originY - 2, 2, 4);
    }

    // Légendes X
    axisContext.fillStyle = 'red';
    axisContext.fillText('X (gauche)', originX - axisLength - 50, originY - 5);
    axisContext.fillText('X (droite)', originX + axisLength + 10, originY - 5);

    // Dessiner l'axe Y (avant/arrière, vert)
    axisContext.strokeStyle = 'green';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY - axisLength);
    axisContext.lineTo(originX, originY + axisLength);
    axisContext.stroke();

    // Graduations Y
    for (let i = -axisLength; i <= axisLength; i += 20) {
        axisContext.fillStyle = 'green';
        axisContext.fillRect(originX - 2, originY + i - 1, 4, 2);
    }

    // Légendes Y
    axisContext.fillStyle = 'green';
    axisContext.fillText('Y (avant)', originX + 10, originY - axisLength - 5);
    axisContext.fillText('Y (arrière)', originX + 10, originY + axisLength + 15);

    // Dessiner l'axe Z (haut/bas, bleu)
    axisContext.strokeStyle = 'blue';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX - axisLength * 0.7, originY - axisLength * 0.7); // Haut
    axisContext.stroke();

    // Graduations Z (haut)
    for (let i = 0; i <= axisLength; i += 20) {
        const x = originX - i * 0.7;
        const y = originY - i * 0.7;
        axisContext.fillStyle = 'blue';
        axisContext.fillRect(x - 1, y - 1, 2, 2);
    }

    // Légende Z (haut)
    axisContext.fillStyle = 'blue';
    axisContext.fillText('Z (haut)', originX - axisLength * 0.7 - 10, originY - axisLength * 0.7 - 5);

    // Dessiner l'axe Z (bas)
    axisContext.strokeStyle = 'blue';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX + axisLength * 0.7, originY + axisLength * 0.7); // Bas
    axisContext.stroke();

    // Graduations Z (bas)
    for (let i = 0; i <= axisLength; i += 20) {
        const x = originX + i * 0.7;
        const y = originY + i * 0.7;
        axisContext.fillStyle = 'blue';
        axisContext.fillRect(x - 1, y - 1, 2, 2);
    }

    // Légende Z (bas)
    axisContext.fillStyle = 'blue';
    axisContext.fillText('Z (bas)', originX + axisLength * 0.7 + 5, originY + axisLength * 0.7 + 15);
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

    canvas.style.display = 'none';
    recordedChunks = [];

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
        canvas.style.display = 'block';
    };

    mediaRecorder.start(100);
    isRecording = true;
});

// Bouton : Arrêter l'enregistrement
document.getElementById('stop-recording').addEventListener('click', () => {
    if (!isRecording) return;
    mediaRecorder.stop();
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
