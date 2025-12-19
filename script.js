function draw3DAxis() {
    axisContext.clearRect(0, 0, axisCanvas.width, axisCanvas.height);

    // Origine (centre du canvas)
    const originX = axisCanvas.width / 2;
    const originY = axisCanvas.height / 2;

    // Longueur des axes
    const axisLength = 100;

    // Dessiner l'axe X (gauche/droite, rouge)
    axisContext.strokeStyle = 'red';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX + axisLength, originY); // Droite
    axisContext.stroke();
    // Graduations X
    for (let i = 10; i <= axisLength; i += 10) {
        axisContext.fillStyle = 'red';
        axisContext.fillRect(originX + i, originY - 2, 1, 4);
    }
    // Légende X
    axisContext.fillStyle = 'red';
    axisContext.fillText('X (droite)', originX + axisLength + 5, originY);

    // Dessiner l'axe X (gauche)
    axisContext.strokeStyle = 'red';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX - axisLength, originY); // Gauche
    axisContext.stroke();
    // Graduations X (gauche)
    for (let i = 10; i <= axisLength; i += 10) {
        axisContext.fillStyle = 'red';
        axisContext.fillRect(originX - i, originY - 2, 1, 4);
    }
    // Légende X (gauche)
    axisContext.fillStyle = 'red';
    axisContext.fillText('X (gauche)', originX - axisLength - 50, originY);

    // Dessiner l'axe Y (avant/arrière, vert)
    // Avant = vers le haut de l'écran, Arrière = vers le bas
    axisContext.strokeStyle = 'green';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX, originY - axisLength); // Avant (haut)
    axisContext.stroke();
    // Graduations Y (avant)
    for (let i = 10; i <= axisLength; i += 10) {
        axisContext.fillStyle = 'green';
        axisContext.fillRect(originX - 2, originY - i, 4, 1);
    }
    // Légende Y (avant)
    axisContext.fillStyle = 'green';
    axisContext.fillText('Y (avant)', originX + 5, originY - axisLength - 5);

    // Dessiner l'axe Y (arrière)
    axisContext.strokeStyle = 'green';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX, originY + axisLength); // Arrière (bas)
    axisContext.stroke();
    // Graduations Y (arrière)
    for (let i = 10; i <= axisLength; i += 10) {
        axisContext.fillStyle = 'green';
        axisContext.fillRect(originX - 2, originY + i, 4, 1);
    }
    // Légende Y (arrière)
    axisContext.fillStyle = 'green';
    axisContext.fillText('Y (arrière)', originX + 5, originY + axisLength + 15);

    // Dessiner l'axe Z (haut/bas, bleu)
    // Haut = vers le haut à gauche, Bas = vers le bas à droite (perspective)
    axisContext.strokeStyle = 'blue';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX - axisLength * 0.5, originY - axisLength * 0.5); // Haut (en perspective)
    axisContext.stroke();
    // Graduations Z (haut)
    for (let i = 10; i <= axisLength; i += 10) {
        const x = originX - i * 0.5;
        const y = originY - i * 0.5;
        axisContext.fillStyle = 'blue';
        axisContext.fillRect(x, y, 2, 2);
    }
    // Légende Z (haut)
    axisContext.fillStyle = 'blue';
    axisContext.fillText('Z (haut)', originX - axisLength * 0.5 - 10, originY - axisLength * 0.5 - 5);

    // Dessiner l'axe Z (bas)
    axisContext.strokeStyle = 'blue';
    axisContext.beginPath();
    axisContext.moveTo(originX, originY);
    axisContext.lineTo(originX + axisLength * 0.5, originY + axisLength * 0.5); // Bas (en perspective)
    axisContext.stroke();
    // Graduations Z (bas)
    for (let i = 10; i <= axisLength; i += 10) {
        const x = originX + i * 0.5;
        const y = originY + i * 0.5;
        axisContext.fillStyle = 'blue';
        axisContext.fillRect(x, y, 2, 2);
    }
    // Légende Z (bas)
    axisContext.fillStyle = 'blue';
    axisContext.fillText('Z (bas)', originX + axisLength * 0.5 + 5, originY + axisLength * 0.5 + 15);
}
