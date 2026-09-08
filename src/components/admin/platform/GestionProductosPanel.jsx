import { useEffect, useMemo, useState } from 'react';
import {
  accionesOperativas, destinoDeImpulso, matrizKasavana, recomendacionesKasavana,
} from '../../../modules/gestionProductos';
import useMediaQuery from '../../../lib/useMediaQuery';

function money(n) {
  return `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function mismoDiaLocal(fecha, ahora, timezone) {
  if (!fecha) return false;
  const fechaPedido = new Date(fecha);
  if (!Number.isFinite(fechaPedido.getTime())) return false;
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || undefined, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return formato.format(fechaPedido) === formato.format(ahora);
}

function relojOperativo(minutos) {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  const horas = Math.floor(total / 60);
  return `${String(horas).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function fechaCorta(fecha, timezone) {
  if (!fecha) return 'Sin turnos cerrados';
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(Date.UTC(anio, mes - 1, dia, 12)));
  }
  const instante = new Date(fecha);
  if (!Number.isFinite(instante.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: timezone || undefined, day: '2-digit', month: 'short', year: 'numeric',
  }).format(instante);
}

function inicioDelPeriodo(turno, periodo) {
  if (!turno) return null;
  if (periodo === 'turno') return turno.opened_at || null;
  const dias = Number(periodo);
  const fin = new Date(turno.closed_at || turno.opened_at);
  if (!Number.isFinite(fin.getTime()) || !dias) return turno.opened_at || null;
  fin.setUTCDate(fin.getUTCDate() - dias);
  return fin.toISOString();
}

function Alcance({ turnosPrevios, operativo, minutosOperando, ahora, orders, timezone }) {
  if (operativo) {
    const transacciones = orders.filter(pedido => (
      pedido.status === 'completed' && mismoDiaLocal(pedido.created_at, ahora, timezone)
    )).length;
    return <><strong>{relojOperativo(minutosOperando)}</strong> operando · {transacciones} {transacciones === 1 ? 'transacción' : 'transacciones'} hoy</>;
  }
  if (!operativo && turnosPrevios?.[0]?.business_day) return <>Turno del {turnosPrevios[0].business_day}</>;
  return <>Últimos pedidos disponibles</>;
}

function Cuadrante({ tipo, titulo, ayuda, icono, items }) {
  return (
    <section className={`ag-kasavana-cuadrante es-${tipo}`}>
      <span className="ag-kasavana-icono" aria-hidden="true">{icono}</span>
      <div className="ag-kasavana-resumen">
        <header>
          <h4>{titulo}</h4>
          <span>{items.length}</span>
        </header>
        <p>{ayuda}</p>
      </div>
      <div className="ag-kasavana-productos">
        {items.length === 0 && <span className="ag-kasavana-vacio">Sin productos</span>}
        {items.slice(0, 3).map(item => (
          <div key={item.producto.id} className="ag-kasavana-producto">
            <strong>{item.producto.name}</strong>
            <span>{item.unidades} u · {money(item.contribucion)} c/u</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function GestionProductosPanel({
  products, orders, itemsPorPedido, recetas, ingredientes, settings,
  operativo, turno, turnosPrevios, minutosOperando, onToggleActive, onImpulsar,
  onIr, showToast, timezone,
}) {
  const [impulsados, setImpulsados] = useState(() => new Set());
  const [abiertoMobile, setAbiertoMobile] = useState(false);
  const [infoAbierta, setInfoAbierta] = useState(false);
  const [periodoAnalisis, setPeriodoAnalisis] = useState('turno');
  const [ahora, setAhora] = useState(() => new Date());
  const esMobile = useMediaQuery('(max-width: 768px)');
  const ultimoTurno = turnosPrevios?.find(t => t.status === 'closed') || turnosPrevios?.[0] || null;
  const desde = operativo ? turno?.opened_at : inicioDelPeriodo(ultimoTurno, periodoAnalisis);
  const hasta = operativo ? null : ultimoTurno?.closed_at;

  const kasavana = useMemo(() => matrizKasavana({
    products, orders, itemsPorPedido, recetas, ingredientes, settings, desde, hasta,
  }), [products, orders, itemsPorPedido, recetas, ingredientes, settings, desde, hasta]);

  const acciones = useMemo(() => accionesOperativas({
    products, orders, itemsPorPedido, recetas, ingredientes, settings, desde,
  }), [products, orders, itemsPorPedido, recetas, ingredientes, settings, desde]);
  const impulsosPendientes = acciones.filter(accion => (
    accion.tipo === 'impulsar' && !impulsados.has(accion.producto.id)
  )).length;
  const recomendaciones = useMemo(() => recomendacionesKasavana(kasavana), [kasavana]);

  // El tiempo de turno y el contador cambian sin exigir otra navegacion.
  // Los pedidos entrantes actualizan `orders`; este reloj refresca la duracion.
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const impulsar = (accion) => {
    const destino = destinoDeImpulso(accion.producto);
    const enviado = onImpulsar?.({ accion, destino });
    if (enviado === false) return;
    setImpulsados(actual => new Set(actual).add(accion.producto.id));
  };

  const pausar = async (accion) => {
    const resultado = await onToggleActive?.(accion.producto);
    if (resultado?.__error || resultado === false) return;
    showToast?.(`${accion.producto.name} pausado en catálogo y comandera`);
  };

  return (
    <aside className={`ag-gestion-productos${operativo ? ' esta-operativo' : ' esta-cerrado'}`}>
      <header className="ag-gestion-head">
        <div>
          <p className="ag-gestion-kicker">
            {operativo ? 'DICO RECOMIENDA · EN VIVO' : 'DICO ANALIZA'}
            {operativo && impulsosPendientes > 0 && (
              <span className="ag-gestion-badge" aria-label={`${impulsosPendientes} impulsos pendientes`}>
                {impulsosPendientes}
              </span>
            )}
          </p>
          <div className="ag-gestion-titulo-fila">
            <h3>{operativo ? 'Acciones del servicio' : 'Ingeniería de menú'}</h3>
            {!operativo && (
              <button
                type="button"
                className="ag-kasavana-info-trigger"
                aria-label="Cómo funciona la matriz Kasavana"
                aria-expanded={infoAbierta}
                aria-controls="ag-kasavana-info"
                onClick={() => {
                  setInfoAbierta(valor => !valor);
                  if (esMobile) setAbiertoMobile(true);
                }}
              >
                <span aria-hidden="true">i</span>
              </button>
            )}
          </div>
        </div>
        {esMobile ? (
          <>
            <span
              className={`ag-gestion-flecha${abiertoMobile ? ' esta-abierta' : ''}`}
              aria-hidden="true"
            />
            <button
              type="button"
              className="ag-gestion-toggle"
              onClick={() => setAbiertoMobile(valor => !valor)}
              aria-expanded={abiertoMobile}
              aria-label={`${abiertoMobile ? 'Cerrar' : 'Abrir'} acciones de Dico`}
            />
          </>
        ) : null}
      </header>

      {(!esMobile || abiertoMobile) && <div className="ag-gestion-contenido">
        {!operativo && infoAbierta && (
          <aside className="ag-kasavana-info" id="ag-kasavana-info" role="note">
            Kasavana cruza la popularidad de cada producto con su margen de contribución.
            Estrellas se mantienen; Caballos requieren revisar costo o precio; Enigmas se promocionan;
            Perros se reformulan o se sacan. El período termina en el último turno cerrado.
          </aside>
        )}
        {operativo ? (
          <p className="ag-gestion-alcance">
            <Alcance turnosPrevios={turnosPrevios} operativo={operativo}
              minutosOperando={minutosOperando} ahora={ahora} orders={orders} timezone={timezone} />
          </p>
        ) : (
          <div className="ag-gestion-periodo">
            <span>Último análisis · {fechaCorta(ultimoTurno?.closed_at || ultimoTurno?.business_day, timezone)}</span>
            <label>
              <span className="ag-sr-only">Período del análisis</span>
              <select value={periodoAnalisis} onChange={e => setPeriodoAnalisis(e.target.value)}>
                <option value="turno">Último turno</option>
                <option value="3">3 días</option>
                <option value="7">1 semana</option>
                <option value="14">2 semanas</option>
                <option value="30">30 días</option>
              </select>
            </label>
          </div>
        )}

        {operativo ? (
        <>
          <div className="ag-acciones-lista">
            {acciones.length === 0 && (
              <div className="ag-gestion-sin-datos">
                <strong>Sin urgencias detectadas</strong>
                <p>Dico sigue mirando stock y ritmo de venta durante el turno.</p>
              </div>
            )}
            {acciones.map(accion => (
              <article key={accion.id} className={`ag-accion es-${accion.tipo}`}>
                <div className="ag-accion-marca" aria-hidden="true" />
                <div className="ag-accion-contenido">
                  <span>{accion.titulo}</span>
                  <h4>{accion.producto.name}</h4>
                  <p>{accion.detalle}</p>
                  <small>{accion.metrica}</small>
                </div>
                <div className="ag-accion-botones">
                  {accion.tipo === 'impulsar' && (
                    impulsados.has(accion.producto.id) ? (
                      <span className="ag-accion-enviada">
                        Dico avisó a {destinoDeImpulso(accion.producto).etiqueta}
                      </span>
                    ) : (
                      <button type="button" className="ag-accion-principal" onClick={() => impulsar(accion)}>
                        Impulsar
                      </button>
                    )
                  )}
                  {accion.tipo === 'stock' && (
                    <button type="button" className="ag-accion-principal" onClick={() => onIr?.('stock')}>
                      Revisar stock
                    </button>
                  )}
                  {accion.tipo === 'faltante' && (
                    <>
                      <button type="button" className="ag-accion-secundaria" onClick={() => onIr?.('stock')}>
                        Voy a resolverlo
                      </button>
                      <button type="button" className="ag-accion-principal" onClick={() => pausar(accion)}>
                        Pausar producto
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
        ) : (
        <>
          {kasavana.productosAnalizados > 0 ? (
            <>
              <div className="ag-kasavana">
                <Cuadrante tipo="estrella" titulo="Estrellas" ayuda="Rentables · populares" icono="⭐" items={kasavana.cuadrantes.estrellas} />
                <Cuadrante tipo="caballo" titulo="Caballos" ayuda="Populares · margen bajo" icono="🐎" items={kasavana.cuadrantes.caballos} />
                <Cuadrante tipo="enigma" titulo="Enigmas" ayuda="Rentables · poca salida" icono="🧩" items={kasavana.cuadrantes.enigmas} />
                <Cuadrante tipo="perro" titulo="Perros" ayuda="Poca salida · bajo margen" icono="🐕" items={kasavana.cuadrantes.perros} />
              </div>
              <p className="ag-kasavana-nota">
                {kasavana.productosAnalizados} analizados · {kasavana.unidadesTotales} unidades vendidas
                {kasavana.productosSinDatos > 0 ? ` · ${kasavana.productosSinDatos} sin ventas o receta` : ''}
              </p>
            </>
          ) : (
            <div className="ag-gestion-sin-datos">
              <strong>La matriz necesita ventas y costos</strong>
              <p>Cuando haya productos vendidos con receta cargada, Dico los ubicará por popularidad y contribución.</p>
            </div>
          )}
          <div className="ag-gestion-lectura">
            <span>LECTURA DE DICO</span>
            {recomendaciones.length ? (
              <ul>{recomendaciones.map(recomendacion => <li key={recomendacion}>{recomendacion}</li>)}</ul>
            ) : (
              <p>Todavía no hay datos suficientes para recomendar una decisión.</p>
            )}
          </div>
        </>
        )}
      </div>}
    </aside>
  );
}
