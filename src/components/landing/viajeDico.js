/** Una sola superficie dorada; el formulario real se monta debajo una vez. */
export function viajarConDico({ origen, raiz, mostrar, destino, alTerminar }) {
  const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const rect = origen?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight
    || reducir?.matches || !Element.prototype.animate) {
    mostrar();
    alTerminar();
    return null;
  }

  const capa = document.createElement('div');
  capa.className = 'pl-viaje-dico';
  capa.setAttribute('aria-hidden', 'true');
  capa.dataset.viaje = 'expansion';
  document.body.append(capa);
  const estilo = getComputedStyle(capa);
  const duracion = (token) => parseFloat(estilo.getPropertyValue(token));
  const curva = estilo.getPropertyValue('--pc-curva').trim();
  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  const recorte = (r, radio) => `inset(${r.top}px ${ancho - r.right}px ${alto - r.bottom}px ${r.left}px round ${radio}px)`;
  const completo = 'inset(0px 0px 0px 0px round 0px)';
  const inertAnterior = raiz?.inert;
  const overflowAnterior = document.documentElement.style.overflow;
  if (raiz) raiz.inert = true;
  document.documentElement.style.overflow = 'hidden';
  let cancelado = false;
  let animacion;
  let marco;
  let limite;
  const limpiar = (enfocar = true) => {
    clearTimeout(limite);
    cancelAnimationFrame(marco);
    window.removeEventListener('resize', interrumpir);
    window.removeEventListener('popstate', volver);
    document.removeEventListener('visibilitychange', visibilidad);
    reducir?.removeEventListener?.('change', interrumpir);
    capa.remove();
    if (raiz) raiz.inert = inertAnterior;
    document.documentElement.style.overflow = overflowAnterior;
    alTerminar({ enfocar });
  };
  const cancelar = (abrir = false) => {
    if (cancelado) return;
    cancelado = true;
    animacion?.cancel();
    if (abrir) mostrar();
    limpiar(abrir);
  };
  const interrumpir = () => cancelar(true);
  const volver = () => cancelar(false);
  const visibilidad = () => { if (document.hidden) interrumpir(); };
  window.addEventListener('resize', interrumpir);
  window.addEventListener('popstate', volver);
  document.addEventListener('visibilitychange', visibilidad);
  reducir?.addEventListener?.('change', interrumpir);
  // Incluso una implementación incompleta de WAAPI no puede dejar la página inerte.
  limite = setTimeout(interrumpir, 1600);
  const animar = async (fotogramas, tiempo) => {
    animacion = capa.animate(fotogramas, { duration: tiempo, easing: curva, fill: 'forwards' });
    await animacion.finished;
  };
  const pintarCompleto = () => new Promise((resolve) => {
    marco = requestAnimationFrame(() => { marco = requestAnimationFrame(resolve); });
  });
  (async () => {
    try {
      await animar([{ clipPath: recorte(rect, rect.height / 2) }, { clipPath: completo }], duracion('--pc-t-estructura'));
      if (cancelado) return;
      capa.dataset.viaje = 'pantalla';
      await pintarCompleto();
      if (cancelado) return;
      mostrar();
      const cara = destino()?.getBoundingClientRect();
      if (!cara?.width || !cara.height) { cancelar(true); return; }
      capa.dataset.viaje = 'llegada';
      await animar([
        { clipPath: completo, opacity: 1 },
        { clipPath: recorte(cara, cara.width / 2), opacity: 1, offset: 0.82 },
        { clipPath: recorte(cara, cara.width / 2), opacity: 0 },
      ], duracion('--pc-t-personaje'));
      if (!cancelado) { cancelado = true; limpiar(); }
    } catch {
      if (!cancelado) cancelar(true);
    }
  })();
  return { cancelar };
}
