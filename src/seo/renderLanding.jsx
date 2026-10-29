import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlatformLanding from '../pages/PlatformLanding';

// Se ejecuta al compilar, sin efectos ni consultas de datos del visitante.
// El navegador monta la misma landing con sus interacciones habituales.
export function renderLanding() {
  return renderToStaticMarkup(createElement('main', { id: 'main-content' }, createElement(PlatformLanding)));
}
