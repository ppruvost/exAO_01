/************************************************
 * OUTILS DE CALCULS PHYSIQUES
 ************************************************/

/* Régression linéaire y = a t + b */
function linearRegression(data) {
    const n = data.length;
    let sumT = 0, sumY = 0, sumTY = 0, sumT2 = 0;

    data.forEach(p => {
        sumT += p.t;
        sumY += p.v;
        sumTY += p.t * p.v;
        sumT2 += p.t * p.t;
    });

    const a = (n * sumTY - sumT * sumY) / (n * sumT2 - sumT * sumT);
    const b = (sumY - a * sumT) / n;
    return { a, b };
}

/* Régression linéaire forcée à l'origine : y = a t */
function linearRegressionThroughOrigin(data) {
    let sumT2 = 0;
    let sumTY = 0;

    data.forEach(p => {
        sumT2 += p.t * p.t;
        sumTY += p.t * p.v;
    });

    // Sécurité numérique
    if (sumT2 === 0) return { a: 0 };

    const a = sumTY / sumT2;
    return { a };
}

/* z(t) linéaire (plan horizontal ou incliné) */
function computeZLinear(trajectory, scale) {
    const zData = trajectory.map(p => ({ t: p.t, v: p.z * scale }));
    const reg = linearRegression(zData);
    return {
        a: reg.a,
        b: reg.b,
        data: zData.map(p => ({ t: p.t, v: reg.a * p.t + reg.b }))
    };
}

/* x(t) linéaire */
function computeXLinear(trajectory, scale) {
    const xData = trajectory.map(p => ({ t: p.t, v: p.x * scale }));
    const reg = linearRegression(xData);
    return {
        a: reg.a,
        b: reg.b,
        data: xData.map(p => ({ t: p.t, v: reg.a * p.t + reg.b }))
    };
}

/* y(t) linéaire (basée sur les données de profondeur) */
function computeYLinear(trajectory, scale) {
    const yData = trajectory.map(p => ({ t: p.t, v: p.y * scale }));
    const reg = linearRegression(yData);
    return {
        a: reg.a,
        b: reg.b,
        data: yData.map(p => ({ t: p.t, v: reg.a * p.t + reg.b }))
    };
}

/* v(t) modélisée (droite lissée, v(0)=0) */
function computeVelocityModel(trajectory, scale) {
    const raw = [];

    for (let i = 1; i < trajectory.length; i++) {
        const dt = trajectory[i].t - trajectory[i - 1].t;
        if (dt <= 0) continue; // sécurité

        const dx = (trajectory[i].x - trajectory[i - 1].x) * scale;
        const dy = (trajectory[i].y - trajectory[i - 1].y) * scale;
        const dz = (trajectory[i].z - trajectory[i - 1].z) * scale;

        const speed = Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;
        raw.push({ t: trajectory[i].t, v: speed });
    }

    if (raw.length < 2) {
        return { a: 0, b: 0, data: [] };
    }

    const reg = linearRegressionThroughOrigin(raw);

    return {
        a: reg.a,     // accélération (pente)
        b: 0,         // vitesse initiale imposée
        data: raw.map(p => ({ t: p.t, v: reg.a * p.t }))
    };
}


/* a(t) avec données brutes et régression linéaire */
function computeAcceleration(vModel) {
    const aData = [];
    for (let i = 1; i < vModel.data.length; i++) {
        const dt = vModel.data[i].t - vModel.data[i - 1].t;
        const dv = vModel.data[i].v - vModel.data[i - 1].v;
        const a = dv / dt;
        aData.push({ t: vModel.data[i].t, v: a });
    }

    // Régression linéaire sur les données d'accélération
    const aRegression = linearRegression(aData);

    return {
        a: aRegression.a, // Pente de la régression
        b: aRegression.b, // Ordonnée à l'origine
        rawData: aData, // Données brutes d'accélération
        regressionData: aData.map(p => ({ t: p.t, v: aRegression.a * p.t + aRegression.b })) // Droite de régression
    };
}

/* Fonction pour dessiner les graphes avec échelle adaptée */
function drawGraph(id, data, label, isRegression = false) {
    const c = document.getElementById(id);
    if (!c) return;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);

    const p = 30; // Marge
    const w = c.width - 2 * p;
    const h = c.height - 2 * p;

    // Dessiner le cadre du graphe
    g.strokeStyle = "#000";
    g.lineWidth = 1;
    g.strokeRect(p, p, w, h);

    if (data.length < 2) {
        console.warn(`Pas assez de données pour dessiner le graphe ${label}`);
        return;
    }

    // Extraire les valeurs min/max pour l'échelle
    const t0 = data[0].t;
    const t1 = data[data.length - 1].t;
    const vMin = Math.min(...data.map(d => d.v));
    const vMax = Math.max(...data.map(d => d.v));

    // Ajuster les marges pour une meilleure visibilité
    const vMargin = 0.2 * (vMax - vMin); // Marge de 20%
    const vMinAdj = vMin - vMargin;
    const vMaxAdj = vMax + vMargin;

    // Dessiner les axes
    g.beginPath();
    g.moveTo(p, p + h);
    g.lineTo(p, p);
    g.lineTo(p + w, p);
    g.stroke();

    // Graduations sur l'axe des temps (t)
    for (let i = 0; i <= 1; i += 0.2) {
        const x = p + i * w;
        g.beginPath();
        g.moveTo(x, p + h);
        g.lineTo(x, p + h + 5);
        g.stroke();
        g.fillText((t0 + i * (t1 - t0)).toFixed(1), x - 10, p + h + 15);
    }

    // Graduations sur l'axe des valeurs (a(t))
    for (let i = 0; i <= 1; i += 0.2) {
        const y = p + h - i * h;
        g.beginPath();
        g.moveTo(p, y);
        g.lineTo(p - 5, y);
        g.stroke();
        g.fillText((vMinAdj + i * (vMaxAdj - vMinAdj)).toFixed(2), p - 35, y + 5);
    }

    // Dessiner la courbe
    g.beginPath();
    g.strokeStyle = isRegression ? "#0000FF" : "#FF0000"; // Bleu pour la régression, rouge pour les données brutes
    g.lineWidth = 2;
    data.forEach((pt, i) => {
        const x = p + (pt.t - t0) / (t1 - t0) * w;
        const y = p + h - (pt.v - vMinAdj) / (vMaxAdj - vMinAdj) * h;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
    });
    g.stroke();

    // Légende
    g.fillStyle = "#000";
    g.fillText(label, p + 5, p - 8);

    // Afficher la pente si c'est a(t)
    if (label.includes("a(t)") && isRegression) {
        const aRegression = linearRegression(data);
        g.fillStyle = "#0000FF";
        g.fillText(`a = ${aRegression.a.toFixed(2)} mm/s²`, p + w - 120, p + 20);
    }
}
