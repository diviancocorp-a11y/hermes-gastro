// src/pages/Diagnostico.jsx
// El diagnostico de la landing (divianco.app/diagnostico). Capta, cualifica y
// vende sin reunion: seis preguntas, Dico guiando, y al final la pieza del
// producto que resuelve el desafio elegido, el plan que conviene y el alta.
//
// Es la misma pieza de la misma maquina que la landing (PlatformLanding.jsx):
// usa su raiz (.pl-root), sus tokens y sus piezas (components/landing/Piezas).
// Direccion "the product performs": a la derecha, la ficha del diagnostico se
// arma en vivo con cada respuesta (y calcula el plan apenas puede); al final,
// la ficha se convierte en la pieza del producto que resuelve el problema.
//
// Colores (RC5 cap. 03): la tinta para avanzar, el volt para lo que Dico lee
// (el progreso, la ficha, "Ver mi diagnostico", el analisis) y el oro UNA vez,
// en el resultado: "Crear mi cuenta gratis".
//
// TODA la logica y los textos de preguntas, opciones, plan y respuestas salen
// de src/lib/diagnostico.js. Aca viven solo los textos de la interfaz (los
// enunciados de cada paso y lo que dice Dico), en PASOS y en el resultado.
//
// guardarDiagnostico guarda una fila real (edge function `diagnostico`). Nunca
// tira, y el resultado no la espera: Dico "lee" ANALISIS_MS y muestra el
// resultado con o sin respuesta de la red.

import { useCallback, useEffect, useRef, useState } from 'react';
import { cargarAnalitica, marcarEvento } from '../lib/analiticaPlataforma';
import { AGENDA_URL } from '../lib/contactoPlataforma';
import {
  CANALES, EQUIPOS, ESTABLECIMIENTOS, GESTIONES, LOCALES, PLANES, VERTICALES,
  desafiosDe, guardarDiagnostico, paramsDelAlta, planRecomendado, solucion,
} from '../lib/diagnostico';
import { PiezaPorNombre } from '../components/landing/Piezas';
import '../styles/plataforma-claro.css';
import '../styles/platform-landing.css';
import '../styles/diagnostico.css';

const TITULO = 'Diagnóstico de tu negocio — Dico';
const DESCRIPCION = 'Seis preguntas sobre tu negocio y Dico te dice qué resolver '
  + 'primero, cómo lo resuelve y qué plan te conviene.';

// Lo que dura el "estoy leyendo" de Dico. Tope del brief: 1,2 s.
const ANALISIS_MS = 1000;
// Lo que se ve la eleccion antes de pasar sola a la siguiente (solo con
// puntero: con el teclado se avanza con Enter o con "Seguir").
const PAUSA_ELECCION_MS = 320;

const DICO = (cara) => `/brand/dico/dico-2d-${cara}.png`;
const CARAS = ['question', 'curious', 'neutral', 'happy', 'celebrate'];

/* Textos de la interfaz por paso. `cara` es el estado de Dico (RC5 cap. 08):
   question/curious al preguntar. */
const PASOS = {
  vertical: {
    pregunta: '¿Qué tipo de negocio tenés?',
    dico: 'Son pocas preguntas. Al final te digo por dónde empezar.',
    cara: 'question',
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
  gestion: {
    pregunta: '¿Cómo controlás hoy costos y resultados?',
    dico: 'Sin juicio: casi todos empiezan con una planilla.',
    cara: 'question',
  },
  desafio: {
    pregunta: '¿Qué es lo que más te preocupa hoy?',
    ayuda: 'Elegí uno: es por donde empezamos.',
    dico: 'Uno solo. Lo demás viene después.',
    cara: 'curious',
  },
  nombre: {
    pregunta: '¿Cómo se llama tu negocio?',
    ayuda: 'Es opcional.',
    dico: 'Si me lo decís, te lo dejo cargado en el alta.',
    cara: 'curious',
  },
};

// La ficha que se arma a la derecha: un renglon por pregunta.
const FICHA = [
  ['vertical', 'Rubro'],
  ['establecimiento', 'Negocio'],
  ['canales', 'Canales'],
  ['escala', 'Tamaño'],
  ['gestion', 'Control hoy'],
  ['desafio', 'Preocupación'],
];

const recorridoDe = (vertical) => [
  'vertical',
  ...(vertical === 'otro' ? [] : ['establecimiento']),
  'canales', 'escala', 'gestion', 'desafio', 'nombre',
];

const labelDe = (lista, id) => lista.find((o) => o.id === id)?.label;

function completo(paso, r) {
  switch (paso) {
    case 'vertical': return Boolean(r.vertical);
    case 'establecimiento': return Boolean(r.establecimiento);
    case 'canales': return r.canales.length > 0;
    case 'escala': return Boolean(r.locales && r.equipo);
    case 'gestion': return Boolean(r.gestion_actual);
    case 'desafio': return Boolean(r.desafio);
    default: return true;
  }
}

/** Lo que muestra cada renglon de la ficha, o null si falta. */
function valorDeFicha(clave, r) {
  switch (clave) {
    case 'vertical': return labelDe(VERTICALES, r.vertical);
    case 'establecimiento': return labelDe(ESTABLECIMIENTOS[r.vertical] || [], r.establecimiento);
    case 'canales': return r.canales.length
      ? CANALES.filter((c) => r.canales.includes(c.id)).map((c) => c.label).join(', ')
      : null;
    case 'escala': return r.locales && r.equipo
      ? `${labelDe(LOCALES, r.locales)} · ${labelDe(EQUIPOS, r.equipo)}`
      : labelDe(LOCALES, r.locales) || labelDe(EQUIPOS, r.equipo) || null;
    case 'gestion': return labelDe(GESTIONES, r.gestion_actual);
    case 'desafio': return labelDe(desafiosDe(r.vertical), r.desafio);
    default: return null;
  }
}

function verticalDeLaUrl() {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('vertical');
  return VERTICALES.some((x) => x.id === v) ? v : null;
}

const VACIO = {
  vertical: null,
  establecimiento: null,
  canales: [],
  locales: null,
  equipo: null,
  gestion_actual: null,
  desafio: null,
  nombre_negocio: '',
};

/** Lo que se guarda: los ids de la tabla diagnosticos, sin campos vacios. */
function datosDe(r) {
  return {
    vertical: r.vertical,
    establecimiento: r.vertical === 'otro' ? null : r.establecimiento,
    canales: r.canales,
    locales: r.locales,
    equipo: r.equipo,
    gestion_actual: r.gestion_actual,
    desafio: r.desafio,
    nombre_negocio: r.nombre_negocio.trim() || null,
  };
}

export default function Diagnostico() {
  const [respuestas, setRespuestas] = useState(() => ({ ...VACIO, vertical: verticalDeLaUrl() }));
  // Si la landing mando el rubro, se arranca en el paso que sigue.
  const [indice, setIndice] = useState(() => (verticalDeLaUrl() ? 1 : 0));
  const [fase, setFase] = useState('preguntas'); // preguntas | analizando | resultado
  const [id, setId] = useState(null);
  const [gesto, setGesto] = useState(0);

  const tituloRef = useRef(null);
  const porPuntero = useRef(false);
  const avance = useRef(null);
  const guardado = useRef(null); // firma de lo ultimo que se mando
  const primerPintado = useRef(true);

  const recorrido = recorridoDe(respuestas.vertical);
  const paso = recorrido[Math.min(indice, recorrido.length - 1)];
  const preguntas = recorrido.length - 1; // el nombre no cuenta como pregunta
  const listo = completo(paso, respuestas);

  useEffect(() => {
    document.title = TITULO;
    const meta = document.head.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', DESCRIPCION);
    cargarAnalitica();
    marcarEvento('diagnostico-inicio');
    // Las caras de Dico, precargadas: cambiar de estado no tiene que parpadear.
    CARAS.forEach((c) => { const i = new Image(); i.src = DICO(c); });

    const raiz = document.documentElement;
    const esquemaPrevio = raiz.style.colorScheme;
    raiz.style.colorScheme = 'light';
    return () => { raiz.style.colorScheme = esquemaPrevio; };
  }, []);

  useEffect(() => () => clearTimeout(avance.current), []);

  // Cada paso nuevo lleva el foco a su enunciado: el lector de pantalla lo
  // anuncia y el teclado sigue desde ahi. En el primer pintado no se toca.
  useEffect(() => {
    if (primerPintado.current) { primerPintado.current = false; return; }
    tituloRef.current?.focus({ preventScroll: true });
    if (window.scrollY > 0) window.scrollTo({ top: 0 });
  }, [paso, fase]);

  useEffect(() => {
    if (fase === 'resultado') marcarEvento('diagnostico-resultado');
  }, [fase]);

  const irA = useCallback((i) => {
    clearTimeout(avance.current);
    setIndice(i);
  }, []);

  const analizar = useCallback((r) => {
    clearTimeout(avance.current);
    setFase('analizando');
    const datos = datosDe(r);
    const firma = JSON.stringify(datos);
    // Volver a ver el resultado sin cambiar nada no guarda otra fila.
    if (guardado.current !== firma) {
      guardado.current = firma;
      setId(null);
      guardarDiagnostico(datos).then((nuevo) => { if (nuevo) setId(nuevo); });
    }
    avance.current = setTimeout(() => setFase('resultado'), ANALISIS_MS);
  }, []);

  const seguir = useCallback(() => {
    if (!completo(paso, respuestas)) return;
    if (paso === 'nombre') { analizar(respuestas); return; }
    irA(indice + 1);
  }, [paso, respuestas, indice, irA, analizar]);

  const volver = () => {
    if (fase !== 'preguntas') { clearTimeout(avance.current); setFase('preguntas'); return; }
    if (indice > 0) irA(indice - 1);
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
      clearTimeout(avance.current);
      avance.current = setTimeout(() => setIndice((i) => i + 1), PAUSA_ELECCION_MS);
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

  const alEnviar = (e) => {
    e.preventDefault();
    seguir();
  };

  // Enter sobre un radio o un checkbox tambien avanza (el navegador no lo hace).
  const alTeclear = (e) => {
    porPuntero.current = false;
    if (e.key === 'Enter' && (e.target.type === 'radio' || e.target.type === 'checkbox')) {
      e.preventDefault();
      seguir();
    }
  };

  const marcarPuntero = () => { porPuntero.current = true; };

  const sol = fase === 'resultado' ? solucion(respuestas.desafio, respuestas.vertical) : null;

  let cara = PASOS[paso].cara;
  let dice = PASOS[paso].dico;
  if (fase === 'analizando') { cara = 'neutral'; dice = 'Un segundo.'; }
  if (fase === 'resultado') {
    cara = sol?.pendiente ? 'happy' : 'celebrate';
    const nombre = respuestas.nombre_negocio.trim();
    dice = nombre
      ? `${nombre}: esto es lo primero que resolvería.`
      : 'Esto es lo primero que resolvería.';
  }

  const hechas = fase !== 'preguntas' ? preguntas : Math.min(indice + 1, preguntas);

  return (
    <div className={`pl-root dg-root dg-fase-${fase}`}>
      <header className="dg-cabecera">
        <a className="pl-marca" href="/">
          <img src="/brand/dico/logo/dico-claro.png" alt="Dico" width="1368" height="452" />
        </a>
        {/* Sin aria-live: el foco ya va al enunciado de cada paso. */}
        <p className="dg-cuenta">
          {fase === 'resultado' && 'Tu diagnóstico'}
          {fase === 'analizando' && 'Leyendo tus respuestas'}
          {fase === 'preguntas' && (paso === 'nombre' ? 'Último paso' : `Pregunta ${indice + 1} de ${preguntas}`)}
        </p>
        <div
          className={`dg-progreso${fase === 'analizando' ? ' leyendo' : ''}`}
          role="progressbar"
          aria-label="Avance del diagnóstico"
          aria-valuemin={0}
          aria-valuemax={preguntas}
          aria-valuenow={hechas}
        >
          {Array.from({ length: preguntas }, (_, i) => (
            <span key={i} className={`dg-tramo${i < hechas ? ' hecho' : ''}`} />
          ))}
        </div>
      </header>

      <div className="dg-contenido">
        {fase === 'preguntas' && (
          <Pregunta
            paso={paso}
            respuestas={respuestas}
            tituloRef={tituloRef}
            listo={listo}
            puedeVolver={indice > 0}
            onElegir={elegir}
            onCanal={alternarCanal}
            onNombre={(v) => setRespuestas({ ...respuestas, nombre_negocio: v })}
            onEnviar={alEnviar}
            onTeclear={alTeclear}
            onPuntero={marcarPuntero}
            onVolver={volver}
          />
        )}

        {fase === 'analizando' && (
          <div className="dg-paso" key="analizando">
            <h1 className="dg-h1" ref={tituloRef} tabIndex={-1}>Estoy leyendo tus respuestas.</h1>
          </div>
        )}

        {fase === 'resultado' && sol && (
          <Resultado
            sol={sol}
            respuestas={respuestas}
            id={id}
            tituloRef={tituloRef}
            onVolver={volver}
          />
        )}
      </div>

      {/* El campo de la derecha: Dico (una sola instancia) y la ficha que se
          arma, o la pieza del producto en el resultado. En el telefono, Dico
          va arriba de la pregunta y la ficha abajo. */}
      <div className="dg-lado">
        <div className="dg-dico">
          <span className="dg-dico-cuerpo" key={`${cara}-${gesto}`} data-gesto={gesto > 0 ? '' : undefined}>
            <img src={DICO(cara)} alt="" width="256" height="256" />
          </span>
          <p className="pl-dico-dice dg-dico-dice" key={dice}>{dice}</p>
        </div>

        <div className="dg-escena">
          {fase === 'resultado' && sol
            ? (
              <div className="dg-pieza" key={sol.pieza}>
                <PiezaPorNombre nombre={sol.pieza} rubro={respuestas.vertical} />
              </div>
            )
            : <Ficha respuestas={respuestas} paso={paso} leyendo={fase === 'analizando'} />}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Una pregunta ─────────────── */

function Pregunta({
  paso, respuestas, tituloRef, listo, puedeVolver,
  onElegir, onCanal, onNombre, onEnviar, onTeclear, onPuntero, onVolver,
}) {
  const texto = PASOS[paso];
  const idTitulo = 'dg-pregunta';
  const idAyuda = texto.ayuda ? 'dg-ayuda' : undefined;

  const opcionesSimples = {
    vertical: [VERTICALES, 'vertical'],
    establecimiento: [ESTABLECIMIENTOS[respuestas.vertical] || [], 'establecimiento'],
    gestion: [GESTIONES, 'gestion_actual'],
    desafio: [desafiosDe(respuestas.vertical), 'desafio'],
  }[paso];

  return (
    <form className="dg-paso" key={paso} onSubmit={onEnviar} onKeyDown={onTeclear} noValidate>
      <h1 className="dg-h1" id={idTitulo} ref={tituloRef} tabIndex={-1}>{texto.pregunta}</h1>
      {texto.ayuda && <p className="dg-ayuda" id={idAyuda}>{texto.ayuda}</p>}

      {opcionesSimples && (
        <fieldset className="dg-grupo" aria-labelledby={idTitulo} aria-describedby={idAyuda}>
          <Opciones
            nombre={opcionesSimples[1]}
            lista={opcionesSimples[0]}
            valor={respuestas[opcionesSimples[1]]}
            onElegir={onElegir}
            onPuntero={onPuntero}
          />
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
                <span>{c.label}</span>
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

      {paso === 'nombre' && (
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
        {paso === 'nombre' ? (
          <button type="submit" className="dg-boton dg-boton-volt">Ver mi diagnóstico</button>
        ) : (
          <button type="submit" className="dg-boton" disabled={!listo}>Seguir</button>
        )}
        {puedeVolver && (
          <button type="button" className="dg-volver" onClick={onVolver}>Volver</button>
        )}
      </div>
    </form>
  );
}

function Opciones({ nombre, lista, valor, onElegir, onPuntero }) {
  return (
    <div className="dg-opciones">
      {lista.map((o) => (
        <label className="dg-opcion" key={o.id} onPointerDown={onPuntero}>
          <input
            type="radio"
            name={nombre}
            value={o.id}
            checked={valor === o.id}
            onChange={() => onElegir(nombre, o.id)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ─────────────── La ficha que se arma ─────────────── */

function Ficha({ respuestas, paso, leyendo }) {
  const filas = FICHA.filter(([clave]) => clave !== 'establecimiento' || respuestas.vertical !== 'otro');
  const conPlan = respuestas.locales && respuestas.equipo;
  const plan = conPlan ? PLANES[planRecomendado(respuestas)] : null;

  return (
    <div className={`pl-pieza dg-ficha${leyendo ? ' leyendo' : ''}`} data-ui aria-label="Tu ficha de diagnóstico">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Diagnóstico</span>
        <span className="pl-pieza-meta">{respuestas.nombre_negocio.trim() || 'Tu negocio'}</span>
      </div>
      <dl className="pl-filas">
        {filas.map(([clave, nombre]) => {
          const valor = valorDeFicha(clave, respuestas);
          const actual = !leyendo && clave === paso;
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

/* ─────────────── El resultado: la venta ─────────────── */

function Resultado({ sol, respuestas, id, tituloRef, onVolver }) {
  const plan = PLANES[planRecomendado(respuestas)];
  const alta = `/registro?${paramsDelAlta(respuestas, id)}`;
  const otroRubro = respuestas.vertical === 'otro';

  return (
    <div className="dg-paso dg-resultado" key="resultado">
      <h1 className="dg-h1" ref={tituloRef} tabIndex={-1}>{sol.titulo}</h1>
      <p className="dg-hoy">{sol.hoy}</p>

      {otroRubro && (
        <p className="dg-nota">
          En tu rubro te sirven el catálogo online, los pedidos, la caja, el stock
          y el personal. Lo que es propio de un rubro, como las recetas, no aplica.
        </p>
      )}

      {sol.pendiente && (
        <p className="dg-pendiente">
          <span className="dg-pendiente-que">{sol.pendiente}</span>
          <span className="dg-pendiente-estado">En desarrollo</span>
        </p>
      )}

      <section className="dg-plan" aria-labelledby="dg-plan-titulo">
        <h2 id="dg-plan-titulo" className="dg-plan-titulo">Te conviene el plan {plan.nombre}.</h2>
        <p className="dg-plan-precio">{plan.precio}</p>
        <p className="dg-plan-detalle">{plan.detalle}</p>
      </section>

      <div className="pl-acciones dg-cierre">
        <a className="pl-boton" href={alta}>Crear mi cuenta gratis</a>
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
      {plan.precio !== PLANES.digital.precio && (
        <p className="dg-nota">
          La cuenta empieza gratis y sin tarjeta. Pasás al plan {plan.nombre} cuando quieras.
        </p>
      )}

      <button type="button" className="dg-volver" onClick={onVolver}>Volver a las preguntas</button>
    </div>
  );
}
