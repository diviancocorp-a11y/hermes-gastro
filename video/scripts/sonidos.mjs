// Sintetiza la musica y los efectos del reel en WAV, sin bajar nada de
// internet: todo el audio es propio y no hay licencia que cuidar.
// Salida: video/src/audio/ (en .gitignore). Uso: npm run sonidos
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'audio');

// PRNG con semilla: el mismo script da siempre el mismo audio.
let semilla = 20261106;
const azar = () => {
  semilla = (semilla * 1664525 + 1013904223) >>> 0;
  return semilla / 4294967296;
};
const ruido = () => azar() * 2 - 1;

function escribirWav(nombre, canales) {
  const n = canales[0].length;
  const datos = Buffer.alloc(n * canales.length * 2);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < canales.length; c++) {
      const v = Math.max(-1, Math.min(1, canales[c][i]));
      datos.writeInt16LE(Math.round(v * 32767), (i * canales.length + c) * 2);
    }
  }
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0); cab.writeUInt32LE(36 + datos.length, 4); cab.write('WAVE', 8);
  cab.write('fmt ', 12); cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20);
  cab.writeUInt16LE(canales.length, 22); cab.writeUInt32LE(SR, 24);
  cab.writeUInt32LE(SR * canales.length * 2, 28); cab.writeUInt16LE(canales.length * 2, 32);
  cab.writeUInt16LE(16, 34); cab.write('data', 36); cab.writeUInt32LE(datos.length, 40);
  writeFileSync(join(SALIDA, nombre), Buffer.concat([cab, datos]));
}

const normalizar = (canales, pico = 0.89) => {
  let max = 0;
  for (const c of canales) for (const v of c) max = Math.max(max, Math.abs(v));
  const k = max ? pico / max : 1;
  for (const c of canales) for (let i = 0; i < c.length; i++) c[i] *= k;
  return canales;
};

const buffer = seg => new Float32Array(Math.round(seg * SR));
const nota = midi => 440 * 2 ** ((midi - 69) / 12);

// Suma un tono con barrido de frecuencia y caida exponencial.
function tono(buf, inicio, { f0, f1 = f0, dur, caida, vol = 1, armonico = 0, ataque = 0.002 }) {
  const i0 = Math.round(inicio * SR);
  const n = Math.round(dur * SR);
  let fase = 0;
  for (let i = 0; i < n && i0 + i < buf.length; i++) {
    const t = i / SR;
    const f = f0 * (f1 / f0) ** (t / dur);
    fase += (2 * Math.PI * f) / SR;
    const env = Math.min(1, t / ataque) * Math.exp(-t / caida);
    buf[i0 + i] += vol * env * (Math.sin(fase) + armonico * Math.sin(2 * fase));
  }
}

function soplo(buf, inicio, { dur, caida, vol = 1, filtro = 0.5, agudo = false }) {
  const i0 = Math.round(inicio * SR);
  const n = Math.round(dur * SR);
  let lp = 0; let ant = 0;
  for (let i = 0; i < n && i0 + i < buf.length; i++) {
    const t = i / SR;
    const x = ruido();
    lp += filtro * (x - lp);
    const y = agudo ? x - ant : lp;
    ant = x;
    buf[i0 + i] += vol * Math.exp(-t / caida) * y;
  }
}

// ── Musica: lo-fi a 90 BPM, cuatro acordes, 37 s ──────────────────────────
function musica() {
  const DUR = 37;
  const negra = 60 / 90;
  const compas = negra * 4;
  const L = buffer(DUR);
  const R = buffer(DUR);
  const mono = buffer(DUR);
  // Fmaj7, Em7, Dm7, Cmaj7
  const acordes = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
  const bajos = [41, 40, 38, 36];
  const compases = Math.ceil(DUR / compas);

  for (let b = 0; b < compases; b++) {
    const t0 = b * compas;
    const acorde = acordes[b % 4];
    // Piano electrico: un golpe largo en el 1 y otro corto en el "y" del 3.
    for (const [desplazo, largo, vol] of [[0, compas, 0.16], [negra * 2.5, negra * 1.5, 0.09]]) {
      acorde.forEach((m, k) => {
        const ini = t0 + desplazo + k * 0.012;
        tono(L, ini, { f0: nota(m) * 0.998, dur: largo, caida: 1.1, vol, armonico: 0.25, ataque: 0.01 });
        tono(R, ini + 0.006, { f0: nota(m) * 1.002, dur: largo, caida: 1.1, vol, armonico: 0.25, ataque: 0.01 });
      });
    }
    if (b === 0) continue; // el primer compas entra solo el piano
    tono(mono, t0, { f0: nota(bajos[b % 4]), dur: negra * 1.8, caida: 0.6, vol: 0.32, ataque: 0.01 });
    tono(mono, t0 + negra * 2.5, { f0: nota(bajos[b % 4]), dur: negra, caida: 0.35, vol: 0.24, ataque: 0.01 });
    for (const beat of [0, 2, 2.75]) {
      tono(mono, t0 + beat * negra, { f0: 125, f1: 42, dur: 0.35, caida: 0.16, vol: beat === 2.75 ? 0.4 : 0.6 });
    }
    for (const beat of [1, 3]) {
      soplo(mono, t0 + beat * negra, { dur: 0.25, caida: 0.07, vol: 0.22, filtro: 0.35 });
      tono(mono, t0 + beat * negra, { f0: 190, f1: 160, dur: 0.12, caida: 0.04, vol: 0.12 });
    }
    for (let corchea = 0; corchea < 8; corchea++) {
      const swing = corchea % 2 ? 0.085 : 0;
      soplo(mono, t0 + corchea * negra / 2 + swing, { dur: 0.05, caida: 0.012, vol: corchea % 2 ? 0.05 : 0.08, agudo: true });
    }
  }
  // Crujido de vinilo y siseo de fondo.
  for (let i = 0; i < mono.length; i++) {
    mono[i] += ruido() * 0.004;
    if (azar() < 7 / SR) mono[i] += ruido() * 0.25;
  }
  // Mezcla, filtro pasa bajos suave (lo-fi) y fundido de salida.
  let lpL = 0; let lpR = 0;
  for (let i = 0; i < L.length; i++) {
    lpL += 0.45 * (L[i] + mono[i] - lpL);
    lpR += 0.45 * (R[i] + mono[i] - lpR);
    const t = i / SR;
    const fundido = Math.min(1, (DUR - t) / 2.5);
    L[i] = lpL * fundido;
    R[i] = lpR * fundido;
  }
  escribirWav('musica.wav', normalizar([L, R], 0.85));
}

// ── Efectos de interfaz ───────────────────────────────────────────────────
function efecto(nombre, dur, armar, pico = 0.89) {
  const b = buffer(dur);
  armar(b);
  escribirWav(nombre, normalizar([b], pico));
}

function efectos() {
  efecto('pop.wav', 0.2, b => tono(b, 0, { f0: 900, f1: 380, dur: 0.12, caida: 0.04 }));
  efecto('mensaje.wav', 0.2, b => tono(b, 0, { f0: 1250, f1: 700, dur: 0.12, caida: 0.035 }));
  efecto('toque.wav', 0.08, b => {
    tono(b, 0, { f0: 1600, dur: 0.05, caida: 0.012 });
    soplo(b, 0, { dur: 0.02, caida: 0.004, vol: 0.5, agudo: true });
  });
  efecto('tic.wav', 0.04, b => tono(b, 0, { f0: 2300, dur: 0.03, caida: 0.006 }));
  efecto('aviso.wav', 1, b => {
    tono(b, 0, { f0: nota(84), dur: 0.9, caida: 0.28, armonico: 0.2 });
    tono(b, 0.1, { f0: nota(91), dur: 0.9, caida: 0.32, armonico: 0.2 });
  });
  efecto('alerta.wav', 0.7, b => {
    tono(b, 0, { f0: 660, dur: 0.3, caida: 0.1, armonico: 0.35 });
    tono(b, 0.16, { f0: 520, dur: 0.4, caida: 0.12, armonico: 0.35 });
  });
  efecto('caja.wav', 1.2, b => {
    for (const m of [88, 93, 100]) tono(b, 0, { f0: nota(m), dur: 1.1, caida: 0.35, vol: 0.5 });
    soplo(b, 0, { dur: 0.08, caida: 0.02, vol: 0.4, agudo: true });
  });
  efecto('brillo.wav', 1.2, b => {
    [84, 88, 91, 96].forEach((m, i) => tono(b, i * 0.06, { f0: nota(m), dur: 0.9, caida: 0.3, vol: 0.6 }));
  });
  efecto('soplido.wav', 0.5, b => {
    // Ruido con un pasa bajos que abre y cierra: el "fsss" de un cambio de escena.
    let lp = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / b.length;
      const abre = Math.sin(Math.PI * t);
      lp += (0.02 + 0.25 * abre) * (ruido() - lp);
      b[i] = lp * abre;
    }
  }, 0.6);
}

mkdirSync(SALIDA, { recursive: true });
musica();
efectos();
console.log(`audio generado en ${SALIDA}`);
