/**
 * NuevoPedido — cargar a mano un pedido que llego por WhatsApp, por telefono
 * o en el mostrador.
 *
 * PARA QUIEN Y EN QUE MOMENTO
 * Alguien con el telefono en una mano y el chat del cliente abierto en la
 * otra. Por eso el flujo es corto y siempre en el mismo orden: tocar
 * productos, continuar, nombre y telefono, cargar. Lo que no cambia casi nunca
 * (retira, efectivo, WhatsApp) viene elegido.
 *
 * QUE NO DECIDE ESTA PANTALLA
 * El precio. Lo que se ve es la vista previa de `pedidoManual.js`; el total
 * que vale lo calcula submit-order (promos del dia, tasa congelada). Las
 * opciones se validan con la MISMA funcion del servidor (`armarLinea`).
 *
 * El servicio no se importa: llega por `onConfirmar`, asi la pantalla se
 * prueba y se previsualiza sin red.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Dialog from '../../ui/Dialog';
import {
  ORIGENES_MANUALES, productosCargables, categoriasDe, filtrarProductos,
  armarLinea, agregarLinea, cambiarCantidad, totalCarrito, unidadesCarrito,
  cuentasDeCobro, validarPedidoManual, cuerpoPedidoManual,
} from '../../../lib/pedidoManual';
import {
  limitesDeGrupo, seleccionDesdeEstado, extrasDeSeleccion, requiereOpciones,
} from '../../../lib/opcionesPedido';
import { formatearMonto, aSecundaria } from '../../../lib/moneda';
import '../../../styles/admin-nuevo-pedido.css';

const ENTREGAS = [
  { id: 'retiro', label: 'Retiro' },
  { id: 'envio', label: 'Envío' },
];

// Como se nombra la secundaria en una frase ("sin tasa del dia en Bs.").
const NOMBRE_MONEDA = { VES: 'Bs.', USD: 'dólares', ARS: 'pesos' };

// Los errores de opciones salen de la funcion del servidor, escrita sin
// tildes a proposito (corre en Deno y en el front). Aca solo se muestran.
const conTildes = (s) => String(s || '')
  .replace(/\bElegi\b/g, 'Elegí')
  .replace(/\bmaximo\b/g, 'máximo')
  .replace(/\bOpcion invalida\b/g, 'Opción inválida')
  .replace(/"([^"]*)"/g, '“$1”');

// Las entradas que el panel agrega al historial (ver el efecto del gesto
// atras). Cuando la pantalla saca la suya con history.back(), el popstate que
// provoca no es del usuario. Es una bandera y no un contador a proposito: ese
// popstate suele llegar cuando la pantalla ya se desmonto, y un contador
// quedaria en 1 y se comeria el proximo atras de verdad. La bandera la apaga
// un listener de un solo uso, haya o no pantalla montada, y vence sola por si
// el popstate no llega nunca: una bandera trabada se comeria el atras real.
let backPropioHasta = 0;
const VENCE_BACK_PROPIO_MS = 400;
const MARCA_HISTORIAL = 'dicoNuevoPedido';

// Cuanto queda a la vista el "Deshacer" despues de quitar una linea.
const DESHACER_MS = 6000;

const fechaCorta = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || ''));
  return m ? `${m[3]}/${m[2]}` : '';
};

function textoRegla(g) {
  const { min, max } = limitesDeGrupo(g);
  if (min >= 1) {
    if (min === max) return `Obligatorio · elegí ${min}`;
    return `Obligatorio · elegí entre ${min} y ${max}`;
  }
  if (g.type === 'single') return 'Opcional · tocá de nuevo para sacarla';
  return max >= g.choices.length ? 'Opcional' : `Opcional · hasta ${max}`;
}

/** Nombres de los grupos que hay que elegir, para la pista de la fila. */
function pistaDeOpciones(p) {
  return (p.option_groups || [])
    .filter((g) => Array.isArray(g?.choices) && limitesDeGrupo(g).min >= 1)
    .map((g) => g.name)
    .join(' · ');
}

/** Lineas del carrito de la vista previa: se arman con la funcion real. */
function carritoInicial(spec, productos) {
  let c = [];
  for (const s of spec || []) {
    const p = productos.find((x) => x.id === s.productoId);
    if (!p) continue;
    const r = armarLinea(p, s.seleccion || [], s.qty || 1);
    if (r.ok) c = agregarLinea(c, r.linea);
  }
  return c;
}

function Stepper({ valor, min = 0, max = 999, onCambiar, nombre, quitarAlMinimo = false }) {
  // En 1, el "−" de una linea del carrito la borra entera (con sus opciones):
  // se dice con la palabra, no con el mismo signo que resta.
  const quita = quitarAlMinimo && valor <= 1;
  return (
    <span className="ag-np-stepper">
      {quita ? (
        <button
          type="button" className="ag-np-stepper-quitar" aria-label={`Quitar ${nombre}`}
          onClick={() => onCambiar(0)}
        >
          Quitar
        </button>
      ) : (
        <button
          type="button" aria-label={`Restar uno de ${nombre}`}
          disabled={!quitarAlMinimo && valor <= min}
          onClick={() => onCambiar(valor - 1)}
        >
          <span aria-hidden="true">−</span>
        </button>
      )}
      <output aria-label={`Cantidad de ${nombre}`}>{valor}</output>
      <button
        type="button" aria-label={`Sumar uno de ${nombre}`}
        disabled={valor >= max}
        onClick={() => onCambiar(valor + 1)}
      >
        <span aria-hidden="true">+</span>
      </button>
    </span>
  );
}

/** El monto en la secundaria, o por que no se puede dar. No bloquea nada. */
function LineaSecundaria({ total, moneda, enPie = true }) {
  const secundaria = moneda?.monedaSecundaria || null;
  if (!secundaria) return null;
  const tasa = Number(moneda?.tasa) > 0 ? Number(moneda.tasa) : null;
  const nombre = NOMBRE_MONEDA[secundaria] || secundaria;
  if (!tasa) {
    return <p className="ag-np-aviso">Sin tasa del día: el monto en {nombre} lo calcula el sistema.</p>;
  }
  const monto = formatearMonto(aSecundaria(total, tasa), secundaria);
  if (moneda?.vencida) {
    const del = fechaCorta(moneda?.fecha);
    return <p className="ag-np-aviso">≈ {monto} · tasa vencida{del ? ` (del ${del})` : ''}</p>;
  }
  return <p className={enPie ? 'ag-np-tasa' : 'ag-np-unitario'}>≈ {monto} con la tasa del día</p>;
}

function GrupoDeOpciones({ uid, grupo, estado, onElegir, falta, fmt }) {
  const { min, max } = limitesDeGrupo(grupo);
  const elegidas = estado || {};
  const cuantas = Object.values(elegidas).filter((q) => q > 0).length;
  const lleno = grupo.type !== 'single' && cuantas >= max;
  const reglaId = `${uid}-regla-${grupo.id}`;

  return (
    <fieldset
      id={`${uid}-grupo-${grupo.id}`}
      className={`ag-np-grupo${falta ? ' falta' : ''}`}
      aria-describedby={reglaId}
    >
      <legend>{grupo.name}</legend>
      <p id={reglaId} className="ag-np-grupo-regla">
        {falta ? `Falta elegir · ${textoRegla(grupo).toLowerCase()}` : textoRegla(grupo)}
      </p>
      <div className="ag-np-elecciones">
        {grupo.choices.map((c) => {
          const qty = elegidas[c.id] || 0;
          const precio = Number(c.price) || 0;
          const extra = precio > 0 ? <span className="ag-np-eleccion-precio">+{fmt(precio)}</span> : <span />;

          // Una opcion que se puede pedir varias veces (2 salsas iguales) va
          // con contador; el tope de elecciones del grupo sigue contando
          // opciones distintas, igual que el servidor.
          if (grupo.type !== 'single' && Number(c.max_qty) > 1) {
            return (
              <div key={c.id} className={`ag-np-eleccion ag-np-eleccion--cantidad${qty ? ' con-cantidad' : ''}`}>
                <span className="ag-np-eleccion-texto">
                  {c.label}
                  {precio > 0 && <span className="ag-np-eleccion-sub">+{fmt(precio)} c/u</span>}
                </span>
                <Stepper
                  valor={qty} min={0}
                  max={qty === 0 && lleno ? 0 : Number(c.max_qty)}
                  nombre={c.label}
                  onCambiar={(n) => onElegir(grupo, c, n)}
                />
              </div>
            );
          }

          const esRadio = grupo.type === 'single';
          return (
            <label key={c.id} className="ag-np-eleccion">
              <input
                type={esRadio ? 'radio' : 'checkbox'}
                className="ag-np-nativo"
                name={`${uid}-${grupo.id}`}
                checked={qty > 0}
                disabled={!esRadio && !qty && lleno}
                onChange={(e) => onElegir(grupo, c, esRadio ? 1 : (e.target.checked ? 1 : 0))}
                // Un radio elegido no dispara onChange al tocarlo otra vez. En un
                // grupo opcional ese toque es "ninguna": sin esto, una vez
                // elegida no habia forma de volver a no querer nada.
                onClick={esRadio && min === 0 && qty > 0 ? () => onElegir(grupo, c, 0) : undefined}
              />
              <span className={`ag-np-marca${esRadio ? '' : ' ag-np-marca--cuadrada'}`} aria-hidden="true" />
              <span className="ag-np-eleccion-texto">{c.label}</span>
              {extra}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Segmentado({ uid, nombre, opciones, valor, onCambiar }) {
  return (
    <div className="ag-np-seg">
      {opciones.map((o) => (
        <label key={o.id} className="ag-np-eleccion">
          <input
            type="radio" className="ag-np-nativo" name={`${uid}-${nombre}`}
            value={o.id} checked={valor === o.id} onChange={() => onCambiar(o.id)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function NuevoPedido({
  productos = [], settings = null, moneda = null, tenantSlug = null,
  onConfirmar, onCreado, onCerrar,
  // Solo para la vista previa (npm run pantalla), que pinta el primer render
  // sin efectos ni interaccion: paso, carrito, ficha abierta y formulario.
  estadoInicial = null,
  // Solo para la vista previa: el render de servidor no monta portales.
  sinPortal = false,
}) {
  const uid = useId();
  const ini = estadoInicial || {};
  const principal = moneda?.monedaPrincipal || 'ARS';
  // ARS va entero, igual que la tarjeta de Pedidos (money de OrdersPanel).
  const fmt = (n) => (principal === 'ARS'
    ? `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
    : formatearMonto(n, principal));

  const cargables = useMemo(() => productosCargables(productos), [productos]);
  const categorias = useMemo(() => categoriasDe(cargables), [cargables]);
  const cuentas = useMemo(() => cuentasDeCobro(settings), [settings]);
  const conFotos = cargables.some((p) => p.image_url);

  const [paso, setPaso] = useState(ini.paso || 'productos');
  const [texto, setTexto] = useState(ini.texto || '');
  const [categoria, setCategoria] = useState(ini.categoria || null);
  const [carrito, setCarrito] = useState(() => carritoInicial(ini.carrito, cargables));
  const [abierto, setAbierto] = useState(() => cargables.find((p) => p.id === ini.productoAbiertoId) || null);
  const [opciones, setOpciones] = useState(ini.opciones || {});
  const [qtyFicha, setQtyFicha] = useState(1);
  const [intentoFicha, setIntentoFicha] = useState(!!ini.intentoFicha);
  const [form, setForm] = useState({
    cliente: '', telefono: '', entrega: 'retiro', direccion: '',
    pago: 'efectivo', origen: ORIGENES_MANUALES[0].id, nota: '',
    ...(ini.form || {}),
  });
  const [intentado, setIntentado] = useState(!!ini.intentado);
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState(ini.errorServidor || null);
  const [descartando, setDescartando] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const [quitada, setQuitada] = useState(null); // { linea, indice } para deshacer

  // El estado se actualiza async: dos toques rapidos en "Cargar" verian
  // `enviando` en false los dos. El ref corta el segundo en el acto.
  const enviandoRef = useRef(false);
  const tituloRef = useRef(null);
  const buscarRef = useRef(null);
  const fichaTituloRef = useRef(null);
  const seguirRef = useRef(null);
  const clienteRef = useRef(null);
  const telefonoRef = useRef(null);
  const direccionRef = useRef(null);
  const carritoRef = useRef(null);
  const cerrarRef = useRef(null);
  const pedidoTituloRef = useRef(null);
  const lineasRef = useRef(null);
  const volverAProducto = useRef(null);
  const atrasRef = useRef(null);

  const total = totalCarrito(carrito);
  const unidades = unidadesCarrito(carrito);
  // Escribir busca en TODA la carta: con "Bandejas" elegida, "tequ" tiene que
  // encontrar los tequeños. Mientras hay texto la categoria no filtra y los
  // chips marcan "Todo".
  const buscando = texto.trim() !== '';
  const categoriaVista = buscando ? null : categoria;
  const visibles = filtrarProductos(cargables, { texto, categoria: categoriaVista });
  const enCarrito = useMemo(() => {
    const m = new Map();
    for (const l of carrito) m.set(l.productId, (m.get(l.productId) || 0) + l.qty);
    return m;
  }, [carrito]);
  const errores = intentado
    ? validarPedidoManual({ carrito, cliente: form.cliente, telefono: form.telefono, entrega: form.entrega, direccion: form.direccion })
    : {};
  const hayAlgoCargado = carrito.length > 0 || !!form.cliente.trim() || !!form.telefono.trim();

  // Foco al abrir. El trap del Dialog ya lo deja adentro (en la X); con
  // teclado y mouse se adelanta al buscador. En el telefono NO: abrir el
  // teclado de entrada tapa media lista, y lo comun es tocar, no tipear.
  useEffect(() => {
    if (ini.paso === 'datos') return;
    const fino = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: fine)').matches;
    if (fino) buscarRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (descartando) seguirRef.current?.focus(); }, [descartando]);

  const set = (campo) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [campo]: v }));
  };

  // ── Productos ──────────────────────────────────────────────────────
  const sumar = (linea) => {
    const nuevo = agregarLinea(carrito, linea);
    setCarrito(nuevo);
    const u = unidadesCarrito(nuevo);
    setAnuncio(`${linea.nombre}: agregado. ${u === 1 ? '1 producto' : `${u} productos`}, ${fmt(totalCarrito(nuevo))}.`);
  };

  // ── Lineas del carrito: quitar con deshacer ────────────────────────
  const cambiarLinea = (linea, indice, qty) => {
    if (qty > 0) { setCarrito((c) => cambiarCantidad(c, linea.key, qty)); return; }
    setCarrito((c) => cambiarCantidad(c, linea.key, 0));
    setQuitada({ linea, indice });
    setAnuncio(`${linea.nombre}: quitado.`);
    // El boton que se toco ya no existe: el foco va a la linea que quedo en
    // ese lugar, a la anterior, o al titulo "Pedido" si no queda ninguna.
    requestAnimationFrame(() => {
      const items = lineasRef.current?.children || [];
      const destino = items[indice] || items[indice - 1];
      const boton = destino?.querySelector('button');
      if (boton) boton.focus();
      else pedidoTituloRef.current?.focus();
    });
  };
  const deshacer = () => {
    if (!quitada) return;
    const { linea, indice } = quitada;
    setCarrito((c) => (c.some((l) => l.key === linea.key)
      ? c : [...c.slice(0, indice), linea, ...c.slice(indice)]));
    setQuitada(null);
    setAnuncio(`${linea.nombre}: volvió al pedido.`);
  };
  useEffect(() => {
    if (!quitada) return undefined;
    const t = setTimeout(() => setQuitada(null), DESHACER_MS);
    return () => clearTimeout(t);
  }, [quitada]);

  const abrirFicha = (p, desdeOpciones = false) => {
    volverAProducto.current = `${uid}-${desdeOpciones ? 'o' : 'p'}-${p.id}`;
    setAbierto(p);
    setOpciones({});
    setQtyFicha(1);
    setIntentoFicha(false);
    // La ficha reemplaza a la lista: el foco va a su titulo, no se pierde.
    requestAnimationFrame(() => fichaTituloRef.current?.focus());
  };

  const cerrarFicha = () => {
    const id = volverAProducto.current;
    setAbierto(null);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  };

  const tocarProducto = (p) => {
    if (requiereOpciones(p)) { abrirFicha(p); return; }
    const r = armarLinea(p, [], 1);
    if (r.ok) sumar(r.linea);
    else abrirFicha(p);
  };

  const elegir = (grupo, choice, qty) => {
    setOpciones((o) => {
      const delGrupo = grupo.type === 'single' ? {} : { ...(o[grupo.id] || {}) };
      if (qty > 0) delGrupo[choice.id] = qty;
      else delete delGrupo[choice.id];
      return { ...o, [grupo.id]: delGrupo };
    });
  };

  const seleccion = abierto ? seleccionDesdeEstado(opciones) : [];
  const gruposFicha = abierto && Array.isArray(abierto.option_groups) ? abierto.option_groups : [];
  const faltan = new Set(gruposFicha.filter((g) => {
    const { min, max } = limitesDeGrupo(g);
    const n = seleccion.filter((s) => s.groupId === g.id).length;
    return n < min || n > max;
  }).map((g) => g.id));
  const precioFicha = abierto
    ? ((Number(abierto.price) || 0) + extrasDeSeleccion(gruposFicha, seleccion)) * qtyFicha
    : 0;
  const errorFicha = abierto && intentoFicha ? armarLinea(abierto, seleccion, qtyFicha) : null;

  const agregarDesdeFicha = () => {
    const r = armarLinea(abierto, seleccion, qtyFicha);
    if (!r.ok) {
      setIntentoFicha(true);
      // Al grupo que falta: lo que se ve no alcanza si quedo fuera de pantalla.
      const g = document.getElementById(`${uid}-grupo-${[...faltan][0]}`);
      g?.scrollIntoView?.({ block: 'center' });
      g?.querySelector('input:not([disabled]), button:not([disabled])')?.focus({ preventScroll: true });
      return;
    }
    sumar(r.linea);
    cerrarFicha();
  };

  // ── Datos ──────────────────────────────────────────────────────────
  const irADatos = () => {
    setPaso('datos');
    requestAnimationFrame(() => clienteRef.current?.focus());
  };
  const volverAProductos = () => {
    setPaso('productos');
    requestAnimationFrame(() => tituloRef.current?.focus());
  };

  const confirmar = async () => {
    if (enviandoRef.current) return;
    const errs = validarPedidoManual({
      carrito, cliente: form.cliente, telefono: form.telefono, entrega: form.entrega, direccion: form.direccion,
    });
    setIntentado(true);
    const primero = ['cliente', 'telefono', 'direccion', 'carrito'].find((k) => errs[k]);
    if (primero) {
      const refs = { cliente: clienteRef, telefono: telefonoRef, direccion: direccionRef, carrito: carritoRef };
      refs[primero].current?.focus();
      return;
    }

    const cuerpo = cuerpoPedidoManual({ tenantSlug, carrito, ...form });
    enviandoRef.current = true;
    setEnviando(true);
    setErrorServidor(null);
    let r;
    try {
      r = await onConfirmar?.(cuerpo);
    } catch {
      r = null;
    }
    if (!r?.ok) {
      enviandoRef.current = false;
      setEnviando(false);
      setErrorServidor(r?.error || 'No se pudo cargar el pedido. Probá de nuevo.');
      return;
    }
    onCreado?.(r, cuerpo);
    onCerrar?.();
  };

  // ── Cerrar ─────────────────────────────────────────────────────────
  // Lo cargado no se pierde por un toque: con algo adentro se pregunta.
  const cerrarTodo = () => {
    if (enviandoRef.current) return;
    if (hayAlgoCargado) { setDescartando(true); return; }
    onCerrar?.();
  };
  const seguirCargando = () => {
    setDescartando(false);
    requestAnimationFrame(() => cerrarRef.current?.focus());
  };
  // Escape, el fondo y el gesto atras: primero deshacen lo ultimo que se
  // abrio. Devuelve true si la pantalla sigue abierta.
  const retroceder = () => {
    if (enviandoRef.current) return true;
    if (descartando) { seguirCargando(); return true; }
    if (abierto) { cerrarFicha(); return true; }
    if (hayAlgoCargado) { setDescartando(true); return true; }
    onCerrar?.();
    return false;
  };
  const alEscape = () => {
    // Escape en el buscador con texto solo borra el texto. El trap del Dialog
    // escucha en captura, asi que se resuelve aca y no en el input.
    if (texto && typeof document !== 'undefined' && document.activeElement === buscarRef.current) {
      setTexto('');
      return;
    }
    retroceder();
  };

  // ── Gesto atras del sistema (Android) y recarga ────────────────────
  // Sin esto el atras del telefono sale del panel y se pierde lo cargado: la
  // pantalla no es una ruta. Al abrir se agrega una entrada al historial; el
  // atras la consume y se trata como Escape (con algo cargado, pregunta). Si
  // la pantalla sigue abierta, se vuelve a agregar.
  useEffect(() => { atrasRef.current = retroceder; });
  useEffect(() => {
    if (sinPortal || typeof window === 'undefined' || !window.history?.pushState) return undefined;
    const empujar = () => window.history.pushState(
      { ...(window.history.state || {}), [MARCA_HISTORIAL]: true }, '',
    );
    empujar();
    const alVolver = () => {
      if (Date.now() < backPropioHasta) return;
      if (atrasRef.current?.()) empujar();
    };
    window.addEventListener('popstate', alVolver);
    return () => {
      window.removeEventListener('popstate', alVolver);
      // Cerrada por la X, por Descartar o al cargar: la entrada propia sale
      // del historial para que el proximo atras haga lo de siempre.
      if (window.history.state?.[MARCA_HISTORIAL]) {
        backPropioHasta = Date.now() + VENCE_BACK_PROPIO_MS;
        const apagar = () => {
          window.removeEventListener('popstate', apagar);
          // Despues de que todos los listeners vieron este popstate.
          setTimeout(() => { backPropioHasta = 0; }, 0);
        };
        window.addEventListener('popstate', apagar);
        window.history.back();
      }
    };
  }, [sinPortal]);
  useEffect(() => {
    if (!hayAlgoCargado || typeof window === 'undefined') return undefined;
    const alSalir = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [hayAlgoCargado]);

  // ── Piezas ─────────────────────────────────────────────────────────
  const enFicha = paso === 'productos' && !!abierto;
  const subtitulo = paso === 'datos'
    ? 'Datos del cliente'
    : enFicha ? 'Elegí las opciones' : 'Elegí los productos';
  const atras = paso === 'datos' ? 'Volver a productos' : enFicha ? 'Volver a la lista' : null;

  const cabeza = (
    <header className="ag-np-cabeza">
      <div className="ag-np-cabeza-fila">
        {atras && (
          <button
            type="button" className="ag-np-icono" aria-label={atras}
            onClick={paso === 'datos' ? volverAProductos : cerrarFicha}
          >
            <span aria-hidden="true">‹</span>
          </button>
        )}
        <div className="ag-np-titulos">
          <h2 id={`${uid}-titulo`} ref={tituloRef} tabIndex={-1} className="ag-np-titulo">Nuevo pedido</h2>
          <p className="ag-np-subtitulo">{subtitulo}</p>
        </div>
        <button type="button" ref={cerrarRef} className="ag-np-icono" aria-label="Cerrar" onClick={cerrarTodo}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {paso === 'productos' && !enFicha && cargables.length > 0 && (
        <>
          <div className="ag-np-buscar" role="search">
            <label htmlFor={`${uid}-buscar`} className="ag-sr-only">Buscar producto</label>
            <input
              id={`${uid}-buscar`} ref={buscarRef} type="search" className="ag-np-input"
              placeholder="Buscar producto…" autoComplete="off" enterKeyHint="search"
              value={texto} onChange={(e) => setTexto(e.target.value)}
            />
            {texto && (
              <button
                type="button" className="ag-np-icono" aria-label="Borrar búsqueda"
                onClick={() => { setTexto(''); buscarRef.current?.focus(); }}
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
          {categorias.length > 1 && (
            <div className="ag-np-chips" role="group" aria-label="Categorías">
              <button
                type="button" className="ag-np-chip" aria-pressed={categoriaVista === null}
                onClick={() => { setTexto(''); setCategoria(null); }}
              >
                Todo
              </button>
              {categorias.map((c) => (
                <button
                  key={c} type="button" className="ag-np-chip" aria-pressed={categoriaVista === c}
                  onClick={() => { setTexto(''); setCategoria(categoriaVista === c ? null : c); }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </header>
  );

  const lista = (
    <div className="ag-np-cuerpo" hidden={paso !== 'productos' || enFicha}>
      {cargables.length === 0 ? (
        <div className="ag-np-vacio">
          <p>Este negocio todavía no tiene productos activos para cargar.</p>
        </div>
      ) : visibles.length === 0 ? (
        <div className="ag-np-vacio">
          <p>No hay productos con “{texto || categoria}”.</p>
          <button type="button" className="ag-np-secundario" onClick={() => { setTexto(''); setCategoria(null); }}>
            Ver todos
          </button>
        </div>
      ) : (
        <ul className="ag-np-lista" aria-label="Productos">
          {visibles.map((p) => {
            const n = enCarrito.get(p.id) || 0;
            const obligatorias = requiereOpciones(p);
            const opcionales = !obligatorias && Array.isArray(p.option_groups) && p.option_groups.length > 0;
            const pista = obligatorias ? pistaDeOpciones(p) : null;
            return (
              <li key={p.id} className="ag-np-fila">
                <button
                  id={`${uid}-p-${p.id}`} type="button"
                  className={`ag-np-prod${conFotos ? ' ag-np-prod--con-foto' : ''}${n ? ' en-pedido' : ''}`}
                  onClick={() => tocarProducto(p)}
                >
                  {conFotos && (p.image_url
                    ? <img className="ag-np-foto" src={p.image_url} alt="" loading="lazy" decoding="async" />
                    : <span className="ag-np-foto" aria-hidden="true" />)}
                  <span className="ag-np-prod-texto">
                    <span className="ag-np-prod-nombre">{p.name}</span>
                    {pista && <span className="ag-np-prod-pista">{pista}</span>}
                  </span>
                  <span className="ag-np-prod-lado">
                    <span className="ag-np-precio">{fmt(p.price)}</span>
                    {n > 0 && (
                      <span className="ag-np-cuenta">
                        <span aria-hidden="true">×{n}</span>
                        <span className="ag-sr-only">, {n} en el pedido</span>
                      </span>
                    )}
                    {obligatorias && <span className="ag-np-chevron" aria-hidden="true">›</span>}
                  </span>
                </button>
                {opcionales && (
                  <button
                    id={`${uid}-o-${p.id}`} type="button" className="ag-np-prod-opciones"
                    aria-label={`Elegir opciones de ${p.name}`}
                    onClick={() => abrirFicha(p, true)}
                  >
                    Opciones
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const ficha = enFicha && (
    <div className="ag-np-cuerpo">
      <section className="ag-np-ficha" aria-labelledby={`${uid}-ficha`}>
        <div>
          <h3 id={`${uid}-ficha`} ref={fichaTituloRef} tabIndex={-1} className="ag-np-ficha-nombre">{abierto.name}</h3>
          <p className="ag-np-ficha-precio">{fmt(abierto.price)}</p>
        </div>
        {gruposFicha.map((g) => (
          <GrupoDeOpciones
            key={g.id} uid={uid} grupo={g} estado={opciones[g.id]} onElegir={elegir}
            falta={intentoFicha && faltan.has(g.id)} fmt={fmt}
          />
        ))}
        <div className="ag-np-cantidad">
          <span className="ag-np-cantidad-etiqueta" id={`${uid}-cant`}>Cantidad</span>
          <Stepper valor={qtyFicha} min={1} nombre={abierto.name} onCambiar={(n) => setQtyFicha(Math.max(1, n))} />
        </div>
      </section>
    </div>
  );

  const datos = paso === 'datos' && (
    <div className="ag-np-cuerpo">
      <div className="ag-np-datos">
        <section className="ag-np-campos" aria-labelledby={`${uid}-h-cliente`}>
          <h3 id={`${uid}-h-cliente`} className="ag-np-bloque-titulo">Cliente</h3>
          <div className="ag-np-campo">
            <label htmlFor={`${uid}-cliente`} className="ag-np-etiqueta">Nombre</label>
            <input
              id={`${uid}-cliente`} ref={clienteRef} className="ag-np-input"
              autoComplete="off" autoCapitalize="words" enterKeyHint="next"
              value={form.cliente} onChange={set('cliente')}
              aria-invalid={errores.cliente ? true : undefined}
              aria-describedby={errores.cliente ? `${uid}-e-cliente` : undefined}
            />
            {errores.cliente && <p id={`${uid}-e-cliente`} className="ag-np-error-campo">{errores.cliente}</p>}
          </div>
          <div className="ag-np-campo">
            <label htmlFor={`${uid}-telefono`} className="ag-np-etiqueta">Teléfono</label>
            <input
              id={`${uid}-telefono`} ref={telefonoRef} className="ag-np-input"
              type="tel" inputMode="tel" autoComplete="off" enterKeyHint="done"
              value={form.telefono} onChange={set('telefono')}
              aria-invalid={errores.telefono ? true : undefined}
              aria-describedby={errores.telefono ? `${uid}-e-telefono` : undefined}
            />
            {errores.telefono && <p id={`${uid}-e-telefono`} className="ag-np-error-campo">{errores.telefono}</p>}
          </div>
        </section>

        <fieldset className="ag-np-bloque">
          <legend>Entrega</legend>
          <div className="ag-np-campos">
            <Segmentado uid={uid} nombre="entrega" opciones={ENTREGAS} valor={form.entrega} onCambiar={set('entrega')} />
            {form.entrega === 'envio' && (
              <div className="ag-np-campo">
                <label htmlFor={`${uid}-direccion`} className="ag-np-etiqueta">Dirección del envío</label>
                <textarea
                  id={`${uid}-direccion`} ref={direccionRef} className="ag-np-input" rows={2}
                  autoComplete="off" value={form.direccion} onChange={set('direccion')}
                  aria-invalid={errores.direccion ? true : undefined}
                  aria-describedby={errores.direccion ? `${uid}-e-direccion` : undefined}
                />
                {errores.direccion && <p id={`${uid}-e-direccion`} className="ag-np-error-campo">{errores.direccion}</p>}
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="ag-np-bloque">
          <legend>Cómo paga</legend>
          <div className="ag-np-elecciones">
            <label className="ag-np-eleccion">
              <input
                type="radio" className="ag-np-nativo" name={`${uid}-pago`} value="efectivo"
                checked={form.pago === 'efectivo'} onChange={() => set('pago')('efectivo')}
              />
              <span className="ag-np-marca" aria-hidden="true" />
              <span className="ag-np-eleccion-texto">Efectivo</span>
              <span />
            </label>
            {cuentas.map((c) => (
              <label key={c.id} className="ag-np-eleccion">
                <input
                  type="radio" className="ag-np-nativo" name={`${uid}-pago`} value={c.id}
                  checked={form.pago === c.id} onChange={() => set('pago')(c.id)}
                />
                <span className="ag-np-marca" aria-hidden="true" />
                <span className="ag-np-eleccion-texto">
                  {c.label || c.banco || 'Cuenta'}
                  {(c.banco || c.moneda) && (
                    <span className="ag-np-eleccion-sub">
                      {[c.label ? c.banco : null, c.moneda].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <span />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="ag-np-bloque">
          <legend>Llegó por</legend>
          <Segmentado uid={uid} nombre="origen" opciones={ORIGENES_MANUALES} valor={form.origen} onCambiar={set('origen')} />
        </fieldset>

        <div className="ag-np-campo">
          <label htmlFor={`${uid}-nota`} className="ag-np-etiqueta">Nota <small>(opcional)</small></label>
          <textarea
            id={`${uid}-nota`} className="ag-np-input" rows={2} maxLength={280}
            placeholder="Sin cebolla, timbre roto, paga con billete grande…"
            value={form.nota} onChange={set('nota')}
          />
        </div>

        <section aria-labelledby={`${uid}-h-pedido`}>
          <h3 id={`${uid}-h-pedido`} ref={pedidoTituloRef} tabIndex={-1} className="ag-np-bloque-titulo">Pedido</h3>
          {carrito.length === 0 ? (
            <div className="ag-np-vacio">
              <p>El pedido quedó vacío.</p>
            </div>
          ) : (
            <ul className="ag-np-lineas" ref={lineasRef}>
              {carrito.map((l, i) => (
                <li key={l.key} className="ag-np-linea">
                  <span className="ag-np-linea-nombre">{l.nombre}</span>
                  <span className="ag-np-linea-subtotal">{fmt(l.unitPrice * l.qty)}</span>
                  {l.detalle && <span className="ag-np-linea-detalle">{l.detalle}</span>}
                  <span className="ag-np-linea-pie">
                    <Stepper
                      valor={l.qty} quitarAlMinimo nombre={l.nombre}
                      onCambiar={(n) => cambiarLinea(l, i, n)}
                    />
                    <span className="ag-np-unitario">{fmt(l.unitPrice)} c/u</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {carrito.length > 0 && (
            <div className="ag-np-estimado">
              <span>Total estimado</span>
              <span>{fmt(total)}</span>
            </div>
          )}
          <p className="ag-np-aclaracion">
            El total final lo calcula el sistema al cargar: aplica las promos del día y congela la tasa.
          </p>
          <div className="ag-np-campos">
            <button
              type="button" ref={carritoRef} className="ag-np-secundario"
              onClick={volverAProductos}
              aria-describedby={errores.carrito ? `${uid}-e-carrito` : undefined}
            >
              Agregar más productos
            </button>
            {errores.carrito && <p id={`${uid}-e-carrito`} className="ag-np-error-campo">{errores.carrito}</p>}
          </div>
        </section>
      </div>
    </div>
  );

  let pie;
  if (descartando) {
    pie = (
      <div className="ag-np-pie" role="group" aria-labelledby={`${uid}-descartar`}>
        <p id={`${uid}-descartar`} className="ag-np-descartar-texto">
          ¿Descartar este pedido? Se pierde lo que cargaste.
        </p>
        <div className="ag-np-pie-fila">
          <button type="button" ref={seguirRef} className="ag-np-secundario" onClick={seguirCargando}>
            Seguir cargando
          </button>
          <button type="button" className="ag-np-peligro" onClick={() => onCerrar?.()}>
            Descartar
          </button>
        </div>
      </div>
    );
  } else if (enFicha) {
    pie = (
      <div className="ag-np-pie">
        {errorFicha && !errorFicha.ok && (
          <p role="alert" className="ag-np-error">{conTildes(errorFicha.error)}</p>
        )}
        <button type="button" className="ag-np-accion ag-np-accion--ancha" onClick={agregarDesdeFicha}>
          Agregar · {fmt(precioFicha)}
        </button>
      </div>
    );
  } else if (paso === 'datos') {
    pie = (
      <div className="ag-np-pie">
        {errorServidor && <p role="alert" className="ag-np-error">{errorServidor}</p>}
        {quitada && (
          <div className="ag-np-deshacer">
            <p>Quitaste {quitada.linea.nombre}.</p>
            <button type="button" className="ag-np-secundario" onClick={deshacer}>Deshacer</button>
          </div>
        )}
        {carrito.length > 0 && <LineaSecundaria total={total} moneda={moneda} />}
        <button
          type="button" className="ag-np-accion ag-np-accion--ancha"
          disabled={enviando} aria-busy={enviando || undefined} onClick={confirmar}
        >
          {enviando ? 'Cargando pedido…' : `Cargar pedido · ${fmt(total)}`}
        </button>
      </div>
    );
  } else {
    pie = (
      <div className="ag-np-pie">
        <div className="ag-np-pie-fila">
          <div className="ag-np-totales">
            {unidades > 0 ? (
              <>
                <span className="ag-np-unidades">{unidades === 1 ? '1 producto' : `${unidades} productos`}</span>
                <span className="ag-np-total">{fmt(total)}</span>
              </>
            ) : (
              <span className="ag-np-unidades">Tocá un producto para sumarlo</span>
            )}
          </div>
          <button type="button" className="ag-np-accion" disabled={unidades === 0} onClick={irADatos}>
            Continuar
          </button>
        </div>
        {unidades > 0 && <LineaSecundaria total={total} moneda={moneda} />}
      </div>
    );
  }

  const contenido = (
    <>
      {/* Region viva FIJA: montada siempre, para que se anuncie tambien lo que
          se agrega desde la ficha (cuyo pie no tiene totales). */}
      <p className="ag-sr-only" aria-live="polite" aria-atomic="true">{anuncio}</p>
      {cabeza}
      {lista}
      {ficha}
      {datos}
      {pie}
    </>
  );

  if (sinPortal) {
    return (
      <div className="ag-dialog-backdrop">
        <div
          role="dialog" aria-modal="true" aria-labelledby={`${uid}-titulo`}
          className="ag-dialog-panel ag-dialog-panel--sheet ag-np"
        >
          {contenido}
        </div>
      </div>
    );
  }

  return (
    <Dialog open onClose={alEscape} labelledBy={`${uid}-titulo`} variante="sheet" className="ag-np">
      {contenido}
    </Dialog>
  );
}
