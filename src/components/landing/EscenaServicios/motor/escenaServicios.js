// @no-jsx-check
// Motor de la escena 3D de Servicios (barbería) para la landing de Dico (versión aprobada).
// SIMULACIÓN con datos ficticios de funciones objetivo: no hay reservas reales, QR operativo, notificaciones ni conexiones.
// NO PUBLICAR hasta validar las funciones representadas.
// Dependencia única: three (probado con 0.186.1). Importa desde "three"; no usa CDN ni otra copia del motor.
// Uso directo (sin React):
//   const s = createDicoScene(contenedor, { imagenAlternativa, onMomento, onDisponibilidad });
//   s.set({ rubro: 'servicios', momento });  // momento: null = historia automática
//   s.stats();                               // { fps, calidad }
//   s.dispose();
// Opciones: imagenAlternativa (URL de la imagen fija si no hay WebGL) · onMomento(id) · onDisponibilidad(estado)
//           calidad 'auto' | 'alta' | 'media' | 'baja' · proporcion '4 / 3' (null llena el contenedor)
// Los estilos viven en EscenaServicios.css (todas las clases bajo .dse-servicios).
import * as THREE from 'three';

const PI = Math.PI;
const F = { N: PI, S: 0, E: PI / 2, W: -PI / 2 };
const TWEEN_SELECT = 420;
const BLEND_MS = 380;
// three r180 o posterior retiró PCFSoftShadowMap: lo reemplaza por PCFShadowMap (filtrado por hardware) y avisa en consola.
// Se elige según la versión instalada para no generar esa advertencia y conservar el resultado original en versiones previas.
const SOFT_SHADOW = parseInt(THREE.REVISION, 10) >= 180 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

const PAL = {
  bg: 0x09090b, plinth: 0x141417, floor: 0x1a1a1d, kitchen: 0x202024, depot: 0x151518,
  wall: 0x2a2a2e, furn: 0x3f3f46, furn2: 0x52525b, steel: 0x8a8a92, wood: 0x5e5248,
  white: 0xe7e5e4, volt: 0x3d6bff, gold: 0xe0ac3c, staff: 0xf0efed, apron: 0x2b2b30,
  main: 0xf0e2c4, main2: 0xe2d1ae, prota1: 0x8aa37a, prota2: 0xc0643e, client: 0x4a4b54, client2: 0x575862, client3: 0x41444c,
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
  const m = /^@([\w:]+(?:-[A-Za-z]\w*)*)([+-][\d.]+)?$/.exec(v);
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
    // desvanecimiento programado sin detener la caminata (lo usa el salto de tiempo)
    if (s.fadeAt) fadeT.push([resolve(s.fadeAt[0], M), s.fadeAt[1]]);
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
    if (s.place) { x = s.place[0]; z = s.place[1]; f = s.place[2] ?? f; segs.push({ type: 'turn', t0: cur, t1: cur + .01, t2: cur + .01, fromF: f, toF: f, x, z }); }
    if (s.face !== undefined) { segs.push({ type: 'turn', t0: cur, t1: cur + .55, t2: cur + .55, fromF: f, toF: s.face, x, z }); cur += .55; f = s.face; }
    if (s.g) { gest.push({ t0: cur, t1: cur + s.dur, type: s.g }); cur += s.dur; }
    if (s.wait) cur += s.wait;
    if (s.mark) M[s.mark] = cur;
  }
  fadeT.sort((a, b) => a[0] - b[0]);
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
    case 'browse': out.yaw += .32 * Math.sin(t * .9 + ph * 5); out.pitch += .06 + .05 * w2; break;
    case 'cut': out.pitch += .18; out.r += -1.55 + .07 * Math.sin(t * 6 + ph * 3); out.l += -1.2 + .05 * Math.sin(t * 4.3 + ph); break;
    case 'pick': { const k = .5 + .5 * Math.sin(t * 3.0 + ph); out.pitch += -.05; out.r += -1.2 - .3 * k; out.l += -.2; break; }
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
  } else if (kind === 'box') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.18, .26, .2), kit.mat(0x6d6258)); b.position.y = .04; g.add(b);
  } else if (kind === 'bag') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.32, .34, .16), kit.mat(PAL.steel)); b.position.y = -.12; g.add(b);
    const h = new THREE.Mesh(new THREE.TorusGeometry(.08, .012, 4, 10, PI), kit.mat(PAL.furn)); h.position.y = .06; g.add(h);
  } else if (kind === 'phone') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(.09, .016, .16), kit.mat(0x111113)));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(.075, .14), new THREE.MeshBasicMaterial({ color: PAL.volt, toneMapped: false }));
    s.rotation.x = -PI / 2; s.position.y = .009; g.add(s);
    g.rotation.x = -.7;
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

// ---------------------------------------------------------------- servicios
function shell(kit, door) {
  const { block } = kit;
  kit.box(17.4, .4, 12.4, PAL.plinth, 0, -.2, 0);
  block(-8.1, -5.62, 8.1, -5.45, 1.25, PAL.wall);
  block(-8.1, -5.62, -7.95, 5.62, 1.25, PAL.wall);
  block(7.95, -5.62, 8.1, 5.62, .32, PAL.wall);
  block(-8.1, 5.45, door[0], 5.62, .32, PAL.wall);
  block(door[1], 5.45, 8.1, 5.62, .32, PAL.wall);
}
function plant(kit, x, z) {
  kit.block(x - .22, z - .22, x + .22, z + .22, .42, PAL.wall);
  const p = new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 0), kit.mat(PAL.plant));
  p.position.set(x, .8, z); p.castShadow = true; kit.add(p);
  kit.blob(x, z, .9, .9, .5);
}
function pendant(kit, x, z, y = 2.38) {
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 1.0, 4), kit.mat(0x111113)); cord.position.set(x, y + .57, z); kit.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(.2, .18, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x1f1f23, emissive: PAL.lamp, emissiveIntensity: .12, side: THREE.DoubleSide, flatShading: true }));
  shade.position.set(x, y, z); kit.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
  bulb.position.set(x, y - .09, z); kit.add(bulb);
}

const MEDIOS = (activo, monto) =>
  ['Efectivo', 'Tarjeta', 'Transferencia'].map((m) => `<span class="dse-m${m === activo ? ' on' : ''}">${m}</span>`).join('') + `<br><i>${monto}</i> <span class="dse-s">registrado</span>`;

// Sillón de barbero: el cliente queda sentado mirando al espejo (hacia el fondo)
function barberChair(kit, x, z) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, .12, 12), kit.mat(PAL.steel)); base.position.set(x, .06, z); base.castShadow = true; kit.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .3, 8), kit.mat(PAL.steel)); post.position.set(x, .24, z); kit.add(post);
  kit.block(x - .26, z - .24, x + .26, z + .26, .1, 0x2c2c31, .38);
  kit.block(x - .26, z + .18, x + .26, z + .28, .62, 0x2c2c31, .48);
  [-1, 1].forEach((s) => kit.block(x + s * .3 - .04, z - .2, x + s * .3 + .04, z + .22, .05, 0x2c2c31, .62));
  kit.block(x - .2, z - .55, x + .2, z - .42, .05, PAL.steel, .14);
  kit.blob(x, z, 1.1, 1.1, .5);
}
function mirror(kit, x) {
  kit.box(1.1, .66, .05, 0x3a3f46, x, .9, -5.42);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(.98, .56), new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: .15, metalness: .6 }));
  glass.position.set(x, .9, -5.39); kit.add(glass);
  kit.box(1.14, .03, .07, PAL.wood, x, 1.24, -5.41);
}
function trolley(kit, x, z) {
  kit.block(x - .2, z - .2, x + .2, z + .2, .75, PAL.furn2);
  [-.1, .05].forEach((dx, i) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .16, 8), kit.mat(i ? 0x6a5f55 : 0x58606a)); b.position.set(x + dx, .83, z); kit.add(b); });
}

function qrTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 84;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f5'; g.fillRect(0, 0, 84, 84);
  g.fillStyle = '#111113';
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) if (rnd() > .52) g.fillRect(8 + x * 4, 8 + y * 4, 4, 4);
  [[8, 8], [56, 8], [8, 56]].forEach(([x, y]) => { g.fillRect(x, y, 20, 20); g.fillStyle = '#f4f4f5'; g.fillRect(x + 4, y + 4, 12, 12); g.fillStyle = '#111113'; g.fillRect(x + 7, y + 7, 6, 6); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}
function phone(kit, x, y, z) {
  kit.box(.1, .015, .18, PAL.wall, x, y, z);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.08, .15), new THREE.MeshBasicMaterial({ color: 0x15151a, toneMapped: false }));
  scr.rotation.x = -PI / 2; scr.position.set(x, y + .009, z); kit.add(scr);
  return scr;
}

const HOUSE = { x: -9.8, z: -.2 };

function mirrorAt(kit, x, zw) {
  kit.box(1.1, .66, .05, 0x3a3f46, x, .9, zw + .03);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(.98, .56), new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: .15, metalness: .6 }));
  glass.position.set(x, .9, zw + .06); kit.add(glass);
  kit.box(1.14, .03, .07, PAL.wood, x, 1.24, zw + .04);
}
// Imagen fija del televisor: un paisaje simple, sin movimiento
function tvTexture() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 54;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 54); sky.addColorStop(0, '#3a4a66'); sky.addColorStop(1, '#8a7a6a');
  g.fillStyle = sky; g.fillRect(0, 0, 96, 54);
  g.fillStyle = '#2c3a33'; g.beginPath(); g.moveTo(0, 40); g.lineTo(30, 26); g.lineTo(58, 38); g.lineTo(80, 24); g.lineTo(96, 34); g.lineTo(96, 54); g.lineTo(0, 54); g.fill();
  g.fillStyle = '#d9c9a0'; g.beginPath(); g.arc(70, 14, 5, 0, PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Teléfono del profesional en su propio soporte, separado de las herramientas
function phoneStand(kit, x, zw) {
  kit.box(.34, .04, .16, PAL.furn, x, 1.0, zw + .1);
  kit.box(.15, .26, .03, 0x111113, x, 1.15, zw + .1);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.12, .22), new THREE.MeshBasicMaterial({ color: 0x15151a, toneMapped: false }));
  scr.position.set(x, 1.15, zw + .118); kit.add(scr);
  return scr;
}

function buildServicios(kit) {
  const { block, box, blob } = kit;
  // local compacto 11 × 8, entrada en el frente derecho como al principio
  const DOOR = [2.0, 3.4];
  kit.box(11.8, .4, 8.8, PAL.plinth, 0, -.2, 0);
  block(-5.6, -4.12, 5.6, -3.95, 1.25, PAL.wall);
  block(-5.6, -4.12, -5.45, 4.12, 1.25, PAL.wall);
  block(5.45, -4.12, 5.6, 4.12, .32, PAL.wall);
  block(-5.6, 3.95, DOOR[0], 4.12, .32, PAL.wall);
  block(DOOR[1], 3.95, 5.6, 4.12, .32, PAL.wall);
  kit.floor(-5.45, -3.95, 5.45, 3.95, PAL.floor);
  kit.floor(-5.45, -3.95, 3.2, -1.9, PAL.kitchen);
  kit.box(1.4, .02, .9, 0x2a2622, 2.7, .012, 3.45);

  // vereda
  kit.box(24.6, .3, 1.6, 0x232327, -.3, -.15, 5.2);
  kit.box(24.6, .06, .08, 0x2a2a2e, -.3, .03, 5.98);
  [-4.4, 6.4].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, 1.6, 6), kit.mat(0x2a2a2e)); post.position.set(x, .8, 5.85); post.castShadow = true; kit.add(post);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })); head.position.set(x, 1.62, 5.85); kit.add(head);
  });

  // casa: sillón mirando al televisor
  const H = HOUSE;
  kit.box(4.4, .3, 4.0, 0x111114, H.x, -.15, H.z);
  const hf = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.8), kit.mat(0x1d1a18, { roughness: .95 }));
  hf.rotation.x = -PI / 2; hf.position.set(H.x, .004, H.z); hf.receiveShadow = true; kit.add(hf);
  block(H.x - 2.2, H.z - 2.0, H.x + 2.2, H.z - 1.85, .9, PAL.wall);
  block(H.x - 2.2, H.z - 2.0, H.x - 2.05, H.z + 2.0, .9, PAL.wall);
  // sillón contra el frente, mirando al televisor del fondo
  block(H.x - .95, H.z + .75, H.x + .95, H.z + 1.4, .42, 0x4a4540);
  block(H.x - .95, H.z + 1.38, H.x + .95, H.z + 1.55, .72, 0x4a4540);
  block(H.x - .3, H.z - .25, H.x + .3, H.z + .25, .38, PAL.wood);
  block(H.x - .75, H.z - 1.85, H.x + .75, H.z - 1.45, .45, PAL.furn);
  box(1.12, .62, .06, 0x111113, H.x, .82, H.z - 1.62);
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.02, .56), new THREE.MeshBasicMaterial({ map: kit.tex.tv, toneMapped: false, color: 0x8a8a8a }));
  tv.position.set(H.x, .82, H.z - 1.585); kit.add(tv);
  plant(kit, H.x + 1.6, H.z - 1.5);
  kit.box(.6, .3, 3.4, 0x232327, H.x + .8, -.15, 3.9);
  blob(H.x, H.z + 1.1, 2.2, 1.2, .45); blob(H.x, H.z - 1.65, 1.8, .8, .4);

  // puestos con el teléfono de cada profesional en su soporte
  [.8, -2.6].forEach((x) => { mirrorAt(kit, x, -3.95); barberChair(kit, x, -2.6); pendant(kit, x, -2.4, 2.5); });
  trolley(kit, 1.9, -3.5); trolley(kit, -1.5, -3.5);
  const phones = { martin: phoneStand(kit, 2.0, -3.95), diego: phoneStand(kit, -1.4, -3.95) };
  block(-.98, -3.95, -.82, -2.3, 1.0, PAL.wall);
  plant(kit, -4.9, -3.4);

  // espera: sillón a la izquierda del QR, mirando a los puestos
  block(-1.0, 3.2, 1.2, 3.75, .42, PAL.furn2);
  block(-1.0, 3.72, 1.2, 3.92, .82, PAL.furn2);
  block(-1.15, 3.25, -.98, 3.9, .58, PAL.furn2); block(1.18, 3.25, 1.35, 3.9, .58, PAL.furn2);
  blob(.1, 3.5, 2.8, 1.1, .45);

  // café y refrigerios contra la pared izquierda
  block(-5.45, -1.0, -4.95, 1.0, .92, PAL.wood);
  box(.5, .04, 2.0, PAL.furn2, -5.2, .94, 0);
  box(.26, .34, .24, 0x2a2a2e, -5.22, 1.13, -.55);
  box(.08, .05, .02, 0xd9473a, -5.08, 1.22, -.55);
  [[-5.1, -.15], [-5.1, .0], [-5.25, -.08]].forEach(([x, z]) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.035, .03, .08, 8), kit.mat(0xf0efed)); c.position.set(x, 1.0, z); kit.add(c);
  });
  box(.36, .07, .26, PAL.wood, -5.15, .99, .45);
  [[-5.22, .4], [-5.1, .48], [-5.15, .36]].forEach(([x, z], i) => box(.07, .05, .07, [0xc98a4a, 0xb37a3e, 0xd9a35c][i], x, 1.05, z));
  block(-5.45, 1.05, -4.95, 1.45, 1.0, 0xd8d6d2);
  box(.02, .5, .3, 0x111113, -4.94, .62, 1.25);
  blob(-5.2, .2, 1.0, 2.8, .45);
  pendant(kit, -4.9, 0, 2.3);

  // estantería con productos en la esquina del fondo derecha
  block(3.3, -3.95, 5.45, -3.88, 1.75, PAL.furn2);
  block(5.05, -3.88, 5.45, -2.2, .06, PAL.furn2);
  const PROD = [0x3d6b8f, 0xc0643e, 0xe0ac3c, 0x6f8f5a, 0xf0efed, 0x8a5a7a];
  [.45, .9, 1.35].forEach((y, k) => {
    box(2.1, .04, .38, PAL.wood, 4.35, y, -3.7);
    for (let i = 0; i < 9; i++) {
      const h = .14 + .06 * ((i + k) % 3), x = 3.45 + i * .22;
      if (i % 2) box(.12, h, .12, PROD[(i + k) % 6], x, y + .02 + h / 2, -3.7);
      else { const b = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, h, 8), kit.mat(PROD[(i + 2 * k) % 6])); b.position.set(x, y + .02 + h / 2, -3.7); b.castShadow = true; kit.add(b); }
    }
  });
  block(5.08, -3.88, 5.45, -2.2, 1.4, PAL.furn2);
  [.5, .95].forEach((y, k) => {
    box(.34, .04, 1.6, PAL.wood, 5.25, y, -3.05);
    for (let i = 0; i < 6; i++) box(.12, .16, .12, PROD[(i + k + 3) % 6], 5.22, y + .1, -3.7 + i * .26);
  });
  blob(4.4, -3.4, 2.4, 1.2, .4);

  // oficina compacta en la esquina delantera izquierda, con divisiones bajas
  block(-5.45, 1.55, -3.4, 1.65, .55, PAL.wall);
  block(-3.4, 1.55, -3.3, 2.6, .55, PAL.wall);
  block(-5.4, 2.05, -4.85, 3.5, .78, PAL.wood);
  box(.04, .4, .62, PAL.wall, -5.05, 1.06, 2.75);
  box(.08, .2, .08, PAL.wall, -5.1, .86, 2.75);
  const officeScreen = new THREE.Mesh(new THREE.PlaneGeometry(.56, .34), new THREE.MeshBasicMaterial({ color: 0x1a2340, toneMapped: false }));
  officeScreen.position.set(-5.025, 1.06, 2.75); officeScreen.rotation.y = PI / 2; kit.add(officeScreen);
  block(-4.55, 2.5, -4.05, 3.0, .45, PAL.furn2);
  block(-4.08, 2.5, -3.98, 3.0, .7, PAL.furn2);
  blob(-4.6, 2.75, 1.8, 1.8, .45);
  pendant(kit, -4.6, 2.75, 2.3);

  // QR en el marco de la entrada, mirando a quien entra
  const qrPost = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.1, 6), kit.mat(PAL.steel)); qrPost.position.set(1.75, .55, 3.55); kit.add(qrPost);
  box(.05, .36, .36, PAL.wall, 1.75, 1.2, 3.55);
  const qr = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3), new THREE.MeshBasicMaterial({ map: kit.tex.qr, toneMapped: false }));
  qr.position.set(1.78, 1.2, 3.55); qr.rotation.y = PI / 2; kit.add(qr);
  blob(1.75, 3.55, .5, .5, .4);

  // caja junto al lateral derecho de la entrada
  block(4.2, 1.6, 4.7, 3.4, 1.0, PAL.wood);
  box(.56, .05, 1.84, PAL.furn2, 4.45, 1.02, 2.5);
  box(.26, .03, .36, PAL.wall, 4.45, 1.06, 2.0);
  const agendaScreen = new THREE.Mesh(new THREE.PlaneGeometry(.2, .3), new THREE.MeshBasicMaterial({ color: 0x15151a, toneMapped: false }));
  agendaScreen.rotation.x = -PI / 2; agendaScreen.position.set(4.45, 1.08, 2.0); kit.add(agendaScreen);
  box(.3, .2, .36, PAL.wall, 4.45, 1.12, 3.0);
  box(.3, .24, .05, PAL.wall, 4.6, 1.33, 3.0);
  const cajaScreen = new THREE.Mesh(new THREE.PlaneGeometry(.18, .26), new THREE.MeshBasicMaterial({ color: 0x15151a, toneMapped: false }));
  cajaScreen.position.set(4.63, 1.34, 3.0); cajaScreen.rotation.y = PI / 2; kit.add(cajaScreen);
  blob(4.45, 2.5, 1.1, 2.4, .5);
  pendant(kit, 4.45, 2.5, 2.5);

  const CH = { x: .8, z: -2.6 }, LEFT = [.1, -2.15, 2.09], RIGHT = [1.5, -2.15, -2.09];
  const AG = [4.45, 1.08, 2.0], REG = [4.45, 1.25, 3.0];
  const CLIENT_CAJA = [3.65, 2.5], STAFF_CAJA = [5.05, 2.5];
  const SEAT = [.5, 3.45], QRSPOT = [2.3, 3.4];
  const PH = { martin: [2.0, 1.15, -3.82], diego: [-1.4, 1.15, -3.82] };

  // ----- personajes (nombre y color fijos)
  const main = [
    {
      name: 'martin', color: PAL.staff, apron: true, speed: 1.15,
      start: { x: RIGHT[0], z: RIGHT[1], f: RIGHT[2] },
      steps: [
        { t: .2, g: 'cut', dur: 2.6 },
        { g: 'hold', dur: .8, mark: 'martinTermina' },
        { d: .6, walk: [[2.4, -1.2], [4.9, .8], [STAFF_CAJA[0], STAFF_CAJA[1]]], f: F.W, speed: 1.1, mark: 'martinEnCaja' },
        { t: '@lucasEnCaja+1.0', g: 'tap', dur: 1.0, mark: 'cobro1' },
        { t: '@cobro1+1.8', walk: [[4.95, 1.2], [3.6, .9], [1.3, 2.0], [.5, 2.45]], f: F.S, speed: 1.15, mark: 'martinEnEspera' },
        { g: 'greet', dur: 1.0 },
        { t: '@martinEnEspera+1.3', walk: [[-.1, 1.8], [-.4, -.6], [-.3, -1.6], [LEFT[0], LEFT[1]]], f: LEFT[2], speed: 1.05, mark: 'martinEnPuesto' },
        // el salto a las 16:30 deja el corte de Tomás terminado: Martín acomoda su puesto
        { t: '@salto2+0.1', walk: [[1.6, -1.95]], f: -2.4, speed: .9 },
        { t: '@brunoEnCaja-3.0', walk: [[2.6, -1.0], [4.9, .8], [STAFF_CAJA[0], STAFF_CAJA[1]]], f: F.W, speed: 1.05 },
        { t: '@brunoEnCaja+1.2', g: 'tap', dur: 1.0, mark: 'asigna' },
        { d: .5, walk: [[4.95, 1.2], [3.4, .4], [2.0, -1.2], [RIGHT[0], RIGHT[1]]], f: RIGHT[2], speed: 1.05, mark: 'martinListo' },
      ],
      gestures: [
        { t0: '@lucasEnCaja', t1: '@cobro1', type: 'talk' },
        { t0: '@tomasEnSillon+0.3', t1: '@salto2+1.0', type: 'cut' },
        { t0: '@salto2+1.1', t1: '@brunoEnCaja-3.0', type: 'cook' },
        { t0: '@brunoSentado+0.3', t1: 999, type: 'cut' },
      ],
    },
    {
      name: 'lucas', color: 0x8aa37a, speed: 1.15, carry: ['box'],
      start: { x: CH.x, z: CH.z, f: F.N, sit: 1 },
      steps: [
        { t: '@martinTermina+0.3', sit: 0 },
        // antes de pagar pasa por la estantería y se lleva un producto
        { walk: [[1.3, -1.9], [3.2, -2.3], [4.3, -3.0]], f: F.N, speed: 1.05, mark: 'lucasEstante' },
        { g: 'pick', dur: 1.3 },
        { carry: 'box' },
        { walk: [[4.0, -1.2], [3.3, 1.4], [CLIENT_CAJA[0], CLIENT_CAJA[1]]], f: F.E, speed: 1.1, mark: 'lucasEnCaja' },
        { t: '@cobro1+1.0', walk: [[3.0, 3.3], [2.7, 4.0], [2.7, 4.7], [3.6, 5.2], [10.8, 5.2]], speed: 1.25 },
        { fade: 0, walk: [[12.0, 5.2]], speed: 1.0 },
      ],
      gestures: [
        { t0: 0, t1: '@martinTermina', type: 'listen' },
        { t0: '@lucasEnCaja+0.2', t1: '@cobro1-0.1', type: 'pay' },
      ],
    },
    {
      name: 'tomas', color: PAL.prota2, speed: 1.25,
      start: { x: -.6, z: 5.2, f: F.E, fade: 0 },
      steps: [
        { t: .3, fade: 1, walk: [[1.9, 5.2], [2.7, 4.7], [2.7, 3.7]], speed: 1.3, mark: 'tomasPuerta' },
        { walk: [[QRSPOT[0], QRSPOT[1]]], f: F.W, speed: .9 },
        { g: 'tap', dur: 1.1, mark: 'qr' },
        { d: .4, walk: [[1.5, 2.85], [.5, 2.85], [SEAT[0], SEAT[1]]], f: F.N, speed: .95 },
        { sit: 1, mark: 'tomasEspera' },
        { t: '@martinEnEspera+0.6', sit: 0 },
        { t: '@martinEnEspera+2.2', walk: [[.6, 2.75], [1.6, 1.6], [1.9, -1.2], [2.0, -2.55], [CH.x, CH.z]], f: F.N, speed: 1.05 },
        { sit: 1, mark: 'tomasEnSillon' },
        { t: '@salto2+0.45', fade: 0 },
        { d: .6, place: [-14, 5.2, F.W] },
      ],
      gestures: [
        { t0: '@tomasEspera', t1: '@martinEnEspera', type: 'listen' },
        { t0: '@martinEnEspera', t1: '@martinEnEspera+1.5', type: 'talk' },
        { t0: '@tomasEnSillon', t1: 999, type: 'listen' },
      ],
    },
    {
      name: 'ana', color: 0xc98aa0, carry: ['phone'],
      start: { x: H.x, z: H.z + 1.05, f: F.N, sit: 1 },
      steps: [
        { t: '@tomasEnSillon+0.6', carry: 'phone' },
        { d: .5, g: 'write', dur: 2.4, mark: 'reserva' },
        { d: .8, carry: null },
      ],
      gestures: [{ t0: 0, t1: 999, type: 'listen' }],
    },
    {
      name: 'juan', color: 0xb39b4c, carry: ['phone'], speed: 1.25,
      start: { x: -4.6, z: 5.2, f: F.E, fade: 0 },
      steps: [
        { t: '@salto1+0.9', fade: 1, walk: [[.6, 5.2]], f: F.N, speed: 1.25, mark: 'juanSeDetiene' },
        { carry: 'phone', g: 'write', dur: 1.6, mark: 'cancela' },
        { d: .6, carry: null, fadeAt: ['@salto2+0.5', 0] },
        { walk: [[10.8, 5.2]], speed: 1.25, mark: 'juanSale' },
      ],
    },
    {
      name: 'bruno', color: 0x4f8f86, speed: 1.25,
      start: { x: -4.4, z: 5.2, f: F.E, fade: 0 },
      steps: [
        { t: '@salto2+0.9', fade: 1, walk: [[1.9, 5.2], [2.7, 4.7], [2.7, 3.6]], speed: 1.25, mark: 'brunoPuerta' },
        { walk: [[3.1, 2.8], [CLIENT_CAJA[0], CLIENT_CAJA[1]]], f: F.E, speed: 1.0, mark: 'brunoEnCaja' },
        { t: '@asigna+1.5', walk: [[2.8, 2.0], [.8, .9], [-.3, -1.4], [-.3, -2.5], [CH.x, CH.z]], f: F.N, speed: 1.1 },
        { sit: 1, mark: 'brunoSentado' },
      ],
      gestures: [{ t0: '@brunoEnCaja', t1: '@asigna+0.8', type: 'talk' }, { t0: '@brunoSentado', t1: 999, type: 'listen' }],
    },
    {
      name: 'duenio', color: 0x7a3b45, speed: .9,
      start: { x: -4.3, z: 2.75, f: F.W, sit: 1 },
      steps: [
        { t: '@fx:resumen+0.4', g: 'read', dur: 2.2 },
        { sit: 0 },
        { walk: [[-4.3, 3.35], [-3.0, 3.3]], f: -1.0, speed: .8, mark: 'duenioSupervisa' },
        { t: '@duenioSupervisa+3.5', walk: [[-4.3, 3.35], [-4.3, 2.75]], f: F.W, speed: .8 },
        { sit: 1, mark: 'duenioVuelve' },
        // más tarde se levanta a buscar un café y vuelve a su escritorio
        { t: '@saltoFin2+1.0', sit: 0 },
        { walk: [[-4.3, 3.35], [-3.0, 3.3], [-2.8, 1.3], [-4.45, .1]], f: F.W, speed: 1.0, mark: 'duenioCafe' },
        { g: 'hold', dur: 2.0 },
        { walk: [[-2.8, 1.3], [-3.0, 3.3], [-4.3, 3.35], [-4.3, 2.75]], f: F.W, speed: 1.0 },
        { sit: 1, mark: 'duenioVuelve2' },
      ],
      gestures: [
        { t0: .3, t1: '@fx:resumen+0.4', type: 'tap' },
        { t0: '@duenioSupervisa', t1: '@duenioSupervisa+3.5', type: 'browse' },
        { t0: '@duenioVuelve', t1: '@saltoFin2+1.0', type: 'tap' },
        { t0: '@duenioVuelve2', t1: 999, type: 'write' },
      ],
    },
  ];

  // ----- fondo: Diego atiende a Pablo
  const loops = [
    { name: 'pablo', color: 0x6f7f95, period: 26, start: { x: -2.6, z: -2.6, f: F.N, sit: 1 }, steps: [], gestures: [{ t0: 0, t1: 26, type: 'listen' }] },
    {
      name: 'diego', color: PAL.staff, apron: true, speed: .8, period: 26,
      start: { x: -3.3, z: -2.15, f: 2.09 },
      steps: [
        { t: .5, g: 'cut', dur: 7.0 },
        { walk: [[-2.6, -1.75], [-1.9, -2.15]], f: -2.09, speed: .7 },
        { g: 'cut', dur: 7.0 },
        { g: 'hold', dur: 2.0 },
        { walk: [[-2.6, -1.75], [-3.3, -2.15]], f: 2.09, speed: .7 },
      ],
    },
  ];
  const extras = [];

  // ----- Dico: una intervención por vez
  const fx = [
    { id: 'qr', from: [1.75, 1.2, 3.55], to: AG, t0: '@qr-0.2', dur: 1.0, slot: 0, moment: 'llegada', pulse: [3.6, 2.0] },
    { id: 'qrM', from: [1.75, 1.2, 3.55], to: PH.martin, t0: '@qr-0.2', dur: 1.0, slot: 1, moment: 'llegada', pulse: [2.0, -3.2], ringScale: .45 },
    { id: 'cobro', from: null, to: REG, t0: '@cobro1', dur: .01, slot: 1, moment: 'llegada', pulse: [3.6, 2.9] },
    { id: 'resumen', from: REG, to: [-5.0, 1.06, 2.75], t0: '@cobro1+1.4', dur: 1.8, slot: 0, moment: 'llegada', pulse: [-4.5, 2.1] },
    { id: 'reserva', from: [H.x + .05, 1.02, H.z + .78], to: AG, t0: '@reserva', dur: 2.8, slot: 0, moment: 'reserva', pulse: [3.6, 2.0] },
    { id: 'tel1', from: AG, to: PH.martin, t0: '@fx:reserva+0.4', dur: 1.4, slot: 1, moment: 'reserva', pulse: [2.0, -3.2], ringScale: .45 },
    { id: 'tel2', from: AG, to: PH.diego, t0: '@fx:tel1+0.3', dur: 1.6, slot: 0, moment: 'reserva', pulse: [-1.4, -3.2], ringScale: .45 },
    { id: 'cancel', from: [.75, 1.05, 5.05], to: AG, t0: '@cancela', dur: 1.6, slot: 0, moment: 'cancelacion', pulse: [3.6, 2.0], tone: 'red' },
    { id: 'cancelM', from: [.75, 1.05, 5.05], to: PH.martin, t0: '@cancela', dur: 1.6, slot: 1, moment: 'cancelacion', pulse: [2.0, -3.2], ringScale: .45, tone: 'red' },
    { id: 'cancelD', from: [.75, 1.05, 5.05], to: PH.diego, t0: '@cancela', dur: 1.6, slot: 1, moment: 'cancelacion', pulse: [-1.4, -3.2], ringScale: .45, tone: 'red' },
    { id: 'asigna', from: null, to: AG, t0: '@asigna', dur: .01, slot: 1, moment: 'recuperado', pulse: [3.6, 2.0] },
  ];

  const derived = [
    ['salto1', (M) => (M['fx:tel2'] ?? 0) + 2.6],
    ['saltoFin1', (M) => (M.salto1 ?? 0) + 2.0],
    ['salto2', (M) => (M['fx:cancel'] ?? 0) + 4.8],
    ['saltoFin2', (M) => (M.salto2 ?? 0) + 2.0],
  ];
  const loopEnd = '@brunoSentado+4.0';
  const historias = {};

  const moments = [
    { id: 'llegada', start: 0, end: '@martinEnEspera', hold: '@fx:qr+0.5', zones: ['caja'] },
    { id: 'reserva', start: '@martinEnEspera', end: '@salto1', hold: '@fx:tel1+0.3', zones: ['casa'] },
    { id: 'cancelacion', start: '@salto1', end: '@salto2', hold: '@fx:cancel+0.6', zones: ['caja'] },
    { id: 'recuperado', start: '@salto2', end: '@T', hold: '@fx:asigna+0.6', zones: ['caja'] },
  ];

  const chips = [
    { t: '@cobro1+0.1', until: '@fx:resumen', at: [4.45, 1.95, 3.0], align: 'l', html: '<b>Cobro registrado</b>Lucas · corte + producto · <i>$ 18.500</i>', short: 'Lucas · <i>$ 18.500</i>' },
    { t: '@fx:resumen+0.15', until: '@duenioSupervisa+2', at: [-5.0, 1.9, 2.75], align: 'l', html: '<b>Resumen del día</b>Servicios 6 → 7 · Productos 2 → 3 · Ingresos $ 72.000 → $ 90.500', short: 'Servicios 6 → 7' },
    { t: '@reserva-0.2', until: '@fx:reserva+0.3', at: [H.x - .3, 2.0, H.z + 1.0], align: 'l', html: '<b>Reserva online</b>17:00 · Martín' },
    { t: '@fx:tel1+0.1', until: '@salto1', at: [2.0, 1.75, -3.82], align: 'l', html: '<b>Nuevo turno</b>17:00 · Martín', short: '17:00 · Martín' },
    { t: '@cancela-0.2', until: '@fx:cancel+1.2', at: [1.3, .6, 5.6], align: 'r', html: '<b>Cancela su turno</b>16:30 · Juan' },
    { t: '@asigna+0.1', until: '@brunoSentado', at: [4.45, 1.95, 2.0], align: 'l', html: '<b>Turno asignado</b>16:30 · Bruno' },
  ];

  const zones = [
    { id: 'caja', label: 'Caja', at: [4.95, .45, 3.8] },
    { id: 'oficina', label: 'Oficina', at: [-4.4, .9, 3.95] },
    { id: 'casa', label: 'Casa', at: [H.x + .6, 1.4, H.z - 1.9] },
  ];

  const lights = {
    pools: [[.8, -2.4], [-2.6, -2.4], [4.45, 2.5]].map(([x, z]) => ({ c: 0xffb468, i: 11, d: 6, p: [x, 2.4, z] })),
    extra: [
      { c: 0xffd2a0, i: 6, d: 5, p: [-4.4, 2.2, 2.6] },
      { c: 0xffc68a, i: 5, d: 5, p: [.2, 2.3, 3.0] },
      { c: 0xffc68a, i: 4, d: 4, p: [-4.8, 2.2, 0] },
      { c: 0xffd2a0, i: 4, d: 4, p: [4.4, 2.0, -3.0] },
      { c: 0xffd2a0, i: 9, d: 10, p: [0, 2.4, 5.6] },
      { c: 0xffb468, i: 7, d: 5.5, p: [H.x + .3, 1.9, H.z + .6] },
    ],
  };

  const SH = {
    general: { tx: -2.1, tz: .5, r: .95, th: 0, ph: 0 },
    entrada: { tx: 1.4, tz: 3.0, r: .76, th: .04, ph: 0 },
    qr: { tx: 2.4, tz: 2.4, r: .74, th: .05, ph: 0 },
    caja: { tx: 3.0, tz: 1.6, r: .76, th: .05, ph: 0 },
    oficina: { tx: -2.6, tz: 1.8, r: .8, th: -.02, ph: -.03 },
    espera: { tx: .2, tz: 2.0, r: .8, th: -.02, ph: 0 },
    puesto: { tx: .2, tz: -2.6, r: .66, th: -.06, ph: .02 },
    casa: { tx: -8.4, tz: .5, r: .8, th: -.08, ph: -.02 },
    enlace: { tx: -3.0, tz: .9, r: 1.05, th: -.03, ph: -.03 },
    telefonos: { tx: -3.6, tz: -.4, r: 1.0, th: -.04, ph: -.04 },
    vereda: { tx: 1.6, tz: 3.2, r: .88, th: .02, ph: 0 },
    aviso: { tx: .9, tz: .2, r: .92, th: .02, ph: -.02 },
    salida: { tx: 2.6, tz: 2.4, r: .95, th: .03, ph: 0 },
  };
  const shots = [
    { from: 0, to: 0, shot: SH.general },
    { from: '@tomasPuerta-2.0', to: '@tomasPuerta', shot: SH.entrada },
    { from: '@fx0:qr', to: '@fx:qr-0.25', shot: SH.aviso },
    { from: '@lucasEnCaja-2.0', to: '@cobro1-0.3', shot: SH.caja },
    { from: '@fx0:resumen', to: '@fx:resumen-0.35', shot: SH.oficina },
    { from: '@duenioSupervisa', to: '@martinEnEspera', shot: SH.espera },
    { from: '@martinEnEspera+2.5', to: '@tomasEnSillon+0.3', shot: SH.puesto },
    { from: '@tomasEnSillon+0.4', to: '@reserva', shot: SH.casa },
    { from: '@fx0:reserva', to: '@fx:reserva-0.4', shot: SH.enlace },
    { from: '@fx:reserva-0.2', to: '@fx:tel1-0.3', shot: SH.telefonos },
    { from: '@salto1', to: '@saltoFin1', shot: SH.general },
    { from: '@juanSeDetiene-3.0', to: '@juanSeDetiene', shot: SH.vereda },
    { from: '@fx0:cancel', to: '@fx:cancel-0.3', shot: SH.aviso },
    { from: '@fx:cancel+3.2', to: '@fx:cancel+5.0', shot: SH.salida },
    { from: '@salto2', to: '@saltoFin2', shot: SH.general },
    { from: '@brunoPuerta-2.5', to: '@brunoPuerta', shot: SH.entrada },
    { from: '@brunoEnCaja-1.2', to: '@brunoEnCaja+0.2', shot: SH.caja },
    { from: '@fx:asigna+1.4', to: '@brunoSentado', shot: SH.puesto },
  ];

  // Reloj: un minuto cada 8 s de recorrido; dos saltos explícitos
  const RATE = 8;
  function clock(t, M) {
    const fmt = (m) => `${16 + Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
    const seg = (t0, base) => base + Math.floor(Math.max(0, t - t0) / RATE);
    const jump = (a, b, from, to, label) => {
      const k = smooth((t - a) / (b - a));
      return { text: fmt(Math.round(from + (to - from) * k)), dim: .92 * Math.sin(PI * k), label };
    };
    if (t < M.salto1) return { text: fmt(seg(0, 0)), dim: 0 };
    if (t < M.saltoFin1) return jump(M.salto1, M.saltoFin1, seg(0, 0), 20, '+15 min · 16:20');
    if (t < M.salto2) return { text: fmt(seg(M.saltoFin1, 20)), dim: 0, label: t < M.saltoFin1 + 2.5 ? '+15 min · 16:20' : null };
    if (t < M.saltoFin2) return jump(M.salto2, M.saltoFin2, seg(M.saltoFin1, 20), 30, '+10 min · 16:30');
    return { text: fmt(seg(M.saltoFin2, 30)), dim: 0, label: t < M.saltoFin2 + 2.5 ? '+10 min · 16:30' : null };
  }

  function agenda(t, M) {
    const S = (s, cls) => ({ s, cls });
    const c = M['fx:cancel'], disp = c + 2.4, as = M['fx:asigna'];
    const r1630 = t < c ? ['Juan', S('Reservado', 'rs'), -99]
      : t < disp ? ['Juan', S('Cancelado', 'cx'), c]
        : t < as ? ['—', S('Disponible', 'dp'), disp]
          : ['Bruno', S('Asignado', 'ok'), as];
    const rows = [
      ['15:30', 'Lucas', t < M['fx:cobro'] ? S('En atención', 'at') : S('Cobrado', 'ok'), M['fx:cobro']],
      ['16:00', 'Tomás', t < M['fx:qr'] ? S('Reservado', 'rs') : S('Llegó', 'll'), M['fx:qr']],
      ['16:30', r1630[0], r1630[1], r1630[2]],
      ['17:00', t < M['fx:reserva'] ? '—' : 'Martín', t < M['fx:reserva'] ? S('Disponible', 'dp') : S('Reservado', 'rs'), M['fx:reserva']],
    ];
    return { title: 'Agenda', rows: rows.map(([h, n, st, at]) => ({ h, n, p: '', st, hot: t >= at && t < at + 2.6, red: st.cls === 'cx' })) };
  }

  function glow(mat, t, at, frozen, base = 0x15151a) {
    const d = t - at;
    let g = d >= 0 ? Math.exp(-d / 1.6) : 0;
    if (frozen) g = Math.max(g, .35);
    mat.color.setHex(base).lerp(TMPC.setHex(PAL.gold), clamp(g));
  }
  function respond(t, M, frozenMoment) {
    const last = ['fx:qr', 'fx:reserva', 'fx:asigna'].map((k) => M[k]).filter((v) => v <= t).pop() ?? -99;
    glow(agendaScreen.material, t, last, false);
    if (t >= M['fx:cancel'] && t < M['fx:cancel'] + 2.4) agendaScreen.material.color.setHex(0xd9473a);
    glow(cajaScreen.material, t, M['fx:cobro'], false);
    glow(officeScreen.material, t, M['fx:resumen'], false, 0x1a2340);
    glow(phones.martin.material, t, t >= M['fx:tel1'] ? M['fx:tel1'] : M['fx:qrM'], frozenMoment === 'reserva');
    glow(phones.diego.material, t, M['fx:tel2'], false);
    if (t >= M['fx:cancel'] && t < M['fx:cancel'] + 2.4) { phones.martin.material.color.setHex(0xd9473a); phones.diego.material.color.setHex(0xd9473a); }
  }

  return { main, loops, extras, fx, derived, loopEnd, historias, moments, chips, zones, lights, shots, respond, clock, agenda };
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
  if (!e.from) return makePulse(kit, e);
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
  const tone = e.tone === 'red' ? 0xd9473a : PAL.gold;
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: tone, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  ring.position.set(e.pulse[0], .035, e.pulse[1]); ring.visible = false; kit.add(ring);
  const discGeo = new THREE.PlaneGeometry(1, 1); discGeo.rotateX(-PI / 2);
  const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ map: e.tone === 'red' ? kit.tex.redGlow : kit.tex.goldGlow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  disc.position.set(e.pulse[0], .03, e.pulse[1]); disc.scale.set(4.2 * (e.ringScale || 1), 1, 4.2 * (e.ringScale || 1)); disc.visible = false; kit.add(disc);
  return { ...e, curve, tube, head, ring, disc, SEG, idx: RAD * 6, lightPos: new THREE.Vector3(e.pulse[0], 2.1, e.pulse[1] + .7), lightColor: tone };
}
// Pulso sin línea: la acción ocurre en el mismo sector que responde (cobro en caja)
function makePulse(kit, e) {
  const ringGeo = new THREE.RingGeometry(.86, 1.0, 56); ringGeo.rotateX(-PI / 2);
  const tone = e.tone === 'red' ? 0xd9473a : PAL.gold;
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: tone, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  ring.position.set(e.pulse[0], .035, e.pulse[1]); ring.visible = false; kit.add(ring);
  const discGeo = new THREE.PlaneGeometry(1, 1); discGeo.rotateX(-PI / 2);
  const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ map: e.tone === 'red' ? kit.tex.redGlow : kit.tex.goldGlow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  disc.position.set(e.pulse[0], .03, e.pulse[1]); disc.scale.set(4.2 * (e.ringScale || 1), 1, 4.2 * (e.ringScale || 1)); disc.visible = false; kit.add(disc);
  return { ...e, tube: null, head: null, ring, disc, lightPos: new THREE.Vector3(e.pulse[0], 2.1, e.pulse[1] + .7), lightColor: tone };
}
function updateFX(f, t, frozen) {
  const u = (t - f._t0) / f.dur;
  const head = easeInOut(u);
  const tail = clamp((t - f._t0 - f.dur * .8) / (f.dur * .7));
  const lineOn = !!f.tube && u > 0 && tail < 1;
  if (f.tube) f.tube.visible = lineOn;
  if (lineOn) {
    const i0 = Math.floor(tail * f.SEG), i1 = Math.max(i0, Math.ceil(head * f.SEG));
    f.tube.geometry.setDrawRange(i0 * f.idx, (i1 - i0) * f.idx);
    f.tube.material.opacity = .95 * (1 - smooth((tail - .6) / .4));
  }
  if (f.head) { f.head.visible = u > 0 && u < 1; if (f.head.visible) f.curve.getPointAt(head, f.head.position); }
  const ta = f._t0 + f.dur, k = (t - ta) / 1.5;
  f.ring.visible = k >= 0 && k < 1;
  if (f.ring.visible) { const s = (.35 + 2.3 * easeOut(k)) * (f.ringScale || 1); f.ring.scale.set(s, 1, s); f.ring.material.opacity = .5 * Math.pow(1 - k, 1.6); }
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
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (mem <= 2 || cores <= 2) return 'baja';
  // celulares y tabletas: nunca 'alta' (resolución máx. 1,35× y sombras de 512 px sin suavizado)
  if (mem <= 4 || cores <= 4 || small || coarse) return 'media';
  return 'alta';
}

// ---------------------------------------------------------------- motor
export const MOMENTOS = { servicios: ['llegada', 'reserva', 'cancelacion', 'recuperado'] };

// Sin WebGL: imagen fija de la escena (si se provee) y un mensaje accesible
function staticFallback(root, stage, opts, notify) {
  root.classList.add('dse-fallback');
  root.removeAttribute('aria-hidden');
  stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', 'Ilustración de una barbería: Dico conecta la llegada con QR, la agenda, las reservas y cancelaciones online, los teléfonos de los barberos, la caja y la oficina del dueño.');
  if (opts.imagenAlternativa) stage.style.backgroundImage = `url("${opts.imagenAlternativa}")`;
  const msg = document.createElement('p'); msg.className = 'dse-fallback-msg';
  msg.textContent = 'La animación 3D no está disponible en este navegador.';
  stage.appendChild(msg);
  notify('sin-webgl');
  let gone = false;
  return {
    set() {},
    dispose() { if (gone) return; gone = true; root.remove(); },
    stats() { return { fps: 0, calidad: 'sin-webgl' }; },
  };
}

export function createDicoScene(container, options = {}) {
  const opts = { onMomento: null, onDisponibilidad: null, imagenAlternativa: null, calidad: 'auto', proporcion: '4 / 3', ...options };
  // avisa el estado de la escena: 'animada' | 'estatica' (movimiento reducido) | 'sin-webgl' | 'contexto-perdido'
  let lastAvail = null, disposed = false;
  const notify = (estado) => {
    if (estado === lastAvail) return;
    lastAvail = estado;
    Promise.resolve().then(() => { if (!disposed && typeof opts.onDisponibilidad === 'function') opts.onDisponibilidad(estado); });
  };

  const root = document.createElement('div');
  root.className = 'dse-root dse-servicios'; root.setAttribute('aria-hidden', 'true');
  const stage = document.createElement('div'); stage.className = 'dse-stage';
  if (opts.proporcion) stage.style.aspectRatio = opts.proporcion; else root.classList.add('dse-fill');
  root.appendChild(stage);
  container.appendChild(root);
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' }); } catch { renderer = null; }
  if (!renderer || !renderer.getContext()) {
    const fb = staticFallback(root, stage, opts, notify);
    return { set: fb.set, stats: fb.stats, dispose() { disposed = true; fb.dispose(); } };
  }
  renderer.setClearColor(PAL.bg, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = SOFT_SHADOW;
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
  Object.assign(key.shadow.camera, { left: -16, right: 11, top: 12, bottom: -12, near: 1, far: 46 });
  scene.add(key);

  const tex = {
    qr: qrTexture(),
    tv: tvTexture(),
    blob: radialTexture([[0, 'rgba(255,255,255,1)'], [.45, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']]),
    voltGlow: radialTexture([[0, 'rgba(120,150,255,.9)'], [.4, 'rgba(61,107,255,.35)'], [1, 'rgba(61,107,255,0)']]),
    redGlow: radialTexture([[0, 'rgba(217,71,58,.8)'], [.45, 'rgba(217,71,58,.25)'], [1, 'rgba(217,71,58,0)']]),
    goldGlow: radialTexture([[0, 'rgba(224,172,60,.85)'], [.45, 'rgba(224,172,60,.28)'], [1, 'rgba(224,172,60,0)']]),
  };
  tex.blob.colorSpace = THREE.NoColorSpace;

  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = !!(mq && mq.matches);

  // calidad adaptable: arranca según el equipo y baja sola si el ritmo de cuadros no alcanza
  const fixedQ = QUALITY[opts.calidad] ? opts.calidad : null;
  let tier = fixedQ || autoQuality();
  let frameEMA = 1 / 60, slowFor = 0, lastDrop = 0;

  let historia = null;
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
    renderer.shadowMap.type = q.soft ? SOFT_SHADOW : THREE.PCFShadowMap;
    key.castShadow = q.shadow;
    key.shadow.mapSize.set(q.map, q.map);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
    resize();
  }

  function teardown() {
    if (!content) return;
    content.zoneEls.forEach((z) => z.el.remove());
    if (content.hud) { content.hud.clockEl.remove(); content.hud.agendaEl.remove(); }
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
    const def = buildServicios(kit);
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
    const moments = def.moments.map((m) => ({ ...m, s: resolve(m.start, M), e: resolve(m.end, M), h: resolve(m.hold, M) }));
    const shots = def.shots.map((s) => ({ from: resolve(s.from, M), to: resolve(s.to, M), shot: s.shot }));
    const ranges = {};
    for (const k in def.historias) ranges[k] = { s: resolve(def.historias[k][0], M), e: resolve(def.historias[k][1], M) };
    // reloj y agenda: fijos en las esquinas superiores, fuera de los personajes
    let hud = null;
    if (def.clock || def.agenda) {
      const clockEl = document.createElement('div'); clockEl.className = 'dse-clock';
      clockEl.innerHTML = '<small>Hoy</small><b>16:00</b><span class="dse-jump"></span>';
      const agendaEl = document.createElement('div'); agendaEl.className = 'dse-agenda';
      stage.insertBefore(clockEl, layer); stage.insertBefore(agendaEl, layer);
      hud = { clockEl, agendaEl, timeEl: clockEl.querySelector('b'), jumpEl: clockEl.querySelector('.dse-jump'), lastClock: '', lastAgenda: '' };
    }
    content = { group, def, M, T: M.T, fxs, people, extras, gold, zoneEls, chips, moments, shots, ranges, hud };
  }

  function range() { return (historia && content.ranges[historia]) || { s: 0, e: content.T }; }
  function mainTime() { const r = range(), L = r.e - r.s; return r.s + (((storyTime % L) + L) % L); }
  function momentAt(t) { const ms = content.moments; for (let i = 0; i < ms.length; i++) if (t < ms[i].e) return i; return ms.length - 1; }
  function frozenHold(idx) { const r = range(), L = r.e - r.s; storyTime = Math.floor(storyTime / L) * L + (content.moments[idx].h - r.s); }

  function enterMoment(idx) {
    lastIdx = idx;
    const m = content.moments[idx];
    content.zoneEls.forEach((z) => { z.on = m.zones.includes(z.id); });
    // informa el momento visible: en la historia automática, en pausa y con movimiento reducido
    const report = m.id;
    if (report !== lastReported && typeof opts.onMomento === 'function') opts.onMomento(report);
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
    // reloj y agenda ocupan esquinas fijas: fichas y rótulos las esquivan
    const hudRects = content.hud ? [content.hud.clockEl, content.hud.agendaEl].map((e) => ({ l: e.offsetLeft - 6, t: e.offsetTop - 6, w: e.offsetWidth + 12, h: e.offsetHeight + 12 })) : [];
    rects.push(...hudRects);
    content.chips.forEach((c) => {
      const on = t >= c.t0 && t < c.t1 && (!narrow || c === latest);
      if (on !== c.on) { c.on = on; c.el.classList.toggle('on', on); }
      if (!on) return;
      if (!c.w) { c.w = c.el.offsetWidth; c.h = c.el.offsetHeight; }
      const [x, y] = project(c.v);
      let l = c.align === 'r' ? x - c.w + 10 : c.align === 'l' ? x - 10 : x - c.w / 2;
      l = clamp(l, 6, W - c.w - 6);
      let tp = clamp(y - c.h, 6, H - c.h - 6);
      for (const r of hudRects) if (hit({ l, t: tp, w: c.w, h: c.h }, r)) tp = Math.min(H - c.h - 6, r.t + r.h + 2);
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
      L.position.copy(f.lightPos); L.color.setHex(f.lightColor || PAL.gold); L.intensity = 14 * best[i] * (f.ringScale || 1);
    });
  }

  function frame(now) {
    raf = 0;
    if (destroyed || !content || lost) return;
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0;
    last = now;
    const playing = fixedIdx < 0 && !reduced;
    if (playing) storyTime += dt;
    const t = mainTime();
    const idx = fixedIdx >= 0 ? fixedIdx : momentAt(t);
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
      const frozenId = fixedIdx >= 0 ? content.moments[fixedIdx].id : (reduced ? content.moments[idx].id : null);
      updatePeople(t, blendK);
      content.def.respond(t, content.M, frozenId);
      updateLightsFX(t, frozenId);
      placeCam(shotNow);
      renderer.render(scene, camera);
      if (updateOverlay(t, dt)) active = true;
      let jumpDim = 0;
      if (content.hud) {
        const c = content.def.clock(t, content.M);
        if (c.text !== content.hud.lastClock) { content.hud.timeEl.textContent = c.text; content.hud.lastClock = c.text; }
        if (c.label && c.label !== content.hud.lastLabel) { content.hud.jumpEl.textContent = c.label; content.hud.lastLabel = c.label; }
        content.hud.jumpEl.classList.toggle('on', !!c.label);
        jumpDim = c.dim ?? .6 * (c.jump || 0);
        const ag = content.def.agenda(t, content.M);
        const rows = Array.isArray(ag) ? ag : ag.rows;
        // con poco ancho la agenda muestra solo la fila que acaba de cambiar (o la última que cambió)
        const compact = W < 440;
        let shown = rows;
        if (compact) {
          const hi = rows.findIndex((r) => r.hot);
          if (hi >= 0) content.hud.lastRow = hi;
          shown = [rows[content.hud.lastRow || 0]];
        }
        const html = (compact ? '' : `<h4>${ag.title || 'Agenda de hoy'}</h4>`) + shown.map((r) => `<div class="r${r.hot ? ' hot' : ''}${r.red ? ' red' : ''}"><span class="h">${r.h}</span><span class="n">${r.n}${r.p ? ` <i>· ${r.p}</i>` : ''}</span><span class="s ${r.st.cls}">${r.st.s}</span></div>`).join('');
        if (html !== content.hud.lastAgenda) { content.hud.agendaEl.innerHTML = html; content.hud.lastAgenda = html; }
      }
      // fundido breve que une el final con el comienzo del recorrido
      let dip = 0;
      if (playing) { const r = range(); dip = t > r.e - .75 ? smooth((t - (r.e - .75)) / .75) : t < r.s + .75 ? 1 - smooth((t - r.s) / .75) : 0; }
      dip = Math.max(dip, jumpDim);
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
  const onVis = () => { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; } else kick(); };
  document.addEventListener('visibilitychange', onVis);
  const onMQ = (e) => { reduced = e.matches; notify(reduced ? 'estatica' : 'animada'); if (content) { if (reduced && fixedIdx < 0) frozenHold(0); lastIdx = -1; } kick(); };
  mq && mq.addEventListener && mq.addEventListener('change', onMQ);
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; if (!onScreen) { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; } else kick(); })
    : null;
  io && io.observe(stage);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro && ro.observe(stage);
  // si el navegador pierde el contexto gráfico, la escena espera a que lo devuelva
  let lost = false;
  const onLost = (e) => { e.preventDefault(); lost = true; if (raf) cancelAnimationFrame(raf); raf = 0; notify('contexto-perdido'); };
  const onRestored = () => { lost = false; notify(reduced ? 'estatica' : 'animada'); applyQuality(); };
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  renderer.domElement.addEventListener('webglcontextrestored', onRestored);

  function set(o = {}) {
    if (destroyed) return;
    const now = performance.now();
    if (!content || o.rubro !== rubro) {
      rubro = o.rubro;
      build();
      historia = o.historia === 'presencial' || o.historia === 'online' ? o.historia : null;
      storyTime = 0; fixedIdx = -1; lastReported = null; blendStart = -1; camBlendStart = -1;
      thetaUser = thetaGoal = 0; phiUser = phiGoal = 0;
      const ids = content.moments.map((m) => m.id);
      fixedIdx = ids.indexOf(o.momento);
      if (fixedIdx >= 0) frozenHold(fixedIdx); else if (reduced) frozenHold(0);
      lastIdx = -1;
      resize();
      return;
    }
    const ids = content.moments.map((m) => m.id);
    const next = ids.indexOf(o.momento);
    const h = o.historia === 'presencial' || o.historia === 'online' ? o.historia : null;
    if (h !== historia) {
      // cambiar de historia arranca esa historia desde su comienzo, con el fundido de entrada
      historia = h; storyTime = 0; fixedIdx = -1; lastIdx = -1; blendStart = -1; camBlendStart = -1;
      if (next >= 0) { fixedIdx = next; frozenHold(next); }
      kick();
      return;
    }
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
    destroyed = true; disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    renderer.domElement.removeEventListener('webglcontextlost', onLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
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
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    root.remove();
  }

  // Lectura de rendimiento para pruebas en dispositivos reales
  function stats() { return { fps: Math.round(1 / frameEMA), calidad: tier }; }

  if (tier !== 'alta') applyQuality(); else resize();
  notify(reduced ? 'estatica' : 'animada');
  return { set, dispose, stats };
}
