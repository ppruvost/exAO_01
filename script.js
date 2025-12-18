// Attendre que le DOM soit entièrement chargé
document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let video = document.getElementById('video');
    let canvas = document.getElementById('canvas');
    let context = canvas.getContext('2d');
    let backgroundImage = null;
    let luxValue = document.getElementById('lux-value');

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

        // Redimensionner le canvas aux dimensions de la vidéo
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Dessiner l'image actuelle de la vidéo sur le canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Capturer l'image du canvas
        backgroundImage = context.getImageData(0, 0, canvas.width, canvas.height);

        // Calculer et afficher la luminosité
        const lux = calculateLux(backgroundImage);
        luxValue.textContent = lux;

        console.log("Fond capturé avec succès.");
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
});
