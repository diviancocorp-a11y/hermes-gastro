// src/pages/PlatformLanding.jsx
// Puerta de entrada de la PLATAFORMA (divianco.app), no de un local.
//
// Se muestra cuando el hostname es la raiz: ahi no hay tenant que resolver,
// asi que el catalogo no aplica. Sin esta pantalla, fetchCatalog devuelve null
// y el catalogo lo interpreta como "Supabase caido" (setError('offline')) —
// un error de conexion que no existe.
//
// El CTA lleva a /registro (Signup.jsx), que es el alta self-service real:
// elegir rubro y slug, crear la cuenta, confirmar el email y quedarse con
// <slug>.divianco.app.
//
// REGLA DE CONTENIDO: aca no se promete nada que el producto no haga hoy.
// Los precios salen de la tabla `plans` del edificio (0052) y los estados de
// las integraciones dicen la verdad, incluso cuando la verdad es "todavia no".
// Una landing que promete de mas se paga en el primer valor, no en la visita.

import { useEffect } from 'react';
import PalabraEscrita from '../components/landing/PalabraEscrita.jsx';
import FooterAscii from '../components/landing/FooterAscii.jsx';
import '../styles/platform-landing.css';

// Lo que rota en el titular son los rubros, no sinonimos de "negocio": el
// mismo sistema sirve para todos, y verlo cambiar lo dice mas rapido que una
// lista. Gastronomia aparece dos veces y con dos locales distintos a
// proposito: "bar" solo dejaba afuera a la panaderia y a la cocina de
// delivery, que son clientes tan validos como el restaurante.
const TITULAR_ROTA = [
  'tu restaurante',
  'tu panadería',
  'tu barbería',
  'tu local de ropa',
  'tu negocio',
];

const RUBROS = [
  {
    nombre: 'Gastronomía',
    detalle: 'Para restaurantes, parrillas, cafés, bares, panaderías y cocinas de delivery que quieren saber cuánto deja cada plato.',
    items: ['Carta online con tu link', 'Comandas a cocina, en salón o para llevar', 'Recetas con costo por porción'],
  },
  {
    nombre: 'Barbería',
    detalle: 'Para barberías y peluquerías que trabajan con turnos y varios profesionales.',
    items: ['Agenda de turnos por profesional', 'Servicios con duración y precio', 'Comisiones y caja por persona'],
  },
  {
    nombre: 'Indumentaria',
    detalle: 'Para locales de ropa que manejan variantes y necesitan stock fino.',
    items: ['Stock por talle y color', 'Catálogo con fotos y variantes', 'Reposición por variante'],
  },
];

const MODULOS = [
  {
    nombre: 'Catálogo online',
    detalle: 'Tu negocio en tu-nombre.divianco.app, con tu identidad. Un link que mandás y ya vende.',
  },
  {
    nombre: 'Pedidos y salón',
    detalle: 'Comandas, estado por mesa y tiempos de entrega. El mozo y la cocina miran lo mismo.',
  },
  {
    nombre: 'Caja y turnos',
    detalle: 'Apertura, cobros por medio de pago, arqueo y cierre. La diferencia aparece sola.',
  },
  {
    nombre: 'Productos y márgenes',
    detalle: 'Costo, precio y margen de cada ítem, calculados por el sistema y no a mano.',
  },
  {
    nombre: 'Stock e insumos',
    detalle: 'Descuento automático por venta y aviso cuando un insumo queda por debajo del mínimo.',
  },
  {
    nombre: 'Equipo',
    detalle: 'Legajo, puestos y permisos. Cada persona ve lo suyo y nada más que lo suyo.',
  },
];

const INTEGRACIONES = [
  { nombre: 'WhatsApp', estado: 'activo', detalle: 'Los pedidos del catálogo se responden por wa.me desde el panel.' },
  { nombre: 'Avisos push', estado: 'activo', detalle: 'Pedido nuevo, stock bajo y cierre de turno, en el celular.' },
  { nombre: 'Exportar a Excel', estado: 'activo', detalle: 'Bajás en CSV o PDF lo que ves en pantalla, para tu contador.' },
  { nombre: 'MercadoPago', estado: 'pruebas', detalle: 'Checkout Pro con la cuenta del propio negocio. Por ahora solo Argentina.' },
  { nombre: 'Facturación AFIP', estado: 'roadmap', detalle: 'Factura electrónica desde el mismo pedido. Todavía no disponible.' },
  { nombre: 'Delivery', estado: 'roadmap', detalle: 'Rappi y Pedidos Ya unificados con los pedidos del salón.' },
];

const ESTADO_TEXTO = { activo: 'Activo', pruebas: 'En pruebas', roadmap: 'En el roadmap' };

const COMPARATIVA = [
  ['Saber el margen real de cada producto', 'Lo calculás a mano', 'Sí, si cargás los costos', 'Solo, y te avisa si baja'],
  ['Enterarte de un problema', 'Cuando revisás', 'En el reporte de fin de mes', 'En el momento'],
  ['Qué hacer con el dato', 'Lo decidís vos', 'Lo decidís vos', 'Te llega la recomendación'],
  ['Catálogo para tus clientes', 'No tiene', 'Módulo aparte, se paga', 'Incluido desde el primer plan'],
  ['Puesta en marcha', 'Inmediata', 'Semanas, con implementador', 'Un minuto, vos solo'],
  ['Costo de arranque', 'Gratis', 'Licencia más instalación', 'Primer mes sin cargo'],
];

// Los precios NO se escriben a mano: son los de la tabla `plans` del edificio
// (migracion 0052). Si cambian alla, cambian aca. El plan `total` queda afuera
// a proposito: esta modelado y marcado como no disponible.
const PLANES = [
  {
    id: 'digital',
    nombre: 'Digital',
    etiqueta: 'Para arrancar',
    mensual: 29000,
    anual: 23200,
    descripcion: 'Para vender a distancia.',
    items: ['Catálogo online con link propio', 'Pedidos y clientes', 'Productos con costo y margen', 'Avisos de Dico'],
  },
  {
    id: 'local',
    nombre: 'Local',
    etiqueta: 'Más elegido',
    destacado: true,
    mensual: 59000,
    anual: 47200,
    descripcion: 'Todo lo de Digital más el salón.',
    items: ['Todo lo del plan Digital', 'Mesas, comandas y salón', 'Caja, turnos y arqueo', 'Stock e insumos', 'Equipo con permisos'],
  },
  {
    id: 'cadena',
    nombre: 'Cadena',
    etiqueta: 'Multi-local',
    mensual: 99000,
    anual: 79200,
    descripcion: 'Varias sucursales en un solo lugar.',
    items: ['Todo lo del plan Local', 'Consolidado entre locales', 'Comparativas por sucursal', 'Roles por local'],
  },
];

const pesos = (n) => `$${n.toLocaleString('es-AR')}`;

export default function PlatformLanding() {
  useEffect(() => {
    document.title = 'Dico — el sistema que ordena tu negocio';
  }, []);

  return (
    <div className="pl-root">
      <header className="pl-nav">
        <div className="pl-wrap pl-nav-in">
          <a className="pl-logo" href="/" aria-label="Dico">
            <img src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" />
          </a>
          <nav className="pl-nav-links">
            <a href="#rubros">Rubros</a>
            <a href="#modulos">Módulos</a>
            <a href="#integraciones">Integraciones</a>
            <a href="#comparativa">Comparativa</a>
            <a href="#precios">Precios</a>
          </nav>
          <div className="pl-nav-cta">
            <a className="pl-btn pl-btn-ghost pl-btn-sm" href="/entrar">Entrar</a>
            <a className="pl-btn pl-btn-gold pl-btn-sm" href="/registro">Crear mi negocio</a>
          </div>
        </div>
      </header>

      <main>
        <section className="pl-hero">
          <div className="pl-wrap">
            <p className="pl-pill pl-mono">
              <span className="pl-pill-dot" aria-hidden="true" />
              Gastronomía · Barbería · Indumentaria
            </p>

            {/* El titular es Overused Grotesk y lo unico en Butler es la
                palabra que cambia: la letra de Dico entra donde Dico habla. */}
            <h1 className="pl-titular">
              <span className="pl-titular-fijo">El sistema que ordena</span>
              <PalabraEscrita palabras={TITULAR_ROTA} className="pl-titular-rota" />
              <span className="pl-titular-fijo">y además te avisa</span>
            </h1>

            <p className="pl-hero-sub">
              Catálogo, pedidos, caja y stock en un solo lugar. Y Dico, que mira todo eso
              por vos y te dice qué conviene resolver hoy.
            </p>

            <div className="pl-hero-cta">
              <a className="pl-btn pl-btn-gold" href="/registro">Crear mi negocio</a>
              <a className="pl-btn pl-btn-ghost" href="#modulos">Ver cómo funciona</a>
            </div>

            <p className="pl-hero-nota pl-mono">Primer mes sin cargo · Tu negocio online en un minuto</p>

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

        <section className="pl-sec" id="rubros">
          <div className="pl-wrap">
            <div className="pl-sec-head">
              <p className="pl-mono">Rubros</p>
              <h2 className="pl-serif">Cada negocio tiene su forma de trabajar</h2>
              <p>
                Elegís tu rubro al crear la cuenta y el sistema ya viene armado con lo que
                necesitás. Nada de configurar campos que no vas a usar.
              </p>
            </div>
            <div className="pl-grid">
              {RUBROS.map((r) => (
                <article className="pl-card" key={r.nombre}>
                  <h3>{r.nombre}</h3>
                  <p>{r.detalle}</p>
                  <ul>
                    {r.items.map((i) => <li key={i}>{i}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pl-sec" id="modulos">
          <div className="pl-wrap">
            <div className="pl-sec-head pl-row">
              <div>
                <p className="pl-mono">Módulos</p>
                <h2 className="pl-serif">Todo el negocio en un solo sistema</h2>
              </div>
              <p>Cada módulo alimenta a Dico. Cuanto más lo usás, mejor te conoce y más útil se vuelve.</p>
            </div>
            <div className="pl-grid">
              {MODULOS.map((m) => (
                <article className="pl-card" key={m.nombre}>
                  <h3>{m.nombre}</h3>
                  <p>{m.detalle}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pl-sec" id="integraciones">
          <div className="pl-wrap">
            <div className="pl-sec-head pl-row">
              <div>
                <p className="pl-mono">Integraciones</p>
                <h2 className="pl-serif">Se lleva bien con lo que ya usás</h2>
              </div>
              <p>No tenés que dejar de usar tus herramientas. Acá está lo que funciona hoy y lo que todavía no.</p>
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

        <section className="pl-sec" id="comparativa">
          <div className="pl-wrap">
            <div className="pl-sec-head">
              <p className="pl-mono">Comparativa</p>
              <h2 className="pl-serif">Contra la planilla y contra el sistema de siempre</h2>
            </div>
            <div className="pl-tabla-scroll">
              <table className="pl-tabla">
                <thead>
                  <tr>
                    <th scope="col" aria-label="Qué se compara" />
                    <th scope="col">Planilla</th>
                    <th scope="col">Sistema tradicional</th>
                    <th scope="col" className="dico">Dico</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARATIVA.map(([que, planilla, tradicional, dico]) => (
                    <tr key={que}>
                      <th scope="row">{que}</th>
                      <td>{planilla}</td>
                      <td>{tradicional}</td>
                      <td className="dico">{dico}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="pl-sec pl-precios" id="precios">
          <div className="pl-wrap">
            <div className="pl-sec-head">
              <p className="pl-mono">Precios</p>
              <h2 className="pl-serif">Empezás sin pagar, seguís si te sirve</h2>
            </div>
            <div className="pl-grid">
              {PLANES.map((p) => (
                <article className={`pl-card pl-precio-card${p.destacado ? ' destacado' : ''}`} key={p.id}>
                  <div className="pl-card-head">
                    <h3>{p.nombre}</h3>
                    <span className="pl-mono">{p.etiqueta}</span>
                  </div>
                  <p className="pl-precio-monto">
                    {pesos(p.mensual)} <span>/ mes por local</span>
                  </p>
                  <p className="pl-precio-anual">{pesos(p.anual)} por mes si pagás el año</p>
                  <ul>
                    {p.items.map((i) => <li key={i}>{i}</li>)}
                  </ul>
                  <a
                    className={`pl-btn pl-btn-block ${p.destacado ? 'pl-btn-gold' : 'pl-btn-ghost'}`}
                    href="/registro"
                  >
                    Empezar con {p.nombre}
                  </a>
                </article>
              ))}
            </div>
            <p className="pl-precio-pie">
              Todos los planes arrancan con el primer mes sin cargo. Precios en pesos, por local, sin IVA.
            </p>
          </div>
        </section>

        <section className="pl-cierre">
          <div className="pl-wrap">
            <h2 className="pl-serif">Probalo con los números que ya tenés</h2>
            <p>
              Creás tu negocio en un minuto, cargás tu carta y mirás qué te dice Dico.
              Si no te sirve, no pagás nada.
            </p>
            <div className="pl-hero-cta">
              <a className="pl-btn pl-btn-gold" href="/registro">Crear mi negocio</a>
              <a className="pl-btn pl-btn-ghost" href="mailto:hola@divianco.app">Hablar con nosotros</a>
            </div>
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
            <a href="#rubros">Rubros</a>
            <a href="#modulos">Módulos</a>
            <a href="#precios">Precios</a>
            <a href="/entrar">Entrar</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* El mockup no es una captura: es la propia UI en miniatura, con datos de
   ejemplo. Una captura envejece con cada deploy; esto no. */
function MockupPanel() {
  return (
    <div className="pl-mock" role="img" aria-label="Vista del panel de Dico con las ventas del período, el margen estimado y las decisiones pendientes">
      <div className="pl-mock-bar pl-mono">
        <span className="pl-mock-luz" />
        <span className="pl-mock-luz" />
        <span className="pl-mock-luz" />
        <span style={{ marginLeft: 10 }}>divianco.app · centro de decisiones</span>
      </div>

      <div className="pl-mock-body" aria-hidden="true">
        <div>
          <div className="pl-kpis">
            <div className="pl-kpi">
              <div className="pl-kpi-label pl-mono">Ventas del período</div>
              <div className="pl-kpi-valor">$1.284.600</div>
              <div className="pl-kpi-delta sube">+6%</div>
            </div>
            <div className="pl-kpi">
              <div className="pl-kpi-label pl-mono">Margen estimado</div>
              <div className="pl-kpi-valor">34%</div>
              <div className="pl-kpi-delta sube">+2 pts</div>
            </div>
            <div className="pl-kpi">
              <div className="pl-kpi-label pl-mono">Bajo margen mínimo</div>
              <div className="pl-kpi-valor">2</div>
              <div className="pl-kpi-delta baja">+1</div>
            </div>
            <div className="pl-kpi">
              <div className="pl-kpi-label pl-mono">Stock crítico</div>
              <div className="pl-kpi-valor">3</div>
              <div className="pl-kpi-delta sube">-1</div>
            </div>
          </div>

          <div className="pl-pend">
            <h3>Pendientes de decidir</h3>
            <ul>
              <li><span className="pl-tag alta">Alta</span> Subir precio de Verde QA — margen 14%, bajo el mínimo.</li>
              <li><span className="pl-tag alta">Alta</span> Reponer Agua mineral 500 ml — sin stock cargado.</li>
              <li><span className="pl-tag media">Media</span> Cierre de caja con diferencia de $340.</li>
            </ul>
          </div>
        </div>

        <div className="pl-dico-card">
          <div className="pl-dico-firma pl-mono">
            <img src="/brand/dico/dico-2d-neutral.png" alt="" width="256" height="256" />
            Dico
          </div>
          <p className="pl-dico-dice">
            Verde QA se está vendiendo con 14% de margen. Si lo llevás a $8.900
            volvés al objetivo sin tocar el resto de la carta.
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
