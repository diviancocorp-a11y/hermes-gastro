// Control del tiempo de una demostración. No usa reloj de pared: la escena
// solo avanza cuando su motor está visible y puede dibujar.
export function crearRecorridoGuiado(alTerminar) {
  let tramo = null;
  const terminar = () => {
    if (!tramo || tramo.avisado) return;
    tramo.reproduciendo = false;
    tramo.avisado = true;
    alTerminar(tramo.id);
  };
  return {
    get indice() { return tramo?.indice ?? null; },
    get activo() { return tramo !== null; },
    cancelar() { tramo = null; },
    configurar(orden, momento, tiempo, reducido) {
      if (!orden || !momento) { tramo = null; return null; }
      if (orden === 'preparar' || orden === 'reproducir') {
        tramo = { ...momento, reproduciendo: orden === 'reproducir', avisado: false };
        if (reducido && tramo.reproduciendo) {
          terminar();
          return { tiempo: momento.resultado, fijo: true };
        }
        return { tiempo: momento.inicio, fijo: !tramo.reproduciendo };
      }
      if (!tramo || tramo.id !== momento.id) return null;
      tramo.reproduciendo = orden === 'continuar';
      if (reducido && tramo.reproduciendo) { terminar(); return { tiempo: momento.resultado, fijo: true }; }
      return { tiempo, fijo: !tramo.reproduciendo };
    },
    reducir() {
      if (!tramo?.reproduciendo) return null;
      const final = { tiempo: tramo.resultado, indice: tramo.indice };
      terminar();
      return final;
    },
    avanzar(tiempo) {
      if (!tramo?.reproduciendo || tiempo < tramo.fin) return null;
      const final = { tiempo: tramo.fin, indice: tramo.indice };
      terminar();
      return final;
    },
  };
}
