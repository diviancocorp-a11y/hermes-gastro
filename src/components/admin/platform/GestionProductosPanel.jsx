import { useEffect, useMemo, useRef, useState } from 'react';
import {
  accionesOperativas, destinoDeImpulso, matrizKasavana, recomendacionProductoKasavana,
  proximidadKasavana, recomendacionesKasavana, ventasPorProducto,
} from '../../../modules/gestionProductos';
import useMediaQuery from '../../../lib/useMediaQuery';
import DicoNative from '../../dico/DicoNative';
import useTipeo from '../../dico/useTipeo';

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

function inicioVentana(turno, dias) {
  if (!turno) return null;
  const fin = new Date(turno.closed_at || turno.opened_at);
  if (!Number.isFinite(fin.getTime())) return turno.opened_at || null;
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

function porcentaje(valor) {
  return `${Math.round((Number(valor) || 0) * 100)}%`;
}

function agruparPorCategoria(items = []) {
  const grupos = new Map();
  for (const item of items) {
    if (!grupos.has(item.categoria)) grupos.set(item.categoria, []);
    grupos.get(item.categoria).push(item);
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
}

function CuadranteResumen({ tipo, titulo, ayuda, descripcion, items, prioritario, onAbrir }) {
  const primero = items[0] || null;
  return (
    <button
      type="button"
      className={`ag-kasavana-cuadrante es-${tipo}${prioritario ? ' es-prioritario' : ''}`}
      aria-label={`Abrir ranking de ${titulo}`}
      onClick={onAbrir}
    >
      <span className="ag-kasavana-cuadrante-cabecera">
        <span className="ag-kasavana-marca" aria-hidden="true"><i /><i /><i /><i /></span>
        <span className="ag-kasavana-cantidad">{items.length}</span>
      </span>
      <strong>{titulo}</strong>
      <small>{ayuda}</small>
      <p>{descripcion}</p>
      <span className="ag-kasavana-abrir">
        {primero ? `1° ${primero.producto.name}` : 'Sin productos'}
        <i aria-hidden="true">→</i>
      </span>
    </button>
  );
}

function FilaRanking({ item, tipo, ranking, ventas7, onProducto }) {
  const proximidad = proximidadKasavana(tipo, item);
  return (
    <button
      type="button"
      className="ag-kasavana-producto"
      aria-label={`Ver estadísticas de ${item.producto.name}`}
      onClick={() => onProducto(item, tipo, ranking)}
    >
      <strong className="ag-kasavana-ranking">#{ranking}</strong>
      <span className="ag-kasavana-producto-nombre">{item.producto.name}</span>
      <span className={`ag-kasavana-proximidad es-${proximidad.direccion}`} title={`Proximidad: ${proximidad.destino}; ${proximidad.motivo}`}>
        <b aria-hidden="true">{proximidad.direccion === 'sube' ? '↗' : '↘'}</b> {proximidad.destino}
      </span>
      <span className="ag-kasavana-venta7">{ventas7.get(item.producto.id)?.unidades || 0} u · 7 días</span>
      <span className="ag-kasavana-mix">{porcentaje(item.participacion)} mix</span>
      <span className="ag-kasavana-margen">{money(item.contribucion)} margen/u</span>
    </button>
  );
}

function VistaCuadrante({ cuadrante, ventas7, onVolver, onProducto }) {
  const grupos = agruparPorCategoria(cuadrante.items);
  const unidades = cuadrante.items.reduce((total, item) => total + item.unidades, 0);
  const contribucion = cuadrante.items.reduce((total, item) => total + (item.unidades * item.contribucion), 0);

  return (
    <div className={`ag-vista-cuadrante es-${cuadrante.tipo}`}>
      <header className="ag-subvista-head">
        <button type="button" className="ag-perfil-volver" onClick={onVolver}>
          <span aria-hidden="true">←</span> Sistema Kasavana
        </button>
        <span className="ag-subvista-identidad">{cuadrante.icono} {cuadrante.titulo}</span>
        <h3>{cuadrante.ayuda}</h3>
      </header>

      <div className="ag-kasavana-resumen-general es-cuadrante">
        <span><strong>{cuadrante.items.length}</strong> {cuadrante.items.length === 1 ? 'producto' : 'productos'}</span>
        <span><strong>{grupos.length}</strong> {grupos.length === 1 ? 'categoría' : 'categorías'}</span>
        <span><strong>{unidades}</strong> {unidades === 1 ? 'unidad' : 'unidades'} · 28 días</span>
        <span><strong>{money(contribucion)}</strong> contribución</span>
      </div>

      <div className="ag-ranking-categorias">
        {grupos.length === 0 && <p className="ag-kasavana-vacio">No hay productos en este cuadrante.</p>}
        {grupos.map(([categoria, items]) => (
          <section key={categoria} className="ag-ranking-categoria">
            <header>
              <h4>{categoria}</h4>
              <span>{items.length} {items.length === 1 ? 'producto' : 'productos'}</span>
            </header>
            <div className="ag-kasavana-productos">
              {items.map((item, indice) => (
                <FilaRanking
                  key={item.producto.id}
                  item={item}
                  tipo={cuadrante.tipo}
                  ranking={indice + 1}
                  ventas7={ventas7}
                  onProducto={onProducto}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function textoResumenDico(kasavana, cuadrantes, recomendaciones) {
  const categorias = new Set(
    cuadrantes.flatMap(cuadrante => cuadrante.items.map(item => item.categoria)),
  ).size;
  const contribucion = cuadrantes.reduce((total, cuadrante) => (
    total + cuadrante.items.reduce((subtotal, item) => (
      subtotal + (item.unidades * item.contribucion)
    ), 0)
  ), 0);
  const distribucion = cuadrantes
    .map(cuadrante => `${cuadrante.items.length} ${cuadrante.titulo}`)
    .join(', ');
  const cobertura = kasavana.productosSinDatos > 0
    ? ` Quedan ${kasavana.productosSinDatos} productos activos sin ventas o costos suficientes para clasificarlos.`
    : ' Todos los productos activos tienen datos suficientes para entrar al ranking.';
  const metricas = `Tu menú tiene ${kasavana.productosAnalizados} productos clasificados en ${categorias} ${categorias === 1 ? 'categoría' : 'categorías'}. En los últimos 28 días registraron ${kasavana.unidadesTotales} unidades y ${money(contribucion)} de contribución estimada.${cobertura}`;
  const lectura = recomendaciones.length
    ? `La distribución actual es ${distribucion}. Mi lectura: ${recomendaciones.join(' ')}`
    : 'Todavía no hay evidencia suficiente para recomendar cambios en el menú.';
  return `${metricas}\n\n${lectura}`;
}

function accionesParaBrief(cuadrantes) {
  const enigmas = cuadrantes.find(cuadrante => cuadrante.tipo === 'enigma')?.items || [];
  const categoriasIncluidas = new Set();
  return enigmas.filter((item) => {
    if (categoriasIncluidas.has(item.categoria)) return false;
    categoriasIncluidas.add(item.categoria);
    return true;
  }).slice(0, 3).map(item => ({
    id: item.producto.id,
    producto: item.producto,
    titulo: `Promocionar ${item.producto.name}`,
    directriz: `Ofrezcan ${item.producto.name} durante el próximo turno.`,
  }));
}

function ResumenDico({
  recomendaciones, cuadrantes, kasavana, briefBorrador, onVolver, onAgregarBrief,
}) {
  const texto = useMemo(
    () => textoResumenDico(kasavana, cuadrantes, recomendaciones),
    [kasavana, cuadrantes, recomendaciones],
  );
  const microacciones = useMemo(() => accionesParaBrief(cuadrantes), [cuadrantes]);
  const { letras, completo, saltear } = useTipeo(texto);

  return (
    <div className="ag-resumen-dico" onClickCapture={() => { if (!completo) saltear(); }}>
      <header className="ag-resumen-dico-head">
        <button type="button" className="ag-perfil-volver" onClick={onVolver}>
          <span aria-hidden="true">←</span> Sistema Kasavana
        </button>
        <div className="ag-resumen-dico-identidad">
          <DicoNative size={66} state="curious" activity="thinking" title="Dico resume la ingeniería de menú" />
          <h3>Resumen <em>Dico</em></h3>
        </div>
      </header>
      <button
        type="button"
        className="ag-resumen-dico-voz"
        onClick={saltear}
        tabIndex={completo ? -1 : 0}
        aria-label={completo ? undefined : 'Completar resumen de Dico'}
      >
        <span className="ag-resumen-dico-reserva" aria-hidden="true">{texto}<i /></span>
        <span className="ag-resumen-dico-texto" aria-hidden="true">
          {texto.slice(0, letras)}
          {!completo && <i className="ag-resumen-dico-cursor" />}
        </span>
      </button>
      <span className="ag-resumen-dico-lectura">{texto}</span>
      {completo && microacciones.length > 0 && (
        <section className="ag-resumen-dico-acciones" aria-label="Micro acciones para el próximo brief">
          <span>MICRO ACCIONES · PRÓXIMO BRIEF</span>
          {microacciones.map(accion => (
            <article className="ag-resumen-dico-microaccion" key={accion.id}>
              <div>
                <strong>{accion.titulo}</strong>
                <p>Al abrir el turno, el equipo recibirá: “{accion.directriz}”</p>
              </div>
              <button
                type="button"
                className={briefBorrador.has(accion.id) ? 'esta-agregada' : ''}
                disabled={briefBorrador.has(accion.id)}
                onClick={() => onAgregarBrief(accion)}
              >
                {briefBorrador.has(accion.id) ? 'En el borrador' : 'Agregar al brief'}
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function PerfilProducto({ seleccion, ventas7, kasavana, onVolver }) {
  const { item, tipo, ranking, titulo, icono } = seleccion;
  if (seleccion.sinCuadrante) {
    return (
      <div className="ag-perfil-producto">
        <header className="ag-perfil-producto-head">
          <button type="button" className="ag-perfil-volver" onClick={onVolver}>
            <span aria-hidden="true">←</span> Volver a resultados
          </button>
          <span className="ag-perfil-cuadrante">Sin cuadrante</span>
          <h3>{seleccion.producto.name}</h3>
        </header>
        <div className="ag-gestion-sin-datos">
          <strong>Todavía no se puede clasificar</strong>
          <p>Este producto necesita receta con costos y ventas registradas para entrar en el Sistema Kasavana.</p>
        </div>
      </div>
    );
  }
  const unidades7 = ventas7.get(item.producto.id)?.unidades || 0;
  const recomendacion = recomendacionProductoKasavana(tipo, item, kasavana);
  const popular = item.participacion >= item.cortePopularidad;
  const rentable = item.contribucion >= item.corteMargen;

  return (
    <div className="ag-perfil-producto">
      <header className="ag-perfil-producto-head">
        <button type="button" className="ag-perfil-volver" onClick={onVolver}>
          <span aria-hidden="true">←</span> {seleccion.desdeBusqueda ? 'Volver a resultados' : 'Volver al ranking'}
        </button>
        <span className={`ag-perfil-cuadrante es-${tipo}`}>{icono} {titulo} · #{ranking}</span>
        <h3>{item.producto.name}</h3>
      </header>

      <div className="ag-perfil-metricas">
        <div><strong>{unidades7}</strong><span>vendidas · 7 días</span></div>
        <div><strong>{item.unidades}</strong><span>vendidas · 28 días</span></div>
        <div><strong>{porcentaje(item.participacion)}</strong><span>popularidad</span></div>
        <div><strong>{money(item.contribucion)}</strong><span>margen por unidad</span></div>
        <div><strong>{money(item.unidades * item.contribucion)}</strong><span>contribución total</span></div>
      </div>

      <div className="ag-perfil-diagnostico">
        <span>POR QUÉ ESTÁ ACÁ</span>
        <p>
          Comparado con {item.categoria}: popularidad {popular ? 'sobre' : 'debajo de'} la referencia de {porcentaje(item.cortePopularidad)}
          {' · '}margen {rentable ? 'sobre' : 'debajo de'} la referencia de {money(item.corteMargen)}.
        </p>
      </div>

      <div className="ag-gestion-lectura ag-perfil-recomendacion">
        <span>RECOMENDACIÓN DE DICO</span>
        <p>{recomendacion}</p>
      </div>

      <p className="ag-perfil-historial-pendiente">
        Tendencia y cambios de cuadrante aparecerán cuando existan snapshots de cierres comparables.
      </p>
    </div>
  );
}

export default function GestionProductosPanel({
  products, orders, itemsPorPedido, recetas, ingredientes, settings,
  operativo, turno, turnosPrevios, minutosOperando, onToggleActive, onImpulsar,
  onIr, showToast, timezone, onDicoResumenChange, busqueda = '',
}) {
  const esMobile = useMediaQuery('(max-width: 768px)');
  const [impulsados, setImpulsados] = useState(() => new Set());
  const [abiertoMobile, setAbiertoMobile] = useState(false);
  const [infoAbierta, setInfoAbierta] = useState(false);
  const [cuadranteSeleccionado, setCuadranteSeleccionado] = useState(null);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [briefBorrador, setBriefBorrador] = useState(() => new Set());
  const [seleccion, setSeleccion] = useState(null);
  const [ahora, setAhora] = useState(() => new Date());
  const panelRef = useRef(null);
  const scrollAnterior = useRef(0);
  const ultimoTurno = turnosPrevios?.find(t => t.status === 'closed') || turnosPrevios?.[0] || null;
  const desde = operativo ? turno?.opened_at : inicioVentana(ultimoTurno, 28);
  const desdePulso = inicioVentana(ultimoTurno, 7);
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
  const ventas7 = useMemo(() => ventasPorProducto(
    orders, itemsPorPedido, { desde: desdePulso, hasta },
  ), [orders, itemsPorPedido, desdePulso, hasta]);
  const cuadrantes = useMemo(() => ([
    { tipo: 'enigma', titulo: 'Enigmas', ayuda: 'Rentables · poca salida', descripcion: 'Buen margen, les falta visibilidad.', icono: '', items: kasavana.cuadrantes.enigmas },
    { tipo: 'estrella', titulo: 'Estrellas', ayuda: 'Rentables · populares', descripcion: 'Sostienen venta y margen. Protegerlos.', icono: '', items: kasavana.cuadrantes.estrellas },
    { tipo: 'perro', titulo: 'Perros', ayuda: 'Poca salida · bajo margen', descripcion: 'Reformular, reposicionar o retirar.', icono: '', items: kasavana.cuadrantes.perros },
    { tipo: 'caballo', titulo: 'Caballos', ayuda: 'Populares · margen bajo', descripcion: 'Se venden bien, falta rentabilidad.', icono: '', items: kasavana.cuadrantes.caballos },
  ]), [kasavana]);
  const cuadrantePrioritario = useMemo(() => [...cuadrantes]
    .filter(cuadrante => cuadrante.items.length > 0)
    .sort((a, b) => {
      const aporte = cuadrante => cuadrante.items.reduce((total, item) => (
        total + item.unidades * item.contribucion
      ), 0);
      return aporte(b) - aporte(a);
    })[0]?.tipo || null, [cuadrantes]);
  const consulta = busqueda.trim().toLocaleLowerCase('es-AR');
  const cuadrantesEnVista = useMemo(() => {
    if (!consulta) return cuadrantes;
    return cuadrantes.map(cuadrante => ({
      ...cuadrante,
      items: cuadrante.items.filter(item => (
        item.producto.name.toLocaleLowerCase('es-AR').includes(consulta)
        || (item.categoria || '').toLocaleLowerCase('es-AR').includes(consulta)
      )),
    }));
  }, [consulta, cuadrantes]);
  const productosBuscados = useMemo(() => {
    if (!consulta) return [];
    return products.filter(producto => (
      producto.name.toLocaleLowerCase('es-AR').includes(consulta)
      || (producto.category || '').toLocaleLowerCase('es-AR').includes(consulta)
    )).map((producto) => {
      const cuadrante = cuadrantes.find(candidato => (
        candidato.items.some(item => item.producto.id === producto.id)
      ));
      const ranking = cuadrante
        ? cuadrante.items.findIndex(item => item.producto.id === producto.id) + 1
        : null;
      const item = cuadrante?.items.find(candidato => candidato.producto.id === producto.id) || null;
      return { producto, cuadrante, ranking, item };
    });
  }, [consulta, products, cuadrantes]);
  const cuadranteActual = cuadrantesEnVista.find(c => c.tipo === cuadranteSeleccionado) || null;

  // El tiempo de turno y el contador cambian sin exigir otra navegacion.
  // Los pedidos entrantes actualizan `orders`; este reloj refresca la duracion.
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    onDicoResumenChange?.(resumenAbierto);
    return () => onDicoResumenChange?.(false);
  }, [resumenAbierto, onDicoResumenChange]);

  const llevarAlInicio = (scroll = 0) => {
    requestAnimationFrame(() => {
      if (esMobile) panelRef.current?.scrollIntoView?.({ block: 'start' });
      else panelRef.current?.scrollTo({ top: scroll });
    });
  };

  const abrirCuadrante = (tipo) => {
    setSeleccion(null);
    setResumenAbierto(false);
    setCuadranteSeleccionado(tipo);
    llevarAlInicio();
  };

  const volverAlPanorama = () => {
    setSeleccion(null);
    setResumenAbierto(false);
    setCuadranteSeleccionado(null);
    llevarAlInicio();
  };

  const abrirProducto = (item, tipo, ranking) => {
    const cuadrante = cuadrantesEnVista.find(c => c.tipo === tipo);
    scrollAnterior.current = panelRef.current?.scrollTop || 0;
    setSeleccion({ item, tipo, ranking, titulo: cuadrante.titulo, icono: cuadrante.icono });
    llevarAlInicio();
  };

  const abrirResultado = (resultado) => {
    scrollAnterior.current = panelRef.current?.scrollTop || 0;
    if (!resultado.cuadrante || !resultado.item) {
      setSeleccion({ producto: resultado.producto, sinCuadrante: true });
    } else {
      setSeleccion({
        item: resultado.item,
        tipo: resultado.cuadrante.tipo,
        ranking: resultado.ranking,
        titulo: resultado.cuadrante.titulo,
        icono: resultado.cuadrante.icono,
        desdeBusqueda: true,
      });
    }
    llevarAlInicio();
  };

  const volverAlRanking = () => {
    const restaurar = scrollAnterior.current;
    setSeleccion(null);
    llevarAlInicio(restaurar);
  };

  const abrirResumen = () => {
    setSeleccion(null);
    setCuadranteSeleccionado(null);
    setResumenAbierto(true);
    llevarAlInicio();
  };

  const agregarAlBrief = (accion) => {
    setBriefBorrador(actual => new Set(actual).add(accion.id));
    showToast?.(`${accion.producto.name} agregado al borrador del próximo brief`);
  };

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
    <aside
      ref={panelRef}
      className={`ag-gestion-productos${operativo ? ' esta-operativo' : ' esta-cerrado'}${seleccion ? ' muestra-producto' : ''}${cuadranteActual || resumenAbierto ? ' muestra-subvista' : ''}`}
    >
      {!seleccion && !cuadranteActual && !resumenAbierto && (
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
              <h3>{operativo ? 'Acciones del servicio' : 'Sistema Kasavana'}</h3>
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
              <span className={`ag-gestion-flecha${abiertoMobile ? ' esta-abierta' : ''}`} aria-hidden="true" />
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
      )}

      {(!esMobile || abiertoMobile || seleccion || cuadranteActual || resumenAbierto) && (
        <div className="ag-gestion-contenido">
          {seleccion ? (
            <PerfilProducto seleccion={seleccion} ventas7={ventas7} kasavana={kasavana} onVolver={volverAlRanking} />
          ) : resumenAbierto ? (
            <ResumenDico
              recomendaciones={recomendaciones}
              cuadrantes={cuadrantes}
              kasavana={kasavana}
              briefBorrador={briefBorrador}
              onVolver={volverAlPanorama}
              onAgregarBrief={agregarAlBrief}
            />
          ) : cuadranteActual ? (
            <VistaCuadrante
              cuadrante={cuadranteActual}
              ventas7={ventas7}
              onVolver={volverAlPanorama}
              onProducto={abrirProducto}
            />
          ) : (
            <>
              {consulta && (
                <div className="ag-dico-busqueda" aria-label="Resultados de Dico">
                  <span>RESULTADO DE BÚSQUEDA</span>
                  {productosBuscados.length > 0 ? productosBuscados.map(resultado => (
                    <button key={resultado.producto.id} type="button" onClick={() => abrirResultado(resultado)}>
                      <strong>{resultado.producto.name}</strong>
                      <span>{resultado.cuadrante?.titulo || 'Sin cuadrante'}</span>
                      <i aria-hidden="true">→</i>
                    </button>
                  )) : <p>No hay productos que coincidan con “{busqueda}”.</p>}
                </div>
              )}
              {!consulta && !operativo && infoAbierta && (
                <aside className="ag-kasavana-info" id="ag-kasavana-info" role="note">
                  El modelo nació en 1982 con Michael L. Kasavana y Donald I. Smith, profesores de la
                  Escuela de Hospitalidad de Michigan State University. En <cite>Menu Engineering: A Practical Guide
                  to Menu Analysis</cite> adaptaron una matriz de cartera al restaurante para convertir ventas y margen
                  en decisiones de menú.
                </aside>
              )}

              {operativo ? (
                <>
                  <p className="ag-gestion-alcance">
                    <Alcance turnosPrevios={turnosPrevios} operativo={operativo}
                      minutosOperando={minutosOperando} ahora={ahora} orders={orders} timezone={timezone} />
                  </p>
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
                              <span className="ag-accion-enviada">Dico avisó a {destinoDeImpulso(accion.producto).etiqueta}</span>
                            ) : (
                              <button type="button" className="ag-accion-principal" onClick={() => impulsar(accion)}>Impulsar</button>
                            )
                          )}
                          {accion.tipo === 'stock' && (
                            <button type="button" className="ag-accion-principal" onClick={() => onIr?.('stock')}>Revisar stock</button>
                          )}
                          {accion.tipo === 'faltante' && (
                            <>
                              <button type="button" className="ag-accion-secundaria" onClick={() => onIr?.('stock')}>Voy a resolverlo</button>
                              <button type="button" className="ag-accion-principal" onClick={() => pausar(accion)}>Pausar producto</button>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : consulta ? null : (
                <>
                  <div className="ag-kasavana-resumen-general">
                    <span><strong>{products.filter(p => p.active !== false).length}</strong> activos</span>
                    <span><strong>{kasavana.productosAnalizados}</strong> clasificados</span>
                    <span><strong>{kasavana.productosSinDatos}</strong> por completar</span>
                  </div>

                  {kasavana.productosAnalizados > 0 ? (
                    <div className="ag-kasavana-matriz">
                      <div className="ag-kasavana">
                        {cuadrantesEnVista.map(cuadrante => (
                          <CuadranteResumen
                            key={cuadrante.tipo}
                            {...cuadrante}
                            prioritario={cuadrante.tipo === cuadrantePrioritario}
                            onAbrir={() => abrirCuadrante(cuadrante.tipo)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="ag-gestion-sin-datos">
                      <strong>La matriz necesita ventas y costos</strong>
                      <p>Cuando haya productos vendidos con receta cargada, Dico podrá construir el ranking.</p>
                    </div>
                  )}

                  <button type="button" className="ag-resumen-dico-trigger" onClick={abrirResumen}>
                    <span>Resumen Dico</span>
                    <small>La vía rápida para priorizar decisiones</small>
                    <i aria-hidden="true">→</i>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
