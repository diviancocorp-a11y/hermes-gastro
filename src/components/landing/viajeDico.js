/** Una sola superficie dorada; el formulario real se monta debajo una vez. */
export function viajarConDico({ origen, raiz, mostrar, destino, alTerminar, sentido = 'ida', prepararOrigen }) {
  const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let rect = origen?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0 || (sentido === 'ida' && (rect.bottom <= 0 || rect.top >= window.innerHeight))
    || reducir?.matches || !Element.prototype.animate) {
    mostrar();
    alTerminar();
    return null;
  }

  const capa = document.createElement('div');
  capa.className = 'pl-viaje-dico';
  capa.setAttribute('aria-hidden', 'true');
  capa.dataset.viaje = 'expansion';
  capa.dataset.sentido = sentido;
  capa.hidden = sentido === 'vuelta';
  document.body.append(capa);
  const estilo = getComputedStyle(capa);
  const duracion = (token) => parseFloat(estilo.getPropertyValue(token));
  const expansion = duracion('--pl-viaje-expansion');
  const pausa = duracion('--pl-viaje-pantalla');
  const compresion = duracion('--pl-viaje-compresion');
  const curva = estilo.getPropertyValue('--pl-viaje-curva').trim();
  if (![expansion, pausa, compresion].every(Number.isFinite)) {
    capa.remove();
    mostrar();
    alTerminar();
    return null;
  }
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
  let pausaCompleta;
  const limpiar = (enfocar = true) => {
    clearTimeout(limite);
    clearTimeout(pausaCompleta);
    cancelAnimationFrame(marco);
    window.removeEventListener('resize', interrumpir);
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
  const visibilidad = () => { if (document.hidden) interrumpir(); };
  window.addEventListener('resize', interrumpir);
  document.addEventListener('visibilitychange', visibilidad);
  reducir?.addEventListener?.('change', interrumpir);
  // Incluso una implementación incompleta de WAAPI no puede dejar la página inerte.
  limite = setTimeout(interrumpir, expansion + pausa + compresion + 1000);
  const animar = async (fotogramas, tiempo) => {
    animacion = capa.animate(fotogramas, { duration: tiempo, easing: curva, fill: 'forwards' });
    await animacion.finished;
  };
  const pintarCompleto = () => new Promise((resolve) => {
    marco = requestAnimationFrame(() => { marco = requestAnimationFrame(resolve); });
  });
  (async () => {
    try {
      if (sentido === 'vuelta') {
        // popstate aún puede restaurar su scroll nativo al terminar el evento.
        // Medir después evita cambiar modos que pertenecen a cada history entry.
        await new Promise((resolve) => { marco = requestAnimationFrame(resolve); });
        if (cancelado) return;
        prepararOrigen?.();
        rect = origen.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) { cancelar(true); return; }
        capa.hidden = false;
      }
      await animar([{ clipPath: recorte(rect, rect.height / 2) }, { clipPath: completo }], expansion);
      if (cancelado) return;
      capa.dataset.viaje = 'pantalla';
      await Promise.all([
        pintarCompleto(),
        new Promise((resolve) => { pausaCompleta = setTimeout(resolve, pausa); }),
      ]);
      if (cancelado) return;
      mostrar();
      const cara = destino()?.getBoundingClientRect();
      if (!cara?.width || !cara.height) { cancelar(true); return; }
      capa.dataset.viaje = 'llegada';
      await animar([
        { clipPath: completo, opacity: 1 },
        { clipPath: recorte(cara, cara.width / 2), opacity: 1, offset: 0.9 },
        { clipPath: recorte(cara, cara.width / 2), opacity: 0 },
      ], compresion);
      if (!cancelado) { cancelado = true; limpiar(); }
    } catch {
      if (!cancelado) cancelar(true);
    }
  })();
  return { cancelar };
}
