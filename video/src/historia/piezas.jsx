import '../fuentes.js';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Tokens de src/styles/dico-tokens.css. Fondo oscuro de marca; las pantallas
// del producto van en papel claro para que se lean como un telefono real.
export const C = {
  fondo: '#0f0e0d',
  fondo2: '#1a1612',
  texto: '#faf5ee',
  suave: '#a39685',
  linea: '#2d2924',
  oro: '#e0ac3c',
  oroClaro: '#f0c868',
  volt: '#3d6bff',
  papel: '#faf5ee',
  papel2: '#f1ebe0',
  tinta: '#1a1612',
  tinta2: '#6b5d4f',
  ok: '#4fa87f',
  error: '#e2564b',
};

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

export const entra = (frame, desde, dur = 12, dist = 30) => ({
  opacity: interpolate(frame, [desde, desde + dur], [0, 1], clamp),
  transform: `translateY(${interpolate(frame, [desde, desde + dur], [dist, 0], clamp)}px)`,
});

export const pesos = n => `$${Math.round(n).toLocaleString('es-AR')}`;

// Fundido de entrada y salida de cada escena.
export const Escena = ({ dur, children, fondo = C.fondo }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ background: fondo, opacity: o }}>{children}</AbsoluteFill>;
};

// Subtitulo palabra por palabra; las palabras de `resaltar` se marcan en oro.
export const Subtitulo = ({ texto, resaltar = [], cada = 4, top = 170 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{
      position: 'absolute', top, left: 70, right: 70, textAlign: 'center',
      fontFamily: 'Overused Grotesk', fontWeight: 700, fontSize: 82, lineHeight: 1.18,
      color: C.texto, letterSpacing: -1,
    }}>
      {texto.split(' ').map((palabra, i) => {
        const t = i * cada;
        const fuerte = resaltar.includes(palabra.replace(/[.,¿?¡!]/g, '').toLowerCase());
        const marca = fuerte ? interpolate(frame, [t + 3, t + 10], [0, 1], clamp) : 0;
        return (
          <span key={i} style={{
            display: 'inline-block', margin: '4px 10px',
            opacity: interpolate(frame, [t, t + 6], [0, 1], clamp),
            transform: `translateY(${interpolate(frame, [t, t + 6], [20, 0], clamp)}px)`,
            padding: fuerte ? '0 16px' : 0, borderRadius: 16,
            background: `rgba(224, 172, 60, ${marca})`,
            color: marca > 0.5 ? C.fondo : C.texto,
          }}>{palabra}</span>
        );
      })}
    </div>
  );
};

const GENTE = ['#faf5ee', '#f0c868', '#5e8cff', '#a39685', '#e2564b', '#4fa87f', '#c4922e'];

// Un local visto de frente: fachada, toldo, vidriera y la fila en la puerta.
export const Local = ({ nombre, left, top, escala = 1, brillo = 0, apagado = 0, fila = 7 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{
      position: 'absolute', left, top, width: 400, transformOrigin: 'bottom center',
      transform: `scale(${escala})`, opacity: 1 - apagado * 0.6,
      filter: brillo ? `drop-shadow(0 0 ${40 * brillo}px rgba(224, 172, 60, ${0.55 * brillo}))` : 'none',
    }}>
      <svg width="400" height="520" viewBox="0 0 400 520">
        <rect x="20" y="0" width="360" height="300" rx="6" fill="#2d2924" />
        {[0, 1, 2].map(col => [0, 1].map(fil => (
          <rect key={`${col}-${fil}`} x={60 + col * 105} y={30 + fil * 85} width="70" height="58" rx="4"
            fill={(col + fil) % 2 ? '#3b2a0e' : '#6b5d4f'} />
        )))}
        <rect x="20" y="210" width="360" height="270" fill="#1a1612" />
        <rect x="40" y="300" width="200" height="160" rx="6" fill="#f0c868" opacity="0.92" />
        <rect x="260" y="300" width="100" height="180" rx="4" fill="#3b2a0e" />
        {Array.from({ length: 9 }).map((_, i) => (
          <path key={i} d={`M${20 + i * 40} 225 h40 v40 q-20 18 -40 0 z`} fill={i % 2 ? C.papel : C.oro} />
        ))}
        <rect x="110" y="178" width="180" height="36" rx="8" fill={C.fondo} stroke={C.oro} strokeWidth="2" />
        <text x="200" y="203" textAnchor="middle" fontFamily="Overused Grotesk" fontWeight="700" fontSize="20" fill={C.papel}>{nombre}</text>
        <rect x="0" y="480" width="400" height="40" fill="#27272A" />
      </svg>
      {Array.from({ length: fila }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 30 + i * 52, top: 400,
          transform: `translateY(${Math.sin(frame / 7 + i * 1.7) * 4}px)`,
        }}>
          <div style={{ width: 30, height: 30, borderRadius: 15, background: '#e8dfd0', margin: '0 auto' }} />
          <div style={{ width: 40, height: 62, borderRadius: '18px 18px 6px 6px', background: GENTE[i % GENTE.length], marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
};

// Telefono que sube desde abajo con resorte.
export const Telefono = ({ children, top = 470 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sube = spring({ frame, fps, config: { damping: 16 } });
  return (
    <div style={{
      position: 'absolute', left: '50%', top, width: 620, height: 1260, marginLeft: -310,
      borderRadius: 84, background: '#09090B', padding: 18,
      boxShadow: '0 50px 140px rgba(0, 0, 0, 0.7), 0 0 0 3px #2d2924',
      transform: `translateY(${interpolate(sube, [0, 1], [1300, 0])}px)`,
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 68, overflow: 'hidden', position: 'relative',
        background: C.papel, fontFamily: 'Overused Grotesk', color: C.tinta,
      }}>
        <div style={{ position: 'absolute', top: 18, left: '50%', marginLeft: -80, width: 160, height: 44, borderRadius: 22, background: '#09090B', zIndex: 5 }} />
        <div style={{ height: 84 }} />
        {children}
      </div>
    </div>
  );
};

// Cortes de camara sobre la misma imagen ("punch-in"): cada plano rige desde
// su cuadro, con su escala, y lleva el punto `foco` (y) a la altura `destino`.
// El corte es seco, con un asentado de 5 cuadros para que no parezca un salto.
export const Camara = ({ planos, children }) => {
  const f = useCurrentFrame();
  const p = planos.findLast(plano => f >= plano.desde) ?? planos[0];
  const asentado = interpolate(f, [p.desde, p.desde + 5], [0, 1], { ...clamp, easing: t => 1 - (1 - t) ** 3 });
  const escala = p.desde === 0 ? p.escala : p.escala * (0.95 + 0.05 * asentado);
  return (
    <AbsoluteFill style={{ transformOrigin: `540px ${p.foco}px`, transform: `translateY(${p.destino - p.foco}px) scale(${escala})` }}>
      {children}
    </AbsoluteFill>
  );
};

// Degrade del fondo arriba: el subtitulo se lee aunque la camara meta el
// telefono debajo (el reel de referencia hace lo mismo en claro).
export const Velo = () => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 720, background: `linear-gradient(${C.fondo} 62%, rgba(15, 14, 13, 0))` }} />
);

export const Pulsar = ({ en, children }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [en, en + 4, en + 10], [1, 0.9, 1], clamp);
  return <div style={{ transform: `scale(${s})` }}>{children}</div>;
};
