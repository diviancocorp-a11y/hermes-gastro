import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import imagenGastronomia from './EscenaRubro/assets/gastronomia-estatica.webp';
import '../../styles/rubros-negocio.css';

const EscenaRubro = lazy(() => import('./EscenaRubro/EscenaRubro'));
const HOY = 'Hoy';
const DESARROLLO = 'En desarrollo';

// Alcance actual del producto. Agenda interna disponible; reserva online pendiente.
const RUBROS = [
  {
    nombre: 'Gastronomía',
    filas: [
      ['Catálogo online y pedidos de salón, mostrador y delivery', HOY],
      ['Mesas y comandas del salón', HOY],
      ['Cocina en pantalla, por sector', HOY],
      ['Recetas con el costo de cada plato', HOY],
      ['Stock de insumos con compras, conteos y mínimo', HOY],
      ['Al completar un pedido se descuentan los insumos de su receta', HOY],
      ['Caja y arqueo por medio de pago', HOY],
      ['Fichaje y costo del personal por día', HOY],
      ['Gastos y resultado del mes', HOY],
      ['La ganancia neta de cada noche, por sucursal', HOY],
    ],
  },
  {
    nombre: 'Comercio',
    filas: [
      ['Catálogo online y pedidos de mostrador', HOY],
      ['Stock por artículo: se descuenta al completar el pedido', HOY],
      ['Caja y arqueo por medio de pago', HOY],
      ['Fichaje y costo del personal por día', HOY],
      ['Compras, gastos y resultado del mes', HOY],
      ['El resultado de cada día (ventas, personal y gastos)', HOY],
      ['El costo de lo vendido por artículo', DESARROLLO],
      ['Mínimo por artículo con aviso', DESARROLLO],
      ['Talles y colores por artículo', DESARROLLO],
    ],
  },
  {
    nombre: 'Servicios',
    filas: [
      ['Catálogo de servicios online, con precio', HOY],
      ['Ventas y cobros de cada servicio', HOY],
      ['Agenda de turnos en el panel', HOY],
      ['Caja y arqueo por medio de pago', HOY],
      ['Stock de insumos, con mínimo', HOY],
      ['Productos que vendés: cada venta los descuenta', HOY],
      ['Fichaje y costo del personal por día', HOY],
      ['Gastos y resultado del mes', HOY],
      ['El resultado de cada día (ventas, personal y gastos)', HOY],
      ['El costo de lo vendido por artículo', DESARROLLO],
      ['Que cada servicio descuente los insumos que usa', DESARROLLO],
      ['Agenda de turnos online', DESARROLLO],
    ],
  },
  {
    nombre: 'En todos los rubros',
    filas: [
      ['Facturación electrónica ARCA', DESARROLLO],
      ['Pedidos de Rappi y PedidosYa', 'Sin fecha'],
    ],
  },
];


const ENFOQUES = [
  {
    id: 'gastronomia', para: 'Restaurantes, panaderías y delivery.',
    dolor: 'Entre el salón y la cocina, todo pasa por vos.',
    respuesta: 'Dico conecta pedidos, mesas y cocina para que el equipo siga la operación desde el mismo sistema. Vos podés mirar cómo viene el negocio sin ir juntando la información de cada sector.',
    momentos: [
      { id: 'pedido', nombre: 'Entra un pedido', zona: 'Salón y cocina', texto: 'El pedido queda en Dico y las comandas llegan a la pantalla del sector de cocina correspondiente.' },
      { id: 'stock', nombre: 'Se completa', zona: 'Depósito', texto: 'Al completar el pedido se descuentan los insumos de su receta. Recibir el pedido todavía no modifica las existencias.' },
      { id: 'cobro', nombre: 'Se cobra', zona: 'Caja', texto: 'El cobro se registra por su medio de pago. Registrar el cobro y completar el pedido son acciones distintas.' },
    ],
  },
  {
    id: 'comercio', para: 'Tiendas y comercios.',
    dolor: 'Vendés por un lado. Controlás lo que queda por otro.',
    respuesta: 'Dico reúne el catálogo, los pedidos y el stock por artículo. Al completar un pedido se actualizan las existencias; los cobros y gastos quedan en el mismo sistema.',
    momentos: [
      { id: 'pedido', nombre: 'Eligen un producto', zona: 'Mostrador', texto: 'El catálogo online y los pedidos de mostrador reúnen los artículos que el cliente quiere comprar.' },
      { id: 'stock', nombre: 'Se completa', zona: 'Depósito', texto: 'Al completar el pedido se descuenta el stock de los artículos vendidos. Talles, colores y avisos de mínimo por artículo siguen en desarrollo.' },
      { id: 'cobro', nombre: 'Se cobra', zona: 'Caja', texto: 'Registrás el cobro y su medio de pago. Las ventas, el personal y los gastos se reúnen en el resultado del día; el costo de lo vendido por artículo sigue en desarrollo.' },
    ],
  },
  {
    id: 'servicios', para: 'Barberías, peluquerías y estética.',
    dolor: 'Atender bien requiere tiempo. Organizar todo, también.',
    respuesta: 'Dico reúne la agenda interna, los servicios y sus cobros. Organizás los turnos desde el panel y registrás la atención en el mismo lugar, sin depender de una reserva online que todavía está en desarrollo.',
    momentos: [
      { id: 'turno', nombre: 'Organizás el turno', zona: 'Recepción', texto: 'El equipo organiza los turnos en la agenda interna del panel. El cliente todavía no puede reservar online.' },
      { id: 'atencion', nombre: 'Registrás el servicio', zona: 'Puestos de atención', texto: 'Registrás la venta del servicio con su precio. El descuento automático de los insumos usados en cada servicio sigue en desarrollo.' },
      { id: 'cobro', nombre: 'Se cobra', zona: 'Caja', texto: 'Registrás el cobro por medio de pago y consultás las ventas, el personal y los gastos del día.' },
    ],
  },
];

export default function RubrosNegocio({ onDiagnostico }) {
  const [activo, setActivo] = useState(0);
  const [momento, setMomento] = useState(null);
  const botones = useRef([]);
  const visual = useRef(null);
  const [cargarEscena, setCargarEscena] = useState(() => typeof IntersectionObserver === 'undefined');
  const [escenaDisponible, setEscenaDisponible] = useState(true);
  const [momentoAuto, setMomentoAuto] = useState('pedido');
  const [reducido, setReducido] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const actualizar = () => setReducido(mq.matches);
    actualizar();
    mq.addEventListener('change', actualizar);
    const observador = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) { setCargarEscena(true); observador.disconnect(); }
    }, { rootMargin: '300px' });
    if (observador) observador.observe(visual.current);
    return () => { observador?.disconnect(); mq.removeEventListener('change', actualizar); };
  }, []);
  const elegir = indice => { setActivo(indice); setMomento(null); setMomentoAuto('pedido'); };
  const teclado = (evento, indice) => {
    const direcciones = { ArrowRight: 1, ArrowLeft: -1 };
    let siguiente;
    if (evento.key === 'Home') siguiente = 0;
    else if (evento.key === 'End') siguiente = 2;
    else if (direcciones[evento.key]) siguiente = (indice + direcciones[evento.key] + 3) % 3;
    else return;
    evento.preventDefault();
    elegir(siguiente);
    botones.current[siguiente]?.focus({ preventScroll: true });
  };
  const rubro = RUBROS[activo];
  const enfoque = ENFOQUES[activo];
  const seleccionado = enfoque.momentos.find(item => item.id === momento);
  const escenaGastronomia = enfoque.id === 'gastronomia';
  const actual = seleccionado || (escenaGastronomia && enfoque.momentos.find(item => item.id === momentoAuto));
  const alternativa = <img className="rn-alternativa" src={imagenGastronomia} alt="Maqueta de un restaurante con salón, cocina, depósito y caja conectados por Dico." width="1200" height="900" loading="lazy" />;
  return (
    <section className="rn-root" id="rubros" aria-labelledby="rn-titulo">
      <span className="pl-ancla" id="modulos" aria-hidden="true" />
      <span className="pl-ancla" id="integraciones" aria-hidden="true" />
      <header className="rn-cabecera">
        <h2 id="rn-titulo">Tu rubro,<br />tu forma de trabajar.</h2>
        <p>Tu negocio tiene su propio ritmo.<br />Dico se adapta a tu operación.</p>
      </header>
      <div className="rn-rubros" role="tablist" aria-label="Elegí tu rubro">
        {ENFOQUES.map((item, indice) => (
          <button key={item.id} type="button" role="tab" id={`rn-selector-${item.id}`}
            aria-selected={activo === indice} aria-controls="rn-experiencia" tabIndex={activo === indice ? 0 : -1}
            onClick={() => elegir(indice)} onKeyDown={evento => teclado(evento, indice)}
            ref={elemento => { botones.current[indice] = elemento; }}>
            <span className="rn-indice" aria-hidden="true">0{indice + 1}</span>{RUBROS[indice].nombre}
          </button>
        ))}
      </div>
      <div className="rn-experiencia" id="rn-experiencia" role="tabpanel" aria-labelledby={`rn-selector-${enfoque.id}`} tabIndex={0}>
        <div className="rn-relato" key={enfoque.id}>
          <p className="rn-para">{enfoque.para}</p>
          <h3>{enfoque.dolor}</h3>
          <p className="rn-respuesta-titulo">Así se adapta Dico</p>
          <p className="rn-explicacion">{enfoque.respuesta}</p>
          <button type="button" className="rn-cta pl-enlace pl-enlace-boton" onClick={onDiagnostico}>Ver qué necesita mi negocio <span aria-hidden="true">→</span></button>
        </div>
        <div className="rn-visual" ref={visual}>
          {escenaGastronomia ? (
            <div className="rn-escena rn-escena-integrada" data-rubro={enfoque.id} data-momento={momento || 'automatico'}>
              {cargarEscena ? <Suspense fallback={alternativa}><EscenaRubro rubro="gastronomia" momento={momento} onMomento={setMomentoAuto} onDisponibilidad={setEscenaDisponible} /></Suspense> : alternativa}
            </div>
          ) : (
            <div className="rn-escena" data-rubro={enfoque.id} data-momento={momento || 'automatico'}>
              <span className="rn-escena-rubro">{rubro.nombre}</span>
              <div className="rn-reserva"><p>Acá vas a ver<br />tu negocio en movimiento.</p><span>Escena 3D en preparación</span></div>
              <span className="rn-zona">{seleccionado ? `Zona: ${seleccionado.zona}` : 'Explorá los momentos de abajo'}</span>
            </div>
          )}
          <div className="rn-momentos" role="group" aria-label={`Momentos de ${rubro.nombre}`}>
            {enfoque.momentos.map((item, indice) => <button type="button" key={item.id} aria-pressed={momento === item.id} onClick={() => setMomento(momento === item.id ? null : item.id)}><span aria-hidden="true">0{indice + 1}</span>{item.nombre}</button>)}
          </div>
          {escenaGastronomia && <div className="rn-reproduccion"><span>{!escenaDisponible ? 'Vista estática' : reducido ? 'Vista sin animación' : momento ? `En pausa · ${seleccionado.nombre}` : `Recorrido automático · ${actual.nombre}`}</span>{!reducido && escenaDisponible && <button type="button" onClick={() => setMomento(momento ? null : momentoAuto)}>{momento ? 'Reanudar recorrido' : 'Pausar recorrido'}</button>}</div>}
          <p className="rn-momento-texto" aria-live={momento ? 'polite' : 'off'} aria-atomic="true">{actual ? actual.texto : 'Elegí un momento para conocer dónde interviene Dico y qué hace en esa parte de tu negocio.'}</p>
        </div>
      </div>
      <details className="rn-alcance" key={enfoque.id}>
        <summary>Consultar disponibilidad y alcance de {rubro.nombre.toLowerCase()}</summary>
        <ul>{rubro.filas.map(([texto, estado]) => <li key={texto}><span>{texto}</span><span>{estado === HOY ? 'Disponible' : estado}</span></li>)}</ul>
      </details>
      <details className="rn-comun">
        <summary>Lo que todavía no está disponible en ningún rubro</summary>
        <ul>{RUBROS[3].filas.map(([texto, estado]) => <li key={texto}><span>{texto}</span><span>{estado}</span></li>)}</ul>
      </details>
    </section>
  );
}
