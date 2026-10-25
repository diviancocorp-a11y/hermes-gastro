/** Anima una superficie persistente. La sesión modal es dueña del scroll/inert. */
export function viajarConDico({ capa, origen, destino, sentido = 'ida', prepararDestino, alTerminar }) {
  let terminado = false;
  let animacion;
  let limite;
  let marco;
  let diferido;
  let quitarCss = () => {};
  const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const destinoElemento = typeof destino === 'function' ? destino() : destino;
  const caja = destinoElemento?.getBoundingClientRect();
  const radio = destinoElemento ? getComputedStyle(destinoElemento).borderRadius || '0px' : '0px';
  const completo = caja?.width ? `inset(${caja.top}px ${window.innerWidth - caja.right}px ${window.innerHeight - caja.bottom}px ${caja.left}px round ${radio})` : 'inset(0px 0px 0px 0px round 0px)';
  const elemento = () => typeof origen === 'function' ? origen() : origen;
  const recorte = (rect) => `inset(${rect.top}px ${window.innerWidth - rect.right}px ${window.innerHeight - rect.bottom}px ${rect.left}px round ${rect.height / 2}px)`;
  const detener = () => { try { animacion?.cancel?.(); } catch { /* motor incompleto */ } };
  const limpiar = () => {
    clearTimeout(limite);
    clearTimeout(diferido);
    cancelAnimationFrame(marco);
    quitarCss();
    capa?.classList.remove('pl-viaje-css');
    window.removeEventListener('resize', finalizar);
    document.removeEventListener('visibilitychange', alOcultar);
    reducir?.removeEventListener?.('change', finalizar);
  };
  let desde = completo;
  let hasta = completo;
  const finalizar = () => {
    if (terminado) return;
    terminado = true;
    if (capa) capa.style.clipPath = sentido === 'ida' ? completo : hasta;
    if (capa && sentido === 'ida') capa.dataset.viaje = 'abierto';
    detener();
    limpiar();
    alTerminar?.();
  };
  const cancelar = () => {
    if (terminado) return;
    terminado = true;
    if (capa) capa.style.clipPath = getComputedStyle(capa).clipPath || desde;
    detener();
    limpiar();
  };
  const alOcultar = () => { if (document.hidden) finalizar(); };
  if (!capa) { finalizar(); return { cancelar }; }
  const estilo = getComputedStyle(capa);
  const tiempo = parseFloat(estilo.getPropertyValue(sentido === 'ida' ? '--pl-viaje-expansion' : '--pl-viaje-contraccion'));
  const curva = estilo.getPropertyValue('--pl-viaje-curva').trim();
  capa.dataset.viaje = sentido === 'ida' ? 'expansion' : 'contraccion';
  capa.dataset.sentido = sentido;
  capa.dataset.motor = typeof capa.animate === 'function' ? 'waapi' : 'css';
  const preparar = () => {
    prepararDestino?.();
    const rect = elemento()?.getBoundingClientRect();
    if (!rect?.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) return false;
    if (sentido === 'ida') { desde = recorte(rect); hasta = completo; }
    else { desde = completo; hasta = recorte(rect); }
    return true;
  };
  if (reducir?.matches || !Number.isFinite(tiempo) || (sentido === 'ida' && !preparar())) {
    finalizar();
    return { cancelar };
  }
  window.addEventListener('resize', finalizar);
  document.addEventListener('visibilitychange', alOcultar);
  reducir?.addEventListener?.('change', finalizar);
  limite = setTimeout(finalizar, tiempo + 1000);
  const animarCss = () => new Promise((resolve, reject) => {
    const alEvento = (evento) => {
      if (evento.target !== capa || evento.animationName !== 'pl-viaje-superficie') return;
      quitarCss();
      if (evento.type === 'animationcancel') reject(new Error('Animación cancelada'));
      else resolve();
    };
    quitarCss = () => {
      capa.removeEventListener('animationend', alEvento);
      capa.removeEventListener('animationcancel', alEvento);
    };
    capa.style.setProperty('--pl-viaje-desde', desde);
    capa.style.setProperty('--pl-viaje-hasta', hasta);
    capa.style.setProperty('--pl-viaje-duracion', `${tiempo}ms`);
    capa.addEventListener('animationend', alEvento);
    capa.addEventListener('animationcancel', alEvento);
    capa.classList.add('pl-viaje-css');
  });
  const ejecutar = async () => {
    try {
      if (sentido === 'vuelta') {
        // Medir tras la restauración nativa de popstate, aun si RAF se pausa.
        await new Promise((resolve) => {
          let atendido = false;
          const seguir = () => {
            if (atendido || terminado) return;
            atendido = true;
            clearTimeout(diferido);
            cancelAnimationFrame(marco);
            resolve();
          };
          marco = requestAnimationFrame(seguir);
          diferido = setTimeout(seguir, 50);
        });
        if (terminado) return;
        if (!preparar()) { finalizar(); return; }
      }
      capa.style.clipPath = desde;
      if (typeof capa.animate === 'function') {
        try {
          animacion = capa.animate([{ clipPath: desde }, { clipPath: hasta }], { duration: tiempo, easing: curva, fill: 'forwards' });
          if (typeof animacion?.finished?.then !== 'function') throw new Error('WAAPI incompleta');
          await animacion.finished;
          if (!terminado) finalizar();
          return;
        } catch {
          if (terminado) return;
          detener();
          capa.dataset.motor = 'css';
        }
      }
      await animarCss();
      if (!terminado) finalizar();
    } catch {
      if (!terminado) finalizar();
    }
  };
  ejecutar();
  return { cancelar };
}
