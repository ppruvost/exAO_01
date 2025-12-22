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

/* y(t) linéaire (constante si non mesurée) */
function computeYLinear(trajectory, scale) {
    return {
        a: 0,
        b: 0,
        data: trajectory.map(p => ({ t: p.t, v: 0 }))
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

/* a(t) constante */
function computeAcceleration(vModel) {
    // a(t) est constante, donc une droite horizontale
    return vModel.data.map(p => ({ t: p.t, v: vModel.a }));
}
