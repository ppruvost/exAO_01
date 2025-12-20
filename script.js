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
        canvas.style.display = 'block';
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
