// src/catalog-pro/plantillas/PopCinta.jsx
// Cinta de frases en CSS puro. Las frases se repiten hasta cubrir el ancho de
// un monitor grande en cada mitad (la animacion corre media pista), la duracion
// sale del largo del texto, y pausa con hover y con foco dentro. Solo la primera
// repeticion es legible para lectores de pantalla.
const MIN_ITEMS = 10;

export default function PopCinta({ frases = [] }) {
  if (!frases.length) return null;
  const reps = Math.max(1, Math.ceil(MIN_ITEMS / frases.length));
  const letras = frases.reduce((n, f) => n + f.length, 0) * reps;
  const estilo = { "--pop-dur": `${Math.max(24, Math.round(letras * 0.45))}s` };
  const copia = (oculta) => (
    <ul className="pop-cinta__tira" aria-hidden={oculta || undefined}>
      {Array.from({ length: reps }, (_, r) => frases.map((f, i) => (
        <li key={`${r}-${i}`} aria-hidden={r > 0 ? true : undefined}>{f}</li>
      )))}
    </ul>
  );
  return (
    <section className="pop-cinta" aria-label="Destacados">
      <div className="pop-cinta__pista" style={estilo}>{copia(false)}{copia(true)}</div>
    </section>
  );
}
