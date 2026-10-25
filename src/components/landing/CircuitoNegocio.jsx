import { useEffect, useRef, useState } from 'react';
import '../../styles/circuito-negocio.css';

const MOMENTOS = [
  {
    titulo: 'Llega el pedido', pantalla: 'Pedidos', imagen: 'pedidos',
    texto: 'Tu cliente elige en el catálogo. Vos recibís el pedido en Dico.',
    detalle: 'Cada pedido aparece con su importe y su estado: nuevo, en preparación, listo o completado. Así ves qué falta resolver sin volver a cargar lo que eligió tu cliente. Recibirlo todavía no descuenta stock ni registra el cobro.',
    alt: 'Panel real de Pedidos de Dico: pedidos nuevos, en preparación, listos y completados, con importes de ejemplo.',
  },
  {
    titulo: 'Completás y cobrás', pantalla: 'Stock', imagen: 'stock',
    texto: 'Al completar, se actualiza el stock. Al registrar el cobro, se refleja en caja.',
    detalle: 'La pantalla muestra cuánto queda de cada insumo, cuáles están por debajo del mínimo y dónde reponer, ajustar o registrar una merma. Al completar el pedido se descuenta su receta; completar el pedido y registrar el cobro son dos acciones distintas.',
    alt: 'Panel real de Stock de Dico: insumos, existencias, mínimos y ficha de reposición, con datos de ejemplo.',
  },
  {
    titulo: 'Ves cómo viene el día', pantalla: 'Resultado del día', imagen: 'resultado',
    texto: 'Ventas, costos y resultado en un mismo lugar.',
    detalle: 'Las ventas se reúnen con descuentos, costo de lo vendido, personal, merma y gastos. La cuenta explica cómo se llega a la ganancia neta. El resultado reúne el día completo; no es la ganancia de un solo pedido.',
    alt: 'Pantalla real de Resultado del día de Dico: ventas, descuentos, costos, nómina, merma y gastos. Ejemplo con ganancia neta de 669.000 pesos.',
  },
];

export default function CircuitoNegocio({ onDiagnostico }) {
  const [momento, setMomento] = useState(0);
  const botones = useRef([]);
  const raiz = useRef(null);
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);
  const [foco, setFoco] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [reducir, setReducir] = useState(false);
  const detenido = !visible || hover || foco || pausado || reducir;

  useEffect(() => {
    const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cambiarPreferencia = () => setReducir(preferencia.matches);
    let enPantalla = typeof IntersectionObserver === 'undefined';
    const actualizar = () => setVisible(enPantalla && !document.hidden);
    const observador = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entrada]) => {
      enPantalla = entrada.isIntersecting;
      actualizar();
    });
    observador?.observe(raiz.current);
    cambiarPreferencia();
    actualizar();
    preferencia.addEventListener('change', cambiarPreferencia);
    document.addEventListener('visibilitychange', actualizar);
    return () => {
      observador?.disconnect();
      preferencia.removeEventListener('change', cambiarPreferencia);
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, []);

  useEffect(() => {
    if (detenido) return undefined;
    const temporizador = setTimeout(() => setMomento(actual => (actual + 1) % MOMENTOS.length), 7000);
    return () => clearTimeout(temporizador);
  }, [detenido, momento]);
  const paso = MOMENTOS[momento];
  const imagen = `/brand/landing/interfaz/${paso.imagen}.png`;
  const alTeclado = (evento, indice) => {
    const direccion = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let siguiente;
    if (evento.key === 'Home') siguiente = 0;
    else if (evento.key === 'End') siguiente = MOMENTOS.length - 1;
    else if (direccion[evento.key]) siguiente = (indice + direccion[evento.key] + MOMENTOS.length) % MOMENTOS.length;
    else return;
    evento.preventDefault();
    setMomento(siguiente);
    botones.current[siguiente]?.focus();
  };

  return (
    <section className="cn-root" id="que-hace" aria-labelledby="cn-titulo" data-momento={momento + 1}
      ref={raiz} data-pausado={detenido}
      onPointerEnter={evento => { if (evento.pointerType !== 'touch') setHover(true); }} onPointerLeave={() => setHover(false)}
      onFocusCapture={() => setFoco(true)} onBlurCapture={evento => { if (!evento.currentTarget.contains(evento.relatedTarget)) setFoco(false); }}>
      <span className="pl-ancla" id="pilares" aria-hidden="true" />
      <span className="pl-ancla" id="flujo" aria-hidden="true" />
      <div className="cn-relato">
        <div className="cn-columna">
          <header className="cn-cabecera">
            <h2 id="cn-titulo">Un pedido.<br />Todo en orden.</h2>
            <p className="cn-intro">Del catálogo al stock y la caja, sin cargar lo mismo dos veces.</p>
          </header>
          <div className="cn-pasos" role="group" aria-label="Momentos del ejemplo">
            {MOMENTOS.map((item, indice) => (
              <div className={`cn-paso${momento === indice ? ' cn-activo' : ''}`} key={item.imagen}>
                <button type="button" className="cn-selector" aria-pressed={momento === indice}
                  aria-controls="cn-vista" onClick={() => setMomento(indice)}
                  onKeyDown={(evento) => alTeclado(evento, indice)} ref={el => { botones.current[indice] = el; }}>
                  <span className="cn-numero" aria-hidden="true">0{indice + 1}</span>
                  <span className="cn-paso-copy"><strong>{item.titulo}</strong><span>{item.texto}</span></span>
                </button>
              </div>
            ))}
          </div>
          <button className="cn-cta pl-boton" type="button" onClick={onDiagnostico}>
            <span className="cn-cta-texto">Quiero ordenar mi negocio</span>
            <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span>
          </button>
        </div>
        <figure className="cn-escena" id="cn-vista" aria-label={`Interfaz real de Dico: ${paso.pantalla}`}>
          <div className="cn-profundidad"><div className="cn-marco">
            <div className="cn-barra">
              <img src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" />
              <span className="cn-pantalla">{paso.pantalla}</span>
              <span className="cn-muestra">Datos de ejemplo</span>
              <button className="cn-reproduccion" type="button" onClick={() => setPausado(valor => !valor)} aria-pressed={pausado}>
                {pausado ? 'Reanudar' : 'Pausar'}
              </button>
            </div>
            <div className="cn-captura-scroll" tabIndex={0} role="region" aria-label="Captura de la interfaz. Deslizá para ver los detalles.">
              <img key={paso.imagen} className="cn-captura" src={imagen} alt={paso.alt} width="1920" height={paso.imagen === 'stock' ? 2228 : 1400} loading="lazy" />
            </div>
          </div></div>
          <figcaption className="cn-pie">
            <p><span className="cn-real">Interfaz real</span> · Gastronomía · Datos ilustrativos</p>
            <p className="cn-detalle">{paso.detalle}</p>
            <a className="pl-enlace cn-ampliar" href={imagen} target="_blank" rel="noreferrer">Ampliar captura <span aria-hidden="true">↗</span></a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
