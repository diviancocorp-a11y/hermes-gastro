/**
 * BloqueoDePlan — lo que el plan del negocio no incluye, dicho con su dato.
 *
 * Regla de Ricky (4/nov/2026): Paris opera entero, y lo bloqueado se VE con
 * el numero real del negocio y la accion que falta. Nunca "no tenés
 * permiso", que no le dice a nadie que hacer.
 *
 *   "Tenés 23 clientes que no compran hace 3 meses."     <- dato
 *   "Verlos y escribirles está en Dante."                <- detalle + plan
 *
 * Props:
 *   funcion  id de src/modules/planes.js ('crm', 'ganancia', ...). De ahi sale
 *            el plan minimo, y viaja en el evento (services/eventosApp).
 *   titulo   encabezado de la region.
 *   dato     frase con el numero real del negocio. Opcional: mientras carga,
 *            o si no hay numero honesto, no se inventa uno.
 *   detalle  lo que desbloquea, como sujeto de "está en <plan>". Sin detalle
 *            queda "Está en <plan>.".
 *   nivel    nivel del encabezado (3 por defecto). 4 dentro de un bloque que ya
 *            tiene su h3, como Facturación ARCA en Caja.
 *   encajado true cuando el contenedor ya pone su propio margen (la cuenta
 *            de Hoy, la pantalla de Cobros): el bloqueo no suma el suyo.
 *
 * El CTA abre la comparacion de planes de la landing en otra pestaña: el
 * panel no cobra, y perder lo que se estaba mirando para ver un precio no
 * tiene sentido.
 */
import { useEffect, useId } from 'react';
import { planMinimoParaFuncion } from '../../../modules/planes';
import { nombreDelPlan } from '../../../lib/planesPlataforma';
import { registrarEvento } from '../../../services/eventosApp';
import '../../../styles/admin-plan.css';

const URL_PLANES = 'https://divianco.app/#comparar-planes';

// Las funciones cuyo bloqueo ya se registro como visto en esta sesion. A nivel
// modulo y no en el componente: navegar los dias de Hoy, o ir y volver de una
// solapa, remonta el bloqueo, y eso no es otra persona viendolo.
const vistosEnLaSesion = new Set();

export default function BloqueoDePlan({ funcion, titulo, dato = null, detalle = null, encajado = false, nivel = 3 }) {
  const Encabezado = nivel === 4 ? 'h4' : 'h3';
  const idTitulo = useId();
  const nombre = nombreDelPlan(planMinimoParaFuncion(funcion)) || 'otro plan';

  // Una vez por funcion y por sesion (ver vistosEnLaSesion).
  useEffect(() => {
    if (vistosEnLaSesion.has(funcion)) return;
    vistosEnLaSesion.add(funcion);
    registrarEvento('plan-bloqueo-visto', { funcion });
  }, [funcion]);

  return (
    <section
      className="ag-bloqueo"
      aria-labelledby={idTitulo}
      data-funcion={funcion}
      data-encajado={encajado ? 'true' : undefined}
    >
      <Encabezado id={idTitulo} className="ag-bloqueo-titulo">{titulo}</Encabezado>
      {dato && <p className="ag-bloqueo-dato">{dato}</p>}
      <p className="ag-bloqueo-detalle">
        {detalle ? `${detalle} está en ` : 'Está en '}
        <strong className="ag-bloqueo-plan">{nombre}</strong>.
      </p>
      <a
        className="ag-bloqueo-cta"
        href={URL_PLANES}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => registrarEvento('plan-bloqueo-click', { funcion })}
      >
        Ver planes
        <span className="ag-sr-only"> (se abre en otra pestaña)</span>
      </a>
    </section>
  );
}

/**
 * La prueba de Dante, dicha sin alarma: una linea de contexto, no un modal
 * ni un rojo. `dias` es diasDePrueba(tenant); con null no se dibuja.
 */
export function AvisoDePrueba({ dias }) {
  if (dias === null || dias === undefined) return null;
  const nombre = nombreDelPlan('local');
  return (
    <p className="ag-prueba-aviso" role="status">
      Estás probando {nombre}: te {dias === 1 ? 'queda 1 día' : `quedan ${dias} días`}.
    </p>
  );
}
