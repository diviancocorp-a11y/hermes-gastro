import './fuentes.js';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// Tokens de src/styles/dico-tokens.css.
const C = {
  fondo: '#0f0e0d',
  texto: '#faf5ee',
  suave: '#a39685',
  oro: '#e0ac3c',
  volt: '#3d6bff',
};

const entrada = (frame, desde, dur = 18) => ({
  opacity: interpolate(frame, [desde, desde + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  transform: `translateY(${interpolate(frame, [desde, desde + dur], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
});

const Titulo = ({ texto }) => {
  const frame = useCurrentFrame();
  const salida = interpolate(frame, [55, 70], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 96, opacity: salida }}>
      <div style={{ ...entrada(frame, 0, 22), fontFamily: 'Butler', fontSize: 150, lineHeight: 1.05, color: C.texto }}>
        {texto}
      </div>
    </AbsoluteFill>
  );
};

const Items = ({ items }) => {
  const frame = useCurrentFrame();
  const salida = interpolate(frame, [80, 95], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 96, gap: 36, opacity: salida }}>
      {items.map((item, i) => (
        <div key={item} style={{ ...entrada(frame, i * 12), display: 'flex', alignItems: 'center', gap: 36 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: C.oro }} />
          <div style={{ fontFamily: 'Overused Grotesk', fontWeight: 600, fontSize: 110, color: C.texto }}>{item}</div>
        </div>
      ))}
      <div style={{ ...entrada(frame, items.length * 12 + 6), fontFamily: 'Overused Grotesk', fontWeight: 400, fontSize: 48, color: C.suave, marginTop: 24 }}>
        En un solo lugar.
      </div>
    </AbsoluteFill>
  );
};

const Cierre = ({ texto }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const escala = spring({ frame, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 56 }}>
      <Img
        src={staticFile('brand/dico/logo/dico-oscuro.png')}
        style={{ width: 760, transform: `scale(${escala})` }}
      />
      <div style={{ ...entrada(frame, 20), fontFamily: 'Overused Grotesk', fontWeight: 500, fontSize: 54, letterSpacing: 2, color: C.oro }}>
        {texto}
      </div>
    </AbsoluteFill>
  );
};

export const PromoDico = ({ titulo, items, cierre }) => (
  <AbsoluteFill style={{ background: C.fondo }}>
    <Sequence durationInFrames={70}>
      <Titulo texto={titulo} />
    </Sequence>
    <Sequence from={70} durationInFrames={95}>
      <Items items={items} />
    </Sequence>
    <Sequence from={165}>
      <Cierre texto={cierre} />
    </Sequence>
  </AbsoluteFill>
);
