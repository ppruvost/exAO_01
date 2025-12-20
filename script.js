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

// Échelle : 1 pixel = 1 mm (ajustez selon vos besoins)
const scale = 1;

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

// Fonction : Dessiner le repère 3D en bas à gauche
function draw3DAxis() {
    axisContext.clearRect(0, 0, axisCanvas.width, axisCanvas.height);

    // Origine (coin bas-gauche)
    const originX = 50; // Marge à gauche
    const originY = axisCanvas.height - 50; // Marge en bas
    const axisLength = 150; // Longueur des axes en pixels (ajustez selon la taille de l'écran)

    // Dessiner l'axe X (rouge, gauche → droite)
    axisContext.strokeStyle = 'red';
    axisContext.lineWidth = 2;
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX + axisLength, originY);
    axisContext.stroke();

    // Graduations X (tous les 10 mm)
    for (let i = 0; i <= axisLength; i += 10) {
        axisContext.fillStyle = 'red';
        axisContext.fillRect(originX + i, originY - 3, 1, 6);
        axisContext.fillText((i / scale).toFixed(0), originX + i, originY - 8);
    }
    axisContext.fillStyle = 'red';
    axisContext.fillText('X (mm)', originX + axisLength + 5, originY);

    // Dessiner l'axe Y (vert, arrière → avant)
    axisContext.strokeStyle = 'green';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX - axisLength * Math.cos(Math.PI / 6), originY - axisLength * Math.sin(Math.PI / 6));
    axisContext.stroke();

    // Graduations Y (tous les 10 mm)
    for (let i = 0; i <= axisLength; i += 10) {
        const x = originX - i * Math.cos(Math.PI / 6);
        const y = originY - i * Math.sin(Math.PI / 6);
        axisContext.fillStyle = 'green';
        axisContext.fillRect(x - 1, y - 1, 2, 2);
        axisContext.fillText((i / scale).toFixed(0), x - 10, y - 5);
    }
    axisContext.fillStyle = 'green';
    axisContext.fillText('Y (mm)', originX - axisLength * Math.cos(Math.PI / 6) - 15, originY - axisLength * Math.sin(Math.PI / 6) - 10);

    // Dessiner l'axe Z (bleu, bas → haut)
    axisContext.strokeStyle = 'blue';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX, originY - axisLength);
    axisContext.stroke();

    // Graduations Z (tous les 10 mm)
    for (let i = 0; i <= axisLength; i += 10) {
        axisContext.fillStyle = 'blue';
        axisContext.fillRect(originX - 3, originY - i, 6, 1);
        axisContext.fillText((i / scale).toFixed(0), originX - 20, originY - i);
    }
    axisContext.fillStyle = 'blue';
    axisContext.fillText('Z (mm)', originX - 30, originY - axisLength - 5);

    // Origine
    axisContext.fillStyle = 'black';
    axisContext.fillText('O', originX - 10, originY + 15);
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
