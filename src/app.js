import {
  state,
  TAU,
  clamp,
  lerp,
  step,
  cycle,
  stageReadings,
} from "./physics.js";
import { createWorld } from "./scene.js";
import { createSteamFlow } from "./steam-flow.js";
import { descriptions } from "./components.js";

const $ = (id) => document.getElementById(id);
const world = createWorld(selectPart);
const {
  host,
  scene,
  camera,
  renderer,
  parts,
  pickables,
  labels,
  movingCovers,
  rotor,
  generatorRotor,
  coupling,
  impeller,
  steamInside,
  tracers,
  fire,
} = world;
const steamFlow = createSteamFlow(world);
let inspecting = false,
  flowEnabled = true,
  inspectedStage = 0,
  savedMotion = 40;
let visibilityBeforeInspection = [];
function setInspection(enabled) {
  if (enabled === inspecting) return;
  activity();
  if (enabled) {
    if (state.view === "assembled") setView("cutaway");
    savedMotion = Number($("motion").value);
    $("motion").value = Math.min(savedMotion, 10);
    $("motion").oninput();
    visibilityBeforeInspection = scene.children.map((object) => [
      object,
      object.visible,
    ]);
    for (const [object] of visibilityBeforeInspection)
      if (
        !object.isLight &&
        !object.isGridHelper &&
        object !== world.inspection
      )
        object.visible = false;
    world.inspection.visible = true;
    world.inspection.scale.setScalar(0.85 + inspectedStage * 0.06);
    inspecting = true;
    $("partTitle").textContent = "Inside a turbine stage";
    $("partDescription").textContent =
      "Silver vanes stay fixed and turn the flow. Gold blades rotate with the shaft. The cyan arrow shows tangential force on the rotor.";
  } else {
    inspecting = false;
    for (const [object, visible] of visibilityBeforeInspection)
      object.visible = visible;
    world.inspection.visible = false;
    $("motion").value = savedMotion;
    $("motion").oninput();
    const d = descriptions[state.selected];
    $("partTitle").textContent = d.title;
    $("partDescription").textContent = d.description;
  }
  $("inspectButton").classList.toggle("active", inspecting);
  $("inspectButton").setAttribute("aria-pressed", inspecting);
  $("inspectionPanel").hidden = !inspecting;
  home(false);
}
const defaults = { ...state };
const target = new THREE.Vector3(-0.35, 1.7, 0.45),
  desiredTarget = target.clone();
let theta = 0.32,
  phi = 1.12,
  radius = 15.8,
  desiredTheta = theta,
  desiredPhi = phi,
  desiredRadius = radius;
let lastTime = performance.now(),
  lastUI = 0,
  historyTime = 0;
const history = [];
state.lastInput = performance.now();
if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  state.autoIdle = false;
  state.motionSpeed = 0;
  $("motion").value = 0;
  $("motionValue").textContent = "Paused";
  $("motionCaption").textContent = "Mechanical motion paused";
}

function syncTour() {
  $("tourButton").classList.toggle("active", state.tour);
  $("tourButton").setAttribute("aria-pressed", state.tour);
  $("orbitHint").textContent = state.tour
    ? "CINEMATIC ORBIT · DRAG TO TAKE CONTROL"
    : "DRAG TO ORBIT · SCROLL TO ZOOM";
}
function activity() {
  state.lastInput = performance.now();
  state.tour = false;
  syncTour();
}
function home(manual = true) {
  if (manual) activity();
  if (inspecting) {
    desiredTarget.set(0, host.clientWidth < 600 ? 1.35 : 1.85, 0);
    desiredTheta = 0.45;
    desiredPhi = 1.1;
    desiredRadius = 6.8;
    return;
  }
  desiredTarget.set(-0.35, 1.7, 0.45);
  desiredTheta = 0.32;
  desiredPhi = 1.12;
  desiredRadius = state.view === "exploded" ? 18 : 15.8;
}
function setView(view) {
  if (inspecting) setInspection(false);
  activity();
  state.view = view;
  $("viewLabel").textContent = {
    assembled: "ASSEMBLY / COMPLETE",
    cutaway: "SECTION / A—A",
    exploded: "ASSEMBLY / EXPLODED",
  }[view];
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
    b.setAttribute("aria-pressed", b.dataset.view === view);
  });
  home(false);
}
function selectPart(id) {
  if (inspecting) setInspection(false);
  activity();
  const d = descriptions[id];
  state.selected = id;
  $("partIndex").textContent = d.index;
  $("partTitle").textContent = d.title;
  $("partDescription").textContent = d.description;
  $("partType").textContent = d.type;
  document.querySelectorAll("[data-part]").forEach((b) => {
    b.classList.toggle(
      "selected",
      b.dataset.part === id ||
        (id === "generator" && b.dataset.part === "turbine"),
    );
    b.setAttribute("aria-pressed", b.classList.contains("selected"));
  });
  if (state.view === "assembled" && (id === "turbine" || id === "generator"))
    setView("cutaway");
  desiredTarget.set(...d.target);
  desiredRadius = d.radius;
  desiredTheta = 0.32;
  desiredPhi = 1.07;
}
function toggleRun() {
  activity();
  state.running = !state.running;
  syncRun();
}
function syncRun() {
  $("runButton").textContent = state.running
    ? "⏻  Shut down"
    : "▶  Start turbine";
  $("runButton").setAttribute("aria-pressed", state.running);
}
function toggleTour() {
  state.tour = !state.tour;
  state.autoIdle = state.tour;
  state.lastInput = performance.now();
  if (state.tour) home(false);
  syncTour();
}
function resize() {
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  if (inspecting) home(false);
}
new ResizeObserver(resize).observe(host);
resize();
function chart(data, dt) {
  historyTime += dt;
  if (historyTime < 0.5) return;
  historyTime = 0;
  history.push(data.net / 1000);
  if (history.length > 120) history.shift();
  const max = Math.max(0.1, ...history) * 1.12;
  const points = history.map(
    (v, i) =>
      `${((i / 119) * 280).toFixed(1)},${(42 - (v / max) * 38).toFixed(1)}`,
  );
  const path = "M" + points.join(" L");
  $("chartLine").setAttribute("d", path);
  $("chartFill").setAttribute(
    "d",
    path + ` L${(((history.length - 1) / 119) * 280).toFixed(1)},44 L0,44 Z`,
  );
}
function telemetry(data) {
  if (inspecting) {
    const s = stageReadings(inspectedStage, state, data);
    $("stagePressure").textContent =
      s.inlet.pressure.toFixed(2) +
      " → " +
      s.outlet.pressure.toFixed(2) +
      " bar";
    $("stageTemperature").textContent =
      s.inlet.temperature.toFixed(0) +
      " → " +
      s.outlet.temperature.toFixed(0) +
      " °C";
    $("stageDrop").textContent = s.drop.toFixed(1) + " kJ/kg";
  }
  $("rpm").textContent = Math.round(data.rpm).toLocaleString("en-US");
  $("netPower").textContent = (data.net / 1000).toFixed(2);
  $("efficiency").textContent =
    (data.efficiency * 100).toFixed(1) + "% efficiency";
  $("torque").textContent = (data.torque / 1000).toFixed(2);
  $("flowMetric").textContent = data.massFlow.toFixed(2);
  $("boilerHeat").innerHTML =
    (data.heatIn / 1000).toFixed(2) + " <small>MW in</small>";
  $("shaftPower").innerHTML =
    (data.shaft / 1000).toFixed(2) + " <small>MW shaft</small>";
  $("condenserHeat").innerHTML =
    (data.rejected / 1000).toFixed(2) + " <small>MW out</small>";
  $("pumpPower").innerHTML = data.pump.toFixed(1) + " <small>kW in</small>";
  $("statusText").textContent = state.running
    ? state.spool < 0.98
      ? "TURBINE RUN-UP"
      : "TURBINE ONLINE"
    : state.spool > 0.001
      ? "TURBINE COAST-DOWN"
      : "TURBINE STOPPED";
}
function frame(now) {
  const dt = clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;
  const data = step(dt),
    ease = 1 - Math.exp(-dt * 5);
  state.explode = lerp(state.explode, state.view === "exploded" ? 1 : 0, ease);
  movingCovers.forEach((c) => {
    c.g.position.copy(c.base).addScaledVector(c.offset, state.explode);
    c.g.visible =
      state.view === "assembled" ||
      state.view === "exploded" ||
      state.explode > 0.02;
  });
  rotor.rotation.x = state.angle;
  generatorRotor.rotation.x = state.angle;
  coupling.rotation.x = state.angle;
  impeller.rotation.y = state.pumpAngle;
  world.inspectionRotor.rotation.x = state.angle;
  steamFlow.update(state, data, inspecting, flowEnabled);
  tracers.forEach(({ curve, beads }) =>
    beads.forEach((b, i) => {
      b.visible = false;
      b.position.copy(curve.getPointAt((state.phase + i / beads.length) % 1));
    }),
  );
  fire.material.emissiveIntensity =
    state.spool * (0.45 + (state.temperature / 550) * 0.8);
  if (
    !inspecting &&
    state.autoIdle &&
    !state.tour &&
    now - state.lastInput > 12000
  ) {
    state.tour = true;
    home(false);
    syncTour();
  }
  if (state.tour) {
    desiredTheta += dt * 0.065;
    desiredPhi = 1.09 + Math.sin(now * 0.00013) * 0.09;
  }
  target.lerp(desiredTarget, ease);
  theta = lerp(theta, desiredTheta, ease);
  phi = lerp(phi, desiredPhi, ease);
  radius = lerp(radius, desiredRadius, ease);
  const fit = Math.max(1, 1.5 / camera.aspect),
    r = radius * fit;
  camera.position.set(
    target.x + r * Math.sin(phi) * Math.sin(theta),
    target.y + r * Math.cos(phi),
    target.z + r * Math.sin(phi) * Math.cos(theta),
  );
  camera.lookAt(target);
  camera.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  labels.forEach(({ el, g, position }) => {
    const p = g.localToWorld(position.clone()).project(camera),
      x = (p.x * 0.5 + 0.5) * host.clientWidth,
      y = (-p.y * 0.5 + 0.5) * host.clientHeight;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.classList.toggle(
      "hidden",
      inspecting ||
        !state.labels ||
        p.z > 1 ||
        p.z < -1 ||
        x < 72 ||
        x > host.clientWidth - 72 ||
        y < 150 ||
        y > host.clientHeight - 65,
    );
  });
  renderer.render(scene, camera);
  window.__steamStartup?.frameRendered();
  chart(data, dt);
  if (now - lastUI > 120) {
    lastUI = now;
    telemetry(data);
  }
  window.SIM.telemetry = data;
  requestAnimationFrame(frame);
}
// Orbit, pinch and ray picking. No external control dependency.
const pointers = new Map();
let moved = false,
  origin = null,
  pinch = 0;
host.addEventListener("pointerdown", (e) => {
  activity();
  host.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  origin = { x: e.clientX, y: e.clientY };
  moved = false;
  if (pointers.size === 2) {
    const p = [...pointers.values()];
    pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    moved = true;
  }
});
host.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  activity();
  const previous = pointers.get(e.pointerId);
  if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 4) moved = true;
  if (pointers.size === 1) {
    desiredTheta -= (e.clientX - previous.x) * 0.006;
    desiredPhi = clamp(
      desiredPhi - (e.clientY - previous.y) * 0.006,
      0.35,
      1.67,
    );
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const p = [...pointers.values()],
      distance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    desiredRadius = clamp(
      (desiredRadius * pinch) / Math.max(1, distance),
      4,
      28,
    );
    pinch = distance;
  }
});
const ray = new THREE.Raycaster();
host.addEventListener("pointerup", (e) => {
  if (!moved && pointers.size === 1) {
    const rect = host.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = ray.intersectObjects(pickables).find((h) => {
      let o = h.object;
      while (o) {
        if (!o.visible) return false;
        o = o.parent;
      }
      return true;
    });
    if (hit) selectPart(hit.object.userData.part);
  }
  pointers.delete(e.pointerId);
});
for (const event of ["pointercancel", "lostpointercapture"])
  host.addEventListener(event, (e) => pointers.delete(e.pointerId));
host.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    activity();
    desiredRadius = clamp(desiredRadius * Math.exp(e.deltaY * 0.001), 4, 28);
  },
  { passive: false },
);
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => setView(b.dataset.view)));
document
  .querySelectorAll("[data-part]")
  .forEach((b) => (b.onclick = () => selectPart(b.dataset.part)));
for (const id of ["temperature", "pressure", "flow"])
  $(id).oninput = () => {
    activity();
    state[id] = Number($(id).value);
    $(id + "Value").textContent =
      id === "flow"
        ? state[id].toFixed(1) + " kg/s"
        : state[id] + (id === "pressure" ? " bar" : " °C");
  };
$("backPressure").onchange = () => {
  activity();
  state.backPressure = Number($("backPressure").value);
};
$("motion").oninput = () => {
  activity();
  const v = Number($("motion").value);
  state.motionSpeed = v === 0 ? 0 : Math.pow(10, (v - 100) / 37.5);
  const caption =
    state.motionSpeed === 0 ? "Paused" : state.motionSpeed.toFixed(3) + "×";
  $("motionValue").textContent = caption;
  $("motionCaption").textContent =
    state.motionSpeed === 0
      ? "Mechanical motion paused"
      : "Motion shown at " + caption;
};
$("runButton").onclick = toggleRun;
$("tourButton").onclick = toggleTour;
$("resetButton").onclick = () => home();
$("labelsButton").onclick = () => {
  activity();
  state.labels = !state.labels;
  $("labelsButton").classList.toggle("active", state.labels);
  $("labelsButton").setAttribute("aria-pressed", state.labels);
};
$("resetPlant").onclick = () => {
  if (inspecting) setInspection(false);
  Object.assign(state, defaults);
  state.lastInput = performance.now();
  for (const id of ["temperature", "pressure", "flow"]) {
    $(id).value = state[id];
    $(id).oninput();
  }
  $("backPressure").value = state.backPressure;
  $("motion").value = 40;
  $("motion").oninput();
  history.length = 0;
  historyTime = 0;
  $("chartLine").setAttribute("d", "M0 44H280");
  $("chartFill").setAttribute("d", "M0 44H280");
  syncRun();
  $("labelsButton").classList.add("active");
  $("labelsButton").setAttribute("aria-pressed", "true");
  selectPart("turbine");
  setView("cutaway");
};
$("guideButton").onclick = () => {
  activity();
  $("guide").showModal();
};
$("closeGuide").onclick = () => $("guide").close();
document.addEventListener("keydown", (e) => {
  if (
    $("guide").open ||
    /INPUT|SELECT|BUTTON|TEXTAREA/.test(document.activeElement.tagName)
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    toggleRun();
  }
  if (e.key === "1") setView("assembled");
  if (e.key === "2") setView("cutaway");
  if (e.key === "3") setView("exploded");
  if (e.key.toLowerCase() === "t") toggleTour();
  if (e.key.toLowerCase() === "r") home();
});
document.addEventListener("visibilitychange", () => {
  lastTime = performance.now();
  state.lastInput = lastTime;
});
$("inspectButton").onclick = () => setInspection(!inspecting);
$("flowButton").onclick = () => {
  activity();
  flowEnabled = !flowEnabled;
  $("flowButton").classList.toggle("active", flowEnabled);
  $("flowButton").setAttribute("aria-pressed", flowEnabled);
};
$("stageSelect").onchange = () => {
  activity();
  inspectedStage = Number($("stageSelect").value);
  world.inspection.scale.setScalar(0.85 + inspectedStage * 0.06);
};
$("closeInspection").onclick = () => setInspection(false);
window.SIM = {
  setInspection,
  steamFlow,
  inspection: world.inspection,
  inspectionRotor: world.inspectionRotor,
  inspectionStator: world.inspectionStator,
  get inspecting() {
    return inspecting;
  },
  get inspectedStage() {
    return inspectedStage;
  },
  state,
  scene,
  camera,
  renderer,
  parts,
  cycle,
  step,
  setView,
  selectPart,
  telemetry: null,
  ready: true,
};
requestAnimationFrame(frame);
