// src/catalog-pro/plantillas/conAcento.jsx
// Titulares con acento (marca.titulo_acento): la ultima palabra va en el color de
// la marca. Un titular de una sola palabra no se parte. Sin el interruptor,
// devuelve el texto tal cual.
export default function conAcento(texto, activo) {
  const t = String(texto ?? "");
  if (!activo) return t;
  const corte = t.trimEnd().lastIndexOf(" ");
  if (corte < 0) return t;
  return <>{t.slice(0, corte + 1)}<em className="pop-acento">{t.slice(corte + 1)}</em></>;
}
