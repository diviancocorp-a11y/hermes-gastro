import { useEffect } from 'react';

// El HTML muestra la marca antes de descargar React. Este controlador entrega
// la landing cuando sus capas visibles y sus fuentes estan listas.
// Minimo en pantalla: lo que tarda la marca en armarse (900 ms, ver
// entrada-landing.css) mas una pausa corta para leerla. Si todo cargo antes,
// abre a este tiempo; si no, espera a las capas y las fuentes.
const MINIMO_MS = 1200;
// La animacion arranca cuando el navegador pinta la cortina, que puede ser
// unos cientos de ms despues de que el script la muestra: ademas del minimo
// se espera a que DIVIANCO termine de cerrarse en DICO, y esta pausa para
// verla armada. Asi la salida nunca corta el cierre a la mitad.
const PAUSA_ARMADA_MS = 200;
function esperarArmado(entrada, alProgramar) {
  const logo = entrada.querySelector('.de-logo');
  if (!logo?.getAnimations) return null;
  const pendientes = logo.getAnimations({ subtree: true })
    .filter(animacion => animacion.effect?.getTiming?.().iterations !== Infinity && animacion.playState !== 'finished');
  if (!pendientes.length) return null;
  return Promise.all(pendientes.map(animacion => animacion.finished.catch(() => {})))
    .then(() => new Promise(resolve => { alProgramar(setTimeout(resolve, PAUSA_ARMADA_MS)); }));
}

export default function EntradaLanding() {
  useEffect(() => {
    const entrada = document.getElementById('dico-entrada');
    if (!entrada || entrada.hidden) return undefined;
    const contenido = document.getElementById('root');
    const inertAnterior = contenido?.inert;
    const movimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
    const limpiezas = [];
    let saliendo = false;
    let cerrado = false;
    let salidaTimer;
    let minimoTimer;
    let pausaTimer;
    if (contenido) contenido.inert = true;
    const terminar = () => {
      cerrado = true;
      entrada.remove();
      if (contenido) contenido.inert = inertAnterior;
      limpiezas.forEach(limpiar => limpiar());
    };
    const salir = () => {
      if (cerrado || saliendo) return;
      saliendo = true;
      clearTimeout(limite);
      try { sessionStorage.setItem('dico:entrada-v1', '1'); } catch { /* sin storage */ }
      if (movimiento.matches) { terminar(); return; }
      entrada.classList.add('de-salida');
      salidaTimer = setTimeout(terminar, 480);
    };
    const limite = setTimeout(salir, 6500);
    const esperarImagen = imagen => new Promise(resolve => {
      const lista = () => {
        imagen.removeEventListener('load', lista);
        imagen.removeEventListener('error', lista);
        if (imagen.decode) imagen.decode().catch(() => {}).then(resolve);
        else resolve();
      };
      if (imagen.complete) { lista(); return; }
      imagen.addEventListener('load', lista);
      imagen.addEventListener('error', lista);
      limpiezas.push(() => {
        imagen.removeEventListener('load', lista);
        imagen.removeEventListener('error', lista);
      });
    });
    const imagenes = [...document.querySelectorAll('.pl-tiempo-escena img')].map(esperarImagen);
    const transcurrido = Date.now() - Number(entrada.dataset.inicio || Date.now());
    const minimo = new Promise(resolve => { minimoTimer = setTimeout(resolve, Math.max(0, MINIMO_MS - transcurrido)); });
    const armado = esperarArmado(entrada, timer => { pausaTimer = timer; });
    Promise.all([...imagenes, document.fonts?.ready, minimo, armado]).then(salir).catch(salir);
    const reducir = () => { if (movimiento.matches) { clearTimeout(limite); clearTimeout(salidaTimer); terminar(); } };
    movimiento.addEventListener('change', reducir);
    if (movimiento.matches) reducir();
    return () => {
      clearTimeout(limite); clearTimeout(minimoTimer); clearTimeout(salidaTimer); clearTimeout(pausaTimer);
      movimiento.removeEventListener('change', reducir);
      terminar();
    };
  }, []);
  return null;
}
