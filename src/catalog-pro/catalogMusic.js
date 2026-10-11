// src/catalog-pro/catalogMusic.js
// Musica ambiente del catalogo: loop a volumen muy bajo. Arranca en el primer
// gesto del cliente (scroll / tap / click) porque los navegadores bloquean el
// autoplay con sonido. REINTENTA en cada gesto hasta que play() funciona (no se
// rinde al primer intento). Singleton a nivel modulo: NO se corta al cambiar de
// pantalla (catalogo -> carrito -> checkout).
const DEFAULT_SRC = "/catalog-music.mp3";
let src = DEFAULT_SRC;       // cada negocio puede traer la suya (configureMusic)
let disabled = false;        // settings.catalog_music === false
const KEY = "cp_music";   // 'on' | 'off' (default: on)
const VOL_MAX = 0.12;       // volumen 100 del negocio
const VOL_DEFAULT = 50;     // el de siempre (0.06): pensado para la cancion de Dico, -17 LUFS
let vol = VOL_DEFAULT / 100 * VOL_MAX;

let audio = null;
let wantOn = null;
let inited = false;
let unlockBound = false;
const subs = new Set();
const EVENTS = ["scroll", "wheel", "touchstart", "touchmove", "pointerdown", "mousedown", "keydown", "click"];

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
    audio = new Audio(src);
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
  }, 50);
}

function tryPlay() {
  const a = el();
  return a.play().then(() => { fadeTo(vol, 1400); return true; }).catch(() => false);
}

function bindUnlock() {
  if (unlockBound) return;
  unlockBound = true;
  const handler = () => {
    const done = () => { EVENTS.forEach(e => window.removeEventListener(e, handler, true)); unlockBound = false; };
    if (!wantOn) { done(); return; }
    const a = el();
    if (!a.paused) { done(); return; }
    a.play().then(() => { fadeTo(vol, 1400); done(); }).catch(() => { /* sigue escuchando el proximo gesto */ });
  };
  EVENTS.forEach(e => window.addEventListener(e, handler, { capture: true, passive: true }));
}

export function musicOn() { return readWant(); }

/**
 * La musica del negocio: `url` propia (o la de Dico si falta) y `enabled`.
 * Se llama cuando llegan los settings; si el audio ya existia y la fuente
 * cambio, se cambia sobre la marcha sin cortar el singleton.
 */
export function configureMusic({ url, enabled = true, volume } = {}) {
  disabled = enabled === false;
  const pct = Number.isFinite(Number(volume)) && volume !== null && volume !== '' ? Math.min(100, Math.max(0, Number(volume))) : VOL_DEFAULT;
  vol = pct / 100 * VOL_MAX;
  // Si ya esta sonando, el cambio se escucha de inmediato.
  if (audio && !audio.paused && !disabled) fadeTo(vol, 300);
  const next = url || DEFAULT_SRC;
  if (next !== src) {
    src = next;
    if (audio) {
      const sonaba = !audio.paused;
      audio.src = src;
      audio.load();
      if (sonaba && wantOn && !disabled) tryPlay();
    }
  }
  if (disabled) stopMusic();
}

export function musicDisabled() { return disabled; }

export function ensureMusic() {
  readWant();
  if (disabled) return;
  if (!inited) {
    inited = true;
    if (wantOn) { tryPlay(); bindUnlock(); }
    return;
  }
  if (wantOn && audio && audio.paused) { tryPlay(); bindUnlock(); }
}

export function toggleMusic() {
  readWant();
  wantOn = !wantOn;
  save();
  if (wantOn) { tryPlay(); bindUnlock(); }
  else if (audio) fadeTo(0, 400);
  notify();
  return wantOn;
}

export function stopMusic() {
  if (audio && !audio.paused) audio.pause();
}

export function subscribeMusic(fn) { subs.add(fn); return () => subs.delete(fn); }
