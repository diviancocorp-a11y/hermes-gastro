// src/catalog-pro/catalogMusic.js
// Musica ambiente del catalogo: loop a volumen bajo. Arranca en el primer gesto
// del cliente (los navegadores bloquean autoplay con sonido) y recuerda si el
// cliente la apago (localStorage). Singleton a nivel modulo para que NO se corte
// al cambiar de pantalla (catalogo -> carrito -> checkout).
const SRC = "/catalog-music.mp3";
const KEY = "cp_music";   // 'on' | 'off' (default: on)
const VOL = 0.13;

let audio = null;
let wantOn = null;
let inited = false;
let gestureBound = false;
const subs = new Set();

function readWant() {
  if (wantOn === null) {
    try { wantOn = localStorage.getItem(KEY) !== "off"; } catch { wantOn = true; }
  }
  return wantOn;
}
function save() { try { localStorage.setItem(KEY, wantOn ? "on" : "off"); } catch {} }
function notify() { subs.forEach(fn => { try { fn(wantOn); } catch {} }); }

function el() {
  if (!audio) {
    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
  }
  return audio;
}

let fadeId = null;
function fadeTo(target, ms) {
  const a = el();
  if (fadeId) clearInterval(fadeId);
  const start = a.volume, t0 = Date.now();
  fadeId = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms);
    a.volume = start + (target - start) * k;
    if (k >= 1) { clearInterval(fadeId); fadeId = null; if (target === 0) a.pause(); }
  }, 60);
}

function startPlay() {
  const a = el();
  a.play().then(() => fadeTo(VOL, 1400)).catch(() => {});
}

function bindGesture() {
  if (gestureBound) return;
  gestureBound = true;
  const go = () => {
    if (wantOn && audio && audio.paused) startPlay();
    window.removeEventListener("pointerdown", go);
    window.removeEventListener("keydown", go);
    window.removeEventListener("touchstart", go);
  };
  window.addEventListener("pointerdown", go);
  window.addEventListener("keydown", go);
  window.addEventListener("touchstart", go);
}

export function musicOn() { return readWant(); }

export function ensureMusic() {
  readWant();
  if (!inited) {
    inited = true;
    if (wantOn) { startPlay(); bindGesture(); }
    return;
  }
  if (wantOn && audio && audio.paused) startPlay();
}

export function toggleMusic() {
  readWant();
  wantOn = !wantOn;
  save();
  if (wantOn) startPlay();
  else if (audio) fadeTo(0, 400);
  notify();
  return wantOn;
}

export function stopMusic() {
  if (audio && !audio.paused) audio.pause();
}

export function subscribeMusic(fn) { subs.add(fn); return () => subs.delete(fn); }
