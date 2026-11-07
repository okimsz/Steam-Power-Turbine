// Educational Rankine-cycle approximation. kJ/kg, kJ/(kg K), bar absolute, kg/s.
// Rounded low-pressure saturated-water anchors; interpolate in log pressure.
const SAT = [
  [0.05, 32.88, 137.8, 2423.7, 0.476],
  [0.1, 45.81, 191.8, 2392.1, 0.6492],
  [0.2, 60.06, 251.4, 2358.3, 0.832],
  [0.5, 81.32, 340.5, 2304.7, 1.091],
  [1, 99.61, 417.5, 2257.9, 1.303],
];
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const state = {
  running: true,
  temperature: 450,
  pressure: 40,
  backPressure: 0.1,
  flow: 3,
  efficiency: 0.82,
  spool: 0.75,
  angle: 0,
  pumpAngle: 0,
  phase: 0,
  motionSpeed: 0.025,
  view: "cutaway",
  explode: 0,
  selected: "turbine",
  labels: true,
  tour: false,
  autoIdle: true,
  lastInput: 0,
};
function saturation(pressure) {
  const p = clamp(pressure, 0.05, 1);
  let i = 0;
  while (i < SAT.length - 2 && p > SAT[i + 1][0]) i++;
  const a = SAT[i],
    b = SAT[i + 1],
    t = Math.log(p / a[0]) / Math.log(b[0] / a[0]);
  const [temperature, hf, hfg, sf] = a
    .slice(1)
    .map((value, j) => lerp(value, b[j + 1], t));
  return { temperature, hf, hfg, sf, sfg: hfg / (temperature + 273.15) };
}
function cycle(s = state) {
  const sat = saturation(s.backPressure),
    cp = 2.3;
  // Smooth inlet approximation referenced to nominal 40 bar / 250 C saturation.
  const h3 = 2800 + cp * (s.temperature - 250);
  const s3 =
    6.1 +
    cp * Math.log((s.temperature + 273.15) / 523.15) -
    0.4615 * Math.log(s.pressure / 40);
  const idealQuality = (s3 - sat.sf) / sat.sfg;
  const h4s =
    idealQuality <= 1
      ? sat.hf + idealQuality * sat.hfg
      : sat.hf +
        sat.hfg +
        cp *
          (sat.temperature + 273.15) *
          (Math.exp((s3 - sat.sf - sat.sfg) / cp) - 1);
  const drop = (h3 - h4s) * s.efficiency;
  const h4 = h3 - drop,
    quality = (h4 - sat.hf) / sat.hfg;
  const exhaustTemperature =
    quality <= 1
      ? sat.temperature
      : sat.temperature + (h4 - sat.hf - sat.hfg) / cp;
  const pumpSpecific = (0.001 * (s.pressure - s.backPressure) * 100) / 0.75;
  const massFlow = s.flow * s.spool;
  const shaft = massFlow * drop * 0.98,
    gross = shaft * 0.96,
    pump = (massFlow * pumpSpecific) / 0.9;
  const heatIn = massFlow * (h3 - sat.hf - pumpSpecific);
  const rejected = massFlow * (h4 - sat.hf);
  const losses =
    massFlow * drop - shaft * 0.96 + pump - massFlow * pumpSpecific;
  const net = gross - pump,
    rpm = 3000 * s.spool;
  return {
    rpm,
    massFlow,
    shaft,
    gross,
    pump,
    net,
    heatIn,
    rejected,
    losses,
    efficiency: heatIn > 0 ? net / heatIn : 0,
    torque: rpm > 0 ? (shaft * 1000) / ((rpm / 60) * TAU) : 0,
    frequency: rpm / 60,
    drop,
    h3,
    h4,
    exhaustTemperature,
    quality: clamp(quality, 0, 1),
    superheated: quality > 1,
  };
}
function step(dt) {
  dt = clamp(dt, 0, 0.1);
  state.spool = lerp(
    state.spool,
    state.running ? 1 : 0,
    1 - Math.exp(-dt * (state.running ? 0.65 : 0.42)),
  );
  if (!state.running && state.spool < 0.0001) state.spool = 0;
  const data = cycle();
  state.angle =
    (state.angle + (data.rpm / 60) * TAU * state.motionSpeed * dt) % TAU;
  state.pumpAngle =
    (state.pumpAngle + (data.rpm / 60) * TAU * 0.5 * state.motionSpeed * dt) %
    TAU;
  state.phase =
    (state.phase + data.massFlow * 0.35 * state.motionSpeed * dt) % 1;
  return data;
}
// Stage boundaries are illustrative distributions, not a stage-by-stage steam solver.
function stageReadings(index, s = state, data = cycle(s)) {
  const i = clamp(Math.round(index), 0, 5);
  const boundary = (fraction) => ({
    pressure: s.pressure * Math.pow(s.backPressure / s.pressure, fraction),
    temperature: lerp(s.temperature, data.exhaustTemperature, fraction),
    enthalpy: lerp(data.h3, data.h4, fraction),
  });
  return {
    inlet: boundary(i / 6),
    outlet: boundary((i + 1) / 6),
    drop: data.drop / 6,
  };
}
export { state, TAU, clamp, lerp, saturation, cycle, step, stageReadings };
