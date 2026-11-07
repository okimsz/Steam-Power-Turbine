import { TAU, clamp } from "./physics.js";

/** Analytical flow guides and a soft exhaust aerosol; not a CFD solution. */
export function createSteamFlow(world) {
  const { scene, turbine, inspection, tracers } = world;
  const flowGroup = new THREE.Group();
  turbine.add(flowGroup);
  const inspectFlow = new THREE.Group();
  inspection.add(inspectFlow);
  const hot = new THREE.Color("#f2bd80"),
    cold = new THREE.Color("#86cbdc");
  function streaks(count, parent) {
    const positions = new Float32Array(count * 6),
      colors = new Float32Array(count * 6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    parent.add(lines);
    return { positions, colors, geometry, lines, count };
  }
  const internal = streaks(210, flowGroup),
    detail = streaks(100, inspectFlow);
  const pipeStreams = tracers.map((route) => ({
    ...streaks(24, scene),
    curve: route.curve,
  }));
  // A point sprite shader makes soft mist without textures, downloads or opaque spheres.
  const mistCount = 220,
    mistPositions = new Float32Array(mistCount * 3),
    sizes = new Float32Array(mistCount);
  for (let i = 0; i < mistCount; i++) sizes[i] = 0.12 + (i % 7) * 0.018;
  const mistGeometry = new THREE.BufferGeometry();
  mistGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(mistPositions, 3),
  );
  mistGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  const mistMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { opacity: { value: 0 }, viewportHeight: { value: 600 } },
    vertexShader:
      "attribute float size; uniform float viewportHeight; varying float fade; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; gl_PointSize=clamp(size*viewportHeight/max(0.1,-p.z),1.0,55.0); fade=0.6+0.4*sin(position.x*9.0); }",
    fragmentShader:
      "uniform float opacity; varying float fade; void main(){ float r=length(gl_PointCoord-vec2(0.5))*2.0; float a=exp(-r*r*4.5)*smoothstep(1.0,0.75,r); if(r>1.0)discard; gl_FragColor=vec4(0.82,0.91,0.94,a*opacity*fade); }",
  });
  // Correct ordering for smoothstep on Windows / ANGLE.
  mistMaterial.fragmentShader = mistMaterial.fragmentShader.replace(
    "smoothstep(1.0,0.75,r)",
    "(1.0-smoothstep(0.75,1.0,r))",
  );
  const mist = new THREE.Points(mistGeometry, mistMaterial);
  mist.frustumCulled = false;
  turbine.add(mist);
  const arrows = [];
  for (let i = 0; i < 3; i++) {
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(),
      0.35,
      0xf3c18c,
      0.09,
      0.05,
    );
    inspectFlow.add(a);
    arrows.push(a);
  }
  const forceArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0.45, 0.95, 0),
    0.6,
    0x8ed5e2,
    0.12,
    0.065,
  );
  inspectFlow.add(forceArrow);
  function point(t, lane, close = false) {
    const x = close ? -1.3 + t * 2.8 : -2.52 + t * 5.02;
    const phase = close ? t * 1.3 : (x + 2.44) / 0.79;
    const local = phase - Math.floor(phase);
    // Guide-row turning, followed by reduced swirl after the rotor transfers momentum.
    const swirl = local < 0.42 ? local * 0.7 : 0.294 - (local - 0.42) * 0.25;
    const radius = close
      ? 0.86 + (lane % 3) * 0.055
      : 0.46 + t * 0.49 + (lane % 3) * 0.035;
    const angle = close
      ? -0.85 + (lane % 10) * 0.17 + swirl
      : lane * 2.399 + swirl;
    return new THREE.Vector3(
      x,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
  }
  const color = new THREE.Color();
  function animateStreaks(set, phase, close) {
    for (let i = 0; i < set.count; i++) {
      const t = (phase * 1.8 + i / set.count) % 1;
      const a = point(t, i, close),
        b = point(Math.min(0.999, t + 0.025), i, close);
      a.toArray(set.positions, i * 6);
      b.toArray(set.positions, i * 6 + 3);
      color.copy(hot).lerp(cold, t);
      color.toArray(set.colors, i * 6);
      color.toArray(set.colors, i * 6 + 3);
    }
    set.geometry.attributes.position.needsUpdate = true;
    set.geometry.attributes.color.needsUpdate = true;
  }
  function update(state, data, inspecting, enabled) {
    const flowing = enabled && state.spool > 0.005;
    flowGroup.visible = flowing && !inspecting;
    inspectFlow.visible = flowing && inspecting;
    animateStreaks(internal, state.phase, false);
    animateStreaks(detail, state.phase, true);
    pipeStreams.forEach((set, index) => {
      set.lines.visible = flowing && !inspecting;
      for (let i = 0; i < set.count; i++) {
        const t = (state.phase + i / set.count) % 1;
        set.curve.getPointAt(t).toArray(set.positions, i * 6);
        set.curve
          .getPointAt(Math.min(0.999, t + 0.025))
          .toArray(set.positions, i * 6 + 3);
        color.copy(index === 0 ? hot : cold);
        color.toArray(set.colors, i * 6);
        color.toArray(set.colors, i * 6 + 3);
      }
      set.geometry.attributes.position.needsUpdate = true;
      set.geometry.attributes.color.needsUpdate = true;
    });
    const wetness = clamp(1 - data.quality, 0, 0.3);
    mist.visible = flowing && !inspecting && wetness > 0;
    mistMaterial.uniforms.opacity.value = wetness * 0.7 * state.spool;
    mistMaterial.uniforms.viewportHeight.value = world.host.clientHeight;
    for (let i = 0; i < mistCount; i++) {
      const t = (state.phase * 2 + i / mistCount) % 1,
        angle = i * 2.399,
        r = 0.67 + (i % 11) * 0.035;
      mistPositions.set(
        [0.7 + t * 1.8, Math.cos(angle) * r, Math.sin(angle) * r],
        i * 3,
      );
    }
    mistGeometry.attributes.position.needsUpdate = true;
    arrows.forEach((arrow, i) => {
      const t = 0.12 + i * 0.32,
        a = point(t, 4, true),
        b = point(t + 0.05, 4, true);
      arrow.position.copy(a);
      arrow.setDirection(b.sub(a).normalize());
    });
  }
  return { update, internal, detail, mist, forceArrow };
}
