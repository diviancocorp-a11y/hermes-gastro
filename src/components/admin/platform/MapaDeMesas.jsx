/**
 * MapaDeMesas — el plano del salon.
 *
 * Dos modos sobre el MISMO plano, y esa es la decision de diseño:
 *
 *   servicio  lo que se usa todos los dias. Cada mesa muestra si esta libre,
 *             reservada u ocupada, hace cuanto y cuanto lleva consumido. Se
 *             toca y se opera desde el panel de al lado.
 *   editar    se arrastra para acomodar el salon. Se entra a proposito.
 *
 * Tener dos pantallas separadas obligaria a mantener dos dibujos iguales y a
 * que el mozo aprenda dos vistas del mismo salon. Y dejar el arrastre siempre
 * activo haria que cualquier toque torcido en un telefono mueva una mesa en
 * medio del servicio.
 *
 * EL PLANO SE MANTIENE EN EL TELEFONO
 * La version anterior de este rediseño convertia el plano en una lista debajo
 * de los 860px. Se descarto: el mozo reconoce su salon por la FORMA, y una
 * lista lo obliga a leer nombres para encontrar la mesa que tiene enfrente. En
 * el telefono cambia el tamanio del lienzo y donde cae el detalle; no cambia
 * el modo de leerlo.
 *
 * EL PLANO ES OPCIONAL: una mesa sin pos_x/pos_y existe igual y se reserva
 * igual. Aparece en una bandeja abajo para colocarla cuando el negocio quiera.
 * Obligar a dibujar el salon antes de tomar la primera reserva seria absurdo.
 *
 * Coordenadas en PORCENTAJE, no en pixeles: el mismo plano se ve en el monitor
 * del mostrador y en el telefono del mozo.
 *
 * ZONAS: UN PLANO POR ZONA, NO UN PLANO CON ZONAS ADENTRO
 * Los porcentajes son relativos a la zona, no al local. Un salon de cuatro
 * zonas dibujado en un lienzo unico le da un cuarto de pantalla a cada una y
 * en un telefono las mesas quedan del tamanio de una moneda. Con una pestania
 * por zona, cada zona usa el ancho completo.
 *
 * Esto se decidio ANTES de que nadie dibujara su salon a proposito: cambiarlo
 * despues invalida las coordenadas ya guardadas —una mesa al 80% del local no
 * esta al 80% del patio— y obliga al cliente a redibujar todo a mano.
 *
 * Las pestanias aparecen recien con dos zonas. Un bar de ocho mesas no tiene
 * por que enterarse de que las zonas existen.
 *
 * LAS CUENTAS NO VIVEN ACA: estado, consumo y demoras salen de
 * `src/modules/salonDelDia.js`, que es donde se pueden probar.
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { panoramaDelSalon, duracionCorta } from '../../../modules/salonDelDia';
import '../../../styles/admin-salon.css';

// Las mesas que el negocio no asigno a ninguna zona necesitan un lugar donde
// caer: sin esto desaparecerian del plano en cuanto exista una segunda zona.
const SIN_ZONA = 'Sin zona';

const ETIQUETA_ESTADO = { libre: 'Libre', reservada: 'Reservada', ocupada: 'Ocupada' };

const ETIQUETA_LLAMADO = {
  waiter: 'Llaman al camarero',
  bill: 'Piden la cuenta',
  manager: 'Llaman al encargado',
};

const money = (n) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;

const horaCorta = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;
};

/**
 * Lo que la mesa dice de si misma en el plano.
 *
 * Vuelven DOS datos y no un string armado porque en el telefono la mesa mide
 * 60px y no entran los dos: ahi se muestra el segundo, que es la plata. Cual
 * se ve lo decide el CSS, no un `window.innerWidth` que se desincroniza con el
 * breakpoint de la hoja.
 */
function pieDeMesa(m) {
  if (m.estado === 'ocupada') {
    return {
      primero: duracionCorta(m.abiertaHace),
      segundo: m.consumo > 0 ? money(m.consumo) : null,
    };
  }
  if (m.estado === 'reservada') {
    const hora = horaCorta(m.proximaReserva?.starts_at);
    return { primero: hora, segundo: `${m.recurso.capacity} lug.` };
  }
  const c = Number(m.recurso.capacity) || 0;
  return { primero: null, segundo: `${c} ${c === 1 ? 'lugar' : 'lugares'}` };
}

function Mesa({ mesa, editando, seleccionada, onPointerDown, onClick }) {
  const { recurso, estado } = mesa;
  const redonda = recurso.shape === 'round';
  const { primero, segundo } = pieDeMesa(mesa);
  return (
    <button
      type="button"
      className="ag-salon-mesa"
      data-estado={estado}
      data-redonda={redonda ? 'true' : 'false'}
      data-editando={editando ? 'true' : 'false'}
      aria-pressed={seleccionada}
      onPointerDown={editando ? onPointerDown : undefined}
      onClick={onClick}
      // El nombre accesible dice las dos cosas aunque en pantalla se vea una:
      // el lector no tiene un plano donde mirar el resto.
      aria-label={[recurso.name, ETIQUETA_ESTADO[estado], primero, segundo]
        .filter(Boolean).join(', ')}
      // El tamanio entra como variable para que la hoja pueda escalarlo en el
      // telefono. Como estilo inline ganaba siempre y las mesas se pisaban.
      style={{
        '--mesa-ancho': `${recurso.width || 84}px`,
        '--mesa-alto': `${recurso.height || (redonda ? 84 : 62)}px`,
      }}
    >
      <span className="ag-salon-mesa-nombre">{recurso.name}</span>
      {primero && <span className="ag-salon-mesa-pie" data-orden="primero">{primero}</span>}
      {segundo && <span className="ag-salon-mesa-pie" data-orden="segundo">{segundo}</span>}
    </button>
  );
}

/** Una celda del tablero. `atencion` sube el filete a oro. */
function Dato({ rotulo, valor, pie, atencion = false, barra = null }) {
  return (
    <article className="ag-salon-dato" data-atencion={atencion ? 'true' : 'false'}>
      <span className="ag-salon-dato-rotulo">{rotulo}</span>
      <strong className="ag-salon-dato-valor">{valor}</strong>
      {barra !== null && (
        <div className="ag-salon-barra" role="presentation">
          <i style={{ width: `${Math.min(100, Math.max(0, barra))}%` }} />
        </div>
      )}
      {pie && <span className="ag-salon-dato-pie">{pie}</span>}
    </article>
  );
}

export default function MapaDeMesas({
  recursos = [],
  reservas = [],
  // Las visitas y los pedidos abiertos son lo que convierte el plano en una
  // pantalla de servicio: sin ellos las mesas son cajas con un nombre.
  visitas = [],
  ordenes = [],
  itemsPorOrden = null,   // Map(order_id -> items[]), opcional
  personal = [],          // para poner nombre al mozo responsable
  onMover,                // (id, {pos_x, pos_y}) -> Promise<boolean>
  onSeleccionar,          // (recurso) -> void
  onNuevo,                // () -> void
  onCobrarMesa,           // (mesa) -> void
  solicitudes = [],
  onActualizarSolicitud,
  terminologia = { plural: 'Mesas', singular: 'mesa' },
}) {
  const [editando, setEditando] = useState(false);
  const [seleccionada, setSeleccionada] = useState(null);
  const [zonaActiva, setZonaActiva] = useState(null);
  const lienzo = useRef(null);
  const arrastre = useRef(null);

  // El reloj del salon. Las demoras se leen en minutos, asi que alcanza con
  // un tick por minuto: mas seguido repinta el plano sin que cambie un numero.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const panorama = useMemo(
    () => panoramaDelSalon(recursos, { visitas, ordenes, reservas }, ahora),
    [recursos, visitas, ordenes, reservas, ahora]);

  const porMesa = useMemo(
    () => new Map(panorama.mesas.map(m => [m.recurso.id, m])),
    [panorama]);

  const nombreDeStaff = useMemo(
    () => new Map(personal.map(p => [p.id, p.name])),
    [personal]);

  // Las zonas salen de TODOS los recursos, no solo de los que estan en el
  // plano: una mesa recien creada todavia no tiene posicion y su zona tiene
  // que existir igual, o la pestania desaparece mientras se la esta cargando.
  const zonas = useMemo(
    () => [...new Set(recursos.map(r => r.zone).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'es')),
    [recursos]);

  const haySinZona = useMemo(() => recursos.some(r => !r.zone), [recursos]);
  // Con una sola zona no hay nada que elegir, y las pestanias solo estorban.
  const pestanias = zonas.length + (haySinZona ? 1 : 0) > 1
    ? [...zonas, ...(haySinZona ? [SIN_ZONA] : [])]
    : [];

  // La zona elegida deja de existir cuando se renombra o se vacia la ultima
  // mesa: sin este ajuste el plano queda en blanco sin explicacion.
  const zonaVigente = pestanias.length
    ? (pestanias.includes(zonaActiva) ? zonaActiva : pestanias[0])
    : null;

  // Sin pestanias no hay zona "abierta", pero eso NO quiere decir que la mesa
  // nueva vaya sin zona: si el local tiene una sola, la hereda. Mandar null
  // ahi le crearia al negocio una pestania "Sin zona" con la mesa que acaba de
  // cargar, que es justo lo que las zonas venian a evitar.
  const zonaParaNueva = zonaVigente === SIN_ZONA ? null
    : (zonaVigente ?? (zonas.length === 1 ? zonas[0] : null));

  const { colocados, sinColocar } = useMemo(() => {
    const deLaZona = zonaVigente === null
      ? recursos
      : recursos.filter(r => (r.zone || SIN_ZONA) === zonaVigente);
    return {
      colocados: deLaZona.filter(r => r.pos_x != null && r.pos_y != null),
      sinColocar: deLaZona.filter(r => r.pos_x == null || r.pos_y == null),
    };
  }, [recursos, zonaVigente]);

  // El arrastre se sigue con pointer events y setPointerCapture: asi el gesto
  // no se pierde si el dedo sale de la mesa, que en un telefono pasa siempre.
  const alTomar = useCallback((recurso) => (ev) => {
    if (!lienzo.current) return;
    ev.preventDefault();
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    arrastre.current = { id: recurso.id, movido: false };
    setSeleccionada(recurso.id);

    const mover = (e) => {
      const caja = lienzo.current.getBoundingClientRect();
      // Se clampea a [2, 98] para que una mesa no quede medio afuera del plano
      // y sin forma de volver a agarrarla.
      const x = Math.min(98, Math.max(2, ((e.clientX - caja.left) / caja.width) * 100));
      const y = Math.min(98, Math.max(2, ((e.clientY - caja.top) / caja.height) * 100));
      arrastre.current.pos = { pos_x: Math.round(x * 10) / 10, pos_y: Math.round(y * 10) / 10 };
      arrastre.current.movido = true;
      const el = lienzo.current.querySelector(`[data-mesa="${recurso.id}"]`);
      if (el) { el.style.left = `${x}%`; el.style.top = `${y}%`; }
    };

    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      const a = arrastre.current;
      arrastre.current = null;
      // Solo se persiste si de verdad se movio: un toque simple no tiene por
      // que escribir en la base.
      if (a?.movido && a.pos) onMover?.(a.id, a.pos);
    };

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  }, [onMover]);

  // Tocar un lugar vacio del plano crea la mesa AHI. Cargar un salon son veinte
  // mesas: hacer "boton -> formulario -> bandeja -> arrastrar" veinte veces
  // cansa a la tercera, y ademas deja la posicion sin poner.
  const crearAca = useCallback((ev) => {
    if (!editando || !onNuevo || !lienzo.current) return;
    // Solo el lienzo: un toque sobre una mesa es para agarrarla, no para
    // crear otra encima.
    if (ev.target !== lienzo.current) return;
    const caja = lienzo.current.getBoundingClientRect();
    const x = ((ev.clientX - caja.left) / caja.width) * 100;
    const y = ((ev.clientY - caja.top) / caja.height) * 100;
    onNuevo({
      pos_x: Math.round(Math.min(98, Math.max(2, x)) * 10) / 10,
      pos_y: Math.round(Math.min(98, Math.max(2, y)) * 10) / 10,
      // La zona no se pregunta: se hereda de la pestania que esta abierta.
      zone: zonaParaNueva,
    });
  }, [editando, onNuevo, zonaParaNueva]);

  const elegida = seleccionada ? porMesa.get(seleccionada) : null;

  // El detalle muestra lo que hay EN la mesa: los renglones de sus pedidos
  // abiertos. Sin el mapa de items, el consumo se muestra igual por pedido.
  const renglones = useMemo(() => {
    if (!elegida) return [];
    if (!itemsPorOrden) {
      return elegida.ordenes.map(o => ({
        id: o.id,
        texto: `Pedido de ${horaCorta(o.created_at) || 'hoy'}`,
        importe: Number(o.total) || 0,
      }));
    }
    return elegida.ordenes.flatMap(o => (itemsPorOrden.get(o.id) || []).map(it => ({
      id: it.id,
      texto: `${it.qty}· ${it.name_snapshot}`,
      importe: Number(it.subtotal) || 0,
    })));
  }, [elegida, itemsPorOrden]);

  const proxima = panorama.proximaReserva;
  const demorada = panorama.demorada;

  return (
    <section className="ag-salon cp-root">
      <div className="ag-salon-tablero">
        <Dato
          rotulo="Capacidad usada"
          valor={`${panorama.capacidadPct}%`}
          barra={panorama.capacidadPct}
          pie={`${panorama.ocupados} de ${panorama.lugares} lugares`}
        />
        <Dato
          rotulo={`${terminologia.plural} ocupadas`}
          valor={`${panorama.mesasOcupadas} / ${panorama.mesasTotales}`}
          pie={proxima
            ? `${panorama.mesasReservadas} reservada${panorama.mesasReservadas === 1 ? '' : 's'} · próxima ${horaCorta(proxima.starts_at) || 'hoy'}`
            : `${panorama.mesasLibres} libre${panorama.mesasLibres === 1 ? '' : 's'}`}
        />
        <Dato
          rotulo="Consumo abierto"
          valor={money(panorama.consumoAbierto)}
          pie="sin cobrar"
        />
        <Dato
          rotulo={`${terminologia.singular} más demorada`}
          valor={demorada ? duracionCorta(demorada.abiertaHace) : '—'}
          // El filete sube a oro solo cuando hay algo que atender: una mesa
          // sentada hace rato sin pedir nada.
          atencion={!!demorada && (demorada.sinPedirHace ?? 0) >= 30}
          pie={demorada
            ? `${demorada.recurso.name} · sin pedir hace ${duracionCorta(demorada.sinPedirHace)}`
            : 'sin mesas abiertas'}
        />
      </div>

      {solicitudes.length > 0 && (
        <div aria-label="Solicitudes de las mesas" style={{ display: 'grid', gap: 7 }}>
          {solicitudes.map(solicitud => (
            <article key={solicitud.id} className="ag-salon-llamado">
              <div>
                <strong>{porMesa.get(solicitud.resource_id)?.recurso.name || 'Mesa'}</strong>
                <span>{ETIQUETA_LLAMADO[solicitud.kind] || 'Solicitan asistencia'}</span>
              </div>
              <button
                type="button"
                className={solicitud.status === 'pending' ? 'ag-btn-primary' : 'ag-btn-ghost'}
                onClick={() => onActualizarSolicitud?.(
                  solicitud.id,
                  solicitud.status === 'pending' ? 'accepted' : 'resolved',
                )}
              >
                {solicitud.status === 'pending' ? 'Tomar' : 'Resolver'}
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="ag-salon-cuerpo">
        <div className="ag-salon-plano-caja">
          <div className="ag-salon-plano-head">
            {pestanias.length > 0 ? (
              <div className="ag-salon-zonas" role="tablist" aria-label="Zonas del local">
                {pestanias.map(z => (
                  <button
                    key={z} type="button" role="tab"
                    className="ag-salon-zona"
                    aria-selected={z === zonaVigente}
                    onClick={() => { setZonaActiva(z); setSeleccionada(null); }}
                  >
                    {z}
                  </button>
                ))}
              </div>
            ) : <div />}

            <div className="ag-salon-leyenda">
              {Object.entries(ETIQUETA_ESTADO).map(([k, label]) => (
                <span key={k} data-estado={k}><i />{label}</span>
              ))}
            </div>
          </div>

          {editando && (
            <p className="ag-salon-ayuda">
              Arrastrá las {terminologia.plural.toLowerCase()} para acomodarlas como están en tu
              local, o tocá un lugar vacío para agregar una. Se guarda solo.
            </p>
          )}

          <div
            ref={lienzo}
            className="ag-salon-plano"
            data-editando={editando ? 'true' : 'false'}
            onClick={crearAca}
          >
            {colocados.length === 0 && (
              <div className="ag-salon-vacio">
                <div>
                  Todavía no dibujaste tu salón.<br />
                  {editando
                    ? <>Tocá donde va la primera {terminologia.singular}.</>
                    : <>Tocá <strong>Acomodar salón</strong> para empezar.</>}
                </div>
              </div>
            )}

            {colocados.map(r => {
              const mesa = porMesa.get(r.id);
              if (!mesa) return null;
              return (
                <div
                  key={r.id} data-mesa={r.id}
                  style={{
                    position: 'absolute',
                    left: `${r.pos_x}%`, top: `${r.pos_y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <Mesa
                    mesa={mesa}
                    editando={editando}
                    seleccionada={seleccionada === r.id}
                    onPointerDown={alTomar(r)}
                    onClick={() => { if (!editando) setSeleccionada(r.id); }}
                  />
                </div>
              );
            })}
          </div>

          {sinColocar.length > 0 && (
            <div className="ag-salon-bandeja">
              <span className="ag-salon-ayuda">
                Sin ubicar en el plano ({sinColocar.length}). Se pueden reservar igual.
              </span>
              <div className="ag-salon-bandeja-lista">
                {sinColocar.map(r => (
                  <button key={r.id} type="button" onClick={() => setSeleccionada(r.id)}>
                    {r.name} · {r.capacity}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="ag-salon-detalle" aria-label={`Detalle de la ${terminologia.singular}`}>
          {!elegida ? (
            <>
              <div className="ag-salon-detalle-head">
                <h3>El salón</h3>
                <span className="ag-salon-detalle-meta">
                  Tocá una {terminologia.singular} del plano para ver su cuenta.
                </span>
              </div>
              <div className="ag-salon-acciones">
                <button
                  type="button" className="ag-btn-ghost"
                  onClick={() => onNuevo?.({ zone: zonaParaNueva })}
                >
                  Nueva {terminologia.singular}
                </button>
                <button
                  type="button" className="ag-btn-ghost"
                  aria-pressed={editando}
                  onClick={() => { setEditando(v => !v); setSeleccionada(null); }}
                >
                  {editando ? 'Listo' : 'Acomodar salón'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="ag-salon-detalle-head">
                <span className="ag-salon-detalle-estado" data-estado={elegida.estado}>
                  {ETIQUETA_ESTADO[elegida.estado]}
                </span>
                <h3>{elegida.recurso.name}</h3>
                <span className="ag-salon-detalle-meta">
                  {elegida.recurso.capacity} lugares
                  {elegida.abiertaHace !== null && ` · abierta hace ${duracionCorta(elegida.abiertaHace)}`}
                  {elegida.visita?.responsible_staff_id
                    && nombreDeStaff.get(elegida.visita.responsible_staff_id)
                    && ` · ${nombreDeStaff.get(elegida.visita.responsible_staff_id)}`}
                  {elegida.estado === 'reservada' && elegida.proximaReserva
                    && ` · reservada ${horaCorta(elegida.proximaReserva.starts_at) || ''}`}
                </span>
              </div>

              {renglones.length > 0 && (
                <div className="ag-salon-consumo">
                  {renglones.map(r => (
                    <div key={r.id} className="ag-salon-linea">
                      <span>{r.texto}</span>
                      <span>{money(r.importe)}</span>
                    </div>
                  ))}
                  <div className="ag-salon-total">
                    <span>Consumo</span>
                    <span>{money(elegida.consumo)}</span>
                  </div>
                </div>
              )}

              <div className="ag-salon-acciones">
                {elegida.estado === 'ocupada' && onCobrarMesa && (
                  <button
                    type="button" className="ag-btn-primary"
                    onClick={() => onCobrarMesa(elegida)}
                  >
                    Cobrar {terminologia.singular}
                  </button>
                )}
                <div className="ag-salon-acciones-fila">
                  <button
                    type="button" className="ag-btn-ghost"
                    onClick={() => onSeleccionar?.(elegida.recurso)}
                  >
                    Editar
                  </button>
                  <button
                    type="button" className="ag-btn-ghost"
                    aria-pressed={editando}
                    onClick={() => { setEditando(v => !v); setSeleccionada(null); }}
                  >
                    {editando ? 'Listo' : 'Mover'}
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
