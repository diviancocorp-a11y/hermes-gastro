/**
 * MiMiniCaja — la caja del mozo, no la del local.
 *
 * EL QUE COBRA ES EL MOZO
 * En este negocio no hay alguien fijo en la caja: cada mozo cobra las mesas
 * que atiende, junta su efectivo y al final del turno presenta su pre-cierre.
 * El encargado certifica uno por uno y recien despues cierra el turno. Por eso
 * esta pantalla existe aparte de `CajaPanel`: el mozo no tiene nada que hacer
 * con el arqueo del local, las incidencias del turno ni la cola fiscal, y
 * mostrarle todo eso para que use dos campos seria darle una pantalla ajena.
 *
 * LO QUE SE DECLARA ES EFECTIVO
 * El esperado sale de los pagos en efectivo que cobro esta persona en este
 * turno. Una tarjeta no deja plata en el bolsillo y por eso no cuenta: lo que
 * se compara es el cajon contra lo cobrado en mano.
 *
 * LA DIFERENCIA NO FRENA NADA
 * Se declara lo que hay, coincida o no. Un pre-cierre que no cierra igual se
 * presenta y queda marcado: esconderlo hasta que cuadre es lo que hace que la
 * gente ajuste el numero en vez de decir lo que le paso.
 */
import { useCallback, useEffect, useState } from 'react';

const money = (n) => `$ ${(Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

const ESTADOS = {
  submitted:    { label: 'Presentado', detalle: 'Esperando que el encargado lo certifique.' },
  under_review: { label: 'En revisión', detalle: 'El encargado lo está mirando.' },
  observed:     { label: 'Observado', detalle: 'El encargado dejó una nota. Hablalo con él.' },
  approved:     { label: 'Aprobado', detalle: 'Certificado. Falta que reciba la plata.' },
  closed:       { label: 'Cerrado', detalle: 'Entregaste la plata y quedó cerrado.' },
};

export default function MiMiniCaja({
  turno,            // la sesion abierta del local, o null
  yo = null,        // mi fila de `staff`
  esperado = null,  // lo que cobre en efectivo este turno
  rendicion = null, // mi pre-cierre de este turno, si ya lo presente
  onPresentar,      // (declarado, notas) -> Promise
  onRefrescar,
  cargando = false,
}) {
  const [contado, setContado] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Cambiar de turno limpia el formulario: dejar el conteo del turno anterior
  // es la forma mas facil de presentar el numero de ayer.
  useEffect(() => { setContado(''); setNotas(''); }, [turno?.id]);

  const diferencia = contado === ''
    ? null
    : (Number(String(contado).replace(',', '.')) || 0) - (Number(esperado) || 0);

  const presentar = useCallback(async () => {
    if (contado === '' || enviando) return;
    setEnviando(true);
    await onPresentar?.(Number(String(contado).replace(',', '.')) || 0, notas.trim() || null);
    setEnviando(false);
  }, [contado, notas, enviando, onPresentar]);

  if (!turno) {
    return (
      <section className="ag-minicaja">
        <div className="ag-minicaja-papel">
          <span className="ag-minicaja-rotulo">TURNO CERRADO</span>
          <p className="ag-minicaja-vacio">
            El local todavía no abrió el turno. Cuando abra vas a poder cobrar
            tus mesas y presentar tu pre-cierre.
          </p>
        </div>
      </section>
    );
  }

  if (!yo) {
    return (
      <section className="ag-minicaja">
        <div className="ag-minicaja-papel">
          <span className="ag-minicaja-rotulo">SIN FICHA DE PERSONAL</span>
          <p className="ag-minicaja-vacio">
            Tu usuario no está vinculado a una ficha del equipo, así que no hay
            a quién atribuirle los cobros. Pedile al encargado que te vincule.
          </p>
        </div>
      </section>
    );
  }

  const estado = rendicion ? (ESTADOS[rendicion.status] || ESTADOS.submitted) : null;

  return (
    <section className="ag-minicaja">
      <div className="ag-minicaja-papel">
        <span className="ag-minicaja-rotulo">MI MINI CAJA</span>
        <span className="ag-minicaja-quien">{yo.name}</span>
        <div className="ag-minicaja-linea">
          <span>Cobré en efectivo</span>
          <span>{esperado === null ? '—' : money(esperado)}</span>
        </div>
        {diferencia !== null && (
          <div className="ag-minicaja-linea" data-total="true">
            <span>{diferencia === 0 ? 'Coincide' : diferencia > 0 ? 'Sobra' : 'Falta'}</span>
            <span data-signo={diferencia === 0 ? 'cero' : diferencia > 0 ? 'mas' : 'menos'}>
              {money(Math.abs(diferencia))}
            </span>
          </div>
        )}
      </div>

      {rendicion ? (
        <div className="ag-minicaja-estado" data-estado={rendicion.status}>
          <strong>{estado.label}</strong>
          <span>{estado.detalle}</span>
          <div className="ag-minicaja-linea">
            <span>Declaraste</span>
            <span>{money(rendicion.declared_cash)}</span>
          </div>
          {Number(rendicion.difference) !== 0 && (
            <div className="ag-minicaja-linea">
              <span>Diferencia</span>
              <span data-signo={Number(rendicion.difference) > 0 ? 'mas' : 'menos'}>
                {money(rendicion.difference)}
              </span>
            </div>
          )}
          {rendicion.review_notes && (
            <p className="ag-minicaja-nota">{rendicion.review_notes}</p>
          )}
        </div>
      ) : (
        <>
          <label className="ag-minicaja-campo">
            <span>¿Cuánta plata tenés?</span>
            <input
              inputMode="decimal"
              value={contado}
              onChange={(e) => setContado(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="0"
            />
            <small>
              Contá lo que tenés en mano. Si no coincide, presentalo igual: la
              diferencia queda anotada y se habla, no se esconde.
            </small>
          </label>

          <label className="ag-minicaja-campo">
            <span>¿Algo que aclarar?</span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="Opcional"
            />
          </label>

          <div className="ag-minicaja-acciones">
            <button
              type="button" className="ag-btn-primary"
              onClick={presentar}
              disabled={contado === '' || enviando || cargando}
            >
              Presentar pre-cierre
            </button>
            {onRefrescar && (
              <button type="button" className="ag-btn-ghost" onClick={onRefrescar}>
                Actualizar
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
