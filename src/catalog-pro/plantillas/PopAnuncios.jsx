// src/catalog-pro/plantillas/PopAnuncios.jsx
// Barra de anuncios en movimiento (CSS puro). Las frases se repiten hasta cubrir
// un monitor grande en cada mitad; la animacion corre media pista, pausa con
// hover y foco, y con "pausar animaciones" / reduced-motion queda estatica y
// completa. Solo la primera repeticion es legible para lectores de pantalla.
const MIN_ITEMS = 8;

export default function PopAnuncios({ frases = [], acento = false }) {
  if (!frases.length) return null;
  const reps = Math.max(1, Math.ceil(MIN_ITEMS / frases.length));
  const letras = frases.reduce((n, f) => n + f.length, 0) * reps;
  const estilo = { "--pop-dur": `${Math.max(30, Math.round(letras * 0.5))}s` };
  const tira = (oculta) => (
    <ul className="pop-anuncios__tira" aria-hidden={oculta || undefined}>
      {Array.from({ length: reps }, (_, r) => frases.map((f, i) => (
        <li key={`${r}-${i}`} aria-hidden={r > 0 ? true : undefined}>{f}</li>
      )))}
    </ul>
  );
  return (
    <div className={`pop-anuncios${acento ? " pop-anuncios--acento" : ""}`} role="region" aria-label="Anuncios">
      <div className="pop-anuncios__pista" style={estilo}>{tira(false)}{tira(true)}</div>
    </div>
  );
}
