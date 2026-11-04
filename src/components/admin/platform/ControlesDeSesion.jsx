import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import {
  duracionCorta, estaOperativo, horaDelLocal, ventanaOperativa,
} from '../../../modules/estadoOperativo';
import { fraseDe, nombreDe, saludoDe } from '../../../modules/saludo';
import { getTenantSlugSync } from '../../../lib/activeTenant';
import { irAlAdmin, irALaConsola, negociosDelUsuario } from '../../../services/entradaUnica';
import { soyStaffDivianco } from '../../../services/platformPlanes';
import { CATALOGO_ARIA, CATALOGO_HREF, IconoCatalogo, LogoNegocio } from './TopbarNegocio';
import { estadoDeInstalacion, pedirInstalacion, suscribirInstalacion } from '../../../lib/instalarApp';
import GuiaDeInstalacion from './GuiaDeInstalacion';

/* Los iconos, en linea y del mismo trazo que los de la navegacion (22px,
   stroke 2, redondeado). Van aca y no en un modulo de iconos porque son tres
   y solo los usa este archivo. */
const IconoConfig = () => (
  <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconoSol = () => (
  <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const IconoLuna = () => (
  <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

const IconoSalir = () => (
  <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

const IconoTilde = () => (
  <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const IconoInstalar = () => (
  <svg className="ag-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
);

/** La lista, en el orden en que se usa: lo de todos los dias primero. */
export function controlesDeSesion({ tema, onTema, onConfig, onSalir, salirTitulo }) {
  const oscuro = tema === 'dark';
  return [
    onConfig && {
      id: 'config',
      label: 'Configuración',
      titulo: 'Configuración del negocio',
      Icono: IconoConfig,
      onClick: onConfig,
    },
    {
      id: 'tema',
      label: oscuro ? 'Tema claro' : 'Tema oscuro',
      titulo: oscuro ? 'Cambiar a claro' : 'Cambiar a oscuro',
      Icono: oscuro ? IconoSol : IconoLuna,
      onClick: onTema,
    },
    {
      id: 'salir',
      label: 'Salir',
      titulo: salirTitulo,
      Icono: IconoSalir,
      onClick: onSalir,
    },
  ].filter(Boolean);
}

/** El pie del riel, en desktop. */
export function PieDeSesion({ controles }) {
  if (!controles.length) return null;
  return (
    <div className="ag-sidebar-pie">
      {controles.map(({ id, label, titulo, Icono, onClick }) => (
        <button
          key={id}
          type="button"
          className="ag-sidebar-item"
          onClick={onClick}
          title={titulo}
          aria-label={label}
        >
          <span className="ag-sidebar-icono"><Icono /></span>
          <span className="ag-sidebar-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** Reloj aislado: el panel de trabajo no se renderiza cada segundo. */
export function RelojDeSesion({ timezone }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time className="ag-sesion-hora" dateTime={ahora.toISOString()} aria-label="Hora local">
      {horaDelLocal(ahora, timezone)}
    </time>
  );
}

/** El horario decide el texto y si la luz esta encendida. */
export function EstadoDelSistema({ settings, timezone }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const cargado = settings != null;
  const operativo = cargado && estaOperativo(settings, ahora, timezone);
  return (
    <div className="ag-sistema-operativo" data-operativo={operativo ? 'true' : 'false'}>
      <span className="ag-sistema-indicador" aria-hidden="true" />
      <span>{!cargado ? 'Verificando sistema' : operativo ? 'Sistema operativo' : 'Sistema en reposo'}</span>
    </div>
  );
}

/** Contexto humano fuera de la superficie de trabajo. */
export function ContextoDeTrabajo({ session, timezone }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const nombre = nombreDe(session) || 'Usuario';
  return (
    <div className="ag-precard">
      <p className="ag-precard-saludo">
        {saludoDe(ahora, timezone)}, <strong>{nombre}</strong>
      </p>
      <RelojDeSesion timezone={timezone} />
    </div>
  );
}

/** La frase acompana el trabajo desde afuera de la superficie madre. */
export function FraseDeTrabajo({ pantalla, timezone }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  return <p className="ag-postcard-frase">{fraseDe(pantalla, ahora, timezone)}</p>;
}

/** Estado, ventana y turno en una sola lectura operativa. */
export function BarraOperativa({ settings, timezone, turno, onOperativoChange }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const cargado = settings != null;
  const ventana = cargado ? ventanaOperativa(settings, ahora, timezone) : null;
  const operativo = !!ventana?.operativo;
  const cajaAbierta = !!turno;
  const etiqueta = operativo
    ? 'Cierre de turno'
    : ventana?.horaObjetivo
      ? `Apertura ${ventana.diaObjetivo === 'Hoy' ? '' : `${ventana.diaObjetivo} · `}${ventana.horaObjetivo}`
      : ventana?.etiqueta;
  const valor = ventana?.minutosRestantes == null
    ? ventana?.valor
    : duracionCorta(ventana.minutosRestantes);
  const porcentaje = Math.round((ventana?.progreso || 0) * 100);
  const minutosTranscurridos = ventana?.minutosTranscurridos ?? null;

  useEffect(() => {
    if (cargado) onOperativoChange?.(operativo, minutosTranscurridos);
  }, [cargado, operativo, minutosTranscurridos, onOperativoChange]);

  return (
    <div className="ag-operativa" data-operativo={operativo ? 'true' : 'false'}>
      <div className="ag-operativa-fila">
        <div className="ag-operativa-estado">
          <div className="ag-sistema-operativo" data-operativo={operativo ? 'true' : 'false'}>
            <span className="ag-sistema-indicador" aria-hidden="true" />
            <span>{!cargado ? 'Verificando sistema' : operativo ? 'Sistema operativo' : 'Sistema en reposo'}</span>
          </div>
          {cargado && (
            <span
              className="ag-operativa-caja"
              data-estado={cajaAbierta ? 'abierta' : operativo ? 'alerta' : 'apagada'}
              aria-label={`Caja ${cajaAbierta ? 'abierta' : 'cerrada'}`}
            >
              <span className="ag-caja-indicador" aria-hidden="true" />
              <span><strong>Caja</strong> {cajaAbierta ? 'abierta' : 'cerrada'}</span>
            </span>
          )}
        </div>
        <div className="ag-operativa-dato">
          <span className="ag-operativa-etiqueta">{etiqueta || 'Leyendo horario'}</span>
          <strong className="ag-operativa-valor">{valor || 'Calculando…'}</strong>
        </div>
      </div>
      <div
        className="ag-operativa-progreso"
        role="progressbar"
        aria-label={operativo ? 'Progreso de la ventana operativa' : 'Tiempo restante hasta la apertura'}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={porcentaje}
      >
        <span style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}

const ITEMS = '[role="menuitem"], [role="menuitemradio"]';
/** Lo que cierra el menu abierto, para los items que viven adentro. */
const CerrarMenu = createContext(() => {});
const MSG_SALTO = 'No pudimos abrir ese negocio. Probá de nuevo.';

/**
 * Los negocios de la persona (y la consola si es staff), para saltar de uno a
 * otro sin pasar por /entrar. Se consultan la primera vez que se abre la
 * burbuja (o que se la apunta), nunca al montar el panel. Si la consulta
 * falla, el menu ofrece reintentar.
 */
function useCuentas() {
  const [estado, setEstado] = useState({ fase: 'idle', negocios: [], staff: false, fallo: false });
  const [saltando, setSaltando] = useState(false);
  const [error, setError] = useState('');
  const pidiendo = useRef(false);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  /** Idempotente: no hace nada si ya esta pedido o resuelto. */
  const cargar = useCallback(() => {
    if (pidiendo.current) return;
    pidiendo.current = true;
    setEstado((e) => ({ ...e, fase: 'cargando' }));
    Promise.all([
      negociosDelUsuario().catch(() => ({ ok: false })),
      soyStaffDivianco().catch(() => false),
    ]).then(([r, staff]) => {
      if (!vivo.current) return;
      if (r?.ok) setEstado({ fase: 'listo', negocios: r.negocios || [], staff: !!staff, fallo: false });
      else setEstado({ fase: 'listo', negocios: [], staff: false, fallo: true });
    });
  }, []);

  const reintentar = useCallback(() => {
    pidiendo.current = false;
    cargar();
  }, [cargar]);

  const saltar = useCallback(async (fn) => {
    if (saltando) return;
    setSaltando(true);
    setError('');
    let r;
    try { r = await fn(); } catch { r = { ok: false, error: MSG_SALTO }; }
    if (!vivo.current) return;
    if (r && r.ok === false) {
      setError(r.error || MSG_SALTO);
      setSaltando(false);
    }
  }, [saltando]);

  return { ...estado, saltando, error, cargar, reintentar, saltar };
}

/**
 * Un boton que abre un menu: lo comparten la burbuja de negocios y el de la
 * cuenta. Escape y clic afuera cierran, las flechas recorren, el foco vuelve
 * al boton. `abierto` lo maneja el padre, asi abrir uno cierra el otro.
 * `enfocarCuando`: si pasa a verdadero con el menu abierto y nadie navego
 * todavia, el foco va al primer item (los negocios llegan despues de abrir).
 * `contenidoBoton` y `children` ponen lo propio de cada menu; los items
 * cierran con `useContext(CerrarMenu)`. `ocupado` marca el menu con
 * aria-busy mientras sus items cargan; `sinMenu` no monta el role="menu"
 * (un menu sin items no se anuncia: queda solo lo que diga la cabecera).
 */
function MenuDesplegable({
  abierto, onAbierto, etiquetaBoton, claseBoton, alPrecargar, etiquetaMenu,
  cabecera, enfocarCuando, contenidoBoton, children, ocupado = false, sinMenu = false,
}) {
  const raiz = useRef(null);
  const boton = useRef(null);
  const menu = useRef(null);
  const navego = useRef(false);
  const menuId = useId();

  const cerrar = useCallback((devolverFoco) => {
    // Cerrar cuenta como navegar: un foco tardio pendiente no le gana al boton.
    navego.current = true;
    onAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }, [onAbierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    navego.current = false;
    menu.current?.querySelector(ITEMS)?.focus();
    const afuera = (e) => {
      if (raiz.current && !raiz.current.contains(e.target)) onAbierto(false);
    };
    const escape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar(true);
      }
    };
    document.addEventListener('pointerdown', afuera, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', afuera, true);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto, cerrar, onAbierto]);

  useEffect(() => {
    if (!abierto || !enfocarCuando || navego.current) return;
    menu.current?.querySelector(ITEMS)?.focus();
  }, [abierto, enfocarCuando]);

  function navegar(e) {
    const lista = Array.from(menu.current.querySelectorAll(ITEMS));
    if (!lista.length) return;
    const actual = lista.indexOf(document.activeElement);
    const destinos = {
      ArrowDown: (actual + 1) % lista.length,
      ArrowUp: (actual - 1 + lista.length) % lista.length,
      Home: 0,
      End: lista.length - 1,
    };
    if (e.key in destinos) {
      e.preventDefault();
      lista[destinos[e.key]]?.focus();
    }
  }

  return (
    <div className="ag-sesion" ref={raiz} onBlur={(e) => {
      if (abierto && !e.currentTarget.contains(e.relatedTarget)) onAbierto(false);
    }}>
      <button
        ref={boton}
        type="button"
        className={claseBoton}
        onPointerEnter={alPrecargar}
        onFocus={alPrecargar}
        onClick={() => { if (!abierto) alPrecargar?.(); onAbierto(!abierto); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            alPrecargar?.();
            onAbierto(true);
          }
        }}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-controls={abierto && !sinMenu ? menuId : undefined}
        aria-label={etiquetaBoton}
      >
        {contenidoBoton}
      </button>

      {abierto && (
        <div
          className="ag-sesion-desplegable"
          onKeyDownCapture={() => { navego.current = true; }}
          onPointerDownCapture={() => { navego.current = true; }}
        >
          {cabecera}
          {!sinMenu && (
            <div id={menuId} ref={menu} role="menu" aria-label={etiquetaMenu}
              aria-busy={ocupado || undefined} onKeyDown={navegar}>
              <CerrarMenu.Provider value={cerrar}>{children}</CerrarMenu.Provider>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemsNegocios({ cuentas }) {
  const cerrar = useContext(CerrarMenu);
  const { negocios, staff, fallo, fase, saltando, saltar, reintentar } = cuentas;
  const actual = getTenantSlugSync();
  // Mientras reintenta, la fila sigue montada: si no, el foco se pierde.
  if (fase === 'idle' || (fase === 'cargando' && !fallo)) return null;

  return (
    <div className="ag-sesion-negocios">
      {fallo && (
        <button
          type="button"
          role="menuitem"
          className="ag-sesion-item ag-sesion-cuenta"
          aria-disabled={fase === 'cargando' || undefined}
          onClick={() => { if (fase !== 'cargando') reintentar(); }}
        >
          <span className="ag-sesion-cuenta-texto">
            <span className="ag-sesion-cuenta-nombre">No pudimos traer tus negocios</span>
            <span className="ag-sesion-cuenta-host">Reintentar</span>
          </span>
        </button>
      )}
      {negocios.map((n) => {
        const esActual = n.slug === actual;
        return (
          <button
            key={n.slug}
            type="button"
            role="menuitemradio"
            className="ag-sesion-item ag-sesion-cuenta"
            aria-checked={esActual}
            aria-disabled={saltando || undefined}
            onClick={() => (esActual ? cerrar(true) : saltar(() => irAlAdmin(n.slug)))}
          >
            <span className="ag-sesion-cuenta-texto">
              <span className="ag-sesion-cuenta-nombre">{n.name || n.slug}</span>
              <span className="ag-sesion-cuenta-host">{n.slug}.divianco.app</span>
            </span>
            {esActual && <IconoTilde />}
          </button>
        );
      })}
      {staff && (
        <button
          type="button"
          role="menuitem"
          className="ag-sesion-item ag-sesion-cuenta ag-sesion-consola"
          aria-disabled={saltando || undefined}
          onClick={() => saltar(() => irALaConsola())}
        >
          <span className="ag-sesion-cuenta-texto">
            <span className="ag-sesion-cuenta-nombre">Consola de Divianco</span>
            <span className="ag-sesion-cuenta-host">Equipo Divianco</span>
          </span>
        </button>
      )}
    </div>
  );
}

function ItemsCuenta({ controles, onInstalar }) {
  const cerrar = useContext(CerrarMenu);
  return controles.flatMap(({ id, label, titulo, Icono, onClick }) => {
    const item = (
      <button
        key={id}
        type="button"
        role="menuitem"
        className={`ag-sesion-item ag-sesion-item--${id}`}
        title={titulo}
        onClick={() => { cerrar(true); onClick(); }}
      >
        <Icono />
        <span>{label}</span>
      </button>
    );
    if (id !== 'tema') return [item];
    // Ver catalogo va justo debajo del tema. Es un enlace y no una accion,
    // asi que no entra en controlesDeSesion (el riel no lo usa).
    return [item, (
      <a
        key="catalogo"
        role="menuitem"
        className="ag-sesion-item ag-sesion-item--catalogo"
        href={CATALOGO_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={CATALOGO_ARIA}
        onClick={() => cerrar(true)}
      >
        <IconoCatalogo className="ag-nav-icon" />
        <span>Ver catálogo</span>
      </a>
    ), onInstalar && (
      <button
        key="instalar"
        type="button"
        role="menuitem"
        className="ag-sesion-item ag-sesion-item--instalar"
        title="Instalar el panel como app en este dispositivo"
        onClick={() => { cerrar(true); onInstalar(); }}
      >
        <IconoInstalar />
        <span>Instalar app</span>
      </button>
    )].filter(Boolean);
  });
}

/** El estado de instalacion, al dia: Chrome puede avisar despues de montar. */
function useInstalacion() {
  const [estado, setEstado] = useState(estadoDeInstalacion);
  useEffect(() => {
    const soltar = suscribirInstalacion(() => setEstado(estadoDeInstalacion()));
    return () => { soltar(); };
  }, []);
  return estado;
}

const IconoDesplegar = () => (
  <svg className="ag-sesion-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/**
 * Dos botones en la topbar. La burbuja (logo del negocio, o las iniciales si
 * no hay) abre los negocios de la persona; el nombre abre la cuenta:
 * configuracion, tema, ver catalogo, instalar app y salir. El nombre viene de la sesion; el
 * logo, del negocio en el que esta parada.
 */
export function MenuDeSesion({ controles, session, logoUrl, nombreNegocio }) {
  const [abierto, setAbierto] = useState(null); // null | 'negocios' | 'cuenta'
  const cuentas = useCuentas();
  const instalacion = useInstalacion();
  const [guia, setGuia] = useState(false);
  // Con el aviso de Chrome/Edge guardado va directo al dialogo del sistema;
  // sin el (iPhone, Firefox), los pasos a mano. Se lee al tocar, no al pintar.
  const instalar = useCallback(() => {
    if (estadoDeInstalacion().puedePedir) pedirInstalacion();
    else setGuia(true);
  }, []);
  const meta = session?.user?.user_metadata || {};
  const email = session?.user?.email || '';
  const nombre = (meta.full_name || meta.name || '').trim() || email.split('@')[0] || 'Mi cuenta';
  const partes = nombre.split(/\s+/);
  const iniciales = (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();

  const sinNegocios = cuentas.fase === 'listo' && !cuentas.fallo && !cuentas.negocios.length && !cuentas.staff;
  const textoEstado = cuentas.saltando && !cuentas.error ? 'Abriendo…'
    : cuentas.fase === 'cargando' && !cuentas.fallo ? 'Buscando tus negocios…'
      : sinNegocios ? 'No encontramos negocios asociados a tu cuenta.' : '';

  const abrirNegocios = useCallback((v) => setAbierto((a) => (v ? 'negocios' : a === 'negocios' ? null : a)), []);
  const abrirCuenta = useCallback((v) => setAbierto((a) => (v ? 'cuenta' : a === 'cuenta' ? null : a)), []);

  return (
    <div className="ag-sesion-grupo">
      <MenuDesplegable
        abierto={abierto === 'negocios'}
        onAbierto={abrirNegocios}
        etiquetaBoton="Cambiar de negocio"
        claseBoton="ag-sesion-burbuja"
        alPrecargar={cuentas.cargar}
        etiquetaMenu="Tus negocios"
        enfocarCuando={cuentas.fase === 'listo'}
        ocupado={cuentas.fase !== 'listo'}
        sinMenu={sinNegocios}
        cabecera={<>
          <p className="ag-sesion-titulo" aria-hidden="true">Tus negocios</p>
          <div className="ag-sesion-estado" role="status" aria-live="polite" data-ocupado={textoEstado ? 'true' : 'false'}>{textoEstado}</div>
          <div className="ag-sesion-aviso" role="alert">{cuentas.error}</div>
        </>}
        contenidoBoton={
          <span className="ag-sesion-iniciales" aria-hidden="true">
            <LogoNegocio url={logoUrl} fallback={iniciales} />
          </span>
        }
      >
        <ItemsNegocios cuentas={cuentas} />
      </MenuDesplegable>

      <MenuDesplegable
        abierto={abierto === 'cuenta'}
        onAbierto={abrirCuenta}
        etiquetaBoton={`Cuenta de ${nombre}`}
        claseBoton="ag-sesion-perfil"
        etiquetaMenu="Mi cuenta"
        cabecera={
          <div className="ag-sesion-identidad">
            <strong>{nombre}</strong>
            {email && <span>{email}</span>}
          </div>
        }
        contenidoBoton={<>
          <span className="ag-sesion-nombre">{nombre}</span>
          <IconoDesplegar />
        </>}
      >
        <ItemsCuenta controles={controles} onInstalar={instalacion.instalada ? null : instalar} />
      </MenuDesplegable>

      {guia && (
        <GuiaDeInstalacion
          abierta
          onCerrar={() => setGuia(false)}
          plataforma={instalacion.plataforma}
          nombreNegocio={nombreNegocio}
        />
      )}
    </div>
  );
}
