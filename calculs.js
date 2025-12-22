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

/* v(t) modélisée (droite lissée) */
function computeVelocityModel(trajectory, scale) {
    const raw = [];

    for (let i = 1; i < trajectory.length; i++) {
        const dt = trajectory[i].t - trajectory[i - 1].t;
        const dx = (trajectory[i].x - trajectory[i - 1].x) * scale;
        const dz = (trajectory[i].z - trajectory[i - 1].z) * scale;
        raw.push({ t: trajectory[i].t, v: Math.sqrt(dx*dx + dz*dz) / dt });
    }

    const reg = linearRegression(raw);
    return {
        a: reg.a,
        b: reg.b,
        data: raw.map(p => ({ t: p.t, v: reg.a * p.t + reg.b }))
    };
}

/* a(t) constante */
function computeAcceleration(vModel) {
    return vModel.data.map(p => ({ t: p.t, v: vModel.a }));
}
