# STEAMWORKS — Steam turbine laboratory

A darker charcoal-and-copper companion to the split-AC simulator, with a new console
layout, six animated turbine stages, fixed guide vanes, coupled generator, removable
upper casing, and a schematic boiler/condenser/feedwater circuit.

## Run in VS Code

Open this folder in VS Code. With Node.js 20+ installed:

```sh
npm run dev
```

Open http://127.0.0.1:5173. No `npm install` is required. The source uses native browser
modules and locally bundled Three.js. Refresh after editing. Use Ctrl+C to stop the server.
If that port is occupied, stop the other simulator or set `PORT` to another number.
PowerShell example: `$env:PORT=5175; npm run dev`.
If PowerShell blocks npm.ps1, run `npm.cmd run dev` or `node scripts/serve.mjs`.

F5 can launch the included Edge or Chrome debugging configuration (default port 5173).
Do not open `index.html` using file://; use the local server for modular development.

## Single-file offline version

The ZIP includes `dist/steam-turbine-simulator.html`. Double-click it to open in a
WebGL-enabled browser without internet or Node. To rebuild after editing:

```sh
npm test
npm run build
```

Share the generated HTML by itself. It contains CSS, JavaScript, Three.js and its license.
External reference links in Field notes are optional and require internet.

## Source map

| File | Responsibility |
| --- | --- |
| `index.html` | Dashboard, cycle cards, controls, and Field notes |
| `src/styles.css` | Charcoal-and-copper theme and responsive layout |
| `src/physics.js` | Approximate Rankine model, shaft speed, torque and energy balance |
| `src/scene.js` | Procedural geometry, twisted airfoil blades, casing and lighting |
| `src/app.js` | Animation, controls, camera, telemetry and power trend |
| `src/components.js` | Component explanations and camera targets |
| `src/errors.js` | Visible startup/runtime errors |
| `scripts/` | Dependency-free preview server and offline builder |
| `tests/` | Energy balance and kinematics regression tests |
| `vendor/` | Three.js r160.1, MIT licensed |

The builder supports relative named imports and named exports for this small project.
Use a full bundler if extending the module syntax beyond its documented support.

## Interactions

- Drag to orbit; wheel/pinch to zoom.
- Click cycle cards or model parts to inspect them.
- Assembled / Cutaway / Exploded control the upper casing and generator cover.
- Adjust inlet temperature, inlet pressure, admission flow and condenser pressure.
- Shut down / Start turbine smoothly ramp operation; Reset plant restores defaults.
- Motion speed is a visualization scale. At zero, the model freezes but telemetry continues.
- After 12 idle seconds, a gentle orbit starts. Turning Orbit tour off disables idle orbit.
- Keyboard: 1/2/3 views, Space run/stop, T tour, R reset view.

## Model limits

This is a generic educational turbine, not a manufacturer's CAD model or a service tool.
Peripheral equipment is schematic and not drawn to turbine scale. The shaft and generator
rotate together, while the stator blades stay fixed. Stage geometry is illustrative.

The cycle uses smooth inlet enthalpy/entropy approximations and rounded saturated-water
anchors, not a validated IAPWS solver. Formulae, efficiencies and assumptions are in the
Field notes. The first-law energy balance includes pump motor and generator losses.
Transient shaft speed is an illustrative governor ramp, not a rotor dynamics simulation.
Pressure controls are in bar absolute, not gauge pressure.

All assets run locally. Three.js retains its MIT license in `vendor/three-LICENSE.txt`.
## GitHub

Repository: https://github.com/okimsz/Steam-Power-Turbine

```sh
git clone https://github.com/okimsz/Steam-Power-Turbine.git
cd Steam-Power-Turbine
npm run dev
```

The generated `dist/` directory is ignored by Git. After cloning, run `npm run build`
to create the single-file offline HTML. This is separate from the split-AC repository.
