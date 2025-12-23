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

    // Assure que la pente est négative pour une droite décroissante
    if (reg.a > 0) {
        reg.a = -Math.abs(reg.a);
    }

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
    console.log("Pente de v(t) :", reg.a); // Pour débogage
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
        const a = dv / dt; // Accélération instantanée
        aData.push({ t: vModel.data[i].t, v: a });
    }
    return aData;
}

