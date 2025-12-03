# exAO Web Tracker

Application web (frontend) pour réaliser un exAO : suivi d'une balle verte et d'une balle rose via webcam et extraction frame-by-frame.

## Fonctionnalités
- Accès à la webcam (navigateur).
- Détection par couleur (HSV) — repère centroïde des balles.
- Enregistrement temporel (t en secondes, précision ms) et export CSV.
- Calcul des vitesses par différences finies et estimation de `a` via régression sur `v = a * t`.
- Comparaison avec `a = 9.8 * sin(alpha)` (alpha à entrer dans l'interface).

## Usage
1. Ouvrir `index.html` dans un navigateur moderne (Chrome/Edge/Firefox).
2. Autoriser l'accès à la caméra.
3. Entrer la distance d'étalonnage (m) et cliquer `Étalonner`, puis cliquer deux points connus sur la vidéo (par ex. 0.5 m).
4. Entrer l'angle `α` du plan incliné.
5. Régler la fréquence cible d'échantillonnage (10 ms = 0.01 s par défaut).
6. `Démarrer` → l'application va détecter frames et remplir tableau/graphes.
7. `Enregistrer données (CSV)` pour télécharger.

## Limitations & conseils
- **Précision temporelle** : le navigateur ne peut pas garantir un échantillonnage exact toutes les 10 ms si la caméra n'a pas une cadence suffisante (typ. 30/60 fps). Le timestamp est pris via `performance.now()`. Pour obtenir des pas réellement à 0.01 s, utiliser une caméra à 100 fps ou plus.
- **Qualité détection** : l'éclairage, contraste et arrière-plan influent fortement. Utiliser un arrière-plan neutre et éclairage uniforme.
- **Axes & calibration** : le script utilise la coordonnée verticale `y` pour la direction du mouvement. Si ton montage a la direction le long de `x`, modifie le code pour projeter sur l'axe voulu.

## Fichier exemple
Basé sur l'exemple exAO fourni par l'utilisateur (PDF). :contentReference[oaicite:1]{index=1}
