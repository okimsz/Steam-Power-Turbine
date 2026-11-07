import { TAU } from "./physics.js";

export function createWorld(onSelect) {
  const host = document.getElementById("viewport"),
    scene = new THREE.Scene();
  scene.background = new THREE.Color("#283136");
  scene.fog = new THREE.Fog("#283136", 28, 65);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 90);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xd4e2ed, 0x2c3031, 2.5));
  const key = new THREE.DirectionalLight(0xffe2bd, 4);
  key.position.set(-4, 9, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {
    left: -10,
    right: 10,
    top: 8,
    bottom: -8,
    near: 0.5,
    far: 30,
  });
  key.shadow.normalBias = 0.035;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x86b9db, 3.4);
  rim.position.set(4, 6, -7);
  scene.add(rim);
  const soft = new THREE.DirectionalLight(0xffffff, 1.5);
  soft.position.set(0, 2, 9);
  scene.add(soft);
  const material = (color, metalness = 0.5, roughness = 0.4, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  const M = {
    shell: material("#506269", 0.65, 0.38),
    edge: material("#8a9a9d", 0.8, 0.3),
    base: material("#334149", 0.5, 0.7),
    dark: material("#26343a", 0.55, 0.36),
    rotor: material("#c5a678", 0.8, 0.31),
    steel: material("#a6b8bb", 0.8, 0.28),
    guide: material("#81989f", 0.75, 0.35),
    copper: material("#cc8a54", 0.65, 0.3),
    hot: material("#d9985b", 0.5, 0.33),
    cold: material("#579fb0", 0.5, 0.35),
    glow: material("#e9ae63", 0.2, 0.4, {
      emissive: 0xd87427,
      emissiveIntensity: 1,
    }),
    trace: material("#ffda9a", 0.1, 0.35, {
      emissive: 0xd99247,
      emissiveIntensity: 0.7,
    }),
  };
  const pickables = [],
    labels = [],
    movingCovers = [],
    parts = {};
  function group(name, parent = scene) {
    const g = new THREE.Group();
    g.name = name;
    parent.add(g);
    return g;
  }
  function mesh(geometry, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(w, h, d, mat, parent, x = 0, y = 0, z = 0) {
    return mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z);
  }
  function cylinder(
    radius,
    length,
    mat,
    parent,
    x = 0,
    y = 0,
    z = 0,
    axis = "x",
  ) {
    const c = mesh(
      new THREE.CylinderGeometry(radius, radius, length, 48),
      mat,
      parent,
      x,
      y,
      z,
    );
    if (axis === "x") c.rotation.z = -Math.PI / 2;
    return c;
  }
  function ring(r, t, mat, parent, x = 0, y = 0, z = 0) {
    const m = mesh(new THREE.TorusGeometry(r, t, 8, 64), mat, parent, x, y, z);
    m.rotation.y = Math.PI / 2;
    return m;
  }
  function pipe(points, mat, r = 0.055) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
      false,
      "centripetal",
    );
    mesh(new THREE.TubeGeometry(curve, 64, r, 10, false), mat, scene);
    return curve;
  }
  function part(g, id) {
    parts[id] = g;
    g.traverse((m) => {
      if (m.isMesh) {
        m.userData.part = id;
        pickables.push(m);
      }
    });
  }
  function cover(g, offset) {
    movingCovers.push({
      g,
      base: g.position.clone(),
      offset: new THREE.Vector3(...offset),
    });
  }
  function label(text, g, position, id, cool = false) {
    const el = document.createElement("button");
    el.className = "part-label" + (cool ? " cool" : "");
    el.textContent = text;
    el.onclick = () => onSelect(id);
    document.getElementById("labels").appendChild(el);
    labels.push({ el, g, position: new THREE.Vector3(...position) });
  }
  const floor = box(
    120,
    0.08,
    120,
    material("#253037", 0.1, 0.92),
    scene,
    0,
    -0.15,
    0,
  );
  const grid = new THREE.GridHelper(32, 64, 0x4a5b62, 0x384950);
  grid.position.y = -0.1;
  grid.material.transparent = true;
  grid.material.opacity = 0.33;
  scene.add(grid);
  const bed = box(9, 0.24, 2.8, M.base, scene, 0.8, 0.05, 0);
  for (const x of [-3.3, 4.8]) {
    box(0.22, 0.3, 3.05, M.edge, scene, x, 0.04, 0);
  }
  const turbine = group("Six-stage turbine");
  turbine.position.set(-0.7, 2.02, 0);
  for (const x of [-2.7, 2.7]) {
    box(0.6, 0.85, 1.15, M.shell, turbine, x, -1.35, 0);
    box(0.85, 0.12, 1.45, M.edge, turbine, x, -1.82, 0);
    cylinder(0.25, 0.55, M.edge, turbine, x, 0, 0);
    ring(0.28, 0.045, M.copper, turbine, x + 0.29);
  }
  const rotor = group("Common rotor shaft", turbine);
  cylinder(0.145, 6.9, M.steel, rotor, 0.25, 0, 0);
  const topCasing = group("Upper casing and guide vanes", turbine);
  function casing(parent, start) {
    const shell = mesh(
      new THREE.CylinderGeometry(1.35, 0.81, 5.35, 64, 1, true, start, Math.PI),
      M.shell,
      parent,
    );
    shell.rotation.z = -Math.PI / 2;
    shell.material = M.shell.clone();
    shell.material.side = THREE.DoubleSide;
    for (const z of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(-2.68, z * 0.81);
      shape.lineTo(2.68, z * 1.35);
      shape.lineTo(2.68, z * 1.46);
      shape.lineTo(-2.68, z * 0.92);
      shape.closePath();
      const flange = mesh(
        new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false }),
        M.edge,
        parent,
      );
      flange.rotation.x = Math.PI / 2;
    }
  }
  casing(turbine, 0);
  casing(topCasing, Math.PI);
  cover(topCasing, [0, 2.45, -0.3]);
  // Twisted blade: elliptical airfoil sections swept along the radius around x.
  function bladeGeometry(root, tip, chord, twist) {
    const vertices = [],
      indices = [],
      rows = 6,
      sides = 12;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows,
        r = root + (tip - root) * t,
        angle = twist * (t - 0.3),
        width = chord * (1 - 0.2 * t);
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * TAU,
          u = Math.cos(a) * width * 0.5,
          v = Math.sin(a) * width * 0.11;
        vertices.push(
          u * Math.cos(angle) - v * Math.sin(angle),
          r,
          u * Math.sin(angle) + v * Math.cos(angle),
        );
      }
    }
    for (let row = 0; row < rows; row++)
      for (let j = 0; j < sides; j++) {
        const a = row * sides + j,
          b = row * sides + ((j + 1) % sides),
          c = a + sides,
          d = b + sides;
        indices.push(a, b, c, b, d, c);
      }
    for (let j = 1; j < sides - 1; j++) {
      indices.push(0, j + 1, j);
      const o = rows * sides;
      indices.push(o, o + j, o + j + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
  const dummy = new THREE.Object3D();
  for (let stage = 0; stage < 6; stage++) {
    const x = -2.12 + stage * 0.79,
      r = 0.67 + stage * 0.105;
    cylinder(0.29 + stage * 0.025, 0.09, M.steel, rotor, x);
    const n = 26 + stage * 2;
    const blades = new THREE.InstancedMesh(
      bladeGeometry(0.28 + stage * 0.025, r, 0.31, 0.8),
      M.rotor,
      n,
    );
    for (let i = 0; i < n; i++) {
      dummy.position.set(x, 0, 0);
      dummy.rotation.set((i / n) * TAU, 0, 0);
      dummy.updateMatrix();
      blades.setMatrixAt(i, dummy.matrix);
    }
    rotor.add(blades);
    blades.castShadow = true;
    blades.receiveShadow = true;
    for (const upper of [false, true]) {
      const stator = group(
        "Fixed nozzle row " + stage,
        upper ? topCasing : turbine,
      );
      const guides = new THREE.InstancedMesh(
        bladeGeometry(0.34 + stage * 0.025, r + 0.035, 0.17, -0.8),
        M.guide,
        15,
      );
      for (let i = 0; i < 15; i++) {
        dummy.position.set(x - 0.32, 0, 0);
        dummy.rotation.set(
          (upper ? 0 : 1) * Math.PI + (i / 15 - 0.5) * Math.PI,
          0,
          0,
        );
        dummy.updateMatrix();
        guides.setMatrixAt(i, dummy.matrix);
      }
      stator.add(guides);
      guides.castShadow = true;
    }
    // Lower ribs match the casing taper and remain fixed.
    const rib = mesh(
      new THREE.TorusGeometry(r + 0.14, 0.035, 8, 48, Math.PI),
      M.edge,
      turbine,
      x,
      0,
      0,
    );
    rib.rotation.set(0, Math.PI / 2, Math.PI);
  }
  for (let i = 0; i < 12; i++)
    for (const z of [-1, 1]) {
      const x = -2.5 + i * 0.45,
        r = 0.84 + ((x + 2.68) / 5.35) * 0.54;
      const bolt = cylinder(
        0.039,
        0.15,
        M.steel,
        topCasing,
        x,
        0.05,
        z * r,
        "y",
      );
    }
  const steamInside = [];
  for (let i = 0; i < 60; i++) {
    const m = mesh(new THREE.SphereGeometry(0.028, 6, 5), M.trace.clone(), turbine);
    const t = i / 60;
    m.material.color.lerp(new THREE.Color('#8ccad8'), t);
    steamInside.push(m);
  }
  part(turbine, "turbine");
  // The generator is mechanically coupled to the shaft, outside the steam circuit.
  const generator = group("Two-pole generator");
  generator.position.set(4.05, 2.02, 0);
  box(2.35, 0.3, 1.8, M.base, generator, 0, -1.47, 0);
  for (const x of [-0.7, 0.7])
    box(0.35, 0.62, 1.2, M.shell, generator, x, -1.05, 0);
  const generatorRotor = group("Generator rotor", generator);
  cylinder(0.31, 1.85, M.steel, generatorRotor);
  for (const z of [-0.32, 0.32])
    box(1.55, 0.32, 0.18, M.copper, generatorRotor, 0, 0, z);
  cylinder(0.14, 3.05, M.steel, generatorRotor, -0.15);
  const generatorCover = group("Generator upper cover", generator);
  for (const upper of [false, true]) {
    const parent = upper ? generatorCover : generator;
    const casing = mesh(
      new THREE.CylinderGeometry(
        0.85,
        0.85,
        2.05,
        48,
        1,
        true,
        upper ? Math.PI : 0,
        Math.PI,
      ),
      M.shell,
      parent,
    );
    casing.rotation.z = -Math.PI / 2;
    for (let i = 0; i < 7; i++) {
      const angle = (i / 6 - 0.5) * Math.PI + (upper ? 0 : Math.PI);
      const y = Math.cos(angle) * 0.64,
        z = Math.sin(angle) * 0.64;
      box(1.6, 0.09, 0.12, M.copper, parent, 0, y, z);
    }
  }
  for (const x of [-1.07, 1.07]) {
    ring(0.75, 0.1, M.dark, generator, x);
    cylinder(0.22, 0.18, M.edge, generator, x);
  }
  cover(generatorCover, [0, 1.7, 0]);
  part(generator, "generator");
  const coupling = group("Shaft coupling");
  coupling.position.set(2.68, 2.02, 0);
  cylinder(0.25, 0.5, M.dark, coupling);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    cylinder(
      0.035,
      0.54,
      M.edge,
      coupling,
      0,
      Math.sin(a) * 0.2,
      Math.cos(a) * 0.2,
    );
  }
  // Compact peripheral equipment represents the whole Rankine loop schematically.
  const boiler = group("Steam generator");
  boiler.position.set(-5.5, 1.35, -0.1);
  cylinder(0.62, 2.35, M.shell, boiler, 0, 0, 0, "y");
  cylinder(0.67, 0.12, M.edge, boiler, 0, 1.12, 0, "y");
  cylinder(0.67, 0.12, M.edge, boiler, 0, -1.12, 0, "y");
  box(1.45, 0.17, 1.45, M.base, boiler, 0, -1.25, 0);
  for (let i = 0; i < 7; i++) {
    const band = mesh(
      new THREE.TorusGeometry(0.635, 0.018, 6, 48),
      M.edge,
      boiler,
      0,
      -0.9 + i * 0.29,
    );
    band.rotation.x = Math.PI / 2;
  }
  box(0.5, 0.35, 0.12, M.dark, boiler, 0, -0.65, 0.6);
  const fire = box(0.34, 0.21, 0.025, M.glow, boiler, 0, -0.65, 0.675);
  box(0.22, 0.43, 0.08, M.edge, boiler, 0.25, 0.25, 0.61);
  box(0.09, 0.32, 0.015, M.cold, boiler, 0.25, 0.25, 0.658);
  part(boiler, "boiler");
  const condenser = group("Surface condenser");
  condenser.position.set(0.1, 0.6, 2.65);
  cylinder(0.39, 2.45, M.shell, condenser);
  for (const x of [-1.23, 1.23]) {
    cylinder(0.44, 0.12, M.edge, condenser, x);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      cylinder(
        0.025,
        0.15,
        M.steel,
        condenser,
        x,
        Math.cos(a) * 0.35,
        Math.sin(a) * 0.35,
      );
    }
  }
  for (const x of [-0.85, 0.85])
    box(0.3, 0.28, 0.8, M.base, condenser, x, -0.45, 0);
  // Visible cooling-water tube bundle on the front.
  for (let i = 0; i < 7; i++)
    cylinder(0.035, 2.15, M.cold, condenser, 0, -0.21 + i * 0.07, 0.37);
  part(condenser, "condenser");
  const pump = group("Feedwater pump");
  pump.position.set(-3.4, 0.52, 2.65);
  cylinder(0.27, 0.35, M.shell, pump, 0, 0, 0, "y");
  box(0.8, 0.12, 0.8, M.base, pump, 0, -0.34, 0);
  cylinder(0.17, 0.55, M.dark, pump, 0.46, 0, 0);
  const impeller = group("Pump impeller", pump);
  impeller.position.y = 0.19;
  for (let i = 0; i < 6; i++) {
    const b = box(0.27, 0.035, 0.035, M.copper, impeller);
    b.rotation.y = (i / 6) * TAU;
    b.position.set(
      Math.cos((i / 6) * TAU) * 0.1,
      0,
      Math.sin((i / 6) * TAU) * 0.1,
    );
  }
  part(pump, "pump");
  const hotPath = pipe(
    [
      [-5.5, 2.55, -0.1],
      [-5.5, 3.55, -0.1],
      [-4.5, 3.55, -0.1],
      [-3.3, 3.55, 0],
      [-3.1, 2.3, 0],
    ],
    M.hot,
    0.072,
  );
  const exhaustPath = pipe(
    [
      [1.55, 1.65, 0.75],
      [1.65, 1.15, 1.6],
      [1.5, 0.6, 2.65],
      [1.25, 0.6, 2.65],
    ],
    M.cold,
    0.12,
  );
  const returnPath = pipe(
    [
      [-1.15, 0.6, 2.65],
      [-2.1, 0.6, 2.65],
      [-3.4, 0.52, 2.65],
    ],
    M.cold,
    0.055,
  );
  const feedPath = pipe(
    [
      [-3.4, 0.52, 2.65],
      [-4.45, 0.5, 2.65],
      [-5.5, 0.5, 1.5],
      [-5.5, 0.7, 0.5],
    ],
    M.cold,
    0.055,
  );
  const tracers = [];
  for (const [curve, hot] of [
    [hotPath, true],
    [exhaustPath, false],
    [returnPath, false],
    [feedPath, false],
  ]) {
    const beads = [];
    for (let i = 0; i < 14; i++)
      beads.push(
        mesh(
          new THREE.SphereGeometry(0.037, 6, 5),
          hot
            ? M.trace
            : material("#a7d9e4", 0.1, 0.4, {
                emissive: 0x5c9eaf,
                emissiveIntensity: 0.6,
              }),
          scene,
        ),
      );
    tracers.push({ curve, beads });
  }
  label("01 / STEAM GENERATOR", boiler, [0, 1.55, 0], "boiler");
  label("02 / TURBINE", turbine, [0, 1.45, 0], "turbine");
  label("GENERATOR", generator, [0, 1.05, 0], "generator");
  label("03 / CONDENSER", condenser, [0, -0.6, 0.35], "condenser", true);
  label("04 / FEED PUMP", pump, [0, -0.25, 0.7], "pump", true);
  return {
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
  };
}
