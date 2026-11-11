import * as THREE from 'three';
import { makeMaterials, shared } from './materials.js';
import { buildHall, CROSS_Z } from './hall.js';
import { Pipeline } from './post.js';
import { rng } from './geo.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const status = async (t, p) => { $('loadText').textContent = t; $('loadBar').style.width = (p * 100) + '%'; await nextFrame(); await nextFrame(); };

const VIEWS = [
  { p: [3.5, 1.7, 30.5], t: [-3.5, 7.5, -20], name: 'The Nave' },
  { p: [0, 1.6, 15], t: [0, 6.5, -36], name: 'Processional' },
  { p: [-15.5, 9.3, 25], t: [6, 6.5, -14], name: 'Gallery' },
  { p: [0.5, 1.6, 6], t: [0, 30, -3.5], name: 'The Dome' },
  { p: [3.2, 2.2, -22.5], t: [-0.6, 5.2, -38], name: 'The Throne' },
  { p: [-15.5, 1.7, 27], t: [-12, 4.2, -20], name: 'South Aisle' },
  { p: [6.5, 1.5, -6], t: [-20, 9, 8], name: 'Windows' },
];

async function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x000000, 1);
  document.body.prepend(renderer.domElement);
  // phones and tablets get a lighter default (lower resolution, 4096 shadow map)
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const quality = parseFloat(params.get('q') || (coarse ? '0.75' : '1'));
  const maxPR = Math.min(window.devicePixelRatio || 1, 1.5) * quality;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);

  await status('Quarrying marble…', 0.1);
  const M = makeMaterials(renderer);
  await status('Raising columns and vaults…', 0.3);
  const hall = buildHall(M);
  scene.add(hall.group);
  console.log('triangles', Math.round(hall.tris), 'ivy leaves', hall.ivy.count);

  // ---------------------------------------------------------------- lights
  await status('Lighting the lanterns…', 0.55);
  const L = new THREE.Vector3(-0.8, 0.62, -0.32).normalize();
  const centre = new THREE.Vector3(0, 13, -2);
  const sunCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 300);
  sunCam.position.copy(centre).addScaledVector(L, 150); sunCam.lookAt(centre); sunCam.updateMatrixWorld();
  {
    const b = new THREE.Box3(), v = new THREE.Vector3();
    for (const x of [-25, 25]) for (const y of [-0.5, 37]) for (const z of [-45, 43]) b.expandByPoint(v.set(x, y, z).applyMatrix4(sunCam.matrixWorldInverse));
    sunCam.left = b.min.x; sunCam.right = b.max.x; sunCam.bottom = b.min.y; sunCam.top = b.max.y; sunCam.near = -b.max.z - 2; sunCam.far = -b.min.z + 2;
    sunCam.updateProjectionMatrix();
  }
  const sunLight = new THREE.DirectionalLight(new THREE.Color(1.0, 0.94, 0.83), 21);
  sunLight.position.copy(sunCam.position); sunLight.target.position.copy(centre);
  sunLight.castShadow = true;
  const sc = sunLight.shadow.camera;
  Object.assign(sc, { left: sunCam.left, right: sunCam.right, top: sunCam.top, bottom: sunCam.bottom, near: sunCam.near, far: sunCam.far });
  const maxTex = renderer.capabilities.maxTextureSize;
  sunLight.shadow.mapSize.setScalar(Math.min(maxTex, quality >= 1 ? 6144 : 4096));
  sunLight.shadow.bias = -0.00035; sunLight.shadow.normalBias = 0.06; sunLight.shadow.radius = 2.2;
  scene.add(sunLight, sunLight.target);

  const domeLight = new THREE.SpotLight(new THREE.Color(0.82, 0.9, 1.0), 2600, 60, 0.42, 0.9, 2);
  domeLight.position.set(0, hall.dome.topY - 0.5, CROSS_Z); domeLight.target.position.set(0, 0, CROSS_Z);
  scene.add(domeLight, domeLight.target);

  scene.add(new THREE.HemisphereLight(new THREE.Color(0.2, 0.19, 0.2), new THREE.Color(1.0, 0.93, 0.82), 1.0));
  { const dl = new THREE.PointLight(new THREE.Color(0.85, 0.92, 1.0), 90, 22, 2); dl.position.set(0, hall.dome.ringY + 2.2, CROSS_Z); scene.add(dl); }
  for (const l of hall.lights) {
    const pl = new THREE.PointLight(l.color, l.intensity, l.distance, 2); pl.position.copy(l.p); scene.add(pl);
  }
  for (const l of hall.lanterns) {
    if (!l.light) continue;
    const pl = new THREE.PointLight(new THREE.Color(1.0, 0.64, 0.32), 22, 14, 2); pl.position.copy(l.c); scene.add(pl);
  }

  // ---------------------------------------------------------------- sun depth + stained-glass cookie
  const sun = {
    dir: L, matrix: new THREE.Matrix4().multiplyMatrices(sunCam.projectionMatrix, sunCam.matrixWorldInverse),
    depthRT: new THREE.WebGLRenderTarget(2048, 2048, { depthTexture: new THREE.DepthTexture(2048, 2048, THREE.UnsignedIntType) }),
    cookieRT: new THREE.WebGLRenderTarget(4096, 4096, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }),
    noise: shared.uNoise3.value,
  };
  sun.depthRT.depthTexture.minFilter = sun.depthRT.depthTexture.magFilter = THREE.NearestFilter;
  shared.uSunMatrix.value.copy(sun.matrix);

  // dust motes that only glint inside the sun shafts
  const dust = makeDust(sun);
  scene.add(dust);

  function renderSunMaps() {
    const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    const hide = [...hall.glass, dust];
    hide.forEach(m => m.visible = false);
    scene.overrideMaterial = depthMat;
    renderer.setRenderTarget(sun.depthRT); renderer.clear(); renderer.render(scene, sunCam);
    scene.overrideMaterial = null;
    hide.forEach(m => m.visible = true);
    // cookie: glass only, un-boosted colours
    const vis = hall.group.children.map(c => c.visible);
    hall.group.children.forEach(c => c.visible = hall.glass.includes(c) && c.name !== 'lanternGlass' && c.name !== 'glassThrone');
    dust.visible = false;
    const cols = hall.glass.map(g => g.material.color.clone());
    hall.glass.forEach(g => g.material.color.setRGB(1, 1, 1));
    renderer.setClearColor(0xffffff, 1);
    renderer.setRenderTarget(sun.cookieRT); renderer.clear(); renderer.render(scene, sunCam);
    renderer.setClearColor(0x000000, 1);
    hall.glass.forEach((g, i) => g.material.color.copy(cols[i]));
    hall.group.children.forEach((c, i) => c.visible = vis[i]);
    dust.visible = true;
    renderer.setRenderTarget(null);
    shared.uSunCookie.value = sun.cookieRT.texture; shared.uCookieOn.value = 1;
  }

  // ---------------------------------------------------------------- environment (captured from inside the hall)
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.3, 300, cubeRT);
  cubeCam.position.set(0, 8.5, 9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  function captureEnv() {
    shared.uReflOn.value = 0; dust.visible = false;
    const boost = hall.glass.filter(g => g.name.startsWith('glassS') || g.name === 'glassDome');
    boost.forEach(g => g.material.color.multiplyScalar(1.8));
    cubeCam.update(renderer, scene);
    boost.forEach(g => g.material.color.multiplyScalar(1 / 1.8));
    const old = envRT;
    envRT = pmrem.fromCubemap(cubeRT.texture);
    scene.environment = envRT.texture;
    if (old) old.dispose();
    dust.visible = true;
  }
  scene.environmentIntensity = 0.8;

  // ---------------------------------------------------------------- planar floor reflection
  const reflRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const vCam = new THREE.PerspectiveCamera();
  const rf = { n: new THREE.Vector3(0, 1, 0), o: new THREE.Vector3(), camPos: new THREE.Vector3(), rot: new THREE.Matrix4(), look: new THREE.Vector3(), view: new THREE.Vector3(), target: new THREE.Vector3(), plane: new THREE.Plane(), clip: new THREE.Vector4(), q: new THREE.Vector4() };
  function renderReflection() {
    camera.updateMatrixWorld();
    rf.camPos.setFromMatrixPosition(camera.matrixWorld);
    if (rf.camPos.y <= 0.01) return;
    rf.rot.extractRotation(camera.matrixWorld);
    rf.view.subVectors(rf.o, rf.camPos).reflect(rf.n).negate().add(rf.o);
    rf.look.set(0, 0, -1).applyMatrix4(rf.rot).add(rf.camPos);
    rf.target.subVectors(rf.o, rf.look).reflect(rf.n).negate().add(rf.o);
    vCam.position.copy(rf.view);
    vCam.up.set(0, 1, 0).applyMatrix4(rf.rot).reflect(rf.n);
    vCam.lookAt(rf.target);
    vCam.near = camera.near; vCam.far = camera.far;
    vCam.updateMatrixWorld();
    vCam.projectionMatrix.copy(camera.projectionMatrix);
    shared.uReflMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vCam.projectionMatrix).multiply(vCam.matrixWorldInverse);
    rf.plane.setFromNormalAndCoplanarPoint(rf.n, rf.o).applyMatrix4(vCam.matrixWorldInverse);
    rf.clip.set(rf.plane.normal.x, rf.plane.normal.y, rf.plane.normal.z, rf.plane.constant);
    const pm = vCam.projectionMatrix, e = pm.elements;
    rf.q.x = (Math.sign(rf.clip.x) + e[8]) / e[0]; rf.q.y = (Math.sign(rf.clip.y) + e[9]) / e[5]; rf.q.z = -1; rf.q.w = (1 + e[10]) / e[14];
    rf.clip.multiplyScalar(2 / rf.clip.dot(rf.q));
    e[2] = rf.clip.x; e[6] = rf.clip.y; e[10] = rf.clip.z + 1 - 0.003; e[14] = rf.clip.w;
    vCam.projectionMatrixInverse.copy(pm).invert();
    hall.floor.visible = false; dust.visible = false;
    renderer.setRenderTarget(reflRT); renderer.clear(); renderer.render(scene, vCam);
    hall.floor.visible = true; dust.visible = true;
    shared.uRefl.value = reflRT.texture; shared.uReflOn.value = 1;
  }

  // ---------------------------------------------------------------- pipeline
  const pipe = new Pipeline(renderer, scene, camera, sun);
  pipe.finalMat.uniforms.uExposure.value = parseFloat(params.get('exp') || '1.02');
  if (params.get('ao')) pipe.ao.configuration.renderMode = parseInt(params.get('ao'));
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(maxPR); renderer.setSize(w, h);
    const dw = renderer.domElement.width, dh = renderer.domElement.height;
    camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 78 : 62;
    camera.updateProjectionMatrix();
    pipe.setSize(dw, dh);
    const rs = 0.6;
    reflRT.setSize(Math.ceil(dw * rs), Math.ceil(dh * rs));
    shared.uReflTexel.value.set(1 / reflRT.width, 1 / reflRT.height);
    dust.material.uniforms.uScale.value = dh;
  }
  window.addEventListener('resize', resize);
  resize();

  await status('Catching the sunlight…', 0.7);
  renderer.shadowMap.needsUpdate = true;
  renderSunMaps();
  await status('Bouncing light…', 0.82);
  captureEnv();
  await nextFrame();
  captureEnv();
  await status('Polishing the floor…', 0.95);

  // ---------------------------------------------------------------- camera control
  const ctl = makeControls(camera, renderer.domElement);
  ctl.jump(VIEWS[Math.max(0, Math.min(VIEWS.length - 1, parseInt(params.get('view') || '1') - 1))]);
  if (params.get('ui') === '0') document.body.classList.add('noui');
  if (params.get('tour') === '1') ctl.tour = true;
  window.__app = { renderer, scene, camera, pipe, ctl, hall, shared, sunLight, VIEWS, captureEnv };
  window.__app.frame = (t = 0) => { renderReflection(); pipe.render(t); };
  window.__app.targets = { reflRT, cubeRT, sun };

  let last = performance.now(), elapsed = 0;
  let frames = 0, fpsT = 0, slow = 0;
  function loop() {
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1); last = now; elapsed += dt; const t = elapsed;
    ctl.update(dt, t);
    dust.material.uniforms.uTime.value = t;
    renderReflection();
    pipe.render(t);
    frames++; fpsT += dt;
    if (fpsT > 1) { $('fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
    if (frames === 3 && !window.__ready) { window.__ready = true; $('loader').classList.add('done'); }
    requestAnimationFrame(loop);
  }
  loop();
}

// ------------------------------------------------------------------ dust
function makeDust(sun) {
  const N = 2600, R = rng(77);
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = -20 + R() * 34; pos[i * 3 + 1] = 0.3 + R() * 18; pos[i * 3 + 2] = -40 + R() * 78;
    seed[i * 3] = R(); seed[i * 3 + 1] = R(); seed[i * 3 + 2] = R();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 1000 }, uSunVP: { value: sun.matrix }, tSunDepth: { value: sun.depthRT.depthTexture } },
    vertexShader: /* glsl */`
      attribute vec3 seed; uniform float uTime, uScale; uniform mat4 uSunVP; varying vec3 vSun; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime*.11+seed.x*6.28), sin(uTime*.07+seed.y*6.28)*.7 - 0., cos(uTime*.09+seed.z*6.28))*.8;
        vec4 mv = viewMatrix * vec4(p,1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((.012 + .02*seed.x) * uScale / -mv.z, 0., 6.);
        vSun = (uSunVP * vec4(p,1.)).xyz*.5+.5;
        vA = (.4 + .6*seed.y) * (.6 + .4*sin(uTime*(.6+seed.z)+seed.x*40.)) * smoothstep(.3, 1.5, -mv.z);
      }`,
    fragmentShader: /* glsl */`
      precision highp float; uniform highp sampler2D tSunDepth; varying vec3 vSun; varying float vA;
      void main(){
        float lit = step(vSun.z - .0012, texture2D(tSunDepth, vSun.xy).r);
        float a = smoothstep(.5, .1, length(gl_PointCoord - .5));
        gl_FragColor = vec4(vec3(1.,.86,.6) * 2.4 * a * vA * lit, 1.);
      }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.name = 'dust';
  return p;
}

// ------------------------------------------------------------------ controls
function makeControls(camera, dom) {
  const pos = new THREE.Vector3(), vel = new THREE.Vector3();
  let yaw = 0, pitch = 0, tYaw = 0, tPitch = 0;
  const keys = {};
  const c = { tour: false, tourT: 0 };
  const fromLook = (p, t) => {
    const d = new THREE.Vector3(t[0] - p[0], t[1] - p[1], t[2] - p[2]).normalize();
    return [Math.atan2(-d.x, -d.z), Math.asin(d.y)];
  };
  let fly = null;
  c.jump = (v, smooth = false) => {
    const [y, p] = fromLook(v.p, v.t);
    if (!smooth) { pos.set(...v.p); yaw = tYaw = y; pitch = tPitch = p; vel.set(0, 0, 0); fly = null; }
    else {
      let dy = y - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      fly = { p0: pos.clone(), p1: new THREE.Vector3(...v.p), y0: yaw, y1: yaw + dy, t0: pitch, t1: p, k: 0 };
    }
    const el = document.getElementById('viewName'); if (el) { el.textContent = v.name; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
  };
  let drag = null, lx = 0, ly = 0;
  dom.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') enableTouch();
    if (drag !== null) return; // one finger looks; others are ignored
    drag = e.pointerId; lx = e.clientX; ly = e.clientY; dom.setPointerCapture(e.pointerId); c.tour = false; fly = null; syncTour();
  });
  const endDrag = e => { if (e.pointerId === drag) drag = null; };
  dom.addEventListener('pointerup', endDrag); dom.addEventListener('pointercancel', endDrag);
  dom.addEventListener('pointermove', e => {
    if (e.pointerId !== drag) return;
    tYaw -= (e.clientX - lx) * 0.0032; tPitch = Math.max(-1.45, Math.min(1.45, tPitch - (e.clientY - ly) * 0.0032));
    lx = e.clientX; ly = e.clientY;
  });
  dom.addEventListener('wheel', e => { camera.fov = Math.max(25, Math.min(90, camera.fov + e.deltaY * 0.02)); camera.updateProjectionMatrix(); e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    const n = parseInt(e.key);
    if (n >= 1 && n <= window.__app.VIEWS.length) { c.tour = false; c.jump(window.__app.VIEWS[n - 1], true); }
    if (e.code === 'KeyT') { c.tour = !c.tour; c.tourT = 0; c.tourI = 0; }
    if (e.code === 'KeyH') document.body.classList.toggle('noui');
    if (e.code === 'KeyV') { const o = window.__app.pipe.opts; o.vol = !o.vol; }
    if (e.code === 'KeyB') { const o = window.__app.pipe.opts; o.bloom = !o.bloom; }
    if (e.code === 'KeyO') { const o = window.__app.pipe.opts; o.ao = !o.ao; }
  });
  window.addEventListener('keyup', e => keys[e.code] = false);

  // ---- on-screen controls (touch devices): analog stick, up/down, view + tour buttons
  c.stick = { x: 0, y: 0 }; c.vert = 0;
  const el = id => document.getElementById(id);
  const syncTour = () => el('bTour')?.classList.toggle('on', c.tour);
  let touchOn = false;
  function enableTouch() {
    if (touchOn) return; touchOn = true;
    document.body.classList.add('touch');
    setTimeout(() => { const h = el('hint'); if (h) { h.style.transition = 'opacity 1.5s'; h.style.opacity = '0'; } }, 9000);
  }
  if (window.matchMedia('(pointer: coarse)').matches) enableTouch();
  {
    const stick = el('stick'), knob = el('knob'), RAD = 44;
    let sid = null, cx = 0, cy = 0;
    const move = e => {
      if (e.pointerId !== sid) return;
      let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy);
      if (l > RAD) { dx *= RAD / l; dy *= RAD / l; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const dead = v => Math.abs(v) < 0.12 ? 0 : v;
      c.stick.x = dead(dx / RAD); c.stick.y = dead(dy / RAD);
      c.tour = false; fly = null; syncTour(); e.preventDefault();
    };
    const end = e => { if (e.pointerId !== sid) return; sid = null; c.stick.x = c.stick.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerdown', e => {
      sid = e.pointerId; stick.setPointerCapture(sid);
      const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e);
    });
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    const hold = (id, v) => {
      const b = el(id);
      b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); c.vert = v; c.tour = false; fly = null; syncTour(); e.preventDefault(); });
      const up = () => { if (c.vert === v) c.vert = 0; };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    };
    hold('bUp', 1); hold('bDown', -1);
    el('bView').addEventListener('click', () => {
      const V = window.__app.VIEWS; c.tour = false; c.tourI = ((c.tourI ?? 0) + 1) % V.length; c.jump(V[c.tourI], true); syncTour();
    });
    el('bTour').addEventListener('click', () => { c.tour = !c.tour; c.tourT = 0; syncTour(); });
    for (const b of document.querySelectorAll('#touch button, #stick')) b.addEventListener('contextmenu', e => e.preventDefault());
  }
  const f = new THREE.Vector3(), r = new THREE.Vector3(), acc = new THREE.Vector3();
  const ease = k => k * k * k * (k * (k * 6 - 15) + 10);
  c.update = (dt, t) => {
    if (c.tour && !fly) {
      c.tourT -= dt;
      if (c.tourT <= 0) { c.tourI = ((c.tourI ?? 0) + 1) % window.__app.VIEWS.length; c.jump(window.__app.VIEWS[c.tourI], true); c.tourT = 13; }
    }
    if (fly) {
      fly.k = Math.min(1, fly.k + dt / (c.tour ? 9 : 2.6));
      const k = ease(fly.k);
      pos.lerpVectors(fly.p0, fly.p1, k);
      yaw = tYaw = fly.y0 + (fly.y1 - fly.y0) * k; pitch = tPitch = fly.t0 + (fly.t1 - fly.t0) * k;
      if (fly.k >= 1) fly = null;
    } else {
      const s = 1 - Math.exp(-dt * 14);
      yaw += (tYaw - yaw) * s; pitch += (tPitch - pitch) * s;
      f.set(-Math.sin(yaw), 0, -Math.cos(yaw)); r.set(Math.cos(yaw), 0, -Math.sin(yaw));
      acc.set(0, 0, 0);
      if (keys.KeyW || keys.ArrowUp) acc.add(f); if (keys.KeyS || keys.ArrowDown) acc.sub(f);
      if (keys.KeyD || keys.ArrowRight) acc.add(r); if (keys.KeyA || keys.ArrowLeft) acc.sub(r);
      if (keys.KeyE || keys.Space) acc.y += 1; if (keys.KeyQ || keys.KeyC) acc.y -= 1;
      acc.addScaledVector(f, -c.stick.y).addScaledVector(r, c.stick.x); acc.y += c.vert;
      const mag = Math.min(1, acc.length()); // analog: a half-pushed stick walks slowly
      if (mag > 0) { acc.normalize().multiplyScalar(((keys.ShiftLeft || keys.ShiftRight) ? 16 : 5.5) * mag); c.tour = false; }
      vel.lerp(acc, 1 - Math.exp(-dt * 6));
      pos.addScaledVector(vel, dt);
      pos.x = Math.max(-21, Math.min(21, pos.x)); pos.y = Math.max(0.5, Math.min(22, pos.y)); pos.z = Math.max(-40, Math.min(39, pos.z));
    }
    camera.position.copy(pos);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
  };
  return c;
}

init().catch(e => { console.error(e); const el = document.getElementById('loadText'); if (el) el.textContent = 'Error: ' + e.message; });
