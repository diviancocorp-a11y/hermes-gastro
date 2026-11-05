// Titulos que suben palabra por palabra (mismo gesto que el h1 del hero).
// Cada palabra va en su mascara (.pl-palabra) y el span interno es el que
// viaja; los espacios son texto real, asi lectores de pantalla y el
// prerender SEO leen la frase entera. --i es el orden dentro del titulo:
// `inicio` lo continua entre spans del mismo h2. Fragment y no span: hay
// titulos que ponen display:block a sus spans y partirian la frase.

import { Fragment } from 'react';

export default function Palabras({ texto, inicio = 0 }) {
  const palabras = texto.split(' ').filter(Boolean);
  return palabras.map((palabra, indice) => (
    <Fragment key={indice}>
      {indice > 0 && ' '}
      <span className="pl-palabra"><span style={{ '--i': inicio + indice }}>{palabra}</span></span>
    </Fragment>
  ));
}
