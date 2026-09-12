// src/lib/impresionDePasador.js
// La etiqueta que sale por la impresora del pasador al cerrar un ticket.
//
// POR QUE POR EL NAVEGADOR Y NO POR ESC/POS
// Una termica de 58 mm entiende ESC/POS, que es el camino "correcto" y
// necesita un puente: un agente local, WebUSB con permiso por dispositivo, o
// un servidor de impresion. Cualquiera de los tres es una instalacion mas en
// cada local.
//
// Por el navegador no hace falta nada: la termica se instala en el sistema
// como cualquier impresora y `print()` le manda la pagina. Con el ancho
// puesto en 58 mm y una fuente monoespaciada, sale igual que por ESC/POS.
//
// Lo que se pierde es el corte automatico de papel y el cajon de dinero, que
// son comandos ESC/POS. Cuando haga falta, `imprimirEtiqueta` es el unico
// lugar que cambia: recibe texto plano, que es lo que ESC/POS tambien manda.
//
// LA IMPRESION NO PUEDE FRENAR LA COCINA
// Si la impresora no responde, el ticket se cierra igual. El diseño lo dice:
// "si la impresora no responde, el KDS deja el aviso en la pantalla de
// expedicion y el ticket queda con numero de pasador". Una cocina detenida
// porque falta papel es peor que una bandeja sin etiqueta.

const ID_MARCO = 'dico-impresion-pasador';

/**
 * Ultimas etiquetas que no se pudieron imprimir. La pantalla de expedicion
 * las va a mostrar para reintentar; por ahora quedan en memoria y se leen
 * con `etiquetasPendientes()`.
 */
const pendientes = [];

export function etiquetasPendientes() {
  return [...pendientes];
}

export function olvidarPendiente(id) {
  const i = pendientes.findIndex(p => p.id === id);
  if (i >= 0) pendientes.splice(i, 1);
}

/** El papel, en CSS. 58 mm de ancho y sin margenes: la termica no tiene. */
function hoja(texto, anchoMm) {
  const escapado = String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { size: ${anchoMm}mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  pre {
    margin: 0;
    padding: 3mm 2mm 6mm;
    /* Monoespaciada obligatoria: la etiqueta alinea por columnas y con una
       proporcional el "Listo 22:01" de la derecha se corre. */
    font-family: ui-monospace, "Courier New", monospace;
    font-size: 11px;
    line-height: 1.35;
    color: #000;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style></head><body><pre>${escapado}</pre></body></html>`;
}

/**
 * Manda la etiqueta a la impresora.
 *
 * @returns {Promise<{ok: boolean, motivo?: string}>} Nunca rechaza: quien la
 * llama esta cerrando un ticket y no puede quedar colgado de la impresora.
 */
export function imprimirEtiqueta(texto, { anchoMm = 58, ticketId = null } = {}) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ ok: false, motivo: 'sin-navegador' });
      return;
    }

    let marco;
    try {
      // Un iframe oculto y no una ventana nueva: `window.open` lo bloquea el
      // navegador cuando la impresion no nace de un click directo, y el cierre
      // del ticket puede venir de un flujo asincrono.
      document.getElementById(ID_MARCO)?.remove();
      marco = document.createElement('iframe');
      marco.id = ID_MARCO;
      marco.setAttribute('aria-hidden', 'true');
      marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
      document.body.appendChild(marco);

      const doc = marco.contentDocument;
      doc.open();
      doc.write(hoja(texto, anchoMm));
      doc.close();

      const disparar = () => {
        try {
          marco.contentWindow.focus();
          marco.contentWindow.print();
          resolve({ ok: true });
        } catch (e) {
          pendientes.push({ id: ticketId || Date.now(), texto, error: String(e?.message || e) });
          resolve({ ok: false, motivo: 'print-fallo' });
        } finally {
          // Se saca despues de imprimir: quitarlo antes cancela el trabajo en
          // algunos navegadores.
          setTimeout(() => marco.remove(), 1500);
        }
      };

      if (marco.contentWindow?.document?.readyState === 'complete') disparar();
      else marco.onload = disparar;
    } catch (e) {
      marco?.remove();
      pendientes.push({ id: ticketId || Date.now(), texto, error: String(e?.message || e) });
      resolve({ ok: false, motivo: 'no-se-pudo-armar' });
    }
  });
}
