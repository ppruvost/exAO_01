/***********************
 * PARAMÈTRES
 ***********************/
const SCALE = 0.002;

/***********************
 * DOM
 ***********************/
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const axisCanvas = document.getElementById("3d-axis");
const axisCtx = axisCanvas.getContext("2d");

const luxValue = document.getElementById("lux-value");
const stopwatchEl = document.getElementById("stopwatch");

const angleEl = document.getElementById("angle-value");
const speedEl = document.getElementById("speed-value");
const positionEl = document.getElementById("position-value");
const error1El = document.getElementById("error1-value");
const error2El = document.getElementById("error2-value");
const equationEl = document.getElementById("equation");

/***********************
 * VARIABLES
 ***********************/
let backgroundFrame = null;
let recording = false;
let trajectory = [];
let startTime = 0;
let animationId = null;

/***********************
 * WEBCAM
 ***********************/
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      canvas.width = axisCanvas.width = video.videoWidth;
      canvas.height = axisCanvas.height = video.videoHeight;
    };
  })
  .catch(err => {
    alert("Erreur webcam : " + err.message);
    console.error("Erreur webcam :", err);
  });

/***********************
 * CAPTURE FOND
 ***********************/
document.getElementById("capture-bg").onclick = () => {
  if (video.videoWidth === 0) {
    alert("La vidéo n'est pas prête. Veuillez patienter.");
    return;
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  backgroundFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/***********************
 * ENREGISTREMENT
 ***********************/
document.getElementById("start-recording").onclick = () => {
  if (!backgroundFrame) {
    alert("Capturer le fond d'abord");
    return;
  }
  trajectory = [];
  recording = true;
  startTime = performance.now();
  animationId = requestAnimationFrame(processFrame);
};

document.getElementById("stop-recording").onclick = () => {
  recording = false;
  cancelAnimationFrame(animationId);
};

/***********************
 * TRAITEMENT IMAGE
 ***********************/
function processFrame(timestamp) {
  if (!recording) return;

  const t = (timestamp - startTime) / 1000;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bg = backgroundFrame.data;
  const data = frame.data;

  let sumX = 0, sumY = 0, count = 0, luxSum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const diff =
      Math.abs(data[i] - bg[i]) +
      Math.abs(data[i+1] - bg[i+1]) +
      Math.abs(data[i+2] - bg[i+2]);

    const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
    luxSum += brightness;

    if (diff > 60) {
      const px = (i / 4) % canvas.width;
      const py = Math.floor((i / 4) / canvas.width);
      sumX += px;
      sumY += py;
      count++;
    }
  }

  luxValue.textContent = (luxSum / (data.length / 4)).toFixed(1);

  if (count > 40) {
    const x = sumX / count;
    const y = sumY / count;
    trajectory.push({ t, x, y });

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.fill();
  }

  drawAxes();
  updateStopwatch(t);
  animationId = requestAnimationFrame(processFrame);
}

/***********************
 * AXES
 ***********************/
function drawAxes() {
  axisCtx.clearRect(0, 0, axisCanvas.width, axisCanvas.height);
  axisCtx.strokeStyle = "red";

  // Axe X (horizontal)
  axisCtx.beginPath();
  axisCtx.moveTo(0, axisCanvas.height / 2);
  axisCtx.lineTo(axisCanvas.width, axisCanvas.height / 2);
  axisCtx.stroke();

  // Axe Z (vertical)
  axisCtx.beginPath();
  axisCtx.moveTo(axisCanvas.width / 2, 0);
  axisCtx.lineTo(axisCanvas.width / 2, axisCanvas.height);
  axisCtx.stroke();

  // Légendes des axes
  axisCtx.fillStyle = "red";
  axisCtx.fillText("x", axisCanvas.width - 10, axisCanvas.height / 2 - 5);
  axisCtx.fillText("z", axisCanvas.width / 2 + 5, 15);
  axisCtx.fillText("y (profondeur)", 10, axisCanvas.height / 2 - 5);
}

/***********************
 * CHRONO
 ***********************/
function updateStopwatch(t) {
  const ms = Math.floor((t % 1) * 100);
  const s = Math.floor(t % 60);
  const m = Math.floor(t / 60);
  stopwatchEl.textContent =
    `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

/***********************
 * CALCUL DES ERREURS
 ***********************/
function computeErrors(pN, dx, dy) {
  // Valeurs théoriques simulées (exemple : mouvement uniforme)
  const xTheorique = 0.1 + 0.2 * pN.t;
  const yTheorique = 0.05 + 0.1 * pN.t;

  // Valeurs mesurées
  const xMesure = dx;
  const yMesure = dy;

  // Erreurs absolues
  const erreurAbsX = Math.abs(xMesure - xTheorique);
  const erreurAbsY = Math.abs(yMesure - yTheorique);

  // Erreurs relatives (en %)
  const erreurRelX = (erreurAbsX / xTheorique) * 100;
  const erreurRelY = (erreurAbsY / yTheorique) * 100;

  return {
    erreurAbsX: erreurAbsX.toFixed(4),
    erreurAbsY: erreurAbsY.toFixed(4),
    erreurRelX: erreurRelX.toFixed(2),
    erreurRelY: erreurRelY.toFixed(2),
  };
}

/***********************
 * CALCULS PHYSIQUES
 ***********************/
document.getElementById("calculate").onclick = computeResults;

function computeResults() {
  if (trajectory.length < 5) {
    alert("Pas assez de données");
    return;
  }

  // Calcul des vitesses et accélérations
  const velocities = [];
  const accelerations = [];

  for (let i = 1; i < trajectory.length; i++) {
    const dt = trajectory[i].t - trajectory[i-1].t;
    const dx = (trajectory[i].x - trajectory[i-1].x) * SCALE;
    const dy = (trajectory[i].y - trajectory[i-1].y) * SCALE;

    const v = Math.sqrt(dx*dx + dy*dy) / dt;
    velocities.push({ t: trajectory[i].t, v });

    if (i > 1) {
      const dv = velocities[i-1].v - velocities[i-2].v;
      const da = dv / (trajectory[i].t - trajectory[i-1].t);
      accelerations.push({ t: trajectory[i].t, a: da });
    }
  }

  // Position finale
  const p0 = trajectory[0];
  const pN = trajectory[trajectory.length - 1];
  const dt = pN.t - p0.t;

  const dx = (pN.x - p0.x) * SCALE;
  const dy = (pN.y - p0.y) * SCALE;

  // Simulation de z(t) : hauteur (exemple : chute libre)
  const g = 9.81;
  const z0 = 2.0;
  const zt = z0 - 0.5 * g * pN.t * pN.t;

  // Calcul des erreurs
  const { erreurAbsX, erreurAbsY, erreurRelX, erreurRelY } = computeErrors(pN, dx, dy);

  const speed = Math.sqrt(dx*dx + dy*dy) / dt;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  angleEl.textContent = angle.toFixed(2);
  speedEl.textContent = speed.toFixed(3);
  positionEl.textContent = `(${dx.toFixed(2)}, ${dy.toFixed(2)}, ${zt.toFixed(2)}) m`;
  error1El.textContent = `Erreur absolue (x) = ${erreurAbsX} m, (y) = ${erreurAbsY} m`;
  error2El.textContent = `Erreur relative (x) = ${erreurRelX}%, (y) = ${erreurRelY}%`;

  equationEl.textContent =
`x(t) = ${(p0.x*SCALE).toFixed(2)} + ${(dx/dt).toFixed(2)} t
y(t) = ${(p0.y*SCALE).toFixed(2)} + ${(dy/dt).toFixed(2)} t
z(t) = ${z0.toFixed(2)} - 0.5 * ${g} * t²

Angle = ${angle.toFixed(2)} °
Vitesse moyenne = ${speed.toFixed(3)} m/s
Position finale = (${dx.toFixed(2)}, ${dy.toFixed(2)}, ${zt.toFixed(2)}) m`;

  drawAllGraphs(velocities, accelerations);
}

/***********************
 * GRAPHIQUES
 ***********************/
function drawAllGraphs(velocities, accelerations) {
  // Graphique x(t)
  drawGraph("graph-x", trajectory.map(p => ({ t: p.t, v: p.x * SCALE })), "x(t) m");

  // Graphique y(t) (profondeur)
  drawGraph("graph-y", trajectory.map(p => ({ t: p.t, v: p.y * SCALE })), "y(t) m");

  // Graphique z(t)
  const zData = trajectory.map(p => {
    const z = z0 - 0.5 * g * p.t * p.t;
    return { t: p.t, v: z };
  });
  drawGraph("graph-z", zData, "z(t) m");

  // Graphique v(t)
  drawGraph("graph-v", velocities, "v(t) m/s");

  // Graphique a(t)
  drawGraph("graph-a", accelerations, "a(t) m/s²");
}

function drawGraph(id, data, label) {
  const c = document.getElementById(id);
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);

  if (data.length < 2) {
    g.fillText("Données insuffisantes", 20, 20);
    return;
  }

  const pad = 30;
  const w = c.width - 2 * pad;
  const h = c.height - 2 * pad;

  const tMin = Math.min(...data.map(p => p.t));
  const tMax = Math.max(...data.map(p => p.t));
  const vMin = Math.min(...data.map(p => p.v));
  const vMax = Math.max(...data.map(p => p.v));

  // Dessine le cadre du graphique
  g.strokeRect(pad, pad, w, h);

  // Trace les données
  g.beginPath();
  data.forEach((p, i) => {
    const x = pad + ((p.t - tMin) / (tMax - tMin)) * w;
    const y = pad + h - ((p.v - vMin) / (vMax - vMin || 1)) * h;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.stroke();

  // Légende
  g.fillText(label, pad + 5, pad - 8);

  // Axes
  g.beginPath();
  g.moveTo(pad, pad + h);
  g.lineTo(pad + w, pad + h); // Axe horizontal (t)
  g.moveTo(pad, pad);
  g.lineTo(pad, pad + h); // Axe vertical (valeur)
  g.stroke();
}
