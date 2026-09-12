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
import { sectoresPendientes } from '../../../services/platformComandera';
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

/**
 * Tres tamanios y ninguno mas.
 *
 * Un salon de ocho mesas y uno de cuarenta no entran en el mismo plano: con
 * las mesas del primero, el segundo es una mancha. Dos controles separados
 * —uno para el plano y otro para la mesa— serian cuatro combinaciones que
 * nadie quiere elegir, asi que es UN control con tres pasos: cada paso mueve
 * las dos cosas a la vez.
 *
 * `alto` es el aspecto del lienzo: cuanto mas chico el paso, mas superficie
 * para repartir. `escala` multiplica el tamanio de cada mesa.
 */
const TAMANOS = {
  holgado: { label: 'Holgado', escala: 1.15, aspecto: '16 / 9', hasta: 12 },
  normal:  { label: 'Normal',  escala: 1,    aspecto: '16 / 10', hasta: 24 },
  compacto:{ label: 'Compacto', escala: .62, aspecto: '4 / 3',  hasta: Infinity },
};

/** El tamanio que le corresponde a un salon por su cantidad de mesas. */
export function tamanoSugerido(cantidad) {
  const n = Number(cantidad) || 0;
  return Object.keys(TAMANOS).find(k => n <= TAMANOS[k].hasta) || 'compacto';
}

const CLAVE_TAMANO = 'dico.salon.tamano';

const money = (n) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;

const horaCorta = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;
};

/**
 * Lo que la mesa dice de si misma EN EL PLANO.
 *
 * Un dato y no cuatro. Con cuarenta mesas, cada burbuja con tiempo y plata
 * convierte el plano en una planilla y deja de leerse de un vistazo, que es lo
 * unico que un plano hace mejor que una lista. Las estadisticas de la mesa se
 * abren al tocarla, en el panel de al lado.
 *
 * Lo que SI se queda es cuantos lugares tiene libres: es lo que se mira para
 * sentar gente, y es la decision que se toma mirando el salon.
 */
function pieDeMesa(m) {
  const capacidad = Number(m.recurso.capacity) || 0;
  if (m.estado === 'ocupada') {
    const libres = Math.max(0, capacidad - m.ocupantes);
    return libres > 0 ? `${libres} ${libres === 1 ? 'libre' : 'libres'}` : 'completa';
  }
  if (m.estado === 'reservada') return horaCorta(m.proximaReserva?.starts_at) || `${capacidad} lug.`;
  return `${capacidad} ${capacidad === 1 ? 'lugar' : 'lugares'}`;
}

function Mesa({ mesa, editando, seleccionada, onPointerDown, onClick }) {
  const { recurso, estado } = mesa;
  const redonda = recurso.shape === 'round';
  const pie = pieDeMesa(mesa);
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
      aria-label={`${recurso.name}, ${ETIQUETA_ESTADO[estado]}, ${pie}`}
      // El tamanio entra como variable para que la hoja pueda escalarlo con el
      // control de tamanio y con el ancho de pantalla. Como estilo inline
      // ganaba siempre y las mesas se pisaban.
      style={{
        '--mesa-ancho': `${recurso.width || 84}px`,
        '--mesa-alto': `${recurso.height || (redonda ? 84 : 62)}px`,
      }}
    >
      <span className="ag-salon-mesa-nombre">{recurso.name}</span>
      <span className="ag-salon-mesa-pie">{pie}</span>
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
  // Lo que la cocina y la barra le deben a cada mesa. Un sector que despacha
  // en PAPEL no tiene pantalla donde marcar: el que cierra es el mozo, desde
  // aca, cuando retira. Uno con pantalla se muestra y no se toca, porque dos
  // lugares para marcar lo mismo es la forma mas facil de que un plato se de
  // por entregado sin que nadie lo haya visto.
  sectores = [],
  cocina = [],
  onCerrarSector,         // (ticket, sector) -> Promise
  solicitudes = [],
  onActualizarSolicitud,
  terminologia = { plural: 'Mesas', singular: 'mesa' },
}) {
  const [editando, setEditando] = useState(false);
  const [seleccionada, setSeleccionada] = useState(null);
  const [zonaActiva, setZonaActiva] = useState(null);
  // Una zona recien nombrada todavia no tiene ninguna mesa, asi que no existe
  // en `recursos`. Vive aca hasta que se cree la primera mesa adentro.
  const [zonaNueva, setZonaNueva] = useState(null);
  const [nombreZona, setNombreZona] = useState('');
  const lienzo = useRef(null);
  const arrastre = useRef(null);

  // El tamanio del plano es una preferencia de quien mira, no del negocio:
  // el encargado en el monitor del mostrador y el mozo en el telefono no
  // quieren el mismo. Por eso va al navegador y no a `settings`, que ademas
  // pediria columna, Zod y manifiesto para un ajuste de zoom.
  const [tamano, setTamano] = useState(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_TAMANO);
      if (guardado && TAMANOS[guardado]) return guardado;
    } catch { /* sin storage: se usa el sugerido */ }
    return null;
  });

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
  // La zona recien nombrada entra a la lista aunque no tenga mesas: si no, se
  // la nombra y no pasa nada visible hasta crear la primera, que es el momento
  // en que uno cree que el boton no anduvo.
  const todas = zonaNueva && !zonas.includes(zonaNueva) ? [...zonas, zonaNueva] : zonas;
  // Con una sola zona no hay nada que elegir, y las pestanias solo estorban.
  const pestanias = todas.length + (haySinZona ? 1 : 0) > 1
    ? [...todas, ...(haySinZona ? [SIN_ZONA] : [])]
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
    : (zonaVigente ?? (todas.length === 1 ? todas[0] : null));

  // Sin eleccion guardada, el tamanio sale de cuantas mesas hay: un salon de
  // cuarenta arranca compacto solo, sin que nadie tenga que descubrir el
  // control. Elegir a mano lo fija.
  const tamanoVigente = tamano || tamanoSugerido(recursos.length);
  const elegirTamano = useCallback((clave) => {
    setTamano(clave);
    try { localStorage.setItem(CLAVE_TAMANO, clave); } catch { /* sin storage */ }
  }, []);

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

  // Crear una zona es NOMBRARLA. No hay tabla de zonas: una zona es el texto
  // que llevan las mesas que estan adentro (`resources.zone`), asi que existe
  // de verdad recien cuando se crea la primera. Hasta entonces vive en estado
  // y ya se puede elegir, que es lo que hace que el gesto se sienta completo.
  const crearZona = useCallback((ev) => {
    ev.preventDefault();
    const nombre = nombreZona.trim();
    if (!nombre) return;
    setZonaNueva(nombre);
    setZonaActiva(nombre);
    setNombreZona('');
    setSeleccionada(null);
  }, [nombreZona]);

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

  // Lo que falta producir de los pedidos de ESTA mesa, agrupado por sector.
  const enProduccion = useMemo(() => {
    if (!elegida) return [];
    const ids = new Set(elegida.ordenes.map(o => o.id));
    return cocina
      .filter(t => ids.has(t.id))
      .map(t => ({ ticket: t, pendientes: sectoresPendientes(t, sectores) }))
      .filter(x => x.pendientes.length > 0);
  }, [elegida, cocina, sectores]);

  const proxima = panorama.proximaReserva;
  const demorada = panorama.demorada;

  return (
    // `cp-root` es la raiz del catalogo y pinta `background: var(--bg)`, que
    // en el panel es blanco: en tema oscuro aparecia una tarjeta blanca detras
    // del plano. El panel tiene sus propios tokens `--ag-*`.
    <section className="ag-salon">
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

      {/* UNA tarjeta con todas las filas, no una tarjeta por llamado. En un
          servicio grande son ocho o diez y apilados empujaban el plano fuera
          de la pantalla, que es justo cuando mas se lo necesita. */}
      {solicitudes.length > 0 && (
        <section className="ag-salon-llamados" aria-label="Llamados de las mesas">
          <header>
            <span className="ag-salon-dato-rotulo">Llamados</span>
            <span className="ag-salon-cuenta">{solicitudes.length}</span>
          </header>
          <ul>
            {solicitudes.map(solicitud => (
              <li key={solicitud.id} className="ag-salon-llamado">
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
              </li>
            ))}
          </ul>
        </section>
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

            <div className="ag-salon-plano-controles">
              {/* El tamanio esta siempre a mano, tambien en servicio: quien
                  mira un salon de cuarenta mesas necesita achicarlo para verlo
                  entero, no para editarlo. */}
              <div className="ag-salon-tamanos" role="group" aria-label="Tamaño del plano">
                {Object.entries(TAMANOS).map(([clave, t]) => (
                  <button
                    key={clave} type="button"
                    className="ag-salon-tamano"
                    aria-pressed={clave === tamanoVigente}
                    onClick={() => elegirTamano(clave)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="ag-salon-leyenda">
                {Object.entries(ETIQUETA_ESTADO).map(([k, label]) => (
                  <span key={k} data-estado={k}><i />{label}</span>
                ))}
              </div>
              {/* Acomodar vive con el PLANO y no con la seleccion. Estaba en el
                  panel de la derecha y solo aparecia sin mesa elegida: con una
                  mesa abierta no habia forma de entrar a editar. */}
              <button
                type="button"
                className="ag-salon-editar"
                aria-pressed={editando}
                onClick={() => { setEditando(v => !v); setSeleccionada(null); }}
              >
                {editando ? 'Salir de edición' : 'Acomodar salón'}
              </button>
            </div>
          </div>

          {editando && (
            <div className="ag-salon-edicion">
              <p className="ag-salon-ayuda">
                Arrastrá las {terminologia.plural.toLowerCase()} para acomodarlas como están en tu
                local, o tocá un lugar vacío para agregar una. Se guarda solo.
                Tocá una {terminologia.singular} para cambiarle el tamaño o la forma.
              </p>
              <form className="ag-salon-zona-nueva" onSubmit={crearZona}>
                <input
                  type="text"
                  value={nombreZona}
                  onChange={(e) => setNombreZona(e.target.value)}
                  placeholder="Nombre de la zona"
                  aria-label="Nombre de la zona nueva"
                  maxLength={40}
                />
                <button type="submit" className="ag-btn-ghost" disabled={!nombreZona.trim()}>
                  Agregar zona
                </button>
              </form>
            </div>
          )}

          <div
            ref={lienzo}
            className="ag-salon-plano"
            data-editando={editando ? 'true' : 'false'}
            style={{
              aspectRatio: TAMANOS[tamanoVigente].aspecto,
              '--salon-base': TAMANOS[tamanoVigente].escala,
            }}
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
                  {elegida.visita?.responsible_staff_id
                    && nombreDeStaff.get(elegida.visita.responsible_staff_id)
                    && ` · ${nombreDeStaff.get(elegida.visita.responsible_staff_id)}`}
                  {elegida.estado === 'reservada' && elegida.proximaReserva
                    && ` · reservada ${horaCorta(elegida.proximaReserva.starts_at) || ''}`}
                </span>
              </div>

              {/* El perfil de uso: lo que se saco de la burbuja para no
                  cargar el plano. Aca hay lugar para leerlo. */}
              {elegida.estado === 'ocupada' && (
                <dl className="ag-salon-perfil">
                  <div>
                    <dt>Abierta hace</dt>
                    <dd>{duracionCorta(elegida.abiertaHace)}</dd>
                  </div>
                  <div>
                    <dt>Sin pedir hace</dt>
                    <dd data-alerta={(elegida.sinPedirHace ?? 0) >= 30 ? 'true' : 'false'}>
                      {duracionCorta(elegida.sinPedirHace)}
                    </dd>
                  </div>
                  <div>
                    <dt>Sentados</dt>
                    <dd>{elegida.ocupantes} de {elegida.recurso.capacity}</dd>
                  </div>
                </dl>
              )}

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

              {enProduccion.length > 0 && (
                <div className="ag-salon-produccion">
                  <h4>En producción</h4>
                  {enProduccion.map(({ ticket, pendientes }) => pendientes.map(s => (
                    <div
                      key={`${ticket.id}-${s.id}`}
                      className="ag-salon-prod"
                      data-modo={s.modo}
                    >
                      <span className="ag-salon-prod-nombre">
                        {s.nombre}
                        {s.huerfano && <em> sin asignar</em>}
                      </span>
                      <span className="ag-salon-prod-platos">
                        {s.platos} {s.platos === 1 ? 'plato' : 'platos'}
                      </span>
                      {s.modo === 'papel' && onCerrarSector && (
                        <button
                          type="button" className="ag-btn-mini"
                          onClick={() => onCerrarSector(ticket, s)}
                        >
                          Entregado
                        </button>
                      )}
                      {s.modo === 'pantalla' && (
                        <span className="ag-salon-prod-espera">en pantalla</span>
                      )}
                    </div>
                  )))}
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
                {/* En edicion la mesa se toca para cambiarle forma, tamanio y
                    ubicacion. En servicio no: el editor no tiene nada que
                    hacer en la mano de alguien que esta cobrando. */}
                {editando && (
                  <button
                    type="button" className="ag-btn-ghost"
                    onClick={() => onSeleccionar?.(elegida.recurso)}
                  >
                    Tamaño y forma
                  </button>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
