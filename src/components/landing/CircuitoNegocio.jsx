import { useEffect, useRef, useState } from 'react';
import DicoPhysical from '../dico/DicoPhysical';
import '../../styles/circuito-negocio.css';

const MOMENTOS = [
  {
    corto: 'Pedido', titulo: 'Recibís el pedido.',
    texto: 'Tu cliente elige dos pizzas en el catálogo. El pedido llega al panel con su estado, sin volver a cargarlo.',
    detalle: 'Recibirlo todavía no descuenta harina ni registra el cobro.',
  },
  {
    corto: 'Registro', titulo: 'La operación queda registrada.',
    texto: 'Completás el pedido y se descuentan los insumos de su receta. Al registrar el cobro, los $24.000 se reflejan en caja.',
    detalle: 'Completar el pedido y registrar el cobro son dos acciones distintas.',
  },
  {
    corto: 'Resultado', titulo: 'Ves el resultado del día.',
    texto: 'Las ventas, los descuentos, el costo de lo vendido, la nómina, la merma y los gastos se reúnen en un resultado claro.',
    detalle: 'Los $669.000 son la ganancia neta del día entero, no de este pedido.',
  },
];

const ACTIVAS = [['catalogo', 'pedidos'], ['pedidos', 'stock', 'caja'], ['resultado']];

export default function CircuitoNegocio({ ocultarDico = false }) {
  const [momento, setMomento] = useState(0);
  const [geometria, setGeometria] = useState(null);
  const circuitoRef = useRef(null);
  const raizRef = useRef(null);
  const pasosRef = useRef([]);
  const botonesRef = useRef([]);
  const cancelarScrollRef = useRef(() => {});

  useEffect(() => {
    const escritorio = window.matchMedia('(min-width: 1000px)');
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cuadro = 0;
    let visible = false;
    const leerPosicion = () => {
      cuadro = 0;
      if (!visible || !escritorio.matches || reducir.matches) return;
      const centro = window.innerHeight * 0.5;
      let cerca = Infinity;
      let siguiente = null;
      pasosRef.current.forEach((paso, indice) => {
        const rect = paso.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const distancia = Math.abs(rect.top + rect.height / 2 - centro);
        if (distancia < cerca) { cerca = distancia; siguiente = indice; }
      });
      if (siguiente !== null) setMomento(siguiente);
    };
    const alScroll = () => {
      if (!cuadro && visible && escritorio.matches && !reducir.matches) cuadro = requestAnimationFrame(leerPosicion);
    };
    const alCambiar = () => {
      if (cuadro) cancelAnimationFrame(cuadro);
      cuadro = 0;
    };
    cancelarScrollRef.current = alCambiar;
    const observador = new IntersectionObserver(([entrada]) => {
      visible = entrada.isIntersecting;
      if (visible) alScroll();
      else alCambiar();
    });
    observador.observe(raizRef.current);
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('resize', alScroll);
    escritorio.addEventListener('change', alCambiar);
    reducir.addEventListener('change', alCambiar);
    return () => {
      observador.disconnect();
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('resize', alScroll);
      escritorio.removeEventListener('change', alCambiar);
      reducir.removeEventListener('change', alCambiar);
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, []);

  useEffect(() => {
    const circuito = circuitoRef.current;
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const caja = circuito.getBoundingClientRect();
      if (!caja.width || !caja.height) return;
      const ubicacion = (clase) => {
        const rect = circuito.querySelector(clase).getBoundingClientRect();
        return {
          x: rect.left - caja.left + rect.width / 2,
          y: rect.top - caja.top + rect.height / 2,
          izquierda: rect.left - caja.left, derecha: rect.right - caja.left,
          arriba: rect.top - caja.top, abajo: rect.bottom - caja.top,
        };
      };
      const catalogo = ubicacion('.cn-catalogo');
      const pedidos = ubicacion('.cn-pedidos');
      const centro = ubicacion('.cn-centro');
      const stock = ubicacion('.cn-stock');
      const cobro = ubicacion('.cn-caja');
      const resultado = ubicacion('.cn-resultado');
      const union = (stock.abajo + resultado.arriba) / 2;
      const siguiente = {
        ancho: caja.width, alto: caja.height,
        caminos: [
          `M${catalogo.derecha} ${catalogo.y} H${pedidos.izquierda}`,
          `M${pedidos.x} ${pedidos.abajo} V${centro.y} H${centro.derecha}`,
          `M${centro.izquierda} ${centro.y} H${stock.x} V${stock.arriba}`,
          `M${centro.derecha} ${centro.y} H${cobro.x} V${cobro.arriba}`,
          `M${stock.x} ${stock.abajo} V${union} H${resultado.x} V${resultado.arriba} M${cobro.x} ${cobro.abajo} V${union} H${resultado.x}`,
        ],
      };
      setGeometria((actual) => JSON.stringify(actual) === JSON.stringify(siguiente) ? actual : siguiente);
    };
    const programar = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    const observador = new ResizeObserver(programar);
    observador.observe(circuito);
    circuito.querySelectorAll('.cn-pieza, .cn-centro').forEach((pieza) => observador.observe(pieza));
    medir();
    return () => { observador.disconnect(); if (cuadro) cancelAnimationFrame(cuadro); };
  }, []);

  const seleccionar = (indice) => {
    cancelarScrollRef.current();
    setMomento(indice);
  };

  const alTeclado = (event, indice) => {
    const teclas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let siguiente;
    if (event.key === 'Home') siguiente = 0;
    else if (event.key === 'End') siguiente = MOMENTOS.length - 1;
    else if (teclas[event.key]) siguiente = (indice + teclas[event.key] + MOMENTOS.length) % MOMENTOS.length;
    else return;
    event.preventDefault();
    seleccionar(siguiente);
    if (window.matchMedia('(min-width: 1000px)').matches) {
      pasosRef.current[siguiente]?.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    botonesRef.current[siguiente]?.focus({ preventScroll: true });
  };

  return (
    <section className="cn-root" ref={raizRef} id="que-hace" aria-labelledby="cn-titulo" data-momento={momento + 1}>
      <span className="pl-ancla" id="pilares" aria-hidden="true" />
      <span className="pl-ancla" id="flujo" aria-hidden="true" />
      <header className="cn-cabecera">
        <h2 id="cn-titulo">Cada parte conectada.<br />Todo más claro.</h2>
        <p className="cn-intro">Seguí un pedido y mirá cómo se ordena la operación en Dico.</p>
      </header>
      <div className="cn-relato">
        <div className="cn-pasos" role="group" aria-label="Momentos del ejemplo">
          {MOMENTOS.map((paso, indice) => (
            <article className={`cn-paso${momento === indice ? ' cn-activo' : ''}`} key={paso.corto} ref={(el) => { pasosRef.current[indice] = el; }}>
              <h3>
                <button type="button" className="cn-selector" aria-pressed={momento === indice} aria-controls="cn-circuito" onClick={() => seleccionar(indice)} onKeyDown={(event) => alTeclado(event, indice)} ref={(el) => { botonesRef.current[indice] = el; }}>
                  <span className="cn-paso-titulo">{paso.titulo}</span>
                  <span className="cn-paso-corto">{paso.corto}</span>
                </button>
              </h3>
              <div className="cn-paso-copy">
                <p>{paso.texto}</p>
                <p className="cn-aclaracion">{paso.detalle}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="cn-escena">
          <p className="cn-ejemplo">Gastronomía <span>· Ejemplo ilustrativo</span></p>
          <div id="cn-circuito" ref={circuitoRef} className="cn-circuito" role="figure" aria-label={`Ejemplo de gastronomía. ${MOMENTOS[momento].titulo}`}>
            <svg className="cn-conexiones" viewBox={`0 0 ${geometria?.ancho || 600} ${geometria?.alto || 560}`} aria-hidden="true">
              {geometria?.caminos.map((camino, indice) => (
                <path key={indice} className={[[0, 1], [1, 2, 3], [4]][momento].includes(indice) ? 'cn-conexion-activa' : ''} d={camino} />
              ))}
            </svg>
            <Pieza id="catalogo" titulo="Catálogo" activa={ACTIVAS[momento].includes('catalogo')}>
              <p>2 pizzas</p><strong>$24.000</strong>
            </Pieza>
            <Pieza id="pedidos" titulo="Pedidos" activa={ACTIVAS[momento].includes('pedidos')}>
              <p className="cn-id">#1048</p><strong>{momento === 0 ? 'Recibido' : 'Completado'}</strong>
            </Pieza>
            <div className="cn-centro">
              {ocultarDico ? <span className="cn-centro-nombre">Dico</span> : <DicoPhysical pose="pointDown" reducedMotion title="Dico, tu negocio conectado" />}
            </div>
            <Pieza id="stock" titulo="Stock" activa={ACTIVAS[momento].includes('stock')}>
              <p>Harina</p><strong>{momento === 0 ? '6 kg' : '5,5 kg'}</strong>
              <span className="cn-pieza-nota">{momento === 0 ? 'Sin cambios' : 'Según la receta'}</span>
            </Pieza>
            <Pieza id="caja" titulo="Caja" activa={ACTIVAS[momento].includes('caja')}>
              <p>{momento === 0 ? 'Cobro' : 'Cobro registrado'}</p><strong>{momento === 0 ? 'Sin registrar' : '$24.000'}</strong>
              <span className="cn-pieza-nota">{momento === 0 ? 'Acción pendiente' : 'Acción separada'}</span>
            </Pieza>
            <Pieza id="resultado" titulo="Resultado del día" activa={momento === 2}>
              <dl className="cn-resumen"><div><dt>Ventas</dt><dd>$2.168.000</dd></div><div><dt>Descuentos y costos</dt><dd>−$1.499.000</dd></div></dl>
              <div className="cn-neto"><span>Ganancia neta</span><strong>$669.000</strong></div>
              <span className="cn-pieza-nota">Día completo · Margen 30,9 %<br />Incluye nómina, merma y gastos</span>
            </Pieza>
          </div>
          <p className="cn-pie">Datos de ejemplo. Cada acción conserva su propio registro.</p>
          <p className="pl-oculto" role="status" aria-live="polite">Momento {momento + 1}: {MOMENTOS[momento].titulo}</p>
        </div>
      </div>
    </section>
  );
}

function Pieza({ id, titulo, activa, children }) {
  return <div className={`cn-pieza cn-${id}${activa ? ' cn-conectada' : ''}`} data-ui><h4>{titulo}</h4>{children}</div>;
}
