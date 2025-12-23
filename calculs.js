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

/* v(t) modélisée (droite lissée) */
function computeVelocityModel(trajectory, scale) {
    const raw = [];
    for (let i = 1; i < trajectory.length; i++) {
        const dt = trajectory[i].t - trajectory[i - 1].t;
        const dx = (trajectory[i].x - trajectory[i - 1].x) * scale;
        const dz = (trajectory[i].z - trajectory[i - 1].z) * scale;
        const speed = Math.sqrt(dx * dx + dz * dz) / dt;
        raw.push({ t: trajectory[i].t, v: speed });
    }

    const reg = linearRegression(raw);
    return {
        a: reg.a,
        b: reg.b,
        data: raw.map(p => ({ t: p.t, v: reg.a * p.t + reg.b }))
    };
}

/* a(t) instantanée (dérivée de v(t)) */
function computeAcceleration(vModel) {
    const aData = [];
    for (let i = 1; i < vModel.data.length; i++) {
        const dt = vModel.data[i].t - vModel.data[i - 1].t;
        const dv = vModel.data[i].v - vModel.data[i - 1].v;
        const a = dv / dt;
        aData.push({ t: vModel.data[i].t, v: a });
    }
    return aData;
}

/* Fonction pour dessiner les graphes */
function drawGraph(id, data, label) {
    const c = document.getElementById(id);
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);

    const p = 30;
    const w = c.width - 2 * p;
    const h = c.height - 2 * p;

    g.strokeStyle = "#000";
    g.lineWidth = 1;
    g.strokeRect(p, p, w, h);

    if (data.length < 2) {
        console.warn(`Pas assez de données pour dessiner le graphe ${label}`);
        return;
    }

    const t0 = data[0].t;
    const t1 = data[data.length - 1].t;
    const vMin = Math.min(...data.map(d => d.v));
    const vMax = Math.max(...data.map(d => d.v));

    g.beginPath();
    data.forEach((pt, i) => {
        const x = p + (pt.t - t0) / (t1 - t0) * w;
        const y = p + h - (pt.v - vMin) / (vMax - vMin) * h;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
    });
    g.stroke();

    g.fillStyle = "#000";
    g.fillText(label, p + 5, p - 8);
}
