import { test } from "node:test";
import assert from "node:assert/strict";
import { state, cycle, step, saturation } from "../src/physics.js";
const defaults = { ...state };
test("Rankine-loop energy balance closes over the full control range", () => {
  for (const temperature of [350, 450, 550])
    for (const pressure of [20, 40, 80])
      for (const backPressure of [0.05, 0.1, 0.2, 0.5, 1])
        for (const flow of [0.5, 3, 6]) {
          const d = cycle({
            ...defaults,
            temperature,
            pressure,
            backPressure,
            flow,
          });
          assert.ok(
            Object.values(d)
              .filter((v) => typeof v === "number")
              .every(Number.isFinite),
          );
          assert.ok(d.net > 0 && d.rejected > 0 && d.heatIn > 0);
          assert.ok(d.efficiency > 0 && d.efficiency < 1);
          assert.ok(Math.abs(d.heatIn - d.net - d.rejected - d.losses) < 1e-8);
        }
});
test("higher flow scales output and lower exhaust pressure improves output", () => {
  const base = cycle({ ...defaults, spool: 1 });
  const twice = cycle({ ...defaults, spool: 1, flow: defaults.flow * 2 });
  assert.ok(Math.abs(twice.net / base.net - 2) < 1e-12);
  assert.ok(
    cycle({ ...defaults, backPressure: 0.05 }).net >
      cycle({ ...defaults, backPressure: 1 }).net,
  );
  assert.ok(
    cycle({ ...defaults, temperature: 550 }).net >
      cycle({ ...defaults, temperature: 350 }).net,
  );
});
test("shaft torque and electrical frequency agree with rpm", () => {
  const d = cycle({ ...defaults, spool: 1 });
  assert.equal(d.rpm, 3000);
  assert.equal(d.frequency, 50);
  assert.ok(
    Math.abs((d.torque * ((d.rpm * Math.PI) / 30)) / 1000 - d.shaft) < 1e-9,
  );
});
test("motion pause, coast-down and saturated-water anchors", () => {
  Object.assign(state, defaults, { motionSpeed: 0 });
  const angle = state.angle;
  step(0.05);
  assert.equal(state.angle, angle);
  state.running = false;
  for (let i = 0; i < 1200; i++) step(0.05);
  assert.equal(cycle().rpm, 0);
  assert.equal(cycle().net, 0);
  assert.equal(saturation(0.1).temperature, 45.81);
  Object.assign(state, defaults);
});
