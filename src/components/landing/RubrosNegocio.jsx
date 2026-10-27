import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import imagenGastronomia from './EscenaRubro/assets/gastronomia-estatica.webp';
import imagenComercio from './EscenaComercio/assets/comercio-estatica.webp';
import imagenServicios from './EscenaServicios/assets/servicios-estatica.webp';
import LecturaRubro from './LecturaRubro';
import { HERRAMIENTAS_RUBROS } from './herramientasRubros';
import '../../styles/rubros-negocio.css';

const EscenaRubro = lazy(() => import('./EscenaRubro/EscenaRubro'));
const EscenaComercio = lazy(() => import('./EscenaComercio/EscenaComercio'));
const EscenaServicios = lazy(() => import('./EscenaServicios/EscenaServicios'));
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
    momentos: [
      { id: 'pedido', nombre: 'Entra un pedido', zona: 'Salón y cocina', texto: 'El pedido queda en Dico y las comandas llegan a la pantalla del sector de cocina correspondiente.' },
      { id: 'stock', nombre: 'Se completa', zona: 'Depósito', texto: 'Al completar el pedido se descuentan los insumos de su receta. Recibir el pedido todavía no modifica las existencias.' },
      { id: 'cobro', nombre: 'Se cobra', zona: 'Caja', texto: 'El cobro se registra por su medio de pago. Registrar el cobro y completar el pedido son acciones distintas.' },
    ],
  },
  {
    id: 'comercio', para: 'Tiendas y comercios.',
    dolor: 'Vendés por un lado. Controlás lo que queda por otro.',
    momentos: [
      { id: 'p-eleccion', nombre: 'Elegís en el local', zona: 'Estanterías', texto: 'Compra presencial: el cliente toma el producto de la estantería y se acerca a caja. Todavía no se registró la venta.' },
      { id: 'p-venta', nombre: 'Registrás la venta', zona: 'Caja y depósito', texto: 'En caja se registra y completa el pedido. Al completarlo se descuenta el stock del artículo; el cobro se registra aparte.' },
      { id: 'p-cobro', nombre: 'Cobrás en el local', zona: 'Caja', texto: 'El equipo registra el cobro de la compra presencial y su medio de pago.' },
      { id: 'o-pedido', nombre: 'Pedido desde casa', zona: 'Casa y mostrador', texto: 'Compra online con retiro: el cliente elige desde su casa y el pedido llega al local. Recibirlo todavía no descuenta stock.' },
      { id: 'o-preparacion', nombre: 'Preparás la compra', zona: 'Estanterías y vereda', texto: 'Mientras el cliente camina hasta el local, el equipo prepara los productos y los deja en entrega. Preparar todavía no descuenta stock.' },
      { id: 'o-completar', nombre: 'Retira el pedido', zona: 'Entrega y depósito', texto: 'El cliente llega y retira la compra. El equipo completa el pedido y recién entonces se actualiza el stock de los artículos.' },
      { id: 'o-cobro', nombre: 'Cobrás el retiro', zona: 'Caja', texto: 'Se registra el pago de la compra online como una acción aparte. El cliente sale del local llevando su bolsa.' },
    ],
  },
  {
    id: 'servicios', para: 'Barberías, peluquerías y estética.',
    dolor: 'Atender bien requiere tiempo. Organizar todo, también.',
    momentos: [
      { id: 'llegada', nombre: 'Llega el cliente', zona: 'Entrada y caja', texto: 'En esta simulación, el cliente confirma su llegada con QR y espera. Se cobra la atención anterior y la información llega al resumen del dueño.' },
      { id: 'reserva', nombre: 'Entra una reserva', zona: 'Casa y puestos', texto: 'Mientras el equipo atiende, una persona reserva las 17:00 desde casa. La información viaja a la agenda y a los teléfonos de los profesionales: funciones objetivo en desarrollo.' },
      { id: 'cancelacion', nombre: 'Se libera un turno', zona: 'Vereda y agenda', texto: 'El cliente cancela las 16:30 desde la vereda. Una señal roja distingue el aviso y esa misma fila queda disponible. Cancelación online representada como función futura.' },
      { id: 'recuperado', nombre: 'Ocupás el horario', zona: 'Caja y puestos', texto: 'Llega otro cliente sin turno y el equipo le asigna el horario libre de las 16:30. La misma fila cambia a asignado y el cliente pasa al puesto disponible.' },
    ],
  },
];

export default function RubrosNegocio({ onDiagnostico }) {
  const [activo, setActivo] = useState(0);
  const [momento, setMomento] = useState(null);
  const [guia, setGuia] = useState(null);
  const [herramienta, setHerramienta] = useState(null);
  const [herramientasAbiertas, setHerramientasAbiertas] = useState(false);
  const botones = useRef([]);
  const visual = useRef(null);
  const lecturaOrigen = useRef(null);
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
  const elegir = indice => { setActivo(indice); setMomento(null); setGuia(null); setHerramienta(null); setHerramientasAbiertas(false); setMomentoAuto(ENFOQUES[indice].momentos[0].id); setEscenaDisponible(true); };
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
  const escenaComercio = enfoque.id === 'comercio';
  const escenaServicios = enfoque.id === 'servicios';
  const actual = seleccionado || enfoque.momentos.find(item => item.id === momentoAuto) || enfoque.momentos[0];
  const EscenaActiva = escenaComercio ? EscenaComercio : escenaServicios ? EscenaServicios : EscenaRubro;
  const disponibilidad = estado => setEscenaDisponible(typeof estado === 'boolean' ? estado : estado !== 'sin-webgl' && estado !== 'contexto-perdido');
  const alternativa = <img className="rn-alternativa" src={escenaComercio ? imagenComercio : escenaServicios ? imagenServicios : imagenGastronomia} alt={escenaComercio ? "Maqueta de una tienda con compra presencial y online, retiro, stock y caja conectados por Dico." : escenaServicios ? "Maqueta de una barbería con casa, agenda, puestos, caja y oficina. Simulación de funciones en desarrollo." : "Maqueta de un restaurante con salón, cocina, depósito y caja conectados por Dico."} width="1200" height="900" loading="lazy" />;
  const grupos = HERRAMIENTAS_RUBROS[enfoque.id];
  const salirGuia = () => { setGuia(null); setMomento(null); setHerramienta(null); };
  const diagnosticar = evento => { if (guia) salirGuia(); onDiagnostico(evento); };
  const explicar = (id, evento) => {
    lecturaOrigen.current = evento?.currentTarget || visual.current?.querySelectorAll('.rn-momentos button')[enfoque.momentos.findIndex(item => item.id === id)];
    setHerramienta(null);
    setMomento(id);
    setGuia({ id, fase: 'explicar', orden: 'preparar', revision: 0 });
    if (window.matchMedia('(max-width: 999px)').matches) visual.current?.querySelector('.rn-escena-integrada')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  const mandarGuia = (orden, fase) => setGuia(g => g && ({ ...g, orden, fase, revision: g.revision + 1 }));
  const verEscena = () => {
    if (!escenaDisponible) setGuia(g => g && ({ ...g, fase: 'resultado' }));
    else mandarGuia('reproducir', 'reproducir');
    visual.current?.querySelector('.rn-escena-integrada')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  };
  const finMomento = id => {
    if (window.matchMedia('(max-width: 999px)').matches) visual.current?.querySelector('.rn-escena-integrada')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    setGuia(g => g?.id === id ? { ...g, fase: 'resultado' } : g);
  };
  const abrirHerramienta = (item, evento) => {
    lecturaOrigen.current = evento.currentTarget;
    setGuia(null); setMomento(null);
    setHerramienta({ ...item, estado: rubro.filas[item.fila][1] });
  };
  const cerrarLectura = () => { if (herramienta) setHerramienta(null); else salirGuia(); };
  const lecturaGuia = guia && ['explicar', 'resultado'].includes(guia.fase);
  const lecturaAbierta = Boolean(herramienta || lecturaGuia);
  const indiceGuia = guia ? enfoque.momentos.findIndex(item => item.id === guia.id) : -1;
  const pasoGuia = enfoque.momentos[indiceGuia];
  const siguiente = enfoque.momentos[indiceGuia + 1];
  const estadoGuia = { explicar: 'Guía · antes de la acción', reproducir: 'Demostración en curso', pausa: 'Demostración en pausa', resultado: 'Momento completado' };
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
        <aside className="rn-relato" key={enfoque.id} aria-label={`Herramientas de ${rubro.nombre}`}>
          <div className="rn-relato-base" inert={lecturaAbierta}>
            <p className="rn-para">{enfoque.para}</p>
            <h3>{enfoque.dolor}</h3>
            <button type="button" className="rn-herramientas-toggle" aria-expanded={herramientasAbiertas} aria-controls={`rn-herramientas-${enfoque.id}`} onClick={() => setHerramientasAbiertas(!herramientasAbiertas)}>Explorar herramientas <span aria-hidden="true">{herramientasAbiertas ? '−' : '+'}</span></button>
            <div className="rn-herramientas-lista" id={`rn-herramientas-${enfoque.id}`} data-abierto={herramientasAbiertas}>
              {grupos.map(grupo => <section className="rn-grupo-herramientas" key={grupo.titulo}>
                <h4>{grupo.titulo}</h4>
                <ul>{grupo.items.map(item => <li key={item.fila}><button type="button" data-rn-disparador onClick={evento => abrirHerramienta({ ...item, grupo: grupo.titulo }, evento)} aria-haspopup="dialog">
                  <span>{item.nombre}{rubro.filas[item.fila][1] !== HOY && <small>En desarrollo</small>}</span><span aria-hidden="true">›</span>
                </button></li>)}</ul>
              </section>)}
            </div>
            <button type="button" className="rn-cta" onClick={diagnosticar}>Ver qué necesita mi negocio <span aria-hidden="true">→</span></button>
          </div>
          {herramienta && <LecturaRubro origen={lecturaOrigen} key={herramienta.nombre} titulo={herramienta.nombre} contexto={herramienta.grupo} onCerrar={cerrarLectura}>
            <p>{herramienta.texto}</p><span className="rn-disponibilidad">{herramienta.estado === HOY ? 'Disponible hoy' : herramienta.estado}</span>
            <button type="button" className="rn-cta" onClick={diagnosticar}>Ver qué necesita mi negocio <span aria-hidden="true">→</span></button>
          </LecturaRubro>}
          {lecturaGuia && <LecturaRubro origen={lecturaOrigen} key={`${guia.id}-${guia.fase}`} titulo={pasoGuia.nombre} contexto={guia.fase === 'resultado' ? (escenaDisponible ? 'Lo que acabás de ver' : 'Vista de referencia') : `Momento ${indiceGuia + 1} de ${enfoque.momentos.length}`} onCerrar={salirGuia}>
            <p>{pasoGuia.texto}</p>
            <p className="rn-mirar">{guia.fase === 'explicar' ? 'Mirá este sector' : 'Dónde intervino Dico'}<strong>{pasoGuia.zona}</strong></p>
            {guia.fase === 'explicar' ? <button type="button" className="rn-cta" onClick={verEscena}>{!escenaDisponible ? 'Ver vista estática' : reducido ? 'Ver resultado' : 'Ver en escena'} <span aria-hidden="true">→</span></button> : <div className="rn-guia-acciones">
              {siguiente && <button type="button" className="rn-cta" onClick={() => explicar(siguiente.id)}>Siguiente momento <span aria-hidden="true">→</span></button>}
              <button type="button" onClick={verEscena}>{reducido ? 'Ver resultado otra vez' : 'Repetir'}</button>
            </div>}
            <button type="button" className="rn-salir-guia" onClick={salirGuia}>Volver al recorrido</button>
          </LecturaRubro>}
        </aside>
        <div className="rn-visual" ref={visual}>
          {escenaServicios && <p className="rn-aviso-escena">Simulación de funciones en desarrollo: reserva y cancelación online, llegada por QR y avisos a profesionales.</p>}
          <div key={enfoque.id} className="rn-escena rn-escena-integrada" data-rubro={enfoque.id} data-momento={momento || 'automatico'} data-guia={guia?.fase || 'automatico'}>
            {cargarEscena ? <Suspense fallback={alternativa}><EscenaActiva rubro={enfoque.id} momento={momento} guia={guia?.orden ?? null} revision={guia?.revision ?? 0} onFinMomento={finMomento} onMomento={setMomentoAuto} onDisponibilidad={disponibilidad} /></Suspense> : alternativa}
          </div>
          <div className={`rn-momentos${escenaComercio ? ' rn-momentos-comercio' : escenaServicios ? ' rn-momentos-servicios' : ''}`} role="group" aria-label={`Momentos de ${rubro.nombre}`}>
            {enfoque.momentos.map((item, indice) => <button type="button" key={item.id} data-rn-disparador aria-haspopup="dialog" aria-pressed={guia?.id === item.id} onClick={evento => explicar(item.id, evento)}><span aria-hidden="true">0{indice + 1}</span>{item.nombre}</button>)}
          </div>
          <div className="rn-reproduccion">
            <span aria-live={guia ? 'polite' : 'off'}>{!escenaDisponible ? 'Vista estática' : guia ? estadoGuia[guia.fase] : reducido ? 'Vista sin animación' : momento ? `En pausa · ${seleccionado.nombre}` : `Recorrido automático · ${actual.nombre}`}</span>
            {guia ? <div className="rn-reproduccion-acciones">
              {guia.fase === 'reproducir' && !reducido && <button type="button" onClick={() => mandarGuia('pausar', 'pausa')}>Pausar demostración</button>}
              {guia.fase === 'pausa' && <button type="button" onClick={() => reducido ? verEscena() : mandarGuia('continuar', 'reproducir')}>{reducido ? 'Ver resultado' : 'Continuar demostración'}</button>}
              <button type="button" onClick={salirGuia}>Volver al recorrido</button>
            </div> : !reducido && escenaDisponible && <button type="button" onClick={() => setMomento(momento ? null : momentoAuto)}>{momento ? 'Reanudar recorrido' : 'Pausar recorrido'}</button>}
          </div>
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
