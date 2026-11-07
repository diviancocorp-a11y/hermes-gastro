import { useEffect, useRef, useState } from 'react';
import EarthBlaze from './EarthBlaze';
import '../../styles/que-es-dico.css';

// Conoce Dico, antes de Rubros: el horizonte con el sol dorado a la izquierda y
// tres escenas que rotan en el negro del planeta, a la derecha. En cada escena
// el sol se corre por el horizonte. La rotacion para con el mouse encima,
// mientras se mantiene apretado en el telefono, con el foco de teclado
// adentro, fuera de pantalla y con movimiento reducido. Ademas se detiene del
// todo al tocar una pestana, el texto o una flecha (WCAG 2.2.2: en el telefono
// no hay hover y 5 s no alcanzan para leer). Sin boton de pausa (Ricky, 5/nov y
// 7/nov): las flechas a los lados del texto pasan de escena y frenan la rotacion.
const ESCENAS = [
  {
    id: 'que-es',
    nombre: 'Qué es',
    titulo: 'Todo tu negocio, en un solo lugar.',
    texto: 'Dico junta pedidos, stock, caja, personal y clientes, y te muestra cuánto ganás de verdad. Sirve para gastronomía, comercios y servicios, y crece con tu negocio.',
    luz: -.6,
  },
  {
    id: 'vision',
    nombre: 'Visión',
    titulo: 'Que cada negocio sepa cuánto gana.',
    texto: 'Queremos que el dueño de un local chico tenga la misma claridad que una cadena grande: los números al día y sin planillas, para decidir con datos y no a ciegas.',
    luz: 0,
  },
  {
    id: 'mision',
    nombre: 'Misión',
    titulo: 'Devolverte el tiempo para lo que importa.',
    texto: 'Ordenamos la operación de todos los días para que dejes de apagar incendios. Te acompañamos desde el primer dato cargado y seguimos con vos mientras el negocio crece.',
    luz: .35,
  },
];
const DURACION = 5000;

export default function QueEsDico() {
  const raiz = useRef(null);
  const pestanas = useRef([]);
  const [activa, setActiva] = useState(0);
  const [puntero, setPuntero] = useState(false);
  const [foco, setFoco] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducido, setReducido] = useState(false);
  // La persona tomo el control (pestana, flecha o texto): no se reanuda sola.
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return undefined;
    const leer = () => setReducido(media.matches);
    leer();
    media.addEventListener('change', leer);
    return () => media.removeEventListener('change', leer);
  }, []);
  useEffect(() => {
    // Se mira el texto y no la seccion: en el telefono la escena va arriba y
    // la rotacion no tiene que avanzar si el texto todavia no se ve.
    const elemento = raiz.current?.querySelector('.qd-texto');
    if (!elemento || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entrada]) => setVisible(entrada.isIntersecting), { threshold: .35 });
    io.observe(elemento);
    return () => io.disconnect();
  }, []);

  const corre = visible && !puntero && !foco && !reducido && !pausado;
  // La animacion de la barra marca el tiempo: al terminar pasa a la escena siguiente.
  const siguiente = () => setActiva(i => (i + 1) % ESCENAS.length);
  const elegir = indice => { setActiva(indice); setPausado(true); };
  const pasar = paso => elegir((activa + paso + ESCENAS.length) % ESCENAS.length);
  const teclas = evento => {
    const paso = { ArrowRight: 1, ArrowLeft: -1 }[evento.key];
    let indice = paso ? (activa + paso + ESCENAS.length) % ESCENAS.length : null;
    if (evento.key === 'Home') indice = 0;
    if (evento.key === 'End') indice = ESCENAS.length - 1;
    if (indice === null) return;
    evento.preventDefault();
    setActiva(indice);
    setPausado(true);
    pestanas.current[indice]?.focus();
  };

  return (
    <section className={`qd-root${corre ? ' qd-corre' : ''}`} id="que-es" aria-labelledby="qd-titulo" ref={raiz}
      onPointerEnter={evento => { if (evento.pointerType === 'mouse') setPuntero(true); }}
      onPointerLeave={evento => { if (evento.pointerType === 'mouse') setPuntero(false); }}
      onPointerDown={evento => { if (evento.pointerType !== 'mouse') setPuntero(true); }}
      onPointerUp={evento => { if (evento.pointerType !== 'mouse') setPuntero(false); }}
      onPointerCancel={evento => { if (evento.pointerType !== 'mouse') setPuntero(false); }}
      onFocus={evento => setFoco(evento.target.matches(':focus-visible'))}
      onBlur={evento => { if (!evento.currentTarget.contains(evento.relatedTarget)) setFoco(false); }}>
      <EarthBlaze className="qd-escena" interactive={false} starCount={1400} galaxyBrightness={.8} illumination={1.15}
        luz={ESCENAS[activa].luz} auroraColor="var(--ds-color-brand-gold-300)" backgroundColor="var(--ds-color-intelligence-trace)" />
      <div className="qd-texto" data-reveal="">
        <h2 id="qd-titulo" className="qd-antetitulo">Conocé <span translate="no">Dico</span></h2>
        <div className="qd-cuerpo">
        <button type="button" className="qd-flecha" onClick={() => pasar(-1)} aria-controls="qd-paneles"
          aria-label={`Anterior: ${ESCENAS[(activa + ESCENAS.length - 1) % ESCENAS.length].nombre}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        {/* Anuncia el texto nuevo solo cuando la persona tomo el control, nunca en la rotacion. */}
        <div className="qd-paneles" id="qd-paneles" aria-live={pausado ? 'polite' : 'off'} onClick={() => setPausado(true)}>
          {ESCENAS.map((escena, indice) => (
            <div key={escena.id} id={`qd-panel-${escena.id}`} role="tabpanel" aria-labelledby={`qd-tab-${escena.id}`}
              className={`qd-panel${indice === activa ? ' qd-activo' : ''}`} aria-hidden={indice !== activa} inert={indice !== activa}
              tabIndex={indice === activa ? 0 : -1}>
              <h3>{escena.titulo}</h3>
              <p>{escena.texto}</p>
            </div>
          ))}
        </div>
        <button type="button" className="qd-flecha" onClick={() => pasar(1)} aria-controls="qd-paneles"
          aria-label={`Siguiente: ${ESCENAS[(activa + 1) % ESCENAS.length].nombre}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>
        </button>
        </div>
        <div className="qd-controles">
          <div className="qd-pestanas" role="tablist" aria-label="Conocé Dico" onKeyDown={teclas}>
            {ESCENAS.map((escena, indice) => (
              <button key={escena.id} type="button" role="tab" id={`qd-tab-${escena.id}`} aria-controls={`qd-panel-${escena.id}`}
                aria-selected={indice === activa} tabIndex={indice === activa ? 0 : -1}
                ref={nodo => { pestanas.current[indice] = nodo; }} onClick={() => elegir(indice)}
                className={`qd-pestana${indice === activa ? ' qd-activo' : ''}`}>
                <span className="qd-barra" aria-hidden="true">
                  {indice === activa && <span key={activa} style={{ animationDuration: `${DURACION}ms` }} onAnimationEnd={siguiente} />}
                </span>
                {escena.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
