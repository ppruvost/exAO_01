# Suivi d'Objet et Calculs Physiques

Ce projet frontend (100% web) permet de :
- Enregistrer une vidéo depuis une webcam (`MediaRecorder`).
- Afficher un repère orthonormé 3D (X, Y, Z) en bas à gauche de l'écran pour mesurer les positions, angles, et vitesses d'un objet.
- Capturer le fond pour un traitement ultérieur.
- Calculer la luminosité de la scène.
- Mesurer les positions, vitesses, et angles en utilisant les axes gradués en millimètres.
- Exporter les données pour un traitement ou une analyse ultérieure.

## Fichiers
- `index.html` — Page principale contenant la structure HTML.
- `style.css` — Styles CSS pour l'interface utilisateur.
- `script.js` — Logique pour l'accès à la caméra, l'affichage des axes 3D, et les calculs de position, vitesse, et angle.

## Utilisation
1. Ouvrir `index.html` dans un navigateur moderne (Chrome, Edge, Firefox).
2. Autoriser l'accès à la caméra quand le navigateur le demande.
3. Cliquer sur `Capturer le fond` pour capturer l'image de fond.
4. Utiliser les boutons `Lancer l'enregistrement` et `Arrêter l'enregistrement` pour enregistrer une vidéo.
5. Visualiser les axes 3D en bas à gauche de l'écran pour mesurer les positions, angles, et vitesses.
6. Les résultats (angle, vitesse, position) s'affichent en temps réel dans la section `Résultats`.

## Configuration des Axes 3D
- Les axes 3D sont affichés en bas à gauche de l'écran.
- **X (rouge)** : Gauche/Droite.
- **Y (vert)** : Avant/Arrière.
- **Z (bleu)** : Haut/Bas.
- Les axes sont gradués en millimètres.

## Remarques
- Pour une meilleure précision, utilisez une caméra avec une résolution élevée.
- Assurez-vous que l'objet à suivre est bien visible et contrasté.
- Les calculs de vitesse et d'angle dépendent de la précision de la détection de position.
- Pour des analyses plus poussées, exportez les données et utilisez des outils comme Excel ou Python.
