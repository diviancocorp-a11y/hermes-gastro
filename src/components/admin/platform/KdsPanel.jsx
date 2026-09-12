/**
 * KdsPanel — la cocina en grilla de tickets (1a y 1b).
 *
 * QUE RECIBE Y QUE NO
 * El KDS recibe SOLO lo que hay que producir. Aprobar, rechazar, cobrar y
 * cancelar se quedan en Pedidos, que es la pantalla administrativa. La
 * frontera es `kitchen_at`: hasta que alguien no baja el pedido a cocina,
 * acá no aparece. Que este panel no pueda cancelar un pedido no es una
 * carencia, es el límite.
 *
 * UNA PANTALLA POR SECTOR
 * La barra no es una estación más de la cocina (0074). Este panel muestra UN
 * sector, con los tickets ya recortados a sus platos: el barman no ve la
 * milanesa y el cocinero no ve la limonada. El umbral de demora también es
 * del sector, porque un gin tonic sale en tres minutos y un asado en
 * veinticinco: un umbral común no sirve para ninguno de los dos.
 *
 * DOS MODOS, UNA PANTALLA
 * `tv` es la colgada de 1920: grilla ancha, cronómetro en número grande.
 * `tablet` es la de mesada de 1280: riel de estaciones al costado y la demora
 * como barra, que a 50 cm se compara mejor entre seis tickets que seis
 * números. Cambia el layout, no la información.
 *
 * EL CRONÓMETRO CORRE DE VERDAD
 * Un tick por segundo y nada más: el reloj se mueve solo, sin volver a pedir
 * los tickets. Volver a consultar cada segundo para mover un número sería
 * doscientas consultas por minuto toda la noche.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  zonaDelTicket, minutosEnCocina, cronometro, estadoDeDemora, avanceDeDemora,
  platosListos, estacionesDe, tocaLaEstacion,
} from '../../../services/platformKds';
import { abreviar } from '../../../services/platformProduccion';

const ZONA = {
  salon: 'Salón',
  mostrador: 'Mostrador',
  delivery: 'Delivery',
  programado: 'Programado',
};

const ESTADO = {
  'en-tiempo': 'En tiempo',
  atencion: 'Atención',
  demorado: 'Demorado',
};

const hora = (d, timezone) => new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone || undefined,
}).format(d);

/**
 * El renglón de contexto debajo del nombre. Cada zona necesita un dato
 * distinto: en salón importan los comensales, en delivery la hora del cadete
 * y en un programado la hora para la que se pidió.
 */
function contexto(t, zona, timezone) {
  const quien = t.staff_nombre || t.customer_name;
  if (zona === 'programado' && t.delivery_date) {
    const d = new Date(t.delivery_date);
    return `Programado ${hora(d, timezone)}${quien ? ` · ${quien}` : ''}`;
  }
  if (zona === 'delivery') {
    return t.customer_name ? `Envío · ${t.customer_name}` : 'Envío';
  }
  if (zona === 'salon') {
    const c = Number(t.diners) > 0 ? `${t.diners} comensales` : 'Mesa';
    return quien ? `${c} · ${quien}` : c;
  }
  return quien ? `Take away · ${quien}` : 'Take away';
}

/* ─────────────────────────── Ticket ───────────────────────────────── */

function Ticket({ ticket, modo, umbralMin, ahora, timezone, cortas, onMarcar, onCerrar, ocupado }) {
  const zona = zonaDelTicket(ticket, ahora);
  const minutos = minutosEnCocina(ticket, ahora);
  const estado = estadoDeDemora(minutos, umbralMin);
  const { listos, total } = platosListos(ticket);
  const completo = total > 0 && listos === total;
  const items = ticket.order_items || [];

  return (
    <article className="ag-kds-ticket" data-estado={estado} data-zona={zona}>
      {/* En tablet la demora es una barra; en tv, el número solo. */}
      {modo === 'tablet' && (
        <div className="ag-kds-barra-demora" aria-hidden="true">
          <i style={{ width: `${Math.round(avanceDeDemora(minutos, umbralMin) * 100)}%` }} />
        </div>
      )}

      <header className="ag-kds-ticket-head">
        <span className="ag-kds-zona">{ZONA[zona]}</span>
        <h3 className="ag-kds-nombre">{ticket.titulo}</h3>
        <p className="ag-kds-sub">{contexto(ticket, zona, timezone)}</p>
        <div className="ag-kds-cronometro">
          {cronometro(minutos)}
          <small>{ESTADO[estado]}</small>
        </div>
      </header>

      {ticket.allergy_note && (
        <p className="ag-kds-alergia">{ticket.allergy_note}</p>
      )}

      <ul className="ag-kds-platos">
        {items.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              className="ag-kds-plato"
              data-listo={!!i.ready_at}
              aria-pressed={!!i.ready_at}
              disabled={ocupado}
              onClick={() => onMarcar(ticket, i, !i.ready_at)}
            >
              <span className="ag-kds-cant">{i.qty}</span>
              <span className="ag-kds-plato-texto">
                <span className="ag-kds-plato-nombre">{i.name_snapshot}</span>
                {i.note && <span className="ag-kds-plato-mod">{i.note}</span>}
              </span>
              {i.station && (
                <span className="ag-kds-plato-estacion">
                  {/* En tablet va la abreviatura que cargó el local, no un
                      corte a tres letras: "Fríos" y "Frituras" cortados dan
                      lo mismo y son dos estaciones distintas. */}
                  {modo === 'tablet'
                    ? abreviar({ name: i.station, short_name: cortas?.get(i.station_id) })
                    : i.station}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <footer className="ag-kds-ticket-pie">
        <button
          type="button"
          className="ag-kds-listo"
          data-completo={completo}
          disabled={ocupado}
          onClick={() => onCerrar(ticket)}
        >
          Ticket listo ({listos}/{total})
        </button>
        {/* "Todo" marca los que falten y cierra de una. En tablet no está:
            el botón grande ya hace lo mismo y el área táctil vale más que
            el atajo. */}
        {modo !== 'tablet' && (
          <button type="button" className="ag-kds-todo" disabled={ocupado} onClick={() => onCerrar(ticket)}>
            Todo
          </button>
        )}
      </footer>
    </article>
  );
}

/* ─────────────────────────── Panel ────────────────────────────────── */

export default function KdsPanel({
  tickets = [],
  // Las estaciones CONFIGURADAS del sector, en el orden de su circuito. Sin
  // esto el riel se deduciria de los platos presentes y cambiaria de largo
  // durante el servicio.
  estaciones = [],
  modo = 'tv',
  columnas = 5,
  umbralMin = 18,
  timezone,
  nombreDePantalla,
  onMarcarPlato,
  onCerrarTicket,
  showToast,
  // Sólo para la vista previa: fija el reloj para que la captura no cambie
  // en cada corrida.
  ahoraFijo = null,
}) {
  const [estacion, setEstacion] = useState('todas');
  const [ahora, setAhora] = useState(() => ahoraFijo || new Date());
  const [ocupado, setOcupado] = useState(false);
  const vivo = useRef(true);

  // Un tick por segundo mueve TODOS los cronómetros. No vuelve a consultar:
  // el reloj es local y los datos llegan por su propio refresco.
  useEffect(() => {
    if (ahoraFijo) return undefined;
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, [ahoraFijo]);

  useEffect(() => () => { vivo.current = false; }, []);

  const { estaciones: conCuenta, total } = useMemo(
    () => estacionesDe(tickets, estaciones), [tickets, estaciones]);

  // El mapa se arma una vez y no por plato: la pantalla repinta cada segundo
  // por el cronometro.
  const cortas = useMemo(
    () => new Map(estaciones.map(e => [e.id, e.short_name])), [estaciones]);

  const visibles = useMemo(
    () => tickets.filter(t => tocaLaEstacion(t, estacion)),
    [tickets, estacion]);

  const demorados = useMemo(
    () => tickets.filter(t => estadoDeDemora(minutosEnCocina(t, ahora), umbralMin) === 'demorado').length,
    [tickets, ahora, umbralMin]);

  const marcar = useCallback(async (ticket, item, listo) => {
    setOcupado(true);
    const r = await onMarcarPlato?.(ticket, item, listo);
    if (vivo.current) setOcupado(false);
    if (r?.__error) showToast?.(r.message || 'No se pudo marcar el plato');
  }, [onMarcarPlato, showToast]);

  const cerrar = useCallback(async (ticket) => {
    setOcupado(true);
    const r = await onCerrarTicket?.(ticket);
    if (vivo.current) setOcupado(false);
    if (r?.__error) showToast?.(r.message || 'No se pudo cerrar el ticket');
  }, [onCerrarTicket, showToast]);

  const filtros = (
    <div className="ag-kds-estaciones" role="group" aria-label="Estaciones">
      <button
        type="button" className="ag-kds-estacion"
        aria-pressed={estacion === 'todas'} onClick={() => setEstacion('todas')}
      >
        Todas <b>{total}</b>
      </button>
      {conCuenta.map(e => (
        <button
          key={e.id} type="button" className="ag-kds-estacion"
          aria-pressed={estacion === e.id} onClick={() => setEstacion(e.id)}
        >
          {e.nombre} <b>{e.n}</b>
        </button>
      ))}
    </div>
  );

  const grilla = (
    <div className="ag-kds-grilla" style={{ '--kds-cols': columnas }}>
      {visibles.length === 0 ? (
        <div className="ag-kds-vacio">
          <strong>{tickets.length === 0 ? 'No hay nada en cocina' : 'Nada en esta estación'}</strong>
          <span>
            {tickets.length === 0
              ? 'Los pedidos aparecen acá cuando se aprueban.'
              : 'Pasá a "Todas" para ver el resto del servicio.'}
          </span>
        </div>
      ) : visibles.map(t => (
        <Ticket
          key={t.id}
          ticket={t}
          modo={modo}
          umbralMin={umbralMin}
          ahora={ahora}
          timezone={timezone}
          cortas={cortas}
          ocupado={ocupado}
          onMarcar={marcar}
          onCerrar={cerrar}
        />
      ))}
    </div>
  );

  if (modo === 'tablet') {
    return (
      <section className="ag-kds" data-modo="tablet">
        <aside className="ag-kds-riel">
          <time className="ag-kds-reloj">{hora(ahora, timezone)}</time>
          {filtros}
          <div className="ag-kds-riel-demorados" data-hay={demorados > 0}>
            <span>Demorados</span>
            <strong>{demorados}</strong>
            <small>umbral {umbralMin} min</small>
          </div>
        </aside>
        {grilla}
      </section>
    );
  }

  return (
    <section className="ag-kds" data-modo="tv">
      <header className="ag-kds-barra">
        {filtros}
        <div className="ag-kds-barra-derecha">
          {demorados > 0 && (
            <span className="ag-kds-demorados">
              <i aria-hidden="true" />{demorados} demorado{demorados === 1 ? '' : 's'}
            </span>
          )}
          {nombreDePantalla && <span>{nombreDePantalla}</span>}
          <time className="ag-kds-reloj">{hora(ahora, timezone)}</time>
        </div>
      </header>

      {grilla}

      <footer className="ag-kds-pie">
        <div className="ag-kds-leyenda">
          <span data-e="en-tiempo"><i />En tiempo</span>
          <span data-e="atencion"><i />Atención</span>
          <span data-e="demorado"><i />Demorado · pasa el umbral de {umbralMin} min</span>
        </div>
        <span className="ag-kds-ayuda">
          Tocá un plato para marcarlo. Al cerrar el ticket se imprime la etiqueta del pasador.
        </span>
      </footer>
    </section>
  );
}
