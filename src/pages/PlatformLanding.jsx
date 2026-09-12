// src/pages/PlatformLanding.jsx
// Puerta de entrada de la PLATAFORMA (divianco.app), no de un local.
//
// Se muestra cuando el hostname es la raiz: ahi no hay tenant que resolver,
// asi que el catalogo no aplica. Sin esta pantalla, fetchCatalog devuelve null
// y el catalogo lo interpreta como "Supabase caido" (setError('offline')) —
// un error de conexion que no existe.
//
// REGLA DE CONTENIDO: aca no se promete nada que el producto no haga hoy.
// Cada afirmacion de esta pagina se puede rastrear a una migracion o a una
// pantalla que existe. Donde la verdad es "todavia no", lo dice.
//
// ENFOQUE (copy del 12/sep/2026): la landing habla SOLO a gastronomia. No es
// que el sistema no sirva para barberia o indumentaria —el registry de rubros
// las tiene y el alta las ofrece— es que una landing que le habla a todos no
// le habla a nadie. El titular es fijo, no rota entre rubros.
//
// LA PROMESA: "sabe cuanto ganas, no solo cuanto vendes". Lo que la sostiene
// son tres datos que el edificio junta y nadie mas junta en un solo lugar:
//   - receta con costo por insumo   -> migraciones 0026 y 0028
//   - costo por hora con fichaje    -> migracion 0048, incluye costo laboral
//                                      sobre venta por dia operativo
//   - P&L con merma y gastos        -> migraciones 0030 a 0033
// Si alguna de esas tres deja de ser cierta, esta pagina miente.

import { useEffect } from 'react';
import FooterAscii from '../components/landing/FooterAscii.jsx';
import '../styles/platform-landing.css';

const TITULO = 'Dico — Sabé cuánto ganás, no solo cuánto vendés';
const DESCRIPCION = 'El sistema de gestión para restaurantes, parrillas, cafés y '
  + 'cocinas de delivery que te muestra la ganancia real de cada plato, cada '
  + 'turno y cada noche. Recetas con costo, nómina por hora y P&L en tiempo real.';

// El telefono de Ricardo. Va en el CTA principal a proposito: a esta escala
// el primer contacto es una persona, no un formulario.
const WHATSAPP = '17869608110';
const WHATSAPP_TEXTO = 'Hola Ricardo, quiero conocer Dico para mi negocio.';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(WHATSAPP_TEXTO)}`;

const PILARES = [
  {
    id: 'receta',
    indice: '01',
    nombre: 'Receta',
    sub: 'Costo + margen',
    detalle: 'Cargás los insumos de cada plato una vez. Dico calcula el costo '
      + 'solo y lo vuelve a calcular cuando el proveedor cambia el precio. Al '
      + 'lado del precio de venta ves el margen que te dejó.',
    ejemplo: [
      ['Bife de chorizo', 'venta', '$1.200'],
      ['Insumos', 'costo', '$340'],
      ['Hora de trabajo', 'costo', '$185'],
      ['Margen', 'neto', '$675'],
    ],
  },
  {
    id: 'horario',
    indice: '02',
    nombre: 'Horario',
    sub: 'Nómina + rentabilidad',
    detalle: 'Cada puesto tiene un valor por hora. La gente ficha entrada y '
      + 'salida, y las horas que cuentan son las fichadas, no las programadas. '
      + 'Dico te dice qué porcentaje de la venta se fue en sueldos, día por día.',
    ejemplo: [
      ['Martes 14 a 17', 'venta', '$4.900'],
      ['Mozo + cocinero', 'nómina', '$1.850'],
      ['Sobre la venta', 'costo', '38%'],
      ['Ese turno', 'veredicto', 'No paga'],
    ],
  },
  {
    id: 'pl',
    indice: '03',
    nombre: 'P&L',
    sub: 'Número real',
    detalle: 'Cerrás la caja y el reporte ya está hecho: ventas, insumos, '
      + 'nómina, merma y margen neto. Eso es lo que ganaste esa noche. No hay '
      + '"veníamos bien", hay un número.',
    ejemplo: [
      ['Viernes', 'ventas', '$4.200'],
      ['Insumos', 'costo', '$1.050'],
      ['Nómina', 'costo', '$650'],
      ['Merma', 'costo', '$140'],
      ['Ganancia', 'neta', '$2.360'],
    ],
  },
];

const PASOS = [
  {
    n: '1',
    titulo: 'Entra el pedido',
    detalle: 'Lo carga el mozo desde el salón, o lo hace el cliente solo desde '
      + 'el QR de la mesa. Aparece en el mismo lugar para los dos.',
  },
  {
    n: '2',
    titulo: 'La cocina lo ve',
    detalle: 'El pedido aprobado baja a producción. Cuando sale, se marca listo '
      + 'y el salón se entera sin que nadie grite.',
  },
  {
    n: '3',
    titulo: 'El stock se descuenta',
    detalle: 'Cada venta baja los insumos que usó esa receta. Si algo queda por '
      + 'debajo del mínimo, Dico avisa antes de que falte a mitad del servicio.',
  },
  {
    n: '4',
    titulo: 'Se cobra y se cierra',
    detalle: 'Efectivo, tarjeta o MercadoPago. Al final del turno, el arqueo '
      + 'compara lo declarado con lo registrado y la diferencia aparece sola.',
  },
  {
    n: '5',
    titulo: 'Aparece la ganancia',
    detalle: 'Dico ya sabe qué costaron los insumos, cuánto se pagó en horas y '
      + 'qué se tiró. Te muestra el neto de esa noche, no a fin de mes.',
  },
];

const MODULOS = [
  { nombre: 'Catálogo público', estado: 'activo', detalle: 'Tu carta online en tu-nombre.divianco.app, con QR para la mesa.' },
  { nombre: 'Pedidos y salón', estado: 'activo', detalle: 'Mapa de mesas, comandas, estado por mesa y pedidos para llevar.' },
  { nombre: 'Caja y arqueo', estado: 'activo', detalle: 'Apertura, cobros por medio de pago y cierre con control del encargado.' },
  { nombre: 'Stock y compras', estado: 'activo', detalle: 'Insumos, compras, recepciones y merma. Cada movimiento queda asentado.' },
  { nombre: 'Recetas con costo real', estado: 'activo', detalle: 'Insumos por plato, costo automático y margen al lado del precio.' },
  { nombre: 'Reportes y P&L', estado: 'activo', detalle: 'Ganancia por día, por mes y por categoría, con costos reales.' },
  { nombre: 'Equipo y horarios', estado: 'activo', detalle: 'Legajos, puestos, fichaje, costo por hora y costo laboral sobre venta.' },
  { nombre: 'Cocina en pantalla', estado: 'pruebas', detalle: 'La comanda digital por sector. Está construida y se termina de probar.' },
  { nombre: 'Facturación ARCA', estado: 'roadmap', detalle: 'Factura electrónica desde el mismo pedido. En desarrollo, todavía no.' },
];

const INTEGRACIONES = [
  { nombre: 'MercadoPago', estado: 'activo', detalle: 'Checkout Pro con la cuenta del propio negocio. Por ahora solo Argentina.' },
  { nombre: 'WhatsApp', estado: 'activo', detalle: 'Los pedidos del catálogo se responden por wa.me desde el panel.' },
  { nombre: 'Avisos push', estado: 'activo', detalle: 'Pedido nuevo, stock bajo y cierre de turno, en el celular.' },
  { nombre: 'Exportar a Excel', estado: 'activo', detalle: 'Bajás en CSV o PDF lo que ves en pantalla, para tu contador.' },
  { nombre: 'Facturación ARCA', estado: 'roadmap', detalle: 'En desarrollo. No la ofrecemos hasta que emita una factura de verdad.' },
  { nombre: 'Rappi y Pedidos Ya', estado: 'roadmap', detalle: 'Está en la lista y no tiene fecha. Preferimos decirlo así.' },
];

const ESTADO_TEXTO = { activo: 'Activo', pruebas: 'En pruebas', roadmap: 'En desarrollo' };

// Lo que Dico dice son AVISOS sobre datos que ya estan en el sistema, no
// respuestas de un modelo de lenguaje. La diferencia importa y esta seccion
// existe para dejarla clara antes de que alguien la asuma al reves.
const AVISOS = [
  {
    titulo: 'Food cost alto',
    texto: 'El bife de chorizo te sale $520 hoy. La semana pasada salía $380: '
      + 'subió el proveedor. ¿Ajustás el precio o cambiás el corte?',
  },
  {
    titulo: 'Turno que no paga',
    texto: 'Los martes de 14 a 17 la nómina se come el 38% de la venta. Es el '
      + 'único turno de la semana arriba del 30%.',
  },
  {
    titulo: 'Merma fuera de lo normal',
    texto: 'Esta semana tiraste $1.200, casi el triple del promedio del mes. '
      + 'Casi todo en verdulería.',
  },
];

const SEGURIDAD = [
  {
    titulo: 'Cada rol ve lo suyo',
    detalle: 'Un mozo no ve el P&L ni la nómina. Un cocinero no ve el precio de '
      + 'venta ni el costo. No es una pantalla escondida: el permiso se aplica '
      + 'en la base de datos, así que tampoco se llega por otro lado.',
  },
  {
    titulo: 'Un negocio no ve al otro',
    detalle: 'Cada local es un inquilino separado con seguridad por fila. Si '
      + 'tenés dos sucursales, cada una ve su data. Si sumás un contador, ve '
      + 'reportes sin ver la operación.',
  },
  {
    titulo: 'Dico no lee tus datos',
    detalle: 'Dico es determinista: calcula sobre lo que ya está cargado, con '
      + 'reglas que se pueden leer. No es un modelo entrenado con tu '
      + 'información ni la manda a ningún lado.',
  },
  {
    titulo: 'Respaldo y cifrado',
    detalle: 'Los datos viajan cifrados y se respaldan a diario. Nadie de '
      + 'Divianco entra a tu operación sin que vos lo pidas.',
  },
];

const FAQ = [
  {
    p: '¿Qué pasa si se cae el sistema en pleno servicio?',
    r: 'Te lo digo derecho: hoy no hay modo offline. Si se cae la conexión o el '
      + 'servicio, no vas a poder cargar pedidos hasta que vuelva. Corre sobre '
      + 'infraestructura administrada y con respaldo diario, y no es algo que '
      + 'pase seguido, pero prometerte que seguís cobrando sin internet sería '
      + 'mentirte. El modo offline está en la lista de lo que falta.',
  },
  {
    p: '¿Puedo migrar desde el sistema que uso hoy?',
    r: 'Sí. El catálogo, el stock y los clientes los importamos si los tenés '
      + 'digitalizados. Las recetas y el equipo se cargan una vez, y ahí se va '
      + 'el grueso del tiempo. La migración la hacemos con el local cerrado '
      + 'para que no dejes de vender.',
  },
  {
    p: 'No entiendo nada de tecnología. ¿Igual lo puedo usar?',
    r: 'Por eso el alta la hacemos juntos. Te muestro cada módulo y lo practicás '
      + 'con tus propios datos. Después es cargar pedidos y mirar el número al '
      + 'cierre. Si algo no se entiende, WhatsApp.',
  },
  {
    p: '¿Cuánto tarda la puesta en marcha?',
    r: 'Crear la cuenta y tener el catálogo online es cuestión de minutos, y eso '
      + 'lo hacés solo desde acá. Dejarlo completo, con recetas costeadas, '
      + 'equipo y horarios cargados, es un par de horas conmigo.',
  },
  {
    p: '¿Y si abro una segunda sucursal?',
    r: 'Pasás al plan Cadena cuando quieras, sin penalidad. Cada local tiene su '
      + 'P&L y sus roles, y arriba ves el consolidado y la comparativa entre '
      + 'sucursales.',
  },
  {
    p: 'Si dejo de pagar, ¿pierdo mis datos?',
    r: 'No se borran. Perdés el acceso hasta que retomes, y cuando volvés está '
      + 'todo donde lo dejaste.',
  },
  {
    p: '¿Sirve con mi caja registradora vieja?',
    r: 'Si es una máquina mecánica, no se conecta. Pero Dico trae su propia caja '
      + 'digital y esa la reemplaza. Si cobrás con terminal de MercadoPago, eso '
      + 'sí entra solo.',
  },
];

// Los precios salen de la tabla `plans` del edificio (migracion 0052). El plan
// `total` queda afuera a proposito: esta modelado y marcado no disponible.
const PLANES = [
  {
    id: 'digital',
    nombre: 'Digital',
    etiqueta: 'Gratis',
    mensual: 0,
    descripcion: 'Todo el sistema, sin pagar.',
    items: [
      'Catálogo público con link propio',
      'Pedidos, caja y arqueo',
      'Recetas con costo y margen',
      'Stock e insumos',
      'Equipo, horarios y costo por hora',
      'P&L con números reales',
    ],
  },
  {
    id: 'local',
    nombre: 'Local',
    etiqueta: 'Más elegido',
    destacado: true,
    mensual: 59000,
    anual: 47200,
    descripcion: 'Un local, con todo lo que llega.',
    items: [
      'Todo lo del plan Digital',
      'Facturación ARCA cuando salga',
      'Cocina en pantalla cuando salga',
      'Soporte por mail y chat',
      'Una sucursal',
    ],
  },
  {
    id: 'cadena',
    nombre: 'Cadena',
    etiqueta: 'Multi-local',
    mensual: 99000,
    anual: 79200,
    descripcion: 'Varias sucursales en un solo lugar.',
    items: [
      'Todo lo del plan Local',
      'Sucursales sin tope',
      'Consolidado y comparativa entre locales',
      'Roles por local',
      'Soporte por teléfono',
    ],
  },
];

const pesos = (n) => `$${n.toLocaleString('es-AR')}`;

/** Escribe el titulo y los meta de la raiz. El index.html del build lleva los
 *  del tenant que se horneo (hermes-cochi), asi que sin esto la pestania de
 *  divianco.app dice el nombre de un restaurante. Los bots de vista previa no
 *  pasan por aca: a esos los atiende `api/og.js`. */
function useMetaDeLaPlataforma() {
  useEffect(() => {
    document.title = TITULO;
    const set = (sel, attr, valor) => {
      const el = document.head.querySelector(sel);
      if (el) el.setAttribute(attr, valor);
    };
    set('meta[name="description"]', 'content', DESCRIPCION);
    set('meta[property="og:title"]', 'content', TITULO);
    set('meta[property="og:description"]', 'content', DESCRIPCION);
  }, []);
}

export default function PlatformLanding() {
  useMetaDeLaPlataforma();

  return (
    <div className="pl-root">
      <header className="pl-nav">
        <div className="pl-wrap pl-nav-in">
          <a className="pl-logo" href="/" aria-label="Dico">
            <img src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" />
          </a>
          <nav className="pl-nav-links">
            <a href="#pilares">Cómo lo calcula</a>
            <a href="#flujo">Cómo funciona</a>
            <a href="#modulos">Módulos</a>
            <a href="#precios">Precios</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <div className="pl-nav-cta">
            <a className="pl-btn pl-btn-ghost pl-btn-sm" href="/entrar">Entrar</a>
            <a className="pl-btn pl-btn-gold pl-btn-sm" href={WHATSAPP_URL} target="_blank" rel="noreferrer">
              Agendá 20 minutos
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ── 1. HERO ── */}
        <section className="pl-hero">
          <div className="pl-wrap">
            <p className="pl-pill pl-mono">
              <span className="pl-pill-dot" aria-hidden="true" />
              Gestión para gastronomía · Argentina
            </p>

            <h1 className="pl-titular">
              <span className="pl-titular-fijo">Sabé cuánto ganás,</span>
              <span className="pl-titular-alma pl-serif">no solo cuánto vendés.</span>
            </h1>

            <p className="pl-hero-sub">
              La ganancia real de cada plato, de cada turno y de cada noche.
              Sin suposiciones. Números.
            </p>

            <div className="pl-hero-cta">
              <a className="pl-btn pl-btn-gold" href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                Agendá 20 minutos conmigo
              </a>
              <a className="pl-btn pl-btn-ghost" href="/registro">Probar gratis</a>
            </div>

            <p className="pl-hero-nota pl-mono">
              El plan Digital es gratis · Sin tarjeta · Tu carta online en un minuto
            </p>

            <MockupPanel />
          </div>
        </section>

        <section className="pl-tira" aria-label="Lo que reemplaza">
          <div className="pl-wrap pl-tira-in pl-mono">
            <strong>Lo que reemplaza</strong>
            <span>Planillas de Excel</span>
            <span>Cuaderno de caja</span>
            <span>Grupo de WhatsApp</span>
            <span>Comandera aparte</span>
            <span>Conteo de stock a ojo</span>
          </div>
        </section>

        {/* ── 2. EL PROBLEMA ── */}
        <section className="pl-sec pl-problema">
          <div className="pl-wrap">
            <div className="pl-sec-head">
              <p className="pl-mono">El problema</p>
              <h2 className="pl-serif">Vendiste $10.000. ¿Ganaste cuánto?</h2>
            </div>
            <div className="pl-grid pl-grid-2">
              <article className="pl-card">
                <h3>Sin sistema</h3>
                <p>
                  Anotás a mano, sumás en papel y a fin de mes calculás si diste
                  vuelta o no. Si el resultado es malo, ya pasó.
                </p>
              </article>
              <article className="pl-card">
                <h3>Con un sistema que solo vende</h3>
                <p>
                  Ves que vendiste $10.000 y no sabés cuánto pagaste de insumos,
                  cuánto costó el equipo de esa noche, ni si ese plato de $500 te
                  deja $200 o te sale negativo.
                </p>
              </article>
            </div>
            <p className="pl-remate">
              En los dos casos decidís a ciegas. ¿Cambio la carta? ¿Subo precios?
              ¿Abro un turno más? Sin costos reales, es adivinar.
            </p>
          </div>
        </section>

        {/* ── 3 y 4. LA SOLUCIÓN / LOS TRES PILARES ── */}
        <section className="pl-sec" id="pilares">
          <div className="pl-wrap">
            <div className="pl-sec-head">
              <p className="pl-mono">Cómo lo calcula</p>
              <h2 className="pl-serif">Receta por receta, turno por turno</h2>
              <p>
                Dico junta tres datos que en cualquier otro lado viven separados.
                Juntos dejan de ser tres planillas y pasan a ser una ganancia.
              </p>
            </div>
            <div className="pl-grid pl-pilares">
              {PILARES.map((p) => (
                <article className="pl-card pl-pilar" key={p.id}>
                  <div className="pl-pilar-head">
                    <span className="pl-pilar-indice pl-mono">{p.indice}</span>
                    <div>
                      <h3>{p.nombre}</h3>
                      <p className="pl-pilar-sub pl-mono">{p.sub}</p>
                    </div>
                  </div>
                  <p>{p.detalle}</p>
                  <dl className="pl-ejemplo pl-mono">
                    {p.ejemplo.map(([concepto, tipo, valor]) => (
                      <div className="pl-ejemplo-fila" key={concepto}>
                        <dt>
                          {concepto} <span className="pl-ejemplo-tipo">{tipo}</span>
                        </dt>
                        <dd>{valor}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
            <p className="pl-remate">
              Una sola base de datos. El dato se carga una vez y aparece donde
              haga falta. Nada se duplica y nada se pierde entre planillas.
            </p>
          </div>
        </section>

        {/* ── 5. CÓMO FUNCIONA ── */}
        <section className="pl-sec" id="flujo">
          <div className="pl-wrap">
            <div className="pl-sec-head pl-row">
              <div>
                <p className="pl-mono">Cómo funciona</p>
                <h2 className="pl-serif">Cinco pasos, de la mesa al número</h2>
              </div>
              <p>
                Cada paso funciona solo. Conectados, el último sale sin que nadie
                tenga que sentarse a calcularlo.
              </p>
            </div>
            <ol className="pl-pasos">
              {PASOS.map((p) => (
                <li className="pl-paso" key={p.n}>
                  <span className="pl-paso-n pl-mono">{p.n}</span>
                  <div>
                    <h3>{p.titulo}</h3>
                    <p>{p.detalle}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 6. MÓDULOS ── */}
        <section className="pl-sec" id="modulos">
          <div className="pl-wrap">
            <div className="pl-sec-head pl-row">
              <div>
                <p className="pl-mono">Módulos</p>
                <h2 className="pl-serif">Lo que tenés hoy y lo que falta</h2>
              </div>
              <p>
                Usás lo que necesitás. Lo que todavía no está terminado figura
                como tal, no como promesa.
              </p>
            </div>
            <div className="pl-grid">
              {MODULOS.map((m) => (
                <article className="pl-card" key={m.nombre}>
                  <div className="pl-card-head">
                    <h3>{m.nombre}</h3>
                    <span className={`pl-estado ${m.estado}`}>{ESTADO_TEXTO[m.estado]}</span>
                  </div>
                  <p>{m.detalle}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 7. INTEGRACIONES ── */}
        <section className="pl-sec" id="integraciones">
          <div className="pl-wrap">
            <div className="pl-sec-head pl-row">
              <div>
                <p className="pl-mono">Integraciones</p>
                <h2 className="pl-serif">Se lleva bien con lo que ya usás</h2>
              </div>
              <p>¿Necesitás conectar otra cosa? Escribime y lo vemos.</p>
            </div>
            <div className="pl-grid">
              {INTEGRACIONES.map((i) => (
                <article className="pl-card" key={i.nombre}>
                  <div className="pl-card-head">
                    <h3>{i.nombre}</h3>
                    <span className={`pl-estado ${i.estado}`}>{ESTADO_TEXTO[i.estado]}</span>
                  </div>
                  <p>{i.detalle}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. DICO, TU COPILOTO ── */}
        <section className="pl-sec pl-copiloto">
          <div className="pl-wrap">
            <div className="pl-sec-head">
              <p className="pl-mono">Dico</p>
              <h2 className="pl-serif">No decide por vos. Te avisa.</h2>
              <p>
                Dico mira tus números y levanta la mano cuando algo se sale de lo
                normal. No manda a la cocina, no cambia precios y no gasta plata.
                Te pone el dato adelante para que decidas vos.
              </p>
            </div>
            <div className="pl-grid pl-avisos">
              {AVISOS.map((a) => (
                <article className="pl-card pl-aviso" key={a.titulo}>
                  <div className="pl-aviso-firma pl-mono">
                    <img src="/brand/dico/dico-2d-neutral.png" alt="" width="256" height="256" />
                    {a.titulo}
                  </div>
                  <p>{a.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 9. PLANES ── */}
        <section className="pl-sec pl-precios" id="precios">
          <div className="pl-wrap">
            <div className="pl-sec-head">
              <p className="pl-mono">Precios</p>
              <h2 className="pl-serif">Empezás gratis. Pagás si te sirve.</h2>
            </div>
            <div className="pl-grid">
              {PLANES.map((p) => (
                <article className={`pl-card pl-precio-card${p.destacado ? ' destacado' : ''}`} key={p.id}>
                  <div className="pl-card-head">
                    <h3>{p.nombre}</h3>
                    <span className="pl-mono">{p.etiqueta}</span>
                  </div>
                  <p className="pl-precio-monto">
                    {p.mensual === 0 ? 'Gratis' : pesos(p.mensual)}
                    {p.mensual > 0 && <span>/ mes por local</span>}
                  </p>
                  <p className="pl-precio-anual">
                    {p.anual ? `${pesos(p.anual)} por mes si pagás el año` : p.descripcion}
                  </p>
                  <ul>
                    {p.items.map((i) => <li key={i}>{i}</li>)}
                  </ul>
                  <a
                    className={`pl-btn pl-btn-block ${p.destacado ? 'pl-btn-gold' : 'pl-btn-ghost'}`}
                    href={p.mensual === 0 ? '/registro' : WHATSAPP_URL}
                    {...(p.mensual === 0 ? {} : { target: '_blank', rel: 'noreferrer' })}
                  >
                    {p.mensual === 0 ? 'Empezar gratis' : `Hablar de ${p.nombre}`}
                  </a>
                </article>
              ))}
            </div>
            <p className="pl-precio-pie">
              Sin cargo por usuario, por pedido ni por factura procesada. Lo que
              ves en la tarjeta es lo que pagás. Precios en pesos, por local, sin IVA.
            </p>
          </div>
        </section>

        {/* ── 10. SEGURIDAD ── */}
        <section className="pl-sec" id="seguridad">
          <div className="pl-wrap">
            <div className="pl-sec-head pl-row">
              <div>
                <p className="pl-mono">Seguridad</p>
                <h2 className="pl-serif">Tu data es tuya</h2>
              </div>
              <p>
                Lo que sigue no son buenas intenciones: son reglas escritas en la
                base de datos, que es donde tienen que estar.
              </p>
            </div>
            <div className="pl-grid pl-grid-2">
              {SEGURIDAD.map((s) => (
                <article className="pl-card" key={s.titulo}>
                  <h3>{s.titulo}</h3>
                  <p>{s.detalle}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 11. FAQ ── */}
        <section className="pl-sec" id="preguntas">
          <div className="pl-wrap">
            <div className="pl-sec-head">
              <p className="pl-mono">Preguntas</p>
              <h2 className="pl-serif">Lo que todos preguntan</h2>
            </div>
            <div className="pl-faq">
              {FAQ.map((f) => (
                <details className="pl-faq-item" key={f.p}>
                  <summary>
                    <span>{f.p}</span>
                    <span className="pl-faq-signo" aria-hidden="true" />
                  </summary>
                  <p>{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 12. CIERRE Y CONTACTO ── */}
        <section className="pl-cierre" id="contacto">
          <div className="pl-wrap">
            <h2 className="pl-serif">Empecemos</h2>
            <p>
              Veinte minutos alcanzan para mirar juntos los números de tu local y
              que veas si esto te sirve. Si preferís probarlo solo primero, el
              plan Digital es gratis y no pide tarjeta.
            </p>
            <div className="pl-hero-cta">
              <a className="pl-btn pl-btn-gold" href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                Agendá 20 minutos conmigo
              </a>
              <a className="pl-btn pl-btn-ghost" href="/registro">Probar gratis</a>
            </div>
            <dl className="pl-contacto pl-mono">
              <div>
                <dt>WhatsApp</dt>
                <dd><a href={WHATSAPP_URL} target="_blank" rel="noreferrer">+1 786 960 8110</a></dd>
              </div>
              <div>
                <dt>Horario</dt>
                <dd>Lunes a viernes, 11 a 23 h (Buenos Aires)</dd>
              </div>
              <div>
                <dt>Mail</dt>
                <dd><a href="mailto:hola@divianco.app">hola@divianco.app</a></dd>
              </div>
              <div>
                <dt>Atiende</dt>
                <dd>Ricardo Rodríguez · Grupo Divianco</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      {/* La trama de puntos cierra la pagina y entrega el pie: es decoracion,
          asi que va fuera de <main> y no aporta nada al lector de pantalla. */}
      <FooterAscii />

      <footer className="pl-pie">
        <div className="pl-wrap pl-pie-in">
          <img src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" />
          <span className="pl-pie-legal">© {new Date().getFullYear()} Grupo Divianco</span>
          <div className="pl-pie-links">
            <a href="#pilares">Cómo lo calcula</a>
            <a href="#modulos">Módulos</a>
            <a href="#precios">Precios</a>
            <a href="#preguntas">Preguntas</a>
            <a href="/entrar">Entrar</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* El mockup no es una captura: es la propia UI en miniatura, con datos de
   ejemplo de un restaurante chico. Una captura envejece con cada deploy; esto
   no. Los numeros son los mismos del pilar de P&L a proposito: la pagina
   cuenta una sola noche, no cinco ejemplos sueltos. */
function MockupPanel() {
  return (
    <div
      className="pl-mock"
      role="img"
      aria-label="Vista del panel de Dico con las ventas de la noche, el costo de insumos y de nómina, la merma y la ganancia neta"
    >
      <div className="pl-mock-bar pl-mono">
        <span className="pl-mock-luz" />
        <span className="pl-mock-luz" />
        <span className="pl-mock-luz" />
        <span style={{ marginLeft: 10 }}>divianco.app · cierre del viernes</span>
      </div>

      <div className="pl-mock-body" aria-hidden="true">
        <div>
          <div className="pl-kpis">
            <div className="pl-kpi">
              <div className="pl-kpi-label pl-mono">Ventas</div>
              <div className="pl-kpi-valor">$4.200</div>
              <div className="pl-kpi-delta sube">+6%</div>
            </div>
            <div className="pl-kpi">
              <div className="pl-kpi-label pl-mono">Insumos</div>
              <div className="pl-kpi-valor">$1.050</div>
              <div className="pl-kpi-delta">25% de la venta</div>
            </div>
            <div className="pl-kpi">
              <div className="pl-kpi-label pl-mono">Nómina</div>
              <div className="pl-kpi-valor">$650</div>
              <div className="pl-kpi-delta">15% de la venta</div>
            </div>
            <div className="pl-kpi destacado">
              <div className="pl-kpi-label pl-mono">Ganancia neta</div>
              <div className="pl-kpi-valor">$2.360</div>
              <div className="pl-kpi-delta sube">56% de margen</div>
            </div>
          </div>

          <div className="pl-pend">
            <h3>Pendientes de decidir</h3>
            <ul>
              <li><span className="pl-tag alta">Alta</span> El bife de chorizo pasó de $380 a $520 de costo.</li>
              <li><span className="pl-tag alta">Alta</span> Agua mineral 500 ml sin stock cargado.</li>
              <li><span className="pl-tag media">Media</span> Merma del viernes: $140, casi toda en verdulería.</li>
            </ul>
          </div>
        </div>

        <div className="pl-dico-card">
          <div className="pl-dico-firma pl-mono">
            <img src="/brand/dico/dico-2d-neutral.png" alt="" width="256" height="256" />
            Dico
          </div>
          <p className="pl-dico-dice">
            El bife de chorizo te está dejando 14% de margen. A $1.450 volvés al
            objetivo sin tocar el resto de la carta.
          </p>
          <div className="pl-dico-acciones">
            <span className="pl-btn pl-btn-gold pl-btn-sm">Aplicar</span>
            <span className="pl-btn pl-btn-ghost pl-btn-sm">Ahora no</span>
          </div>
        </div>
      </div>
    </div>
  );
}
