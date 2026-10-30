import DicoPhysical from '../dico/DicoPhysical';
// src/components/landing/Diagnostico.jsx
// El embudo de la plataforma: el diagnostico de Dico como componente. Lo usan
// la home (src/pages/PlatformLanding.jsx, adentro del hero: el boton lo abre en
// la misma pagina) y /diagnostico (src/pages/Diagnostico.jsx, pagina propia que
// usan la landing vieja y los links de afuera).
//
// Composicion (direccion `quiet-instrument` de design-taste-frontend): dos
// mitades por tono. A la izquierda, la columna: la pregunta es la unica cosa
// grande. A la derecha, en el tono de al lado, el instrumento: Dico y la ficha
// que imprime lo que Dico lee de cada respuesta. En el resultado, la ficha
// queda completa con "Cambiar respuestas" y la columna cuenta el plan.
// En el telefono el orden del DOM es el visual: columna y despues la ficha
// (que durante las preguntas se esconde: es larga y repite lo elegido).
//
// Colores (RC5 cap. 03): tinta para avanzar; volt para lo que Dico lee (el
// avance, la ficha, "Ver mi diagnostico"); oro para la accion y el valor: una
// sola accion oro ("Crear mi cuenta", en el resultado) y, como cifra de valor
// (texto gold-700 o la cifra de la pieza), el plan que conviene y su precio.
//
// Textos: preguntas y respuestas, dolores, urgencias, inversiones, plan y
// soluciones salen de src/lib/diagnostico.js. Aca viven solo los enunciados
// de cada paso y lo que dice Dico (la lib no los tiene).
//
// El boton Atras del navegador recorre los pasos: cada paso es una entrada de
// history (misma URL, sin cambio de ruta) y las respuestas viven en
// sessionStorage, asi que ni Atras ni una recarga las pierden.
//
// Guardado (edge function `diagnostico`): una fila por juego de respuestas.
// Si falla se puede reintentar; una respuesta vieja no pisa el id de un
// guardado posterior; volver a ver el mismo resultado no guarda otra fila.

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { marcarEvento } from '../../lib/analiticaPlataforma';
import {
  CANALES, EQUIPOS, ESTABLECIMIENTOS, GESTIONES, LOCALES, ORDEN_PASOS,
  PREGUNTAS_DOLOR, VENTAS_MENSUALES, DECISORES, extrasV2,
  PLANES, URGENCIAS, VERTICALES, desafiosDe, eventosDePaso, guardarDiagnostico,
  planRecomendado, recordarDiagnosticoPendiente, solucion,
} from '../../lib/diagnostico';
import ResultadoDiagnostico from './ResultadoDiagnostico';
import { viajarConDico } from './viajeDico';
import DiagnosticoCard from './DiagnosticoCard';

// Lo que dura el "estoy leyendo" de Dico. Tope del brief: 1,2 s.
const ANALISIS_MS = 1000;
// Lo que se ve la eleccion antes de pasar sola a la siguiente (solo con
// puntero: con el teclado se avanza con Enter o con "Seguir").
const PAUSA_ELECCION_MS = 320;
const CLAVE_SESION = 'dico:diagnostico-v2-en-curso';
const CLAVE_EVENTOS = 'dico:diagnostico-v2-eventos';

/** Marca un evento de analitica una sola vez por diagnostico, aunque se
 *  recargue la pagina: lo ya marcado queda en sessionStorage. `clave` separa
 *  diagnosticos distintos (el resultado de otras respuestas es otro). */
function marcarUnaVez(evento, clave = '') {
  const id = `${evento}:${clave}`;
  let hechos = [];
  try { hechos = JSON.parse(sessionStorage.getItem(CLAVE_EVENTOS) || '[]'); } catch { /* sin storage */ }
  if (!Array.isArray(hechos)) hechos = [];
  if (hechos.includes(id)) return;
  marcarEvento(evento);
  try { sessionStorage.setItem(CLAVE_EVENTOS, JSON.stringify([...hechos, id].slice(-60))); } catch { /* sin storage */ }
}


/* Enunciado de cada paso y lo que dice Dico. `cara` es su estado (RC5 cap. 08). */
const PASOS = {
  vertical: {
    pregunta: '¿Qué tipo de negocio tenés?',
    dico: 'Son pocas preguntas. Al final te digo por dónde empezar.',
    cara: 'question',
  },
  desafio: {
    pregunta: '¿Qué es lo que más te preocupa hoy?',
    ayuda: 'Elegí uno: es por donde empezamos.',
    dico: 'Uno solo. Lo demás viene después.',
    cara: 'curious',
  },
  establecimiento: {
    pregunta: '¿Cómo es tu negocio?',
    dico: 'Cada negocio pierde plata en un lugar distinto.',
    cara: 'curious',
  },
  canales: {
    pregunta: '¿Por dónde vendés?',
    ayuda: 'Elegí todos los que uses.',
    dico: 'Cada canal suma ventas. Si no están juntos, también suma desorden.',
    cara: 'question',
  },
  escala: {
    pregunta: '¿Qué tamaño tiene hoy?',
    dico: 'Con esto sé qué plan te conviene.',
    cara: 'curious',
  },
  gestion_actual: {
    pregunta: '¿Cómo controlás hoy costos y resultados?',
    dico: 'Sin juicio: casi todos empiezan con una planilla.',
    cara: 'question',
  },
  urgencia: {
    pregunta: '¿Para cuándo lo querés resolver?',
    dico: 'Así podemos priorizar cómo acompañarte.',
    cara: 'curious',
  },
  venta_mensual: {
    pregunta: '¿Cuánto vende tu negocio aproximadamente por mes?',
    dico: 'Es una referencia de tu operación, no una prueba de capacidad de pago.',
    ayuda: 'Podés elegir un rango, indicar que no lo sabés o no responder.', cara: 'curious',
  },
  nombre_negocio: {
    pregunta: '¿Cómo se llama tu negocio?',
    ayuda: 'Es opcional.',
    dico: 'Si me lo decís, te lo dejo cargado en el alta.',
    cara: 'curious',
  },
};

// La ficha: un renglon por pregunta, en el orden del recorrido.
const FICHA = [
  ['vertical', 'Rubro'],
  ['desafio', 'Preocupación'],
  ['establecimiento', 'Negocio'],
  ['canales', 'Canales'],
  ['escala', 'Tamaño'],
  ['gestion_actual', 'Control hoy'],
  ['urgencia', 'Urgencia'],
  ['venta_mensual', 'Venta mensual'],
  ['decisor', 'Decisión'],
];

const VACIO = {
  vertical: null,
  desafio: null,
  establecimiento: null,
  canales: [],
  locales: null,
  equipo: null,
  gestion_actual: null,
  urgencia: null,
  inversion: null,
  nombre_negocio: '',
  senal: null, sistema_nombre: '', sistema_costo: '', venta_mensual: null, decisor: null,
};

const recorridoDe = () => ORDEN_PASOS;

const labelDe = (lista, id) => lista.find((o) => o.id === id)?.label;

function completo(paso, r) {
  switch (paso) {
    case 'vertical': return Boolean(r.vertical && (r.vertical === 'otro' || ESTABLECIMIENTOS[r.vertical]?.some(e => e.id === r.establecimiento)));
    case 'desafio': return Boolean(PREGUNTAS_DOLOR[r.desafio]?.opciones.some(o => o.id === r.senal));
    case 'urgencia': return Boolean(r.urgencia && r.decisor);
    case 'gestion_actual': return Boolean(r.gestion_actual) && (r.sistema_costo === '' || r.sistema_costo === null || (Number.isFinite(Number(r.sistema_costo)) && Number(r.sistema_costo) >= 0 && Number(r.sistema_costo) <= 1e9));
    case 'canales': return r.canales.length > 0;
    case 'escala': return Boolean(r.locales && r.equipo);
    case 'nombre_negocio': return true;
    default: return Boolean(r[paso]);
  }
}

const todoCompleto = (r) => recorridoDe(r.vertical).every((p) => completo(p, r));

/** El primer paso sin contestar (o el ultimo, si estan todos). */
const primerFaltante = (r) => {
  const rec = recorridoDe(r.vertical);
  const i = rec.findIndex((p) => !completo(p, r));
  return i === -1 ? rec.length - 1 : i;
};

/** Lo que muestra cada renglon de la ficha, o null si falta. */
function valorDeFicha(clave, r) {
  switch (clave) {
    case 'vertical': return labelDe(VERTICALES, r.vertical);
    case 'desafio': return labelDe(desafiosDe(r.vertical), r.desafio);
    case 'establecimiento': return labelDe(ESTABLECIMIENTOS[r.vertical] || [], r.establecimiento);
    case 'canales': return r.canales.length
      ? CANALES.filter((c) => r.canales.includes(c.id)).map((c) => c.label).join(', ')
      : null;
    case 'escala': return r.locales && r.equipo
      ? `${labelDe(LOCALES, r.locales)} · ${labelDe(EQUIPOS, r.equipo)}`
      : labelDe(LOCALES, r.locales) || labelDe(EQUIPOS, r.equipo) || null;
    case 'gestion_actual': return labelDe(GESTIONES, r.gestion_actual);
    case 'urgencia': return labelDe(URGENCIAS, r.urgencia);
    case 'venta_mensual': return labelDe(VENTAS_MENSUALES, r.venta_mensual);
    case 'decisor': return labelDe(DECISORES, r.decisor);
    default: return null;
  }
}

/** Lo que se guarda: los ids de la tabla diagnosticos (0100-0102). */
function datosDe(r) {
  return {
    version: 2,
    respuestas_v2: extrasV2(r),
    vertical: r.vertical,
    establecimiento: r.vertical === 'otro' ? null : r.establecimiento,
    canales: r.canales,
    locales: r.locales,
    equipo: r.equipo,
    gestion_actual: r.gestion_actual,
    desafio: r.desafio,
    urgencia: r.urgencia,
    inversion: r.inversion,
    nombre_negocio: r.nombre_negocio.trim() || null,
  };
}

function verticalDeLaUrl() {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('vertical');
  return VERTICALES.some((x) => x.id === v) ? v : null;
}

function leerSesion() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || sessionStorage.getItem('dico:diagnostico-en-curso') || 'null');
    if (!s || typeof s !== 'object' || !s.respuestas) return null;
    const r = { ...VACIO, ...s.respuestas };
    if (!Array.isArray(r.canales)) r.canales = [];
    if (typeof r.nombre_negocio !== 'string') r.nombre_negocio = '';
    return { respuestas: r, version: s.version, id: s.version === 2 && typeof s.id === 'string' ? s.id : null, token: s.version === 2 ? s.token || null : null, firma: s.version === 2 ? s.firma || null : null };
  } catch {
    return null;
  }
}

const estadoDeHistoria = () => (typeof window === 'undefined' ? undefined : window.history.state?.dg);

/** Arranque: lo que dejo la sesion (Atras, recarga) o un diagnostico nuevo. */
function arranque(modo) {
  const sesion = leerSesion();
  const respuestas = sesion?.respuestas || { ...VACIO };
  const delaUrl = modo === 'pagina' ? verticalDeLaUrl() : null;
  if (delaUrl && !respuestas.vertical) respuestas.vertical = delaUrl;
  const h = sesion?.version === 2 ? estadoDeHistoria() : undefined;
  const base = { respuestas, token: sesion?.token || null, id: sesion?.id || null, firma: sesion?.firma || null };

  if (h === 'resultado') {
    if (todoCompleto(respuestas)) return { ...base, abierto: true, indice: 0, fase: 'resultado' };
    // La entrada dice "resultado" pero faltan respuestas (se borro la sesion):
    // se muestra la primera que falta y la historia se corrige al montar.
    return { ...base, abierto: true, indice: primerFaltante(respuestas), fase: 'preguntas', corregir: true };
  }
  if (typeof h === 'number') return { ...base, abierto: true, indice: h, fase: 'preguntas' };
  if (modo === 'pagina') return { ...base, abierto: true, indice: primerFaltante(respuestas), fase: 'preguntas' };
  return { ...base, abierto: false, indice: 0, fase: 'preguntas' };
}

/**
 * modo 'home': cerrado muestra `<Portada onAbrir>` en la columna y `lado` en el
 *   instrumento; el boton de la portada lo abre. `abrirRef.current` queda con
 *   `abrir` para los otros botones de la pagina.
 * modo 'pagina': arranca abierto. `nivel` es la etiqueta del enunciado.
 */
export default function Diagnostico({ modo = 'pagina', Portada, lado, abrirRef, onAbiertoChange, nivel = 'h1' }) {
  const [inicio] = useState(() => arranque(modo));
  const [respuestas, setRespuestas] = useState(inicio.respuestas);
  const [abierto, setAbierto] = useState(inicio.abierto);
  const [overlayActivo, setOverlayActivo] = useState(modo === 'home' && inicio.abierto);
  const [indice, setIndice] = useState(inicio.indice);
  const [fase, setFase] = useState(inicio.fase); // preguntas | analizando | resultado
  const [id, setId] = useState(inicio.id);
  const [tokenContacto, setTokenContacto] = useState(inicio.token);
  const [guardado, setGuardado] = useState(inicio.id ? 'ok' : 'nada'); // nada | guardando | ok | error
  const [gesto, setGesto] = useState(0);

  const raizRef = useRef(null);
  const tituloRef = useRef(null);
  const porPuntero = useRef(false);
  const avance = useRef(null);
  const respuestasRef = useRef(respuestas);
  // Guardado: firma de lo ultimo que se mando, su id y un turno para descartar
  // respuestas viejas que lleguen tarde.
  const envio = useRef({ firma: inicio.id ? inicio.firma : null, id: inicio.id, token: inicio.token, turno: 0, enCurso: false });
  const vista = useRef(null); // ultimo `abierto|paso|fase` atendido
  const marcoInicio = useRef(false);
  const marcoResultado = useRef(null);
  const ultimoPaso = useRef(null); // { paso, idx } de la pregunta a la vista
  const aperturaEnCurso = useRef(false);
  const viaje = useRef(null);
  const portadaRef = useRef(null);
  const oroRef = useRef(null);
  const disparadorRef = useRef(null);
  const overlayRef = useRef(overlayActivo);
  const cerrandoRef = useRef(false);
  const cierreSolicitado = useRef(false);
  const abiertoRef = useRef(abierto);
  const scrollPortada = useRef(0);

  const recorrido = recorridoDe(respuestas.vertical);
  const pasoIdx = Math.min(indice, recorrido.length - 1);
  const paso = recorrido[pasoIdx];
  const listo = completo(paso, respuestas);
  const conDesde = () => window.history.state?.desde === true;

  useEffect(() => {
    abiertoRef.current = abierto;
    overlayRef.current = overlayActivo;
    onAbiertoChange?.(modo === 'home' ? overlayActivo : abierto);
  }, [abierto, overlayActivo, modo, onAbiertoChange]);

  // Caras de Dico precargadas: cambiar de estado no tiene que parpadear.
  useEffect(() => {
    if ((modo === 'pagina' && estadoDeHistoria() === undefined) || inicio.corregir) {
      window.history.replaceState({ ...window.history.state, dg: inicio.indice }, '');
    }
  }, [modo, inicio.indice, inicio.corregir]);

  useEffect(() => () => clearTimeout(avance.current), []);
  useEffect(() => () => viaje.current?.cancelar(), []);
  useEffect(() => { respuestasRef.current = respuestas; }, [respuestas]);

  // Respuestas e id en la sesion: Atras y una recarga no las pierden.
  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify({
        respuestas, id: envio.current.id, token: tokenContacto, version: 2, firma: envio.current.id ? envio.current.firma : null,
      }));
    } catch { /* sin storage: sigue andando, sin recordar */ }
  }, [respuestas, id, tokenContacto]);

  // Analitica: el inicio y el resultado, una vez por diagnostico aunque se
  // recargue (marca en sessionStorage). El resultado se marca por juego de
  // respuestas: cambiar respuestas y ver otro resultado es otro diagnostico.
  useEffect(() => {
    if (abierto && !marcoInicio.current) { marcoInicio.current = true; marcarUnaVez('diagnostico-v2-inicio'); }
  }, [abierto]);
  useEffect(() => {
    if (fase !== 'resultado') return;
    const firma = JSON.stringify(datosDe(respuestas));
    if (marcoResultado.current === firma) return;
    marcoResultado.current = firma;
    marcarUnaVez('diagnostico-v2-resultado', firma);
  }, [fase, respuestas]);

  // Analitica por paso: cada pregunta vista, cada atras y el abandono (cerrar
  // o irse de la pagina con una pregunta a la vista). Fuera de las preguntas
  // no hay paso: volver del resultado no cuenta como atras.
  useEffect(() => {
    if (!abierto || fase !== 'preguntas') { ultimoPaso.current = null; return; }
    const ahora = { paso, idx: pasoIdx };
    eventosDePaso(ultimoPaso.current, ahora, 2).forEach((ev) => marcarUnaVez(ev));
    ultimoPaso.current = ahora;
  }, [abierto, fase, paso, pasoIdx]);
  const marcarAbandono = useCallback(() => {
    if (ultimoPaso.current) marcarUnaVez(`diagnostico-v2-abandono-${ultimoPaso.current.paso}`);
  }, []);
  useEffect(() => {
    window.addEventListener('pagehide', marcarAbandono);
    return () => window.removeEventListener('pagehide', marcarAbandono);
  }, [marcarAbandono]);

  // El mismo formulario vive en la card en home y en su ruta propia.
  useEffect(() => {
    const clave = `${abierto}|${paso}|${fase}`;
    if (vista.current === clave) return;
    const primera = vista.current === null;
    vista.current = clave;
    if (primera || aperturaEnCurso.current) return;
    if (abierto) {
      if (modo === 'home') {
        const card = tituloRef.current?.closest('.dg-modal-card');
        if (card) card.scrollTop = 0;
      }
      tituloRef.current?.focus({ preventScroll: true });
      if (modo === 'pagina') {
        const arriba = raizRef.current?.getBoundingClientRect().top || 0;
        if (arriba < 0 || arriba > window.innerHeight * 0.5) window.scrollTo({ top: Math.max(0, window.scrollY + arriba) });
      }
    }
  }, [abierto, paso, fase, modo]);

  const cerrarAnimado = useCallback(() => {
    if (!overlayRef.current || cerrandoRef.current) return;
    marcarAbandono();
    viaje.current?.cancelar();
    clearTimeout(avance.current);
    aperturaEnCurso.current = true;
    cerrandoRef.current = true;
    flushSync(() => setAbierto(false));
    const boton = () => {
      const guardado = disparadorRef.current;
      return guardado && document.contains(guardado) ? guardado : portadaRef.current?.querySelector('[data-abrir]');
    };
    viaje.current = viajarConDico({
      capa: oroRef.current,
      destino: () => oroRef.current?.parentElement.querySelector('.dg-modal-card'),
      origen: boton,
      sentido: 'vuelta',
      prepararDestino: () => {
        window.scrollTo({ top: scrollPortada.current, behavior: 'instant' });
        const elemento = boton();
        const rect = elemento?.getBoundingClientRect();
        if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) elemento.scrollIntoView({ block: 'center', behavior: 'instant' });
      },
      alTerminar: () => {
        aperturaEnCurso.current = false;
        cerrandoRef.current = false;
        cierreSolicitado.current = false;
        flushSync(() => { setOverlayActivo(false); setAbierto(false); setFase('preguntas'); setIndice(0); });
        const origen = boton();
        origen?.classList.add('pl-hero-regresando');
        origen?.focus({ preventScroll: true });
        if (origen) {
          const limpiar = () => origen.classList.remove('pl-hero-regresando');
          origen.addEventListener('animationend', limpiar, { once: true });
          setTimeout(limpiar, 400);
        }
      },
    });
  }, [marcarAbandono]);

  const cerrar = useCallback(() => {
    if (modo !== 'home' || !overlayRef.current || cierreSolicitado.current || cerrandoRef.current) return;
    cierreSolicitado.current = true;
    clearTimeout(avance.current);
    const profundidad = window.history.state?.dgProfundidad;
    if (Number.isInteger(profundidad) && profundidad > 0 && profundidad < window.history.length) {
      window.history.go(-profundidad);
    } else {
      // Una sesión de una versión anterior no declara su profundidad. No se
      // adivina cuántas entradas atrás hay: se cierra sin añadir otra.
      const estado = { ...window.history.state };
      delete estado.dg;
      delete estado.desde;
      delete estado.dgProfundidad;
      window.history.replaceState(estado, '');
      cerrarAnimado();
    }
  }, [modo, cerrarAnimado]);

  // Atrás entre preguntas conserva su recorrido. Sólo salir del diagnóstico
  // contrae el oro; Adelante durante una salida gana sobre el cierre pendiente.
  useEffect(() => {
    const alVolver = (e) => {
      clearTimeout(avance.current);
      cierreSolicitado.current = false;
      const s = e.state?.dg;
      if (s === undefined || s === null) {
        if (modo === 'home') cerrarAnimado();
        return;
      }
      viaje.current?.cancelar();
      aperturaEnCurso.current = false;
      cerrandoRef.current = false;
      if (oroRef.current) oroRef.current.dataset.viaje = 'abierto';
      flushSync(() => {
        if (modo === 'home') setOverlayActivo(true);
        setAbierto(true);
        if (s === 'resultado' && todoCompleto(respuestasRef.current)) { setFase('resultado'); return; }
        setFase('preguntas');
        if (s === 'resultado') {
          const falta = primerFaltante(respuestasRef.current);
          window.history.replaceState({ ...window.history.state, dg: falta }, '');
          setIndice(falta);
        } else setIndice(Number(s) || 0);
      });
      tituloRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, [modo, cerrarAnimado]);

  const empujar = (dg, primero = false) => {
    const estado = { ...window.history.state, dg, desde: true };
    if (primero) estado.dgProfundidad = 1;
    else if (Number.isInteger(estado.dgProfundidad)) estado.dgProfundidad += 1;
    window.history.pushState(estado, '');
  };

  const irA = useCallback((i) => {
    clearTimeout(avance.current);
    empujar(i);
    setFase('preguntas');
    setIndice(i);
  }, []);

  const abrir = useCallback((evento) => {
    if (aperturaEnCurso.current) return;
    if (!abiertoRef.current) {
      scrollPortada.current = window.scrollY;
      const activo = document.activeElement;
      disparadorRef.current = evento?.currentTarget || evento?.disparador || (activo instanceof HTMLElement && activo !== document.body ? activo : null);
      aperturaEnCurso.current = true;
      cerrandoRef.current = false;
      cierreSolicitado.current = false;
      flushSync(() => setOverlayActivo(true));
      viaje.current = viajarConDico({
        capa: oroRef.current,
        origen: evento?.currentTarget,
        destino: () => oroRef.current?.parentElement.querySelector('.dg-modal-card'),
        alTerminar: () => {
          aperturaEnCurso.current = false;
          const siguiente = primerFaltante(respuestasRef.current);
          empujar(siguiente, true);
          flushSync(() => { setIndice(siguiente); setFase('preguntas'); setAbierto(true); });
          tituloRef.current?.focus({ preventScroll: true });
        },
      });
      return;
    }
    tituloRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (abrirRef) abrirRef.current = abrir;
  }, [abrirRef, abrir]);

  const guardar = useCallback((datos) => {
    const firma = JSON.stringify(datos);
    const e = envio.current;
    // Lo mismo que ya se guardo (o se esta guardando) no se manda de nuevo.
    if (e.firma === firma && (e.id || e.enCurso)) { setId(e.id); return; }
    const turno = e.turno + 1;
    envio.current = { firma, id: null, token: null, turno, enCurso: true };
    setTokenContacto(null);
    setId(null);
    setGuardado('guardando');
    guardarDiagnostico(datos, { conToken: true }).then((respuesta) => {
      const nuevo = typeof respuesta === 'string' ? respuesta : respuesta?.id;
      // Llego tarde: ya se mando otro juego de respuestas.
      if (envio.current.turno !== turno) return;
      envio.current.enCurso = false;
      if (nuevo) {
        envio.current.id = nuevo;
        envio.current.token = respuesta?.token || null;
        setTokenContacto(respuesta?.token || null);
        // Recien aca, con el turno confirmado: una respuesta vieja nunca
        // pisa el id que se ata al alta.
        recordarDiagnosticoPendiente(nuevo);
        setId(nuevo);
        setGuardado('ok');
      } else {
        envio.current.firma = null; // permite reintentar lo mismo
        setGuardado('error');
      }
    });
  }, []);

  const analizar = useCallback(() => {
    clearTimeout(avance.current);
    empujar('resultado');
    setFase('analizando');
    guardar(datosDe(respuestasRef.current));
    avance.current = setTimeout(() => setFase('resultado'), ANALISIS_MS);
  }, [guardar]);

  const seguir = () => {
    if (!completo(paso, respuestas)) return;
    if (paso === 'nombre_negocio') { analizar(); return; }
    irA(pasoIdx + 1);
  };

  const volver = () => {
    clearTimeout(avance.current);
    if (modo === 'home' && pasoIdx === 0) { cerrar(); return; }
    if (conDesde()) { window.history.back(); return; }
    // Sin entrada propia atras (se entro directo a un paso): se retrocede en
    // el lugar, sin sacar al visitante de la pagina.
    if (pasoIdx > 0) {
      window.history.replaceState({ ...window.history.state, dg: pasoIdx - 1 }, '');
      setFase('preguntas');
      setIndice(pasoIdx - 1);
    }
  };

  /** Una eleccion simple. Con puntero, pasa sola a la siguiente pregunta. */
  const elegir = (campo, valor) => {
    let nuevo = { ...respuestas, [campo]: valor };
    if (campo === 'vertical') {
      // Otro rubro, otras listas: lo que ya no corresponde se descarta.
      const tipos = ESTABLECIMIENTOS[valor] || [];
      if (!tipos.some((t) => t.id === nuevo.establecimiento)) nuevo = { ...nuevo, establecimiento: null };
      if (!desafiosDe(valor).some((d) => d.id === nuevo.desafio)) nuevo = { ...nuevo, desafio: null, senal: null };
    }
    if (campo === 'desafio' && valor !== respuestas.desafio) nuevo = { ...nuevo, senal: null };
    if (campo === 'gestion_actual' && valor !== 'otro_sistema') nuevo = { ...nuevo, sistema_nombre: '', sistema_costo: '' };
    setRespuestas(nuevo);
    setGesto((g) => g + 1);
    if (porPuntero.current && paso === 'venta_mensual') {
      const siguiente = pasoIdx + 1;
      clearTimeout(avance.current);
      avance.current = setTimeout(() => irA(siguiente), PAUSA_ELECCION_MS);
    }
    porPuntero.current = false;
  };

  const alternarCanal = (canal) => {
    const canales = respuestas.canales.includes(canal)
      ? respuestas.canales.filter((c) => c !== canal)
      : [...respuestas.canales, canal];
    setRespuestas({ ...respuestas, canales });
    setGesto((g) => g + 1);
    porPuntero.current = false;
  };

  const alEnviar = (e) => { e.preventDefault(); seguir(); };

  // Enter sobre un radio o un checkbox tambien avanza (el navegador no lo hace).
  const alTeclear = (e) => {
    porPuntero.current = false;
    if (e.key === 'Enter' && (e.target.type === 'radio' || e.target.type === 'checkbox')) {
      e.preventDefault();
      seguir();
    }
  };

  const portada = modo === 'home' && (
    <div className="pl-split dg-embudo dg-cerrado" ref={portadaRef}>
      <div className="pl-split-col">{Portada && <Portada onAbrir={abrir} />}</div>
      <div className="pl-split-lado">{lado}</div>
    </div>
  );
  const envolver = (contenido) => modo === 'home' ? (
    <>
      {portada}
      {overlayActivo && (
        <DiagnosticoCard visible={abierto} fondoRef={portadaRef}
          oroRef={oroRef} tituloRef={tituloRef} tituloId={fase === 'resultado' ? 'dg-resultado-titulo' : 'dg-pregunta'} onCerrar={cerrar}>
          {contenido}
        </DiagnosticoCard>
      )}
    </>
  ) : contenido;
  if (!abierto && !overlayActivo) return envolver(null);

  const sol = fase === 'resultado' ? solucion(respuestas.desafio, respuestas.vertical) : null;

  let dice = PASOS[paso].dico;
  if (fase === 'analizando') { dice = 'Un segundo.'; }
  if (fase === 'resultado') {
    const nombre = respuestas.nombre_negocio.trim();
    dice = nombre ? `${nombre}: esto es lo primero que resolvería.` : 'Esto es lo primero que resolvería.';
  }

  const Titulo = nivel;
  const total = recorrido.length;
  const hechas = fase !== 'preguntas' ? total : Math.min(pasoIdx, total);
  let cuenta = 'Leyendo tus respuestas';
  if (fase === 'preguntas') cuenta = paso === 'nombre_negocio' ? 'Último paso' : `Pregunta ${pasoIdx + 1} de ${total}`;

  const instrumento = (
    <aside className="pl-split-lado dg-lado" aria-label="Tu ficha de diagnóstico">
      <div className="dg-lado-dentro">
        <div className="dg-guia">
          <span className="dg-guia-cara" key={gesto} data-gesto={gesto > 0 ? '' : undefined}>
            <DicoPhysical pose={fase === 'analizando' ? 'thinking' : 'idle'} reducedMotion={fase !== 'analizando'} ritmo={.55} title="Dico" />
          </span>
          <p className="pl-dico-dice dg-guia-dice" key={dice}>{dice}</p>
        </div>
        <div className="dg-ficha-envoltura">
          <Ficha respuestas={respuestas} paso={paso} fase={fase} />
          {fase === 'resultado' && (
            <button type="button" className="dg-texto-boton" onClick={() => irA(0)}>
              Cambiar respuestas
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  /* ── El resultado ── */
  if (fase === 'resultado' && sol) {
    return envolver(
      <div className="pl-split dg-embudo dg-fase-resultado" ref={raizRef}>
        <div className="pl-split-col dg-res-cab">
          <Titulo className="dg-titulo dg-entra" id="dg-resultado-titulo" ref={tituloRef} tabIndex={-1}>Tu diagnóstico{respuestas.nombre_negocio.trim() ? ` para ${respuestas.nombre_negocio.trim()}` : ''}</Titulo>
        </div>
        {instrumento}
        <ResultadoDiagnostico
          sol={sol}
          respuestas={respuestas}
          id={id}
          token={tokenContacto}
          onContactoGuardado={() => marcarUnaVez('diagnostico-v2-whatsapp')}
          guardado={guardado}
          onReintentar={() => guardar(datosDe(respuestas))}
        />
      </div>
    );
  }

  /* ── Preguntas (y el segundo en que Dico lee) ── */
  return envolver(
    <div className={`pl-split dg-embudo dg-fase-${fase}`} ref={raizRef}>
      {modo === 'home' && instrumento}
      <div className="pl-split-col dg-col">
        {/* El avance arriba es solo la barra; la cuenta en texto va al pie
            del paso, al lado de las acciones (arriba seria una etiqueta
            sobre el enunciado). */}
        <div
          className={`dg-progreso${fase === 'analizando' ? ' leyendo' : ''}`}
          role="progressbar"
          aria-label="Avance del diagnóstico"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={hechas}
          aria-valuetext={cuenta}
        >
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`dg-tramo${i < hechas ? ' hecho' : ''}`} />
          ))}
        </div>

        {fase === 'analizando' ? (
          <div className="dg-paso dg-entra" key="analizando">
            <Titulo className="dg-titulo" id="dg-pregunta" ref={tituloRef} tabIndex={-1}>Estoy leyendo tus respuestas.</Titulo>
          </div>
        ) : (
          <Pregunta
            paso={paso}
            nivel={nivel}
            cuenta={cuenta}
            respuestas={respuestas}
            tituloRef={tituloRef}
            listo={listo}
            textoVolver={modo === 'home' && pasoIdx === 0 ? 'Volver al inicio' : 'Volver'}
            puedeVolver={pasoIdx > 0 || modo === 'home'}
            onElegir={elegir}
            onCanal={alternarCanal}
            onNombre={(v) => setRespuestas({ ...respuestas, nombre_negocio: v })}
            onEnviar={alEnviar}
            onTeclear={alTeclear}
            onPuntero={() => { porPuntero.current = true; }}
            onVolver={volver}
          />
        )}
      </div>
      {modo !== 'home' && instrumento}
    </div>
  );
}

/* ─────────────── Una pregunta ─────────────── */

function Pregunta({
  paso, nivel, cuenta, respuestas, tituloRef, listo, textoVolver, puedeVolver,
  onElegir, onCanal, onNombre, onEnviar, onTeclear, onPuntero, onVolver,
}) {
  const Titulo = nivel;
  const texto = PASOS[paso];
  const idTitulo = 'dg-pregunta';
  const idAyuda = texto.ayuda ? 'dg-ayuda' : undefined;

  const simples = {
    vertical: VERTICALES,
    desafio: desafiosDe(respuestas.vertical),
    establecimiento: ESTABLECIMIENTOS[respuestas.vertical] || [],
    gestion_actual: GESTIONES,
    urgencia: URGENCIAS,
    venta_mensual: VENTAS_MENSUALES,
  }[paso];

  return (
    <form className="dg-paso dg-entra" key={paso} onSubmit={onEnviar} onKeyDown={onTeclear} noValidate>
      <Titulo className="dg-titulo" id={idTitulo} ref={tituloRef} tabIndex={-1}>{texto.pregunta}</Titulo>
      {texto.ayuda && <p className="dg-ayuda" id={idAyuda}>{texto.ayuda}</p>}

      {simples && (
        <fieldset className="dg-grupo" aria-labelledby={idTitulo} aria-describedby={idAyuda}>
          <Opciones nombre={paso} lista={simples} valor={respuestas[paso]} onElegir={onElegir} onPuntero={onPuntero} />
        </fieldset>
      )}

      {paso === 'vertical' && respuestas.vertical && respuestas.vertical !== 'otro' && <fieldset className="dg-grupo dg-condicional"><legend className="dg-subtitulo">¿Cómo es tu negocio?</legend><Opciones nombre="establecimiento" lista={ESTABLECIMIENTOS[respuestas.vertical] || []} valor={respuestas.establecimiento} onElegir={onElegir} onPuntero={onPuntero} /></fieldset>}
      {paso === 'desafio' && PREGUNTAS_DOLOR[respuestas.desafio] && <fieldset className="dg-grupo dg-condicional"><legend className="dg-subtitulo">{PREGUNTAS_DOLOR[respuestas.desafio].pregunta}</legend><Opciones nombre="senal" lista={PREGUNTAS_DOLOR[respuestas.desafio].opciones} valor={respuestas.senal} onElegir={onElegir} onPuntero={onPuntero} /></fieldset>}
      {paso === 'gestion_actual' && respuestas.gestion_actual === 'otro_sistema' && <div className="dg-condicional dg-datos-sistema"><label htmlFor="dg-sistema-nombre">¿Cuál usás? (opcional)<input className="dg-texto" id="dg-sistema-nombre" value={respuestas.sistema_nombre} maxLength={80} onChange={e => onElegir('sistema_nombre', e.target.value)} /></label><label htmlFor="dg-sistema-costo">¿Cuánto pagás por mes? (opcional, en pesos)<input className="dg-texto" id="dg-sistema-costo" type="number" min="0" max="1000000000" inputMode="decimal" value={respuestas.sistema_costo} onChange={e => onElegir('sistema_costo', e.target.value)} /></label><p className="dg-ayuda">Si no lo recordás, podés dejarlo vacío.</p></div>}
      {paso === 'urgencia' && <fieldset className="dg-grupo dg-condicional"><legend className="dg-subtitulo">¿Quién participa de la decisión?</legend><Opciones nombre="decisor" lista={DECISORES} valor={respuestas.decisor} onElegir={onElegir} onPuntero={onPuntero} /></fieldset>}

      {paso === 'canales' && (
        <fieldset className="dg-grupo" aria-labelledby={idTitulo} aria-describedby={idAyuda}>
          <div className="dg-opciones">
            {CANALES.map((c) => (
              <label className="dg-opcion" key={c.id}>
                <input
                  type="checkbox"
                  name="canales"
                  value={c.id}
                  checked={respuestas.canales.includes(c.id)}
                  onChange={() => onCanal(c.id)}
                />
                <span className="dg-opcion-texto">{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {paso === 'escala' && (
        <div className="dg-escala">
          <fieldset className="dg-grupo">
            <legend className="dg-subtitulo">Locales</legend>
            <Opciones nombre="locales" lista={LOCALES} valor={respuestas.locales} onElegir={onElegir} onPuntero={onPuntero} />
          </fieldset>
          <fieldset className="dg-grupo">
            <legend className="dg-subtitulo">Equipo</legend>
            <Opciones nombre="equipo" lista={EQUIPOS} valor={respuestas.equipo} onElegir={onElegir} onPuntero={onPuntero} />
          </fieldset>
        </div>
      )}

      {paso === 'nombre_negocio' && (
        <input
          className="dg-texto"
          type="text"
          name="nombre_negocio"
          maxLength={80}
          autoComplete="organization"
          aria-labelledby={idTitulo}
          aria-describedby={idAyuda}
          value={respuestas.nombre_negocio}
          onChange={(e) => onNombre(e.target.value)}
        />
      )}

      <div className="dg-acciones">
        {paso === 'nombre_negocio' ? (
          <button type="submit" className="dg-boton dg-boton-volt">Ver mi diagnóstico</button>
        ) : (
          <button type="submit" className="dg-boton" disabled={!listo}>Seguir</button>
        )}
        {puedeVolver && (
          <button type="button" className="dg-texto-boton" onClick={onVolver}>{textoVolver}</button>
        )}
        <p className="dg-cuenta" aria-hidden="true">{cuenta}</p>
      </div>
    </form>
  );
}

function Opciones({ nombre, lista, valor, onElegir, onPuntero }) {
  return (
    <div className="dg-opciones">
      {lista.map((o) => (
        <label className={`dg-opcion${o.sub ? ' dg-opcion-doble' : ''}`} key={o.id} onPointerDown={onPuntero}>
          <input
            type="radio"
            name={nombre}
            value={o.id}
            checked={valor === o.id}
            onChange={() => onElegir(nombre, o.id)}
          />
          <span className="dg-opcion-texto">
            <span className="dg-opcion-label">{o.label}</span>
            {o.sub && <span className="dg-opcion-sub">{o.sub}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

/* ─────────────── La ficha: lo que Dico lee ─────────────── */

function Ficha({ respuestas, paso, fase }) {
  const filas = FICHA.filter(([clave]) => clave !== 'establecimiento' || respuestas.vertical !== 'otro');
  const plan = respuestas.locales && respuestas.equipo ? PLANES[planRecomendado(respuestas)] : null;
  const leyendo = fase === 'analizando';

  return (
    <div className={`pl-pieza dg-ficha${leyendo ? ' leyendo' : ''}`} data-ui role="group" aria-label="Tus respuestas">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Diagnóstico</span>
        <span className="pl-pieza-meta">{respuestas.nombre_negocio.trim() || 'Tu negocio'}</span>
      </div>
      <dl className="pl-filas">
        {filas.map(([clave, nombre]) => {
          const valor = valorDeFicha(clave, respuestas);
          const actual = fase === 'preguntas' && clave === paso;
          return (
            <div className={`pl-fila dg-ficha-fila${actual ? ' actual' : ''}`} key={clave}>
              <dt>{nombre}</dt>
              <dd key={valor || 'vacio'} className={valor ? 'dg-ficha-valor' : 'dg-ficha-falta'}>
                {valor || '—'}
              </dd>
            </div>
          );
        })}
      </dl>
      {fase !== 'resultado' && <div className="pl-pieza-cifra">
        <span className="pl-pieza-cifra-nombre">Plan que te conviene</span>
        {plan ? (
          <>
            <span className="pl-pieza-cifra-valor pl-oro" key={plan.nombre}>{plan.nombre}</span>
            <span className="pl-pieza-cifra-nota">{plan.precio}</span>
          </>
        ) : (
          <span className="dg-ficha-sin-plan">Lo calculo cuando me digas el tamaño.</span>
        )}
      </div>}
    </div>
  );
}
