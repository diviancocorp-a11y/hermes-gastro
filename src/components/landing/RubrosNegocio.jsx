import { useRef, useState } from 'react';
import '../../styles/rubros-negocio.css';

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
    para: 'Restaurantes, panaderías y delivery.',
    titulo: 'De la receta al resultado.',
    texto: 'Sabé cuánto cuesta lo que vendés y cómo cerró el día.',
    capacidades: ['Pedidos, mesas y cocina conectados.', 'Recetas con costo y stock de insumos.', 'Caja, personal y ganancia neta por día.'],
  },
  {
    para: 'Tiendas y comercios.',
    titulo: 'Lo que vendés, bajo control.',
    texto: 'Catálogo, artículos y cobros en el mismo lugar.',
    capacidades: ['Catálogo online y pedidos de mostrador.', 'Stock por artículo al completar el pedido.', 'Compras, caja y resultado del mes.'],
  },
  {
    para: 'Barberías, peluquerías y estética.',
    titulo: 'Más atención. Menos administración.',
    texto: 'Organizá los turnos desde el panel y registrá lo que cobrás.',
    capacidades: ['Catálogo de servicios con sus precios.', 'Agenda interna de turnos.', 'Cobros, equipo y resultado del mes.'],
  },
];

export default function RubrosNegocio({ onDiagnostico }) {
  const [activo, setActivo] = useState(0);
  const botones = useRef([]);
  const teclado = (evento, indice) => {
    const direcciones = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let siguiente;
    if (evento.key === 'Home') siguiente = 0;
    else if (evento.key === 'End') siguiente = 2;
    else if (direcciones[evento.key]) siguiente = (indice + direcciones[evento.key] + 3) % 3;
    else return;
    evento.preventDefault();
    setActivo(siguiente);
    botones.current[siguiente]?.focus({ preventScroll: true });
  };
  return (
    <section className="rn-root" id="rubros" aria-labelledby="rn-titulo">
      <span className="pl-ancla" id="modulos" aria-hidden="true" />
      <span className="pl-ancla" id="integraciones" aria-hidden="true" />
      <header className="rn-cabecera">
        <h2 id="rn-titulo">Tu rubro,<br />tu forma de trabajar.</h2>
        <p>La misma base. Las herramientas que necesita tu negocio.</p>
      </header>
      <div className="rn-paneles" data-activo={activo}>
        {RUBROS.slice(0, 3).map((rubro, indice) => {
          const abierto = activo === indice;
          const enfoque = ENFOQUES[indice];
          const pendientes = rubro.filas.filter(([, estado]) => estado !== HOY);
          return (
            <article className={`rn-panel${abierto ? ' rn-abierto' : ''}`} key={rubro.nombre}>
              <h3>
                <button type="button" id={`rn-selector-${indice}`} className="rn-selector"
                  aria-expanded={abierto} aria-controls={`rn-contenido-${indice}`}
                  onClick={() => setActivo(abierto ? null : indice)} onKeyDown={evento => teclado(evento, indice)}
                  ref={elemento => { botones.current[indice] = elemento; }}>
                  <span>{rubro.nombre}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>
                </button>
              </h3>
              <p className="rn-para">{enfoque.para}</p>
              <div className="rn-expansion" inert={!abierto} aria-hidden={!abierto}>
                <div className="rn-interior">
                  <div className="rn-contenido" id={`rn-contenido-${indice}`} role="region" aria-labelledby={`rn-selector-${indice}`}>
                    <p className="rn-promesa">{enfoque.titulo}</p>
                    <p className="rn-explicacion">{enfoque.texto}</p>
                    <ul className="rn-capacidades">
                      {enfoque.capacidades.map(texto => <li key={texto}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>{texto}</li>)}
                    </ul>
                    {pendientes.length > 0 && (
                      <div className="rn-pendiente"><p>En desarrollo</p><ul>{pendientes.map(([texto]) => <li key={texto}>{texto}</li>)}</ul></div>
                    )}
                    <details className="rn-alcance">
                      <summary>Ver el alcance completo</summary>
                      <ul>{rubro.filas.map(([texto, estado]) => <li key={texto}><span>{texto}</span><span>{estado === HOY ? 'Disponible' : estado}</span></li>)}</ul>
                    </details>
                    <button type="button" className="rn-cta pl-enlace pl-enlace-boton" onClick={onDiagnostico}>Ver qué necesita mi negocio <span aria-hidden="true">→</span></button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <details className="rn-comun">
        <summary>Lo que todavía no está disponible en ningún rubro</summary>
        <ul>{RUBROS[3].filas.map(([texto, estado]) => <li key={texto}><span>{texto}</span><span>{estado}</span></li>)}</ul>
      </details>
    </section>
  );
}
