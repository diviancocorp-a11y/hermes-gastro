import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import imagenGastronomia from './EscenaRubro/assets/gastronomia-estatica.webp';
import imagenComercio from './EscenaComercio/assets/comercio-estatica.webp';
import imagenServicios from './EscenaServicios/assets/servicios-estatica.webp';
import LecturaRubro from './LecturaRubro';
import IconoHerramienta from './IconoHerramienta';
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
  const [pausado, setPausado] = useState(false);
  const botones = useRef([]);
  const visual = useRef(null);
  const lecturaOrigen = useRef(null);
  const puntero = useRef(null);
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
  const elegir = indice => { setActivo(indice); setMomento(null); setGuia(null); setPausado(false); setMomentoAuto(ENFOQUES[indice].momentos[0].id); setEscenaDisponible(true); };
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
  const escenaComercio = enfoque.id === 'comercio';
  const escenaServicios = enfoque.id === 'servicios';
  const EscenaActiva = escenaComercio ? EscenaComercio : escenaServicios ? EscenaServicios : EscenaRubro;
  const disponibilidad = estado => setEscenaDisponible(typeof estado === 'boolean' ? estado : estado !== 'sin-webgl' && estado !== 'contexto-perdido');
  const alternativa = <img className="rn-alternativa" src={escenaComercio ? imagenComercio : escenaServicios ? imagenServicios : imagenGastronomia} alt={escenaComercio ? "Maqueta de una tienda con compra presencial y online, retiro, stock y caja conectados por Dico." : escenaServicios ? "Maqueta de una barbería con casa, agenda, puestos, caja y oficina. Simulación de funciones en desarrollo." : "Maqueta de un restaurante con salón, cocina, depósito y caja conectados por Dico."} width="1200" height="900" loading="lazy" />;
  const grupos = HERRAMIENTAS_RUBROS[enfoque.id];
  const salirGuia = () => { setGuia(null); setMomento(null); setPausado(false); };
  const diagnosticar = evento => { if (guia) salirGuia(); onDiagnostico(evento); };
  const explicar = (id, evento) => {
    lecturaOrigen.current = evento?.currentTarget || visual.current?.querySelectorAll('.rn-momentos button')[enfoque.momentos.findIndex(item => item.id === id)];
    setPausado(false);
    setMomento(id);
    setGuia({ id, fase: 'explicar', orden: 'preparar', revision: 0 });
    if (window.matchMedia('(max-width: 999px)').matches) visual.current?.querySelector('.rn-escena-integrada')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  const mandarGuia = (orden, fase) => setGuia(g => g && ({ ...g, orden, fase, revision: g.revision + 1 }));
  const verEscena = () => {
    setPausado(false);
    if (!escenaDisponible) setGuia(g => g && ({ ...g, fase: 'resultado' }));
    else mandarGuia('reproducir', 'reproducir');
    visual.current?.querySelector('.rn-escena-integrada')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  };
  const finMomento = id => {
    if (window.matchMedia('(max-width: 999px)').matches) visual.current?.querySelector('.rn-escena-integrada')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    setGuia(g => g?.id === id ? { ...g, fase: 'resultado' } : g);
  };
  const lecturaGuia = guia && ['explicar', 'resultado'].includes(guia.fase);
  const indiceGuia = guia ? enfoque.momentos.findIndex(item => item.id === guia.id) : -1;
  const pasoGuia = enfoque.momentos[indiceGuia];
  const siguiente = enfoque.momentos[indiceGuia + 1];
  const iniciarPuntero = evento => {
    puntero.current = !lecturaGuia && !evento.target.closest('button') ? { x: evento.clientX, y: evento.clientY } : null;
  };
  const soltarPuntero = evento => {
    const inicio = puntero.current;
    puntero.current = null;
    if (inicio && Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y) < 6 && escenaDisponible && !reducido) setPausado(valor => !valor);
  };
  return (
    <section className="rn-root" id="rubros" aria-labelledby="rn-titulo">
      <span className="pl-ancla" id="modulos" aria-hidden="true" />
      <span className="pl-ancla" id="integraciones" aria-hidden="true" />
      <div className="rn-firma">
      <header className="rn-cabecera"><h2 id="rn-titulo">Tu rubro, tu forma de trabajar.</h2></header>
      <div className="rn-experiencia">
        <div className="rn-visual" ref={visual}>
          <div className="rn-maqueta">
            <div className="rn-barra-maqueta">
              <div className="rn-rubros" role="tablist" aria-label="Elegí tu rubro">
                {ENFOQUES.map((item, indice) => <button key={item.id} type="button" role="tab" id={`rn-selector-${item.id}`} aria-selected={activo === indice} aria-controls="rn-experiencia" tabIndex={activo === indice ? 0 : -1} onClick={() => elegir(indice)} onKeyDown={evento => teclado(evento, indice)} ref={elemento => { botones.current[indice] = elemento; }}>{RUBROS[indice].nombre}</button>)}
              </div>
              {guia && <button type="button" className="rn-volver-automatico" onClick={salirGuia} aria-label="Volver al recorrido" title="Volver al recorrido">↶</button>}
            </div>
            <div id="rn-experiencia" role="tabpanel" aria-labelledby={`rn-selector-${enfoque.id}`}>
              <div key={enfoque.id} className="rn-escena rn-escena-integrada" data-rubro={enfoque.id} data-momento={momento || 'automatico'} data-guia={guia?.fase || 'automatico'} data-pausado={pausado} data-lectura={Boolean(lecturaGuia)}>
                <div className="rn-lienzo" inert={Boolean(lecturaGuia)} onPointerDownCapture={iniciarPuntero} onPointerUpCapture={soltarPuntero} onPointerCancelCapture={() => { puntero.current = null; }}>
                  {cargarEscena ? <Suspense fallback={alternativa}><EscenaActiva rubro={enfoque.id} momento={momento} guia={guia?.orden ?? null} revision={guia?.revision ?? 0} pausado={pausado} onFinMomento={finMomento} onMomento={setMomentoAuto} onDisponibilidad={disponibilidad} /></Suspense> : alternativa}
                  <button type="button" className="rn-pausa-teclado" disabled={!escenaDisponible || reducido} aria-label={pausado ? 'Reanudar escena' : 'Pausar escena'} aria-pressed={pausado} onClick={() => setPausado(!pausado)}>{pausado ? 'Reanudar escena' : 'Pausar escena'}</button>
                  {pausado && <span className="rn-pausa-indicador" aria-hidden="true">En pausa · tocá para continuar</span>}
                </div>
                {lecturaGuia && <div className="rn-velo">
                  <LecturaRubro origen={lecturaOrigen} key={`${guia.id}-${guia.fase}`} titulo={pasoGuia.nombre} contexto={guia.fase === 'resultado' ? (escenaDisponible ? 'Lo que acabás de ver' : 'Vista de referencia') : `${escenaServicios ? 'Simulación · ' : ''}Momento ${indiceGuia + 1} de ${enfoque.momentos.length}`} onCerrar={salirGuia}>
                    <p>{pasoGuia.texto}</p>
                    <p className="rn-mirar">{guia.fase === 'explicar' ? 'Mirá' : 'Sector'}: <strong>{pasoGuia.zona}</strong></p>
                    {guia.fase === 'explicar' ? <button type="button" className="rn-cta" onClick={verEscena}><span>{!escenaDisponible ? 'Ver vista estática' : reducido ? 'Ver resultado' : 'Ver en escena'}</span><span aria-hidden="true">→</span></button> : <div className="rn-guia-acciones">
                      {siguiente && <button type="button" className="rn-cta" onClick={() => explicar(siguiente.id)}><span>Siguiente momento</span><span aria-hidden="true">→</span></button>}
                      <button type="button" onClick={verEscena}>{reducido ? 'Ver otra vez' : 'Repetir'}</button>
                    </div>}
                    <button type="button" className="rn-salir-guia" onClick={salirGuia}>Volver al recorrido</button>
                  </LecturaRubro>
                </div>}
              </div>
              <div className={`rn-momentos${escenaComercio ? ' rn-momentos-comercio' : escenaServicios ? ' rn-momentos-servicios' : ''}`} role="group" aria-label={`Momentos de ${rubro.nombre}`}>
                {enfoque.momentos.map((item, indice) => <button type="button" key={item.id} data-rn-disparador data-activo={(guia?.id || momentoAuto) === item.id} aria-haspopup="dialog" aria-pressed={guia?.id === item.id} onClick={evento => explicar(item.id, evento)}><span aria-hidden="true">0{indice + 1}</span>{item.nombre}<span aria-hidden="true">›</span></button>)}
              </div>
              <span className="pl-oculto" role="status">{!escenaDisponible ? 'Vista estática' : reducido ? 'Vista sin animación' : pausado ? 'Escena en pausa' : 'Escena en reproducción'}</span>
            </div>
          </div>
          <p className="rn-lema">Tu negocio tiene su propio ritmo. Dico se adapta a tu operación.</p>
      <div className="rn-disponibilidad-grupos" key={enfoque.id}>
        <details className="rn-alcance"><summary>Herramientas disponibles</summary><ul>{rubro.filas.filter(([, estado]) => estado === HOY).map(([texto]) => <li key={texto}>{texto}</li>)}</ul></details>
        <details className="rn-alcance"><summary>Herramientas en desarrollo</summary><ul>{[...rubro.filas.filter(([, estado]) => estado !== HOY), ...RUBROS[3].filas].map(([texto, estado]) => <li key={texto}><span>{texto}</span><span>{estado}</span></li>)}</ul></details>
      </div>
          {escenaServicios && <p className="rn-aviso-escena">Simulación de funciones en desarrollo: reserva y cancelación online, llegada por QR y avisos a profesionales.</p>}
        </div>
        <aside className="rn-relato" key={enfoque.id} aria-label={`Herramientas de ${rubro.nombre}`}>
          <h3>{rubro.nombre}</h3><p className="rn-para">{enfoque.para}</p>
          <div className="rn-herramientas-scroll">
            {grupos.flatMap(grupo => grupo.items).map(item => <details className="rn-herramienta" name={`rn-herramientas-${enfoque.id}`} key={item.fila}>
              <summary><IconoHerramienta nombre={item.nombre} /><span>{item.nombre}{rubro.filas[item.fila][1] !== HOY && <small>En desarrollo</small>}</span><span className="rn-chevron" aria-hidden="true">›</span></summary>
              <div className="rn-herramienta-detalle"><p>{item.texto}</p></div>
            </details>)}
          </div>
          <button type="button" className="rn-cta" onClick={diagnosticar}><span>Ver qué necesita mi negocio</span><span aria-hidden="true">→</span></button>
        </aside>
      </div>
      </div>

    </section>
  );
}
