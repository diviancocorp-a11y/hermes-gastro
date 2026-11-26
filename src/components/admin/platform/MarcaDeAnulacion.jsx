// Marca de seguimiento de un pedido anulado (0150): quien, cuando y por que.
//
// Es una foto del momento que vive en el pedido (`cancelled_by_*`): si despues
// la persona cambia de nombre o la dan de baja, la marca no cambia. Un pedido
// anulado antes de la 0150 solo tiene el motivo, y entonces la tarjeta dice
// "Anulado" sin "por"; sin `cancelled_at` no se inventa una hora.
//
// Cerrada: una linea compacta con quien y cuando, y el motivo debajo.
// Abierta (`abierta`): un bloque "Anulacion" como lista de definiciones.
// La hora sale del reloj del local (`timezone`), no del navegador ni de UTC.
import { useId } from 'react';
import { fechaHoraDelLocal } from '../../../modules/estadoOperativo';

export default function MarcaDeAnulacion({ pedido, timezone, abierta = false }) {
  const titulo = useId();
  const nombre = pedido.cancelled_by_name || '';
  const rol = pedido.cancelled_by_role || '';
  const correo = pedido.cancelled_by_email || '';
  const motivo = pedido.cancel_reason || '';

  if (!abierta) {
    const cuando = fechaHoraDelLocal(pedido.cancelled_at, timezone);
    const quien = nombre ? `Anulado por ${nombre}` : 'Anulado';
    return (
      <div className="ag-anulacion-linea">
        <p className="ag-anular-motivo">{[quien, cuando].filter(Boolean).join(' · ')}</p>
        {motivo && <p className="ag-anulacion-motivo-linea">Motivo: {motivo}</p>}
      </div>
    );
  }

  const cuando = fechaHoraDelLocal(pedido.cancelled_at, timezone, { conAnio: true });
  const filas = [
    ['Por', nombre],
    ['Rol', rol],
    ['Correo', correo],
    ['Fecha y hora', cuando],
    ['Motivo', motivo],
  ].filter(([, valor]) => valor);

  return (
    <section className="ag-anulacion" aria-labelledby={titulo}>
      <h4 id={titulo} className="ag-anulacion-titulo">Anulación</h4>
      <dl className="ag-anulacion-lista">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="ag-anulacion-fila">
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
