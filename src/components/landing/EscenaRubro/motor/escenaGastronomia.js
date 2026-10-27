// @no-jsx-check: las fichas se generan con strings HTML para el DOM de Three.js, no JSX.
// Motor de la escena 3D de Gastronomía para la landing de Dico.
// Dependencia fijada por la landing: three 0.186.1. Motor entregado por Ricky.
// Uso directo (sin React): const s = createDicoScene(contenedor, opciones); s.set({ rubro, momento }); s.dispose();
// Opciones: calidad 'auto' | 'alta' | 'media' | 'baja' · proporcion '4 / 3' (null llena el contenedor)
//           imagenAlternativa: URL de la imagen que se muestra si no hay WebGL · onMomento(id) en el recorrido automático
import * as THREE from 'three';
import { crearRecorridoGuiado } from '../../../../lib/recorridoGuiado';

const PI = Math.PI;
const F = { N: PI, S: 0, E: PI / 2, W: -PI / 2 };
const TWEEN_SELECT = 420;
const BLEND_MS = 380;

const PAL = {
  bg: 0x09090b, plinth: 0x141417, floor: 0x1a1a1d, kitchen: 0x202024, depot: 0x151518,
  wall: 0x2a2a2e, furn: 0x3f3f46, furn2: 0x52525b, steel: 0x8a8a92, wood: 0x5e5248,
  white: 0xe7e5e4, volt: 0x3d6bff, gold: 0xe0ac3c, staff: 0xf0efed, apron: 0x2b2b30,
  main: 0xf0e2c4, main2: 0xe2d1ae, client: 0x4a4b54, client2: 0x575862, client3: 0x41444c,
  plant: 0x34423a, lamp: 0xffc477, salad: 0x6f8f5a, meat: 0xb8693a,
};

// ---------------------------------------------------------------- utilidades
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);
const easeInOut = (u) => { u = clamp(u); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const lerp = (a, b, k) => a + (b - a) * k;
function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > PI) d -= 2 * PI;
  while (d < -PI) d += 2 * PI;
  return a + d * k;
}
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }

function radialTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- recorridos
// Polilínea con esquinas redondeadas; s = distancia recorrida
function makePoly(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], v = pts[i], n = pts[i + 1];
    const d1 = Math.hypot(v[0] - p[0], v[1] - p[1]), d2 = Math.hypot(n[0] - v[0], n[1] - v[1]);
    const r = Math.min(.55, d1 / 2, d2 / 2);
    if (r < .05) { out.push(v); continue; }
    const a = [v[0] + (p[0] - v[0]) / d1 * r, v[1] + (p[1] - v[1]) / d1 * r];
    const b = [v[0] + (n[0] - v[0]) / d2 * r, v[1] + (n[1] - v[1]) / d2 * r];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u;
      out.push([w0 * a[0] + w1 * v[0] + w2 * b[0], w0 * a[1] + w1 * v[1] + w2 * b[1]]);
    }
  }
  out.push(pts[pts.length - 1]);
  const cum = [0];
  for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  const len = cum[cum.length - 1];
  function at(s, o) {
    s = clamp(s, 0, len);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1] || 1, k = (s - cum[i - 1]) / seg;
    o[0] = out[i - 1][0] + (out[i][0] - out[i - 1][0]) * k;
    o[1] = out[i - 1][1] + (out[i][1] - out[i - 1][1]) * k;
    return o;
  }
  const A = [0, 0], B = [0, 0];
  function heading(s) {
    at(Math.max(0, s - .12), A); at(Math.min(len, s + .32), B);
    let dx = B[0] - A[0], dz = B[1] - A[1];
    if (Math.hypot(dx, dz) < 1e-4) { const n = out.length; dx = out[n - 1][0] - out[n - 2][0]; dz = out[n - 1][1] - out[n - 2][1]; }
    return Math.atan2(dx, dz);
  }
  return { len, at, heading, end: out[out.length - 1] };
}

function resolve(v, M) {
  if (typeof v === 'number') return v;
  const m = /^@([\w:]+)([+-][\d.]+)?$/.exec(v);
  if (!m) return 0;
  return (M[m[1]] ?? 0) + (m[2] ? parseFloat(m[2]) : 0);
}

// Compila el guion de un personaje a segmentos deterministas
function compileActor(spec, M) {
  const st = spec.start;
  const segs = [], sitT = [[-1e9, st.sit || 0]], fadeT = [[-1e9, st.fade ?? 1]], carryT = [[-1e9, st.carry || null]], gest = [];
  let cur = 0, x = st.x, z = st.z, f = st.f ?? 0;
  for (const s of spec.steps || []) {
    if (s.t !== undefined) cur = Math.max(cur, resolve(s.t, M));
    if (s.d) cur += s.d;
    if (s.fade !== undefined) fadeT.push([cur, s.fade]);
    if ('carry' in s) carryT.push([cur, s.carry]);
    if (s.sit !== undefined) { sitT.push([cur, s.sit]); cur += .45; }
    if (s.walk) {
      const poly = makePoly([[x, z], ...s.walk]);
      const v = s.speed || spec.speed || 1.3;
      const tAcc = Math.min(.5, poly.len / v);
      const dur = poly.len / v + tAcc;
      const endH = poly.heading(poly.len);
      const turn = s.f === undefined ? 0 : .5;
      segs.push({ type: 'walk', t0: cur, t1: cur + dur, t2: cur + dur + turn, poly, v, tAcc, dur, fromF: f, endH, toF: s.f ?? endH });
      cur += dur + turn;
      x = poly.end[0]; z = poly.end[1]; f = s.f ?? endH;
    }
    if (s.face !== undefined) { segs.push({ type: 'turn', t0: cur, t1: cur + .55, t2: cur + .55, fromF: f, toF: s.face, x, z }); cur += .55; f = s.face; }
    if (s.g) { gest.push({ t0: cur, t1: cur + s.dur, type: s.g }); cur += s.dur; }
    if (s.wait) cur += s.wait;
    if (s.mark) M[s.mark] = cur;
  }
  M[spec.name + ':end'] = cur;
  (spec.gestures || []).forEach((g) => gest.push({ t0: resolve(g.t0, M), t1: resolve(g.t1, M), type: g.type }));
  return { segs, sitT, fadeT, carryT, gest, start: { x: st.x, z: st.z, f: st.f ?? 0 }, end: cur };
}

function trackValue(T, t, dur) {
  let v = T[0][1], target = T[0][1];
  for (let i = 1; i < T.length && T[i][0] <= t; i++) {
    const from = target; target = T[i][1];
    v = from + (target - from) * smooth((t - T[i][0]) / dur);
  }
  return v;
}
function trackDiscrete(T, t) { let v = T[0][1]; for (let i = 1; i < T.length && T[i][0] <= t; i++) v = T[i][1]; return v; }

function distAt(sg, tau) {
  const { v, tAcc, dur, poly } = sg;
  if (tAcc <= 0) return v * tau;
  if (tau < tAcc) return v * tau * tau / (2 * tAcc);
  if (tau < dur - tAcc) return v * tAcc / 2 + v * (tau - tAcc);
  const r = Math.max(0, dur - tau);
  return poly.len - v * r * r / (2 * tAcc);
}
function velAt(sg, tau) {
  const { v, tAcc, dur } = sg;
  if (tau < tAcc) return v * tau / tAcc;
  if (tau < dur - tAcc) return v;
  return Math.max(0, v * (dur - tau) / tAcc);
}

const P2 = [0, 0];
function evalMotion(A, t, o) {
  let sg = null;
  for (const s of A.segs) { if (s.t0 <= t) sg = s; else break; }
  o.speedK = 0;
  if (!sg) { o.x = A.start.x; o.z = A.start.z; o.rot = A.start.f; o.phase = 0; return o; }
  if (sg.type === 'turn') {
    o.x = sg.x; o.z = sg.z; o.rot = lerpAngle(sg.fromF, sg.toF, smooth((t - sg.t0) / (sg.t1 - sg.t0))); o.phase = 0; return o;
  }
  const tau = t - sg.t0;
  if (tau >= sg.dur) {
    o.x = sg.poly.end[0]; o.z = sg.poly.end[1]; o.phase = sg.poly.len * 5.6;
    o.rot = sg.t2 > sg.t1 ? lerpAngle(sg.endH, sg.toF, smooth((t - sg.t1) / (sg.t2 - sg.t1))) : sg.endH;
    return o;
  }
  const s = distAt(sg, tau);
  sg.poly.at(s, P2); o.x = P2[0]; o.z = P2[1];
  o.rot = lerpAngle(sg.fromF, sg.poly.heading(s), smooth(tau / .55));
  o.speedK = velAt(sg, tau) / sg.v;
  o.phase = s * 5.6;
  return o;
}

// ---------------------------------------------------------------- gestos
function gestureFX(type, t, ph, out) {
  const w1 = Math.sin(t * 1.6 + ph * 6), w2 = Math.sin(t * 2.9 + ph * 9);
  switch (type) {
    case 'talk': out.yaw += .26 * w1; out.pitch += .05 * w2; out.r += -.35 - .18 * Math.sin(t * 2.2 + ph * 5); break;
    case 'greet': out.yaw += .12 * w1; out.pitch += .06; out.r += -.9 - .15 * Math.sin(t * 4 + ph); break;
    case 'listen': out.pitch += .08 * Math.max(0, Math.sin(t * 2.1 + ph * 4)); out.yaw += .06 * w1; break;
    case 'write': out.pitch += .36; out.l += -1.0; out.r += -1.12 + .06 * Math.sin(t * 9); break;
    case 'hold': out.pitch += .2; out.l += -.95; out.r += -1.0; break;
    case 'cook': { const c = Math.sin(t * 3.3 + ph * 7); out.pitch += .3; out.l += -.95 + .18 * c; out.r += -.95 - .18 * c; out.sway += .045 * Math.sin(t * 1.6 + ph * 3); break; }
    case 'read': out.pitch += -.28; out.l += -.2; out.r += -.25; break;
    case 'tap': out.pitch += .32; out.r += -1.05 + .08 * Math.sin(t * 8); out.l += -.25; break;
    case 'eat': { const e = Math.max(0, Math.sin(t * 1.9 + ph * 8)); out.pitch += .18 + .12 * e; out.l += -.55; out.r += -.7 - .4 * e; break; }
    case 'pay': out.pitch += .25; out.r += -1.1; out.l += -.4; break;
    case 'serve': out.pitch += .22; out.l += -1.0; out.r += -1.0; break;
    case 'clear': out.pitch += .3; out.l += -1.05; out.r += -.95; break;
    default: break;
  }
}

// ---------------------------------------------------------------- construcción
function makeKit(root, tex) {
  const mats = new Map();
  const mat = (c, extra) => {
    const key = c + '|' + (extra ? JSON.stringify(extra) : '');
    let m = mats.get(key);
    if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .82, metalness: 0, flatShading: true }, extra)); mats.set(key, m); }
    return m;
  };
  const geos = new Map();
  const boxGeo = (w, h, d, bottom) => {
    const key = [w, h, d, bottom ? 1 : 0].join('x');
    let g = geos.get(key);
    if (!g) { g = new THREE.BoxGeometry(w, h, d); if (bottom) g.translate(0, h / 2, 0); geos.set(key, g); }
    return g;
  };
  const add = (o, parent) => { (parent || root).add(o); return o; };
  function box(w, h, d, c, x, y, z, parent) {
    const m = new THREE.Mesh(boxGeo(w, h, d), typeof c === 'number' ? mat(c) : c);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    return add(m, parent);
  }
  function block(x1, z1, x2, z2, h, c, y0 = 0, parent) {
    return box(Math.abs(x2 - x1), h, Math.abs(z2 - z1), c, (x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2, parent);
  }
  function stack(x, z, w, h, d, c) {
    const m = new THREE.Mesh(boxGeo(w, h, d, true), mat(c));
    m.position.set(x, 0, z); m.castShadow = true; m.receiveShadow = true;
    return add(m);
  }
  const blobMats = new Map();
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-PI / 2);
  function blob(x, z, w, d, op = .55, parent, y = .012) {
    let m = blobMats.get(op);
    if (!m) { m = new THREE.MeshBasicMaterial({ map: tex.blob, transparent: true, depthWrite: false, opacity: op, toneMapped: false, color: 0x000000 }); blobMats.set(op, m); }
    const b = new THREE.Mesh(blobGeo, m); b.position.set(x, y, z); b.scale.set(w, 1, d); b.renderOrder = 1;
    return add(b, parent);
  }
  function floor(x1, z1, x2, z2, c) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat(c, { roughness: .95 }));
    m.rotation.x = -PI / 2; m.position.set((x1 + x2) / 2, .003, (z1 + z2) / 2); m.receiveShadow = true;
    return add(m);
  }
  return { root, mat, box, block, stack, blob, floor, add, tex };
}

function makePlate(kit, food) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(.15, .12, .03, 12), kit.mat(PAL.white)); g.add(p);
  const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.075, 0), kit.mat(food === 'salad' ? PAL.salad : PAL.meat));
  f.position.y = .055; f.scale.y = .7; g.add(f);
  return g;
}
function makeCarry(kit, kind) {
  const g = new THREE.Group();
  if (kind === 'plate') {
    const a = makePlate(kit, 'meat'); a.position.x = -.12; g.add(a);
    const b = makePlate(kit, 'salad'); b.position.set(.13, .02, .02); g.add(b);
  } else if (kind === 'dirty') {
    const a = makePlate(kit, 'none'); a.children[1].visible = false; g.add(a);
    const b = makePlate(kit, 'none'); b.children[1].visible = false; b.position.y = .035; g.add(b);
  } else if (kind === 'tablet') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(.24, .018, .17), kit.mat(PAL.wall)));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(.2, .13), new THREE.MeshBasicMaterial({ color: PAL.volt, toneMapped: false }));
    s.rotation.x = -PI / 2; s.position.y = .011; g.add(s);
    g.rotation.x = -.55;
  }
  return g;
}

function makePerson(kit, name, color, o = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.18, .24, .84, 10), kit.mat(color));
  body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.165, 0), kit.mat(color));
  head.castShadow = true; g.add(head);
  if (o.apron) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(.3, .44, .04), kit.mat(PAL.apron));
    a.position.set(0, -.12, .215); body.add(a);
  }
  if (o.hat) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, .2, 8), kit.mat(PAL.white));
    h.position.y = .2; head.add(h);
  }
  const arms = [-1, 1].map((side) => {
    const pv = new THREE.Group(); pv.position.set(side * .235, .76, .01);
    const a = new THREE.Mesh(new THREE.BoxGeometry(.075, .4, .075), kit.mat(color));
    a.position.y = -.19; a.castShadow = true; pv.add(a); pv.rotation.z = side * .06; g.add(pv);
    return pv;
  });
  const carry = {};
  (o.carry || []).forEach((k) => {
    const m = makeCarry(kit, k); m.position.set(0, .9, .34); m.visible = false; g.add(m); carry[k] = m;
  });
  kit.blob(0, 0, .85, .85, .5, g, .014);
  kit.add(g);
  return { name, g, body, head, arms, carry, ph: hash(name), rot: 0, cur: null };
}

function applyPose(p, s) {
  p.g.position.set(s.x, 0, s.z);
  p.g.rotation.y = s.rot;
  const fade = clamp(s.fade);
  p.g.scale.setScalar(Math.max(.001, .55 + .45 * fade));
  p.g.visible = fade > .02;
  const k = s.sit;
  const bob = s.bob || 0;
  p.body.scale.y = 1 - .42 * k;
  p.body.position.y = lerp(.42, .695, k) + bob;
  p.body.rotation.set(s.lean || 0, 0, s.sway || 0);
  p.head.position.y = lerp(1.0, 1.11, k) + bob;
  p.head.rotation.set(s.pitch || 0, s.yaw || 0, 0);
  p.arms[0].position.y = p.arms[1].position.y = lerp(.76, .87, k) + bob;
  p.arms[0].rotation.x = s.l; p.arms[1].rotation.x = s.r;
  for (const key in p.carry) p.carry[key].visible = s.carry === key;
}

// ---------------------------------------------------------------- gastronomía
function shell(kit) {
  const { block } = kit;
  kit.box(17.4, .4, 12.4, PAL.plinth, 0, -.2, 0);
  block(-8.1, -5.62, 8.1, -5.45, 1.25, PAL.wall);
  block(-8.1, -5.62, -7.95, 5.62, 1.25, PAL.wall);
  block(7.95, -5.62, 8.1, 5.62, .32, PAL.wall);
  block(-8.1, 5.45, 4.8, 5.62, .32, PAL.wall);
  block(6.6, 5.45, 8.1, 5.62, .32, PAL.wall);
}
function chair(kit, x, z, side) {
  kit.block(x - .2, z - .2, x + .2, z + .2, .45, PAL.furn);
  kit.block(x - .2, z + side * .17, x + .2, z + side * .23, .5, PAL.furn, .45);
}
function table(kit, x, z) {
  kit.box(1.2, .07, .9, PAL.wood, x, .76, z);
  kit.box(.12, .72, .12, PAL.wall, x, .36, z);
  chair(kit, x, z + .75, 1); chair(kit, x, z - .75, -1);
  kit.blob(x, z, 1.9, 2.3, .5);
  // lámpara colgante
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 1.0, 4), kit.mat(0x111113)); cord.position.set(x, 2.95, z); kit.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(.2, .18, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x1f1f23, emissive: PAL.lamp, emissiveIntensity: .12, side: THREE.DoubleSide, flatShading: true }));
  shade.position.set(x, 2.38, z); kit.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
  bulb.position.set(x, 2.29, z); kit.add(bulb);
}
function plant(kit, x, z) {
  kit.block(x - .22, z - .22, x + .22, z + .22, .42, PAL.wall);
  const p = new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 0), kit.mat(PAL.plant));
  p.position.set(x, .8, z); p.castShadow = true; kit.add(p);
  kit.blob(x, z, .9, .9, .5);
}

const MEDIOS = (activo, monto) =>
  ['Efectivo', 'Tarjeta', 'Transferencia'].map((m) => `<span class="dse-m${m === activo ? ' on' : ''}">${m}</span>`).join('') + `<br><i>${monto}</i> <span class="dse-s">registrado</span>`;

const T6 = { x: .6, z: 3.2 };
const STATION = { x: 2.2, z: -1.2 };

function buildGastronomia(kit) {
  const { block, box, blob } = kit;
  shell(kit);
  kit.floor(-7.95, -5.45, .92, -2.2, PAL.kitchen);
  kit.floor(1.08, -5.45, 7.95, -2.2, PAL.depot);
  kit.floor(-7.95, -2.12, 7.95, 5.45, PAL.floor);
  // tabiques, pase y puerta del depósito
  block(-8, -2.28, -2.2, -2.12, .95, PAL.wall);
  block(0, -2.28, 2, -2.12, .95, PAL.wall);
  block(3, -2.28, 8, -2.12, .95, PAL.wall);
  block(.92, -5.45, 1.08, -2.2, .95, PAL.wall);
  block(-2.2, -2.42, 0, -1.98, .95, PAL.steel);
  blob(-1.1, -2.2, 2.6, 1.0, .45);
  // cocina: fríos a la izquierda, plancha a la derecha
  block(-6.8, -5.4, -4.8, -4.75, .9, PAL.furn2);
  box(1.9, .03, .55, PAL.white, -5.8, .915, -5.07);
  [-6.4, -5.9, -5.3].forEach((x, i) => box(.28, .1, .22, i === 1 ? PAL.salad : PAL.furn, x, .98, -5.15));
  block(-4.1, -5.4, -2.3, -4.75, .9, 0x2c2c31);
  const griddleMat = new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: .5, metalness: .3, emissive: 0xff7a2a, emissiveIntensity: .1, flatShading: true });
  box(1.7, .03, .55, griddleMat, -3.2, .915, -5.07);
  block(-4.2, -5.45, -2.2, -4.8, .22, PAL.furn, 1.95);
  block(-7.9, -5.4, -7.2, -4.3, 1.7, PAL.furn);
  block(-1.6, -5.4, .7, -4.95, .92, PAL.furn2);
  box(.8, .04, .34, 0x1c1c20, -.4, .925, -5.17);
  block(.55, -4.3, .9, -2.6, 1.5, PAL.furn);
  [-3.9, -3.4, -2.9].forEach((zz) => box(.24, .16, .3, PAL.steel, .7, 1.12, zz));
  blob(-5.8, -5.0, 2.6, 1.2, .45); blob(-3.2, -5.0, 2.4, 1.2, .45); blob(-.45, -5.1, 2.7, .9, .4);
  // riel de comandas
  box(5.6, .03, .03, PAL.steel, -4.5, 1.62, -4.78);
  const ticketMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .9, flatShading: true });
  const tickets = { frios: box(.2, .26, .015, ticketMat, -5.8, 1.47, -4.77), plancha: box(.2, .26, .015, ticketMat, -3.2, 1.47, -4.77) };
  Object.values(tickets).forEach((tk) => { const s = new THREE.Mesh(new THREE.BoxGeometry(.2, .04, .018), new THREE.MeshBasicMaterial({ color: PAL.volt, toneMapped: false })); s.position.y = .11; tk.add(s); tk.visible = false; });
  // pantalla del pase (mira a cocina)
  box(.36, .26, .04, PAL.wall, -.3, 1.13, -2.3);
  const paseScreen = new THREE.Mesh(new THREE.PlaneGeometry(.3, .2), new THREE.MeshBasicMaterial({ color: 0x15151a, toneMapped: false }));
  paseScreen.position.set(-.3, 1.13, -2.325); paseScreen.rotation.y = PI; kit.add(paseScreen);
  // depósito
  block(3.3, -5.4, 7.7, -4.8, .06, PAL.furn, .55);
  block(3.3, -5.4, 7.7, -4.8, .06, PAL.furn, 1.05);
  [3.35, 7.65].forEach((x) => block(x - .05, -5.4, x + .05, -4.8, 1.12, PAL.wall));
  [3.9, 4.7, 5.5, 6.3, 7.1].forEach((x, i) => box(.6, .34, .44, i % 2 ? PAL.furn2 : PAL.steel, x, .78, -5.1));
  const stacks = [4.1, 5.4, 6.7].map((x) => kit.stack(x, -4.0, .8, .95, .6, PAL.furn2));
  stacks.forEach((s, i) => { const lid = new THREE.Mesh(new THREE.BoxGeometry(.82, .05, .62), kit.mat(i === 1 ? PAL.steel : PAL.furn)); lid.position.y = .97; s.add(lid); s.userData.lid = lid; blob(s.position.x, -4.0, 1.3, 1.1, .45); });
  blob(5.5, -5.1, 4.8, 1.0, .4);
  // salón
  [[-6.2, 0], [-3.4, 0], [-.6, 0], [-6.2, 3.2], [-3.4, 3.2], [-.6, 3.2]].forEach(([x, z]) => table(kit, x, z));
  plant(kit, -7.4, 5.0); plant(kit, 3.3, 5.0);
  block(1.6, -2.08, 2.8, -1.65, .95, PAL.furn);
  [1.85, 2.15].forEach((x) => box(.2, .08, .2, PAL.white, x, .99, -1.86));
  blob(2.2, -1.85, 1.8, .9, .4);
  // caja
  block(6.3, .9, 6.9, 2.7, 1.0, PAL.furn);
  box(.4, .2, .34, PAL.wall, 6.6, 1.1, 1.5);
  box(.05, .26, .32, PAL.wall, 6.78, 1.32, 1.5);
  const cajaScreen = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), new THREE.MeshBasicMaterial({ color: 0x15151a, toneMapped: false }));
  cajaScreen.position.set(6.81, 1.32, 1.5); cajaScreen.rotation.y = PI / 2; kit.add(cajaScreen);
  block(7.6, -1.6, 7.9, 1.6, 1.1, PAL.furn);
  [-1.1, -.4, .3, 1.0].forEach((zz, i) => box(.16, .3, .16, i % 2 ? PAL.steel : PAL.furn2, 7.72, 1.25, zz));
  blob(6.6, 1.8, 1.3, 2.6, .5); blob(7.75, 0, .8, 3.6, .4);
  // platos
  const pase = { salad: makePlate(kit, 'salad'), meat: makePlate(kit, 'meat') };
  pase.salad.position.set(-1.6, .97, -2.2); pase.meat.position.set(-.7, .97, -2.2);
  Object.values(pase).forEach((p) => { p.visible = false; kit.add(p); });
  const tablePlates = [makePlate(kit, 'meat'), makePlate(kit, 'salad')];
  tablePlates[0].position.set(-.6, .8, 3.46); tablePlates[1].position.set(-.6, .8, 2.94);
  tablePlates.forEach((p) => { p.visible = false; kit.add(p); });
  const otherPlates = [[-6.2, .26], [-6.2, -.26], [-3.4, .26], [-6.2, 3.46], [-6.2, 2.94], [-3.4, 3.46], [-.6, .26]].map(([x, z], i) => {
    const p = makePlate(kit, i % 3 ? 'meat' : 'salad'); p.position.set(x, .8, z); kit.add(p); return p;
  });
  otherPlates.forEach((p, i) => { p.userData.on = i !== 4; p.visible = p.userData.on; });

  // ----- personajes principales
  // La historia arranca con la Mesa 6 ya sentada; el bucle se cierra con un fundido breve
  const main = [
    {
      name: 'mozo', color: PAL.staff, apron: true, carry: ['tablet', 'plate'], speed: 1.5,
      start: { x: T6.x, z: T6.z, f: F.W, carry: 'tablet' },
      steps: [
        { t: .7, g: 'write', dur: 1.7, mark: 'pedidoRegistrado' },
        { d: .35, carry: null, walk: [[1.4, 2.6], [1.4, -.5], [STATION.x, STATION.z]], f: F.S, speed: 1.5 },
        { t: '@listo-1.4', walk: [[1.4, -1.0], [-.75, -1.55]], f: F.N, speed: 1.5 },
        { d: .3, carry: 'plate', mark: 'mozoRetira' },
        { d: .3, walk: [[1.4, -1.0], [1.4, 2.7], [T6.x, T6.z]], f: F.W, speed: 1.4 },
        { g: 'serve', dur: .9 },
        { carry: null, mark: 'servido' },
        { d: .3, carry: 'tablet', g: 'write', dur: 1.0, mark: 'completado' },
        { d: .25, carry: null, walk: [[1.35, 2.3]], f: -1.14, speed: 1.1 },
        { wait: 1.6 },
        { walk: [[T6.x, T6.z]], f: F.W, speed: 1.1, mark: 'mozoCobro' },
        { carry: 'tablet', g: 'hold', dur: 1.2 },
        { g: 'write', dur: .9, mark: 'cobroRegistrado' },
        { carry: null },
        { t: '@clientesDePie', g: 'greet', dur: 1.4 },
      ],
      gestures: [{ t0: 0, t1: .7, type: 'talk' }],
    },
    {
      name: 'payer', color: PAL.main, speed: 1.35,
      start: { x: -.6, z: 3.95, f: F.N, sit: 1 },
      steps: [
        { t: '@clientesDePie', sit: 0 },
        { walk: [[.15, 3.95], [.5, 4.65], [4.6, 4.65], [5.45, 5.0]], speed: 1.35 },
        { fade: 0, walk: [[5.6, 6.4]], speed: 1.0 },
      ],
      gestures: [
        { t0: 0, t1: .7, type: 'talk' },
        { t0: .7, t1: '@pedidoRegistrado', type: 'listen' },
        { t0: '@pedidoRegistrado+0.3', t1: '@servido', type: 'talk' },
        { t0: '@servido+0.4', t1: '@mozoCobro', type: 'eat' },
        { t0: '@mozoCobro+0.15', t1: '@cobroRegistrado-0.9', type: 'pay' },
        { t0: '@cobroRegistrado', t1: '@clientesDePie', type: 'talk' },
      ],
    },
    {
      name: 'comp', color: PAL.main2, speed: 1.35,
      start: { x: -.6, z: 2.45, f: F.S, sit: 1 },
      steps: [
        { t: '@clientesDePie+0.35', sit: 0 },
        { walk: [[.15, 2.45], [1.5, 1.85], [4.6, 4.05], [5.6, 5.0]], speed: 1.35 },
        { fade: 0, walk: [[6.0, 6.45]], speed: 1.0 },
      ],
      gestures: [
        { t0: 0, t1: '@pedidoRegistrado', type: 'listen' },
        { t0: '@pedidoRegistrado+0.2', t1: '@servido', type: 'talk' },
        { t0: '@servido+0.6', t1: '@mozoCobro+0.4', type: 'eat' },
        { t0: '@mozoCobro+0.4', t1: '@clientesDePie', type: 'listen' },
      ],
    },
    {
      name: 'cookA', color: PAL.staff, hat: true, apron: true, carry: ['plate'], speed: 1.35,
      start: { x: -3.2, z: -4.25, f: F.N },
      steps: [
        { t: '@fx:plancha+5.0', carry: 'plate', mark: 'cookAToma' },
        { d: .2, walk: [[-2.7, -3.55], [-1.0, -3.5], [-.7, -2.85]], f: F.S, speed: 1.4 },
        { d: .2, carry: null, mark: 'platoListo' },
        { g: 'tap', dur: .8, mark: 'listo' },
        { d: .4, walk: [[-1.0, -3.5], [-2.7, -3.55], [-3.2, -4.25]], f: F.N, speed: 1.35, mark: 'cookAVuelve' },
      ],
      gestures: [
        { t0: 0, t1: '@fx:plancha', type: 'cook' },
        { t0: '@fx:plancha+0.15', t1: '@fx:plancha+1.2', type: 'read' },
        { t0: '@fx:plancha+1.2', t1: '@cookAToma', type: 'cook' },
        { t0: '@cookAVuelve+0.2', t1: 999, type: 'cook' },
      ],
    },
    {
      name: 'cookB', color: PAL.staff, hat: true, apron: true, carry: ['plate'], speed: 1.4,
      start: { x: -5.8, z: -4.25, f: F.N },
      steps: [
        { t: '@fx:frios+1.8', carry: 'plate', mark: 'cookBToma' },
        { d: .2, walk: [[-4.7, -3.35], [-2.1, -3.3], [-1.6, -2.85]], f: F.S, speed: 1.45 },
        { d: .2, carry: null, mark: 'ensaladaPase' },
        { t: '@platoListo+0.2', walk: [[-2.2, -3.75], [-4.9, -3.75], [-5.8, -4.25]], f: F.N, speed: 1.4, mark: 'cookBVuelve' },
      ],
      gestures: [
        { t0: 0, t1: '@fx:frios', type: 'cook' },
        { t0: '@fx:frios+0.15', t1: '@fx:frios+1.1', type: 'read' },
        { t0: '@fx:frios+1.1', t1: '@cookBToma', type: 'cook' },
        { t0: '@ensaladaPase+0.2', t1: '@platoListo', type: 'listen' },
        { t0: '@cookBVuelve+0.2', t1: 999, type: 'cook' },
      ],
    },
    {
      name: 'cajero', color: PAL.staff, apron: true,
      start: { x: 7.35, z: 1.8, f: F.W },
      steps: [
        { t: 6.5, face: 1.4 }, { d: 2.2, face: F.W },
        { t: '@fx:caja+0.05', g: 'tap', dur: 1.2 },
        { t: '@fx:caja+2.6', face: 1.3 }, { d: 1.4, face: F.W },
      ],
      gestures: [{ t0: 7.6, t1: 8.4, type: 'read' }],
    },
  ];

  // ----- vida alrededor: ciclos propios, desfasados de la historia
  const loops = [
    {
      name: 'mozoB', color: PAL.staff, apron: true, carry: ['plate'], speed: 1.3, period: 37,
      start: { x: -2.0, z: -1.55, f: F.N },
      steps: [
        { t: 1.0, carry: 'plate' },
        { d: .4, walk: [[-2.0, -1.05], [-4.8, -1.05], [-5.15, 0]], f: F.W, speed: 1.3 },
        { g: 'serve', dur: .9 }, { carry: null },
        { g: 'talk', dur: 2.4 },
        { d: .3, walk: [[-4.8, 1.6], [-5.15, 3.2]], f: F.W, speed: 1.2 },
        { g: 'talk', dur: 3.6 },
        { d: .2, walk: [[-4.8, 1.6], [-2.45, 1.6], [-2.45, 0]], f: F.W, speed: 1.25 },
        { g: 'listen', dur: 3.0 },
        { d: .3, walk: [[-2.1, -1.0], [-2.0, -1.55]], f: F.N, speed: 1.2 },
      ],
    },
    {
      name: 'cookC', color: PAL.staff, hat: true, apron: true, speed: 1.0, period: 23,
      start: { x: -.35, z: -4.45, f: F.N },
      steps: [
        { t: 9.0, walk: [[.15, -3.7]], f: F.E, speed: .9 },
        { g: 'cook', dur: 3.2 },
        { walk: [[-.35, -4.45]], f: F.N, speed: .9 },
      ],
      gestures: [{ t0: 0, t1: 8.9, type: 'cook' }, { t0: 15.5, t1: 23, type: 'cook' }],
    },
  ];

  const extras = [
    { x: -6.2, z: .75, f: F.N, c: PAL.client, eat: true }, { x: -6.2, z: -.75, f: F.S, c: PAL.client2 },
    { x: -3.4, z: .75, f: F.N, c: PAL.client3, eat: true }, { x: -3.4, z: -.75, f: F.S, c: PAL.client },
    { x: -.6, z: .75, f: F.N, c: PAL.client2, eat: true },
    { x: -6.2, z: 3.95, f: F.N, c: PAL.client3 }, { x: -6.2, z: 2.45, f: F.S, c: PAL.client, eat: true },
    { x: -3.4, z: 3.95, f: F.N, c: PAL.client2, eat: true },
  ];

  const fx = [
    { id: 'plancha', from: [.3, 1.02, 3.2], to: [-3.2, 1.55, -4.78], t0: '@pedidoRegistrado+0.05', dur: 1.5, slot: 0, moment: 'pedido', pulse: [-3.2, -4.15] },
    { id: 'frios', from: [.3, 1.02, 3.2], to: [-5.8, 1.55, -4.78], t0: '@pedidoRegistrado+0.2', dur: 1.75, slot: 1, moment: 'pedido', pulse: [-5.8, -4.15] },
    { id: 'deposito', from: [.3, 1.02, 3.2], to: [5.4, 1.35, -4.4], t0: '@completado', dur: 1.7, slot: 0, moment: 'stock', pulse: [5.4, -3.9] },
    { id: 'caja', from: [.3, 1.02, 3.2], to: [6.6, 1.3, 1.5], t0: '@cobroRegistrado', dur: 1.4, slot: 0, moment: 'cobro', pulse: [6.1, 1.7] },
  ];

  const derived = [
    ['clientesDePie', (M) => (M['fx:caja'] ?? 0) + 1.6],
    ['stockStart', (M) => (M.listo ?? 0) + .4],
    ['cobroStart', (M) => (M['fx:deposito'] ?? 0) + 2.0],
  ];
  const loopEnd = '@clientesDePie+5.2';

  const moments = [
    { id: 'pedido', guideStart: '@pedidoRegistrado-1', guideEnd: '@fx:frios+1.2', start: 0, end: '@stockStart', hold: '@fx:plancha+0.25', zones: ['salon', 'cocina'] },
    { id: 'stock', guideStart: '@completado-1', guideEnd: '@fx:deposito+1.2', start: '@stockStart', end: '@cobroStart', hold: '@fx:deposito+0.3', zones: ['deposito'] },
    { id: 'cobro', guideStart: '@cobroRegistrado-1', guideEnd: '@fx:caja+1.2', start: '@cobroStart', end: '@T', hold: '@fx:caja+0.35', zones: ['caja'] },
  ];

  const chips = [
    { t: '@pedidoRegistrado', until: '@fx:frios+1.6', at: [.6, 2.05, 3.2], align: 'l', html: '<b>Pedido #24 · Mesa 6</b>Milanesa · Ensalada' },
    { t: '@fx:plancha+0.15', until: '@cookAToma', at: [-3.2, 2.0, -4.78], align: 'l', html: '<b>Comanda · Plancha</b>Milanesa' },
    { t: '@fx:frios+0.15', until: '@cookBToma', at: [-5.8, 2.0, -4.78], align: 'r', html: '<b>Comanda · Fríos</b>Ensalada' },
    { t: '@listo-0.3', until: '@mozoRetira+1.2', at: [-.7, 1.95, -2.35], html: '<b>Comanda #24</b>Lista para servir' },
    { t: '@completado-0.2', until: '@cobroStart', at: [.6, 2.05, 3.2], align: 'l', html: '<b>Pedido #24</b>Completado' },
    { t: '@fx:deposito+0.2', until: '@cobroStart', at: [5.4, 2.0, -4.4], html: '<b>Insumos de la receta</b>Carne −200 g · Lechuga −1 · Tomate −1' },
    { t: '@fx:caja+0.2', until: '@T', at: [6.6, 2.0, 1.6], html: '<b>Cobro · Mesa 6</b>' + MEDIOS('Tarjeta', '$ 18.400'), short: 'Tarjeta · <i>$ 18.400</i>' },
  ];

  // Etiquetas por encima del fondo de cada sector
  const zones = [
    { id: 'cocina', label: 'Cocina', at: [-5.0, 2.45, -5.5] },
    { id: 'deposito', label: 'Depósito', at: [5.5, 2.05, -5.5] },
    { id: 'salon', label: 'Salón', at: [-7.95, 1.75, 2.4] },
    { id: 'caja', label: 'Caja', at: [7.3, 1.6, 3.9] },
  ];

  const lights = {
    pools: [[-6.2, 1.6], [-3.4, 1.6], [-.6, 1.6]].map(([x, z]) => ({ c: 0xffb468, i: 13, d: 7, p: [x, 2.3, z] })),
    extra: [
      { c: 0xfff0dc, i: 16, d: 7.5, p: [-5.6, 2.7, -3.6] },
      { c: 0xfff0dc, i: 16, d: 7.5, p: [-2.4, 2.7, -3.6] },
      { c: 0xffc68a, i: 7, d: 5.5, p: [6.4, 2.4, 2.2] },
      { c: 0xd9defa, i: 3.2, d: 6, p: [5.4, 2.4, -3.3] },
    ],
  };

  // Planos de cámara. Cada uno llega a destino antes del aro dorado y se mantiene durante la respuesta.
  // tx, tz: punto al que mira · r: distancia relativa · th, ph: desvío de ángulo
  const SH = {
    general: { tx: .2, tz: .6, r: 1.0, th: 0, ph: 0 },
    cocina: { tx: -2.9, tz: -2.0, r: .7, th: -.08, ph: -.06 },
    cocinaMedio: { tx: -1.8, tz: -1.6, r: .82, th: -.04, ph: -.03 },
    pase: { tx: .1, tz: -.4, r: .8, th: .02, ph: -.02 },
    mesa: { tx: .5, tz: 1.5, r: .78, th: .05, ph: 0 },
    deposito: { tx: 3.6, tz: -1.7, r: .72, th: .1, ph: -.05 },
    mesaCaja: { tx: 2.2, tz: 1.7, r: .84, th: .06, ph: 0 },
    caja: { tx: 4.5, tz: 2.1, r: .7, th: .08, ph: -.02 },
    salida: { tx: 3.0, tz: 2.5, r: .9, th: .05, ph: 0 },
  };
  const shots = [
    { from: 0, to: 0, shot: SH.general },
    { from: '@fx0:plancha', to: '@fx:plancha-0.35', shot: SH.cocina },
    { from: '@fx:frios+1.6', to: '@fx:frios+3.4', shot: SH.cocinaMedio },
    { from: '@listo+0.2', to: '@listo+2.2', shot: SH.pase },
    { from: '@mozoRetira+0.3', to: '@servido-1.2', shot: SH.mesa },
    { from: '@fx0:deposito', to: '@fx:deposito-0.35', shot: SH.deposito },
    { from: '@fx:deposito+1.8', to: '@fx:deposito+3.6', shot: SH.mesaCaja },
    { from: '@fx0:caja', to: '@fx:caja-0.3', shot: SH.caja },
    { from: '@clientesDePie', to: '@clientesDePie+2.6', shot: SH.salida },
  ];

  function respond(t, M, frozenMoment) {
    tickets.frios.visible = t >= M['fx:frios'] + .05 && t < M.cookBToma;
    tickets.plancha.visible = t >= M['fx:plancha'] + .05 && t < M.cookAToma;
    pase.salad.visible = t >= M.ensaladaPase && t < M.mozoRetira;
    pase.meat.visible = t >= M.platoListo && t < M.mozoRetira;
    const onTable = t >= M.servido;
    tablePlates.forEach((p) => { p.visible = onTable; });
    const cooking = t >= M['fx:plancha'] + 1.2 && t < M.cookAToma;
    griddleMat.emissiveIntensity = cooking ? .55 + .08 * Math.sin(t * 2.1) : .12;
    const k = t < M['fx:deposito'] ? 0 : smooth((t - M['fx:deposito'] - .1) / .9);
    stacks.forEach((s) => { const lv = 1 - .26 * k; s.scale.y = lv; s.userData.lid.scale.y = 1 / lv; });
    const tapping = t >= M.listo - .8 && t < M.listo + .3;
    paseScreen.material.color.setHex(tapping ? PAL.volt : 0x15151a);
    const dc = t - M['fx:caja'];
    let cg = dc >= 0 ? Math.exp(-dc / 1.6) : 0;
    if (frozenMoment === 'cobro') cg = Math.max(cg, .35);
    cajaScreen.material.color.setHex(0x15151a).lerp(TMPC.setHex(PAL.gold), clamp(cg));
  }

  return { main, loops, extras, fx, derived, loopEnd, moments, chips, zones, lights, shots, respond, otherPlates };
}
const TMPC = new THREE.Color();

// Resuelve tiempos encadenados entre personajes (varias pasadas hasta estabilizar)
function compileStory(def) {
  const M = {};
  let comp = null;
  for (let pass = 0; pass < 7; pass++) {
    comp = def.main.map((a) => compileActor(a, M));
    def.fx.forEach((e) => { e._t0 = resolve(e.t0, M); M['fx0:' + e.id] = e._t0; M['fx:' + e.id] = e._t0 + e.dur; });
    def.derived.forEach(([k, fn]) => { M[k] = fn(M); });
    M.T = def.loopEnd ? resolve(def.loopEnd, M) : Math.max(...def.main.map((a) => M[a.name + ':end'])) + .8;
  }
  comp = def.main.map((a) => compileActor(a, M));
  const loops = def.loops.map((a) => compileActor(a, {}));
  return { M, comp, loops };
}

// ---------------------------------------------------------------- efectos Dico
function makeFX(kit, e) {
  const from = new THREE.Vector3(...e.from), to = new THREE.Vector3(...e.to);
  const top = Math.max(from.y, to.y) + 1.5;
  const c1 = from.clone().lerp(to, .25); c1.y = top;
  const c2 = from.clone().lerp(to, .75); c2.y = top;
  const curve = new THREE.CubicBezierCurve3(from, c1, c2, to);
  const SEG = 72, RAD = 6;
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, SEG, .04, RAD, false), new THREE.MeshBasicMaterial({ color: PAL.volt, toneMapped: false, transparent: true, opacity: .95 }));
  tube.visible = false; kit.add(tube);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xb9cbff, toneMapped: false }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: kit.tex.voltGlow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.scale.set(.75, .75, 1); head.add(glow);
  head.visible = false; kit.add(head);
  const ringGeo = new THREE.RingGeometry(.86, 1.0, 56); ringGeo.rotateX(-PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  ring.position.set(e.pulse[0], .035, e.pulse[1]); ring.visible = false; kit.add(ring);
  const discGeo = new THREE.PlaneGeometry(1, 1); discGeo.rotateX(-PI / 2);
  const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ map: kit.tex.goldGlow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  disc.position.set(e.pulse[0], .03, e.pulse[1]); disc.scale.set(4.2, 1, 4.2); disc.visible = false; kit.add(disc);
  return { ...e, curve, tube, head, ring, disc, SEG, idx: RAD * 6, lightPos: new THREE.Vector3(e.pulse[0], 2.1, e.pulse[1] + .7) };
}
const V3 = new THREE.Vector3();
function updateFX(f, t, frozen) {
  const u = (t - f._t0) / f.dur;
  const head = easeInOut(u);
  const tail = clamp((t - f._t0 - f.dur * .8) / (f.dur * .7));
  const lineOn = u > 0 && tail < 1;
  f.tube.visible = lineOn;
  if (lineOn) {
    const i0 = Math.floor(tail * f.SEG), i1 = Math.max(i0, Math.ceil(head * f.SEG));
    f.tube.geometry.setDrawRange(i0 * f.idx, (i1 - i0) * f.idx);
    f.tube.material.opacity = .95 * (1 - smooth((tail - .6) / .4));
  }
  f.head.visible = u > 0 && u < 1;
  if (f.head.visible) f.curve.getPointAt(head, f.head.position);
  const ta = f._t0 + f.dur, k = (t - ta) / 1.5;
  f.ring.visible = k >= 0 && k < 1;
  if (f.ring.visible) { const s = .35 + 2.3 * easeOut(k); f.ring.scale.set(s, 1, s); f.ring.material.opacity = .5 * Math.pow(1 - k, 1.6); }
  const kd = t - ta;
  let env = kd < 0 ? 0 : kd < .3 ? smooth(kd / .3) : Math.exp(-(kd - .3) / 1.1);
  if (frozen) env = Math.max(env, .3);
  f.disc.visible = env > .01;
  f.disc.material.opacity = .42 * env;
  f.env = env;
}

// ---------------------------------------------------------------- cámara dirigida
function lerpShot(a, b, k, o = {}) {
  o.tx = lerp(a.tx, b.tx, k); o.tz = lerp(a.tz, b.tz, k); o.r = lerp(a.r, b.r, k);
  o.th = lerp(a.th, b.th, k); o.ph = lerp(a.ph, b.ph, k);
  return o;
}
// El plano es función del tiempo de la historia: congelar y reanudar no produce saltos
function evalShot(shots, t, o) {
  let cur = shots[0].shot;
  for (let i = 1; i < shots.length; i++) {
    const s = shots[i];
    if (t < s.from) break;
    const k = s.to > s.from ? easeInOut((t - s.from) / (s.to - s.from)) : 1;
    if (k < 1) return lerpShot(cur, s.shot, k, o);
    cur = s.shot;
  }
  return lerpShot(cur, cur, 0, o);
}

// ---------------------------------------------------------------- calidad
const QUALITY = {
  alta: { dpr: 1.75, shadow: true, soft: true, map: 1024 },
  media: { dpr: 1.35, shadow: true, soft: false, map: 512 },
  baja: { dpr: 1, shadow: false, soft: false, map: 256 },
};
function autoQuality() {
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  const small = Math.min(screen.width || 1024, screen.height || 768) < 520;
  if (mem <= 2 || cores <= 2) return 'baja';
  if (mem <= 4 || cores <= 4 || small) return 'media';
  return 'alta';
}


// Sin WebGL: imagen fija de la escena (si se provee) y un mensaje accesible
function staticFallback(root, stage, opts) {
  root.classList.add('dse-fallback');
  root.removeAttribute('aria-hidden');
  stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', 'Ilustración de un restaurante: Dico conecta la mesa, la cocina, el depósito y la caja.');
  if (opts.imagenAlternativa) stage.style.backgroundImage = `url("${opts.imagenAlternativa}")`;
  const msg = document.createElement('p'); msg.className = 'dse-fallback-msg';
  msg.textContent = 'La animación 3D no está disponible en este navegador.';
  stage.appendChild(msg);
  return { set() {}, dispose() { root.remove(); }, stats() { return { fps: 0, calidad: 'sin-webgl' }; } };
}

// ---------------------------------------------------------------- motor
export const MOMENTOS = { gastronomia: ['pedido', 'stock', 'cobro'] };

export function createDicoScene(container, options = {}) {
  const opts = { onMomento: null, calidad: 'auto', proporcion: '4 / 3', imagenAlternativa: null, ...options };

  const root = document.createElement('div');
  root.className = 'dse-root'; root.setAttribute('aria-hidden', 'true');
  const stage = document.createElement('div'); stage.className = 'dse-stage';
  if (opts.proporcion) stage.style.aspectRatio = opts.proporcion; else root.classList.add('dse-fill');
  root.appendChild(stage);
  container.appendChild(root);
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' }); } catch { renderer = null; }
  if (!renderer || !renderer.getContext()) return staticFallback(root, stage, opts);
  renderer.setClearColor(PAL.bg, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.domElement.setAttribute('tabindex', '-1');
  stage.appendChild(renderer.domElement);
  const vig = document.createElement('div'); vig.className = 'dse-vig'; stage.appendChild(vig);
  const dipEl = document.createElement('div'); dipEl.className = 'dse-dip'; stage.appendChild(dipEl);
  const layer = document.createElement('div'); layer.className = 'dse-layer'; stage.appendChild(layer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.bg);
  scene.fog = new THREE.Fog(PAL.bg, 33, 58);
  const camera = new THREE.PerspectiveCamera(32, 4 / 3, .5, 140);
  scene.add(new THREE.HemisphereLight(0xc9cfff, 0x101013, 1.05));
  const key = new THREE.DirectionalLight(0xffe9d2, 1.55);
  key.position.set(-5, 15, 9); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0006; key.shadow.normalBias = .02;
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
  scene.add(key);

  const tex = {
    blob: radialTexture([[0, 'rgba(255,255,255,1)'], [.45, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']]),
    voltGlow: radialTexture([[0, 'rgba(120,150,255,.9)'], [.4, 'rgba(61,107,255,.35)'], [1, 'rgba(61,107,255,0)']]),
    goldGlow: radialTexture([[0, 'rgba(224,172,60,.85)'], [.45, 'rgba(224,172,60,.28)'], [1, 'rgba(224,172,60,0)']]),
  };
  tex.blob.colorSpace = THREE.NoColorSpace;

  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = !!(mq && mq.matches);

  // calidad adaptable: arranca según el equipo y baja sola si el ritmo de cuadros no alcanza
  const fixedQ = QUALITY[opts.calidad] ? opts.calidad : null;
  let tier = fixedQ || autoQuality();
  let frameEMA = 1 / 60, slowFor = 0, lastDrop = 0;

  let content = null, rubro = null, fixedIdx = -1, storyTime = 0, lastIdx = -1, lastReported = null;
  let W = 1, H = 1, fitR = 30;
  const BASE = { theta: .52, phi: .98 };
  let thetaUser = 0, phiUser = 0, thetaGoal = 0, phiGoal = 0;
  const shotNow = {}, shotSnap = {}, shotOut = {};
  let camBlendStart = -1, blendStart = -1, hasShot = false;
  let dirty = true, raf = 0, last = 0, onScreen = true, drag = null, destroyed = false;
  const tmp = new THREE.Vector3(), mo = {}, pose = {};

  function applyQuality() {
    const q = QUALITY[tier];
    renderer.shadowMap.enabled = q.shadow;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    key.castShadow = q.shadow;
    key.shadow.mapSize.set(q.map, q.map);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
    resize();
  }

  function teardown() {
    if (!content) return;
    content.zoneEls.forEach((z) => z.el.remove());
    content.chips.forEach((c) => c.el.remove());
    scene.remove(content.group);
    const geos = new Set(), mats = new Set();
    content.group.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => { for (const k in m) if (m[k] && m[k].isTexture && !Object.values(tex).includes(m[k])) m[k].dispose(); m.dispose(); });
    content = null;
  }

  function build() {
    teardown();
    const group = new THREE.Group(); scene.add(group);
    const kit = makeKit(group, tex);
    const def = buildGastronomia(kit);
    const story = compileStory(def);
    const M = story.M;
    def.fx.forEach((e) => { e._t0 = resolve(e.t0, M); });
    const fxs = def.fx.map((e) => makeFX(kit, e));
    const people = def.main.map((a, i) => ({ p: makePerson(kit, a.name, a.color, a), A: story.comp[i], loop: 0 }));
    def.loops.forEach((a, i) => people.push({ p: makePerson(kit, a.name, a.color, a), A: story.loops[i], loop: a.period }));
    const extras = def.extras.map((e, i) => ({ p: makePerson(kit, 'extra' + i, e.c, {}), e }));
    [...def.lights.pools, ...def.lights.extra].forEach((l) => {
      const L = new THREE.PointLight(l.c, l.i, l.d, 2); L.position.set(...l.p); group.add(L);
    });
    const gold = [0, 1].map(() => { const L = new THREE.PointLight(PAL.gold, 0, 7, 2); group.add(L); return L; });
    const zoneEls = def.zones.map((z) => {
      const el = document.createElement('div'); el.className = 'dse-zone'; el.textContent = z.label; layer.appendChild(el);
      return { ...z, el, v: new THREE.Vector3(...z.at), w: 0, h: 0, on: false, off: 0, shown: null, wasOn: null };
    });
    const chips = def.chips.map((c) => {
      const el = document.createElement('div'); el.className = 'dse-chip';
      el.innerHTML = c.html.replace('</b>', '</b><span class="dse-body">') + '</span>' + (c.short ? `<span class="dse-short">${c.short}</span>` : '');
      layer.appendChild(el);
      return { ...c, el, v: new THREE.Vector3(...c.at), t0: resolve(c.t, M), t1: resolve(c.until, M), w: 0, h: 0, on: false, rect: null };
    });
    const moments = def.moments.map((m) => ({ ...m, s: resolve(m.start, M), e: resolve(m.end, M), h: resolve(m.hold, M), g: Math.max(0, resolve(m.guideStart ?? m.start, M)), ge: Math.min(M.T - .001, resolve(m.guideEnd ?? m.end, M)) }));
    const shots = def.shots.map((s) => ({ from: resolve(s.from, M), to: resolve(s.to, M), shot: s.shot }));
    content = { group, def, M, T: M.T, fxs, people, extras, gold, zoneEls, chips, moments, shots };
  }

  function mainTime() { return ((storyTime % content.T) + content.T) % content.T; }
  function momentAt(t) { const ms = content.moments; for (let i = 0; i < ms.length; i++) if (t < ms[i].e) return i; return ms.length - 1; }
  function frozenHold(idx) { const T = content.T; storyTime = Math.floor(storyTime / T) * T + content.moments[idx].h; }

  function enterMoment(idx) {
    lastIdx = idx;
    const m = content.moments[idx];
    content.zoneEls.forEach((z) => { z.on = m.zones.includes(z.id); });
    const report = fixedIdx < 0 && !reduced ? m.id : null;
    if (report && report !== lastReported && typeof opts.onMomento === 'function') opts.onMomento(report);
    lastReported = report;
  }

  function placeCam(s) {
    const th = BASE.theta + s.th + thetaUser, ph = BASE.phi + s.ph + phiUser;
    const r = fitR * s.r;
    camera.position.set(s.tx + r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph), s.tz + r * Math.sin(ph) * Math.cos(th));
    camera.lookAt(s.tx, 0, s.tz);
  }

  function project(v) { tmp.copy(v).project(camera); return [(tmp.x + 1) / 2 * W, (1 - tmp.y) / 2 * H, tmp.z]; }
  const hit = (a, b) => a.l < b.l + b.w && b.l < a.l + a.w && a.t < b.t + b.h && b.t < a.t + a.h;

  // Fichas primero; las etiquetas esquivan fichas y entre sí, con desplazamiento suave
  function updateOverlay(t, dt) {
    const narrow = W < 440;
    let moving = false;
    let latest = null;
    if (narrow) content.chips.forEach((c) => { if (t >= c.t0 && t < c.t1 && (!latest || c.t0 > latest.t0)) latest = c; });
    const rects = [];
    content.chips.forEach((c) => {
      const on = t >= c.t0 && t < c.t1 && (!narrow || c === latest);
      if (on !== c.on) { c.on = on; c.el.classList.toggle('on', on); }
      if (!on) return;
      if (!c.w) { c.w = c.el.offsetWidth; c.h = c.el.offsetHeight; }
      const [x, y] = project(c.v);
      let l = c.align === 'r' ? x - c.w + 10 : c.align === 'l' ? x - 10 : x - c.w / 2;
      l = clamp(l, 6, W - c.w - 6);
      const tp = clamp(y - c.h, 6, H - c.h - 6);
      c.el.style.transform = `translate3d(${l | 0}px,${tp | 0}px,0)`;
      rects.push({ l: l - 4, t: tp - 4, w: c.w + 8, h: c.h + 8 });
    });
    const k = reduced || !dt ? 1 : 1 - Math.exp(-dt * 9);
    const order = [...content.zoneEls].sort((a, b) => (b.on ? 1 : 0) - (a.on ? 1 : 0));
    order.forEach((z) => {
      if (z.wasOn !== z.on) { z.wasOn = z.on; z.el.classList.toggle('on', z.on); z.w = 0; }
      if (!z.w) { z.w = z.el.offsetWidth; z.h = z.el.offsetHeight; }
      const [x, y, depth] = project(z.v);
      const l = clamp(x - z.w / 2, 4, W - z.w - 4);
      const baseT = y - z.h / 2;
      let need = 0;
      const box = { l, t: baseT, w: z.w, h: z.h };
      for (const r of rects) {
        if (!hit(box, r)) continue;
        const up = r.t - z.h - 2 - baseT, down = r.t + r.h + 2 - baseT;
        need = baseT + up >= 4 ? up : down;
        box.t = baseT + need;
      }
      z.off += (need - z.off) * k;
      if (Math.abs(need - z.off) > .5) moving = true;
      const tp = clamp(baseT + z.off, 4, H - z.h - 4);
      const final = { l, t: tp, w: z.w, h: z.h };
      const clash = rects.some((r) => hit(final, r));
      const hide = depth > 1 || (narrow && !z.on) || (!z.on && clash);
      if (hide !== z.shown) { z.shown = hide; z.el.classList.toggle('off', hide); }
      z.el.style.transform = `translate3d(${l | 0}px,${tp | 0}px,0)`;
      if (!hide) rects.push(final);
    });
    return moving;
  }

  function poseFor(item, t, out) {
    const { A, p } = item;
    evalMotion(A, t, mo);
    out.x = mo.x; out.z = mo.z; out.rot = mo.rot;
    out.sit = trackValue(A.sitT, t, .45);
    out.fade = trackValue(A.fadeT, t, .6);
    out.carry = trackDiscrete(A.carryT, t);
    const sk = mo.speedK;
    const swing = Math.sin(mo.phase) * .5 * sk;
    out.bob = Math.abs(Math.sin(mo.phase)) * .035 * sk;
    out.lean = .07 * sk;
    out.yaw = .05 * Math.sin(t * .5 + p.ph * 7); out.pitch = 0; out.sway = 0;
    const carrying = out.carry && out.carry !== 'tablet';
    const baseL = carrying ? -1.05 : lerp(swing, -.5, out.sit), baseR = carrying ? -1.05 : lerp(-swing, -.5, out.sit);
    const g = { l: 0, r: 0, yaw: 0, pitch: 0, sway: 0 };
    let w = 0;
    for (const gs of A.gest) {
      if (t < gs.t0 || t > gs.t1) continue;
      const kk = smooth((t - gs.t0) / .35) * smooth((gs.t1 - t) / .35) * (1 - sk);
      if (kk <= 0) continue;
      const q = { l: 0, r: 0, yaw: 0, pitch: 0, sway: 0 };
      gestureFX(gs.type, t, p.ph, q);
      g.l += q.l * kk; g.r += q.r * kk; g.yaw += q.yaw * kk; g.pitch += q.pitch * kk; g.sway += q.sway * kk;
      w = Math.max(w, kk);
    }
    const useArms = w > 0 && (g.l || g.r);
    out.l = useArms ? lerp(baseL, 0, w) + g.l : baseL;
    out.r = useArms ? lerp(baseR, 0, w) + g.r : baseR;
    if (carrying && useArms) { out.l = Math.min(out.l, -1.0); out.r = Math.min(out.r, -1.0); }
    out.yaw += g.yaw; out.pitch += g.pitch; out.sway = g.sway;
    return out;
  }

  function updatePeople(t, blendK) {
    content.people.forEach((item) => {
      const tt = item.loop ? ((storyTime % item.loop) + item.loop) % item.loop : t;
      poseFor(item, tt, pose);
      const p = item.p;
      if (blendK < 1 && p.from) {
        const e = easeOut(blendK);
        pose.x = lerp(p.from.x, pose.x, e); pose.z = lerp(p.from.z, pose.z, e);
        pose.rot = lerpAngle(p.from.rot, pose.rot, e); pose.fade = lerp(p.from.fade, pose.fade, e);
      }
      p.cur = { x: pose.x, z: pose.z, rot: pose.rot, fade: pose.fade };
      applyPose(p, pose);
    });
    content.extras.forEach(({ p, e }) => {
      const ts = storyTime;
      const talkW = smooth(.5 + .9 * Math.sin(ts * .19 + p.ph * 11));
      const q = { l: 0, r: 0, yaw: 0, pitch: 0, sway: 0 }, qe = { l: 0, r: 0, yaw: 0, pitch: 0, sway: 0 };
      gestureFX('talk', ts, p.ph, q);
      gestureFX(e.eat ? 'eat' : 'listen', ts, p.ph, qe);
      pose.x = e.x; pose.z = e.z; pose.rot = e.f; pose.sit = 1; pose.fade = 1; pose.carry = null; pose.bob = 0; pose.lean = 0;
      pose.l = -.5 + lerp(qe.l, q.l * .5, talkW); pose.r = -.5 + lerp(qe.r, q.r * .6, talkW);
      pose.yaw = lerp(qe.yaw, q.yaw, talkW); pose.pitch = lerp(qe.pitch, q.pitch, talkW); pose.sway = 0;
      applyPose(p, pose);
    });
  }

  function updateLightsFX(t, frozenId) {
    const slot = [null, null], best = [0, 0];
    content.fxs.forEach((f) => {
      updateFX(f, t, frozenId === f.moment);
      if (f.env > best[f.slot]) { best[f.slot] = f.env; slot[f.slot] = f; }
    });
    content.gold.forEach((L, i) => {
      const f = slot[i];
      if (!f) { L.intensity = 0; return; }
      L.position.copy(f.lightPos); L.intensity = 14 * best[i];
    });
  }

  function frame(now) {
    raf = 0;
    if (destroyed || !content || lost) return;
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0;
    last = now;
    let playing = fixedIdx < 0 && !reduced;
    if (playing) storyTime += dt;
    const finalGuiado = recorridoGuiado.avanzar(storyTime);
    if (finalGuiado) { storyTime = finalGuiado.tiempo; fixedIdx = finalGuiado.indice; playing = false; dirty = true; }
    const t = mainTime();
    const idx = recorridoGuiado.indice ?? (fixedIdx >= 0 ? fixedIdx : momentAt(t));
    if (idx !== lastIdx) enterMoment(idx);
    let active = playing || !!drag;

    // cámara: plano dirigido por la historia + mezcla al seleccionar + exploración manual
    evalShot(content.shots, t, shotOut);
    if (camBlendStart >= 0) {
      const k = clamp((now - camBlendStart) / TWEEN_SELECT);
      lerpShot(shotSnap, shotOut, easeInOut(k), shotOut);
      if (k >= 1) camBlendStart = -1;
      active = true;
    }
    Object.assign(shotNow, shotOut); hasShot = true;
    const kc = reduced ? 1 : 1 - Math.exp(-dt * 12);
    if (Math.abs(thetaGoal - thetaUser) > 1e-4 || Math.abs(phiGoal - phiUser) > 1e-4) {
      thetaUser += (thetaGoal - thetaUser) * kc; phiUser += (phiGoal - phiUser) * kc; active = true;
    }
    let blendK = 1;
    if (blendStart >= 0) { blendK = clamp((now - blendStart) / BLEND_MS); if (blendK >= 1) blendStart = -1; active = true; }

    if (active || dirty) {
      const frozenId = recorridoGuiado.activo ? null : fixedIdx >= 0 ? content.moments[fixedIdx].id : (reduced ? content.moments[idx].id : null);
      updatePeople(t, blendK);
      content.def.respond(t, content.M, frozenId);
      updateLightsFX(t, frozenId);
      placeCam(shotNow);
      renderer.render(scene, camera);
      if (updateOverlay(t, dt)) active = true;
      // fundido breve que une el final con el comienzo del recorrido
      let dip = 0;
      if (playing) { const T = content.T; dip = t > T - .75 ? smooth((t - (T - .75)) / .75) : t < .75 ? 1 - smooth(t / .75) : 0; }
      dipEl.style.opacity = dip.toFixed(3);
      dirty = false;
      if (playing && dt) {
        frameEMA = frameEMA * .92 + dt * .08;
        slowFor = frameEMA > 1 / 38 ? slowFor + dt : Math.max(0, slowFor - dt);
        if (!fixedQ && slowFor > 2.5 && tier !== 'baja' && now - lastDrop > 4000) {
          tier = tier === 'alta' ? 'media' : 'baja'; slowFor = 0; lastDrop = now; applyQuality();
        }
      }
    }
    if (active) raf = requestAnimationFrame(frame); else last = 0;
  }

  function kick() { dirty = true; if (!raf && !destroyed && !lost && onScreen && !document.hidden) raf = requestAnimationFrame(frame); }

  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight);
    root.classList.toggle('dse-narrow', W < 440);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[tier].dpr));
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    fitR = 8.1 / Math.sin(Math.min(half, Math.atan(Math.tan(half) * camera.aspect)));
    if (content) { content.zoneEls.forEach((z) => { z.w = 0; }); content.chips.forEach((c) => { c.w = 0; }); }
    kick();
  }

  const onDown = (e) => {
    if (e.button !== 0 || drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse' };
    if (drag.mouse) try { stage.setPointerCapture(e.pointerId); } catch { /* noop */ }
    root.classList.add('dse-drag');
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    thetaGoal = clamp(thetaGoal - dx * .005, -.5, .5);
    if (drag.mouse) phiGoal = clamp(phiGoal - dy * .0035, -.25, .14);
    kick();
  };
  const onUp = (e) => { if (drag && e.pointerId === drag.id) { drag = null; root.classList.remove('dse-drag'); } };
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  stage.addEventListener('lostpointercapture', onUp);
  // si el navegador pierde el contexto gráfico, se espera a que lo devuelva
  let lost = false;
  const onLost = (e) => { e.preventDefault(); lost = true; if (raf) cancelAnimationFrame(raf); raf = 0; };
  const onRestored = () => { lost = false; applyQuality(); };
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  renderer.domElement.addEventListener('webglcontextrestored', onRestored);
  const onVis = () => { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; } else kick(); };
  document.addEventListener('visibilitychange', onVis);
  const onMQ = (e) => { reduced = e.matches; if (content) { if (reduced && recorridoGuiado.activo) { const fin = recorridoGuiado.reducir(); if (fin) { storyTime = fin.tiempo; fixedIdx = fin.indice; } } else if (reduced && fixedIdx < 0) frozenHold(0); lastIdx = -1; } kick(); };
  mq && mq.addEventListener && mq.addEventListener('change', onMQ);
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; if (!onScreen) { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; } else kick(); })
    : null;
  io && io.observe(stage);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro && ro.observe(stage);

  const recorridoGuiado = crearRecorridoGuiado(id => { if (!destroyed) opts.onFinMomento?.(id); });
  function aplicarGuia(o) {
    const indice = content.moments.findIndex(m => m.id === o.momento);
    const m = content.moments[indice];
    const estado = recorridoGuiado.configurar(o.guia, m && { id: m.id, indice, inicio: m.g, fin: Math.max(m.g + .01, m.ge), resultado: m.h }, mainTime(), reduced);
    if (!estado) return false;
    storyTime = estado.tiempo;
    fixedIdx = estado.fijo ? indice : -1;
    blendStart = camBlendStart = -1;
    lastIdx = -1;
    last = 0;
    kick();
    return true;
  }

  function set(o = {}) {
    if (destroyed) return;
    const now = performance.now();
    if (!content || o.rubro !== rubro) {
      rubro = o.rubro;
      build();
      storyTime = 0; fixedIdx = -1; lastReported = null; blendStart = -1; camBlendStart = -1;
      thetaUser = thetaGoal = 0; phiUser = phiGoal = 0;
      const ids = content.moments.map((m) => m.id);
      fixedIdx = ids.indexOf(o.momento);
      if (fixedIdx >= 0) frozenHold(fixedIdx); else if (reduced) frozenHold(0);
      lastIdx = -1;
      resize();
      aplicarGuia(o);
      return;
    }
    if (aplicarGuia(o)) return;
    const ids = content.moments.map((m) => m.id);
    const next = ids.indexOf(o.momento);
    if (next === fixedIdx) return;
    if (!reduced) {
      content.people.forEach(({ p }) => { p.from = p.cur ? { ...p.cur } : null; });
      blendStart = now;
      if (hasShot) { Object.assign(shotSnap, shotNow); camBlendStart = now; }
    }
    if (next >= 0) frozenHold(next);
    // al reanudar (next = -1) la historia sigue desde el instante congelado y la cámara vuelve a su recorrido
    else { thetaGoal = 0; phiGoal = 0; }
    fixedIdx = next;
    lastIdx = -1;
    kick();
  }

  function dispose() {
    if (destroyed) return;
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerup', onUp);
    stage.removeEventListener('pointercancel', onUp);
    stage.removeEventListener('lostpointercapture', onUp);
    document.removeEventListener('visibilitychange', onVis);
    mq && mq.removeEventListener && mq.removeEventListener('change', onMQ);
    io && io.disconnect(); ro && ro.disconnect();
    teardown();
    Object.values(tex).forEach((x) => x.dispose());
    key.dispose && key.dispose();
    renderer.domElement.removeEventListener('webglcontextlost', onLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
    renderer.dispose();
    renderer.forceContextLoss();
    root.remove();
  }

  // Lectura de rendimiento para pruebas en dispositivos reales
  function stats() { return { fps: Math.round(1 / frameEMA), calidad: tier }; }

  if (tier !== 'alta') applyQuality(); else resize();
  return { set, dispose, stats };
}
