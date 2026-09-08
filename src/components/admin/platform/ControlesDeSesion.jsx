import { useEffect, useId, useRef, useState } from 'react';
import {
  duracionCorta, estaOperativo, horaDelLocal, ventanaOperativa,
} from '../../../modules/estadoOperativo';
import { fraseDe, nombreDe, saludoDe } from '../../../modules/saludo';

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

/** Perfil sin foto. La identidad viene de la sesion, nunca del negocio. */
export function MenuDeSesion({ controles, session }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);
  const boton = useRef(null);
  const menu = useRef(null);
  const menuId = useId();
  const meta = session?.user?.user_metadata || {};
  const email = session?.user?.email || '';
  const nombre = (meta.full_name || meta.name || '').trim() || email.split('@')[0] || 'Mi cuenta';
  const partes = nombre.split(/\s+/);
  const iniciales = (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();

  useEffect(() => {
    if (!abierto) return undefined;
    menu.current?.querySelector('[role="menuitem"]')?.focus();
    const afuera = (e) => {
      if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false);
    };
    const escape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', afuera, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', afuera, true);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  function navegar(e) {
    const items = Array.from(menu.current.querySelectorAll('[role="menuitem"]'));
    const actual = items.indexOf(document.activeElement);
    const destinos = {
      ArrowDown: (actual + 1) % items.length,
      ArrowUp: (actual - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    if (e.key in destinos) {
      e.preventDefault();
      items[destinos[e.key]]?.focus();
    }
  }

  return (
    <div className="ag-sesion" ref={raiz} onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false);
    }}>
      <button
        ref={boton}
        type="button"
        className="ag-sesion-perfil"
        onClick={() => setAbierto(v => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setAbierto(true);
          }
        }}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-controls={abierto ? menuId : undefined}
        aria-label={`Cuenta de ${nombre}`}
      >
        <span className="ag-sesion-iniciales" aria-hidden="true">{iniciales}</span>
        <span className="ag-sesion-nombre">{nombre}</span>
      </button>

      {abierto && (
        <div className="ag-sesion-desplegable">
          <div className="ag-sesion-identidad">
            <strong>{nombre}</strong>
            {email && <span>{email}</span>}
          </div>
          <div id={menuId} ref={menu} role="menu" aria-label="Mi cuenta" onKeyDown={navegar}>
            {controles.map(({ id, label, titulo, Icono, onClick }) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                className={`ag-sesion-item ag-sesion-item--${id}`}
                title={titulo}
                onClick={() => { setAbierto(false); boton.current?.focus(); onClick(); }}
              >
                <Icono />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
