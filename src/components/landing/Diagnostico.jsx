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
import { marcarEvento } from '../../lib/analiticaPlataforma';
import { AGENDA_URL } from '../../lib/contactoPlataforma';
import {
  CANALES, EQUIPOS, ESTABLECIMIENTOS, GESTIONES, INVERSIONES, LOCALES, ORDEN_PASOS,
  PLANES, URGENCIAS, VERTICALES, desafiosDe, guardarDiagnostico, paramsDelAlta,
  planRecomendado, recordarDiagnosticoPendiente, solucion,
} from '../../lib/diagnostico';
import { PiezaPorNombre } from './Piezas';

// Lo que dura el "estoy leyendo" de Dico. Tope del brief: 1,2 s.
const ANALISIS_MS = 1000;
// Lo que se ve la eleccion antes de pasar sola a la siguiente (solo con
// puntero: con el teclado se avanza con Enter o con "Seguir").
const PAUSA_ELECCION_MS = 320;
const CLAVE_SESION = 'dico:diagnostico-en-curso';
const CLAVE_EVENTOS = 'dico:diagnostico-eventos';

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
  try { sessionStorage.setItem(CLAVE_EVENTOS, JSON.stringify([...hechos, id].slice(-20))); } catch { /* sin storage */ }
}

const DICO = (cara) => `/brand/dico/dico-2d-${cara}.png`;
const CARAS = ['question', 'curious', 'neutral', 'happy', 'celebrate'];

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
    dico: 'Si es urgente, arrancamos hoy mismo.',
    cara: 'curious',
  },
  inversion: {
    pregunta: '¿Cuánto pensás invertir por mes?',
    ayuda: 'Hay un plan gratis. Esto es para mostrarte el que te sirve.',
    dico: 'Sin compromiso: no te pido tarjeta ni email.',
    cara: 'question',
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
  ['inversion', 'Inversión'],
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
};

const recorridoDe = (vertical) => ORDEN_PASOS
  .filter((p) => !(p === 'establecimiento' && vertical === 'otro'));

const labelDe = (lista, id) => lista.find((o) => o.id === id)?.label;

function completo(paso, r) {
  switch (paso) {
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
    case 'inversion': return labelDe(INVERSIONES, r.inversion);
    default: return null;
  }
}

/** Lo que se guarda: los ids de la tabla diagnosticos (0100-0102). */
function datosDe(r) {
  return {
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
    const s = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || 'null');
    if (!s || typeof s !== 'object' || !s.respuestas) return null;
    const r = { ...VACIO, ...s.respuestas };
    if (!Array.isArray(r.canales)) r.canales = [];
    if (typeof r.nombre_negocio !== 'string') r.nombre_negocio = '';
    return { respuestas: r, id: typeof s.id === 'string' ? s.id : null, firma: s.firma || null };
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
  const h = estadoDeHistoria();
  const base = { respuestas, id: sesion?.id || null, firma: sesion?.firma || null };

  if (h === 'resultado') {
    if (todoCompleto(respuestas)) return { ...base, abierto: true, indice: 0, fase: 'resultado' };
    // La entrada dice "resultado" pero faltan respuestas (se borro la sesion):
    // se muestra la primera que falta y la historia se corrige al montar.
    return { ...base, abierto: true, indice: primerFaltante(respuestas), fase: 'preguntas', corregir: true };
  }
  if (typeof h === 'number') return { ...base, abierto: true, indice: h, fase: 'preguntas' };
  if (modo === 'pagina') return { ...base, abierto: true, indice: delaUrl ? 1 : 0, fase: 'preguntas' };
  return { ...base, abierto: false, indice: 0, fase: 'preguntas' };
}

/**
 * modo 'home': cerrado muestra `<Portada onAbrir>` en la columna y `lado` en el
 *   instrumento; el boton de la portada lo abre. `abrirRef.current` queda con
 *   `abrir` para los otros botones de la pagina.
 * modo 'pagina': arranca abierto. `nivel` es la etiqueta del enunciado.
 */
export default function Diagnostico({ modo = 'pagina', Portada, lado, abrirRef, nivel = 'h1' }) {
  const [inicio] = useState(() => arranque(modo));
  const [respuestas, setRespuestas] = useState(inicio.respuestas);
  const [abierto, setAbierto] = useState(inicio.abierto);
  const [indice, setIndice] = useState(inicio.indice);
  const [fase, setFase] = useState(inicio.fase); // preguntas | analizando | resultado
  const [id, setId] = useState(inicio.id);
  const [guardado, setGuardado] = useState(inicio.id ? 'ok' : 'nada'); // nada | guardando | ok | error
  const [gesto, setGesto] = useState(0);

  const raizRef = useRef(null);
  const tituloRef = useRef(null);
  const porPuntero = useRef(false);
  const avance = useRef(null);
  const respuestasRef = useRef(respuestas);
  // Guardado: firma de lo ultimo que se mando, su id y un turno para descartar
  // respuestas viejas que lleguen tarde.
  const envio = useRef({ firma: inicio.id ? inicio.firma : null, id: inicio.id, turno: 0, enCurso: false });
  const vista = useRef(null); // ultimo `abierto|paso|fase` atendido
  const marcoInicio = useRef(false);
  const marcoResultado = useRef(null);

  const recorrido = recorridoDe(respuestas.vertical);
  const pasoIdx = Math.min(indice, recorrido.length - 1);
  const paso = recorrido[pasoIdx];
  const listo = completo(paso, respuestas);
  const conDesde = () => window.history.state?.desde === true;

  // Caras de Dico precargadas: cambiar de estado no tiene que parpadear.
  useEffect(() => {
    CARAS.forEach((c) => { const i = new Image(); i.src = DICO(c); });
    if ((modo === 'pagina' && estadoDeHistoria() === undefined) || inicio.corregir) {
      window.history.replaceState({ ...window.history.state, dg: inicio.indice }, '');
    }
  }, [modo, inicio.indice, inicio.corregir]);

  useEffect(() => () => clearTimeout(avance.current), []);
  useEffect(() => { respuestasRef.current = respuestas; }, [respuestas]);

  // Respuestas e id en la sesion: Atras y una recarga no las pierden.
  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify({
        respuestas, id: envio.current.id, firma: envio.current.id ? envio.current.firma : null,
      }));
    } catch { /* sin storage: sigue andando, sin recordar */ }
  }, [respuestas, id]);

  // Analitica: el inicio y el resultado, una vez por diagnostico aunque se
  // recargue (marca en sessionStorage). El resultado se marca por juego de
  // respuestas: cambiar respuestas y ver otro resultado es otro diagnostico.
  useEffect(() => {
    if (abierto && !marcoInicio.current) { marcoInicio.current = true; marcarUnaVez('diagnostico-inicio'); }
  }, [abierto]);
  useEffect(() => {
    if (fase !== 'resultado') return;
    const firma = JSON.stringify(datosDe(respuestas));
    if (marcoResultado.current === firma) return;
    marcoResultado.current = firma;
    marcarUnaVez('diagnostico-resultado', firma);
  }, [fase, respuestas]);

  // Cada paso lleva el foco a su enunciado (el lector lo anuncia y el teclado
  // sigue desde ahi) y trae el embudo a la vista. Al cerrar, el foco vuelve
  // al boton que lo abrio. Solo cuando algo cambio de verdad: ni en el primer
  // pintado ni en la segunda pasada de efectos de StrictMode.
  useEffect(() => {
    const clave = `${abierto}|${paso}|${fase}`;
    if (vista.current === clave) return;
    const primera = vista.current === null;
    vista.current = clave;
    if (primera) return;
    const raiz = raizRef.current;
    if (!raiz) return;
    if (abierto) {
      tituloRef.current?.focus({ preventScroll: true });
      const arriba = raiz.getBoundingClientRect().top;
      if (arriba < 0 || arriba > window.innerHeight * 0.5) {
        window.scrollTo({ top: Math.max(0, window.scrollY + arriba) });
      }
    } else {
      raiz.querySelector('[data-abrir]')?.focus({ preventScroll: true });
    }
  }, [abierto, paso, fase]);

  // Atras y Adelante del navegador recorren los pasos.
  useEffect(() => {
    const alVolver = (e) => {
      clearTimeout(avance.current);
      const s = e.state?.dg;
      if (s === undefined || s === null) {
        if (modo === 'home') { setAbierto(false); setFase('preguntas'); setIndice(0); }
        return;
      }
      setAbierto(true);
      if (s === 'resultado') {
        if (todoCompleto(respuestasRef.current)) { setFase('resultado'); return; }
        // Pantalla e historial tienen que coincidir: si faltan respuestas, la
        // entrada pasa a ser la primera pregunta sin contestar.
        const falta = primerFaltante(respuestasRef.current);
        window.history.replaceState({ ...window.history.state, dg: falta }, '');
        setFase('preguntas');
        setIndice(falta);
        return;
      }
      setFase('preguntas');
      setIndice(Number(s) || 0);
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, [modo]);

  const empujar = (dg) => window.history.pushState({ ...window.history.state, dg, desde: true }, '');

  const irA = useCallback((i) => {
    clearTimeout(avance.current);
    empujar(i);
    setFase('preguntas');
    setIndice(i);
  }, []);

  const abrir = useCallback(() => {
    if (!abierto) {
      empujar(0);
      setIndice(0);
      setFase('preguntas');
      setAbierto(true);
      return;
    }
    // Ya abierto (un boton de mas abajo): solo traerlo a la vista.
    raizRef.current?.scrollIntoView({ block: 'start' });
    tituloRef.current?.focus({ preventScroll: true });
  }, [abierto]);

  useEffect(() => {
    if (abrirRef) abrirRef.current = abrir;
  }, [abrirRef, abrir]);

  const guardar = useCallback((datos) => {
    const firma = JSON.stringify(datos);
    const e = envio.current;
    // Lo mismo que ya se guardo (o se esta guardando) no se manda de nuevo.
    if (e.firma === firma && (e.id || e.enCurso)) { setId(e.id); return; }
    const turno = e.turno + 1;
    envio.current = { firma, id: null, turno, enCurso: true };
    setId(null);
    setGuardado('guardando');
    guardarDiagnostico(datos).then((nuevo) => {
      // Llego tarde: ya se mando otro juego de respuestas.
      if (envio.current.turno !== turno) return;
      envio.current.enCurso = false;
      if (nuevo) {
        envio.current.id = nuevo;
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

  const seguir = useCallback(() => {
    if (!completo(paso, respuestas)) return;
    if (paso === 'nombre_negocio') { analizar(); return; }
    irA(pasoIdx + 1);
  }, [paso, respuestas, pasoIdx, irA, analizar]);

  const volver = () => {
    clearTimeout(avance.current);
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
      if (!desafiosDe(valor).some((d) => d.id === nuevo.desafio)) nuevo = { ...nuevo, desafio: null };
    }
    setRespuestas(nuevo);
    setGesto((g) => g + 1);
    if (porPuntero.current && paso !== 'escala') {
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

  /* ── Cerrado (solo en la home): la portada y el instrumento ── */
  if (!abierto) {
    return (
      <div className="pl-split dg-embudo dg-cerrado" ref={raizRef}>
        <div className="pl-split-col">{Portada && <Portada onAbrir={abrir} />}</div>
        <div className="pl-split-lado">{lado}</div>
      </div>
    );
  }

  const sol = fase === 'resultado' ? solucion(respuestas.desafio, respuestas.vertical) : null;

  let cara = PASOS[paso].cara;
  let dice = PASOS[paso].dico;
  if (fase === 'analizando') { cara = 'neutral'; dice = 'Un segundo.'; }
  if (fase === 'resultado') {
    cara = sol?.pendiente ? 'happy' : 'celebrate';
    const nombre = respuestas.nombre_negocio.trim();
    dice = nombre ? `${nombre}: esto es lo primero que resolvería.` : 'Esto es lo primero que resolvería.';
  }

  const Titulo = nivel;
  const total = recorrido.length - 1;
  const hechas = fase !== 'preguntas' ? total : Math.min(pasoIdx, total);
  let cuenta = 'Leyendo tus respuestas';
  if (fase === 'preguntas') cuenta = paso === 'nombre_negocio' ? 'Último paso' : `Pregunta ${pasoIdx + 1} de ${total}`;

  const instrumento = (
    <aside className="pl-split-lado dg-lado" aria-label="Tu ficha de diagnóstico">
      <div className="dg-lado-dentro">
        <div className="dg-guia">
          <span className="dg-guia-cara" key={`${cara}-${gesto}`} data-gesto={gesto > 0 ? '' : undefined}>
            <img src={DICO(cara)} alt="" width="256" height="256" />
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
    return (
      <div className="pl-split dg-embudo dg-fase-resultado" ref={raizRef}>
        <div className="pl-split-col dg-res-cab">
          <Titulo className="dg-titulo dg-entra" ref={tituloRef} tabIndex={-1}>{sol.titulo}</Titulo>
        </div>
        {instrumento}
        <Resultado
          sol={sol}
          respuestas={respuestas}
          id={id}
          guardado={guardado}
          onReintentar={() => guardar(datosDe(respuestas))}
        />
      </div>
    );
  }

  /* ── Preguntas (y el segundo en que Dico lee) ── */
  return (
    <div className={`pl-split dg-embudo dg-fase-${fase}`} ref={raizRef}>
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
            <Titulo className="dg-titulo" ref={tituloRef} tabIndex={-1}>Estoy leyendo tus respuestas.</Titulo>
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
      {instrumento}
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
    inversion: INVERSIONES,
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
      <div className="pl-pieza-cifra">
        <span className="pl-pieza-cifra-nombre">Plan que te conviene</span>
        {plan ? (
          <>
            <span className="pl-pieza-cifra-valor pl-oro" key={plan.nombre}>{plan.nombre}</span>
            <span className="pl-pieza-cifra-nota">{plan.precio}</span>
          </>
        ) : (
          <span className="dg-ficha-sin-plan">Lo calculo cuando me digas el tamaño.</span>
        )}
      </div>
    </div>
  );
}

/* ─────────────── El resultado: el plan con nombre propio ─────────────── */

function Resultado({ sol, respuestas, id, guardado, onReintentar }) {
  const planId = planRecomendado(respuestas);
  const plan = PLANES[planId];
  const dolor = desafiosDe(respuestas.vertical).find((d) => d.id === respuestas.desafio);
  const gestion = labelDe(GESTIONES, respuestas.gestion_actual);
  const inversion = labelDe(INVERSIONES, respuestas.inversion);
  const alta = `/registro?${paramsDelAlta(respuestas, id)}`;
  const urgente = respuestas.urgencia === 'ya';
  const pago = planId !== 'digital';

  let sobreInversion = null;
  if (pago && respuestas.inversion === 'gratis') {
    sobreInversion = `Querés empezar gratis: la cuenta arranca en el plan Digital y pasás a ${plan.nombre} cuando lo necesites.`;
  } else if (planId === 'cadena' && respuestas.inversion === 'hasta_60k') {
    sobreInversion = 'Para varias sucursales el plan es Cadena. Podés empezar gratis con un local y sumar los demás después.';
  } else if (pago) {
    sobreInversion = `La cuenta empieza gratis y sin tarjeta. Pasás al plan ${plan.nombre} cuando quieras.`;
  }

  return (
    <div className="pl-split-col dg-res-cuerpo dg-entra">
      {dolor && (
        <section className="dg-bloque" aria-labelledby="dg-encontramos">
          <h2 className="dg-bloque-titulo" id="dg-encontramos">Lo que encontramos</h2>
          <p className="dg-dolor">{dolor.label}.</p>
          <p className="dg-parrafo">{dolor.sub}</p>
        </section>
      )}

      {gestion && (
        <section className="dg-bloque" aria-labelledby="dg-hoy">
          <h2 className="dg-bloque-titulo" id="dg-hoy">Hoy</h2>
          <p className="dg-parrafo">{gestion}.</p>
        </section>
      )}

      <section className="dg-bloque" aria-labelledby="dg-con-dico">
        <h2 className="dg-bloque-titulo" id="dg-con-dico">Con Dico</h2>
        <p className="dg-parrafo">{sol.hoy}</p>
        {respuestas.vertical === 'otro' && (
          <p className="dg-parrafo dg-suave">
            En tu rubro te sirven el catálogo online, los pedidos, la caja, el stock
            y el personal. Lo que es propio de un rubro, como las recetas, no aplica.
          </p>
        )}
        <div className="dg-pieza">
          <PiezaPorNombre nombre={sol.pieza} rubro={respuestas.vertical} />
        </div>
      </section>

      {sol.pendiente && (
        <section className="dg-bloque dg-desarrollo" aria-labelledby="dg-desarrollo">
          <h2 className="dg-bloque-titulo" id="dg-desarrollo">En desarrollo</h2>
          <p className="dg-parrafo">{sol.pendiente}</p>
          <p className="dg-parrafo">
            {sol.aMedida}{' '}
            <a className="pl-enlace" href={AGENDA_URL} target="_blank" rel="noreferrer" onClick={() => marcarEvento('agenda')}>
              Contanos qué necesitás
            </a>
          </p>
        </section>
      )}

      <section className="dg-bloque dg-plan" aria-labelledby="dg-plan">
        <h2 className="dg-bloque-titulo" id="dg-plan">Tu plan</h2>
        <p className="dg-plan-linea">
          <span>{plan.nombre}</span>
          <span>{plan.precio}</span>
        </p>
        <p className="dg-parrafo dg-suave">{plan.detalle}</p>
        {inversion && !(pago && respuestas.inversion === 'gratis') && (
          <p className="dg-parrafo">Elegiste: {inversion.charAt(0).toLowerCase() + inversion.slice(1)}.</p>
        )}
        {sobreInversion && <p className="dg-parrafo">{sobreInversion}</p>}
      </section>

      <div className="dg-cierre">
        <a className="pl-boton" href={alta}>
          {urgente ? 'Crear mi cuenta y empezar hoy' : 'Crear mi cuenta gratis'}
        </a>
        <a
          className="pl-enlace dg-agenda"
          href={AGENDA_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => marcarEvento('agenda')}
        >
          Prefiero que me lo muestren
        </a>
      </div>

      {guardado === 'error' && (
        <p className="dg-parrafo dg-suave dg-guardado" role="status">
          No pude guardar tu diagnóstico. La cuenta se crea igual.{' '}
          <button type="button" className="dg-texto-boton dg-en-linea" onClick={onReintentar}>Reintentar</button>
        </p>
      )}
    </div>
  );
}
