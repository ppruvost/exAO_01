// Variables globales
let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d');
let backgroundImage = null;
let luxValue = document.getElementById('lux-value');
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];

// Initialisation de la caméra
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            console.log("Caméra prête, dimensions :", canvas.width, canvas.height);
        };
    })
    .catch(err => {
        console.error("Erreur d'accès à la caméra :", err);
        alert("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.");
    });

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
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    backgroundImage = context.getImageData(0, 0, canvas.width, canvas.height);
    const lux = calculateLux(backgroundImage);
    luxValue.textContent = lux;
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
    isRecording = false;
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
