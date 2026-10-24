// src/pages/PlatformLanding.jsx
// Puerta de entrada de la PLATAFORMA (divianco.app), no de un local.
//
// Se muestra cuando el hostname es la raiz: ahi no hay tenant que resolver,
// asi que el catalogo no aplica. Sin esta pantalla, fetchCatalog devuelve null
// y el catalogo lo interpreta como "Supabase caido" (setError('offline')) —
// un error de conexion que no existe.
//
// REGLA DE CONTENIDO: aca no se promete nada que el producto no haga hoy.
// Cada afirmacion se puede rastrear a una migracion o a una pantalla que
// existe; lo que hace cada rubro sale de src/modules/registry.js
// (`implementado`). Lo que falta se dice "en desarrollo" y se ofrece como
// "lo desarrollamos con vos" (decision de Ricky, 19/oct/2026). Verificado en
// el codigo el 19/oct: el resultado del mes es para todos; desde la 0103
// (publicada el 20/oct) hay resultado del dia por sucursal, con costo de lo
// vendido solo donde hay recetas (gastronomia). El costo laboral es POR DIA,
// el stock entra con compras y conteos y, desde la 0104, completar un pedido
// descuenta la receta (gastronomia) o el articulo sin receta (comercio, y los
// productos que vende un servicio); el minimo con aviso en el panel es solo
// de insumos; el salon es solo de gastronomia. El costeo de una receta es
// insumos x (1 + merma% + gastos%): no hay mano de obra.
//
// Anclas viejas de la landing de main (#pilares, #flujo, #modulos,
// #integraciones, #seguridad, #contacto): quedan como alias (.pl-ancla) en
// la seccion equivalente, para que los links de afuera no caigan arriba.
//
// V3 (20/oct/2026, rama landing/rediseno). La home ES el embudo: la frase de
// valor y un boton que abre el diagnostico en la misma pagina, en la misma
// columna (src/components/landing/Diagnostico.jsx). Lo que explica el sistema
// queda debajo, para quien quiere leer.
//
// Direccion de design-taste-frontend: `quiet-instrument` (seed 2118221348).
// Columna angosta, la frase como unica cosa grande, demostraciones chicas y
// exactas, mucho aire compuesto. Idea: lo que Dico lee de tu negocio se
// imprime en un instrumento al lado de la columna: el resultado en la portada
// (la noche en gastronomia, el mes en comercio y servicios), tus respuestas durante el diagnostico, la pieza que resuelve tu
// dolor al final. Paleta en src/styles/plataforma-claro.css (oro solo accion
// y valor, volt solo lo que lee Dico, oscuro solo en piezas de producto).
//
// Orden: portada (embudo) -> que hace Dico (tu dolor y la parte del panel que
// lo resuelve) -> que hace hoy cada rubro y que esta en desarrollo -> clientes
// -> planes -> preguntas -> una frase y el boton -> una linea de pie.
//
// PRUEBA SOCIAL: solo nombres y fotos reales de productos de clientes que
// corren sobre Dico (La Nona Pato y Crazy Miga). Sin cifras de resultados.
// Las cifras de las piezas del producto son ejemplos y cierran entre si.

import { useEffect, useRef, useState } from 'react';
import { cargarAnalitica, marcarEvento } from '../lib/analiticaPlataforma';
import {
  AGENDA_HORARIO, AGENDA_URL, WHATSAPP_HORARIO, WHATSAPP_URL, WHATSAPP_VISIBLE,
} from '../lib/contactoPlataforma';
import Diagnostico from '../components/landing/Diagnostico';
import EscenaHero from '../components/landing/EscenaHero';
import CircuitoNegocio from '../components/landing/CircuitoNegocio';
import DicoBoton from '../components/landing/DicoBoton';
import { CLIENTES, FOTOS } from '../components/landing/clientes';
import useEntradas from '../components/landing/useEntradas';
import '../styles/plataforma-claro.css';
import '../styles/platform-landing.css';
import '../styles/diagnostico.css';

const TITULO = 'Dico — Todo tu negocio, en un solo lugar';
// <= 160 caracteres, lo que muestran los buscadores. Igual en api/og.js.
const DESCRIPCION = 'Ventas, costos, sueldos, stock, caja, pedidos y el resultado de cada día '
  + 'de tu gastronomía, comercio o servicio. Empezá con un diagnóstico, sin email.';

// Telefono, agenda y horarios: src/lib/contactoPlataforma.js.
const marcarWhatsApp = () => marcarEvento('whatsapp');
const marcarAgenda = () => marcarEvento('agenda');

/** Escribe el titulo y los meta de la raiz. El index.html del build lleva los
 *  del cliente que se horneo (clients/edificio), asi que sin esto la pestania de
 *  divianco.app dice el nombre de un restaurante. Los bots de vista previa no
 *  pasan por aca: a esos los atiende `api/og.js`. */
function useMetaDeLaPlataforma() {
  useEffect(() => {
    cargarAnalitica();
    document.title = TITULO;
    const set = (sel, attr, valor) => {
      const el = document.head.querySelector(sel);
      if (el) el.setAttribute(attr, valor);
    };
    set('meta[name="description"]', 'content', DESCRIPCION);
    set('meta[property="og:title"]', 'content', TITULO);
    set('meta[property="og:description"]', 'content', DESCRIPCION);

    // La landing es clara: color-scheme light para que la barra de scroll y
    // los controles nativos acompanien. Se devuelve el valor previo al salir.
    const raiz = document.documentElement;
    const esquemaPrevio = raiz.style.colorScheme;
    raiz.style.colorScheme = 'light';
    return () => { raiz.style.colorScheme = esquemaPrevio; };
  }, []);
}

export default function PlatformLanding() {
  useMetaDeLaPlataforma();
  const raizRef = useRef(null);
  const [diagnosticoAbierto, setDiagnosticoAbierto] = useState(false);
  const abrirRef = useRef(null);
  useEntradas(raizRef);

  // Los botones de mas abajo abren el mismo diagnostico, arriba.
  const abrirDiagnostico = (evento) => {
    marcarEvento('diagnostico-cta');
    abrirRef.current?.({ disparador: evento?.currentTarget });
  };

  return (
    <div className="pl-root" ref={raizRef}>
      {/* div y no main: App.jsx ya envuelve todas las rutas en
          <main id="main-content">, y un main adentro de otro rompe el landmark. */}
      <section className={`pl-hero pl-hero-tiempo${diagnosticoAbierto ? ' pl-hero-diagnostico' : ''}`} aria-label="Dico">
        <header className="pl-cabecera">
          <a className="pl-marca" href="/">
            <img src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" />
          </a>
          <a className="pl-enlace pl-cabecera-link" href="/entrar">Entrar</a>
        </header>
        <Diagnostico
          modo="home"
          nivel="h1"
          abrirRef={abrirRef}
          Portada={Portada}
          onAbiertoChange={setDiagnosticoAbierto}
          lado={<EscenaHero />}
        />
      </section>
      <CircuitoNegocio ocultarDico={diagnosticoAbierto} />
      <Rubros />
      <Clientes />
      <Planes onDiagnostico={abrirDiagnostico} />
      <Preguntas />
      <Cierre onDiagnostico={abrirDiagnostico} />
      <Pie />
    </div>
  );
}

/* ─────────────── La portada: la frase y el boton ─────────────── */

function Portada({ onAbrir }) {
  const alAbrir = (evento) => {
    marcarEvento('diagnostico-cta');
    onAbrir(evento);
  };
  return (
    <div className="pl-portada">
      <h1 className="pl-h1" data-tiempo-capa="0.33">
        <span>Tu tiempo vuelve</span>{' '}
        <span>a ser tuyo.</span>
      </h1>
      <div className="pl-tiempo-propuesta">
        <p className="pl-bajada">
          Dico simplifica la gestión de tu negocio para que tengas más tiempo para vos y los tuyos.
        </p>
        <div className="pl-acciones">
          <button type="button" className="pl-boton pl-hero-origen" data-abrir onClick={alAbrir}>
            <span className="pl-hero-etiqueta">Quiero Dico</span> <span className="pl-hero-burbuja" aria-hidden="true"><DicoBoton /></span>
          </button>
          <a className="pl-enlace" href="#que-hace">Qué hace Dico</a>
        </div>
        <p className="pl-hero-ayuda">Empezamos con un diagnóstico breve, sin email.</p>
      </div>
      <a className="pl-tiempo-credito" href="https://webflow.com/made-in-webflow/website/osmo-parallax-image-layers" target="_blank" rel="noreferrer">Escena: Osmo · CC0</a>
    </div>
  );
}

/* ─────────────── Lo que hace hoy cada rubro ─────────────── */

const HOY = 'Hoy';
const DESARROLLO = 'En desarrollo';

// De src/modules/registry.js: `implementado: true` es Hoy. Lo demas, en
// desarrollo (agenda de turnos y variantes estan en false). El resultado del
// dia (0103) es Hoy en los tres rubros; el costo de lo vendido sale solo de
// las recetas, asi que fuera de gastronomia el dia va sin el. Desde la 0104 (aplicada el 20/oct) completar un
// pedido descuenta la receta en gastronomia y el articulo sin receta en
// comercio y en los productos que vende un servicio. No existen: el minimo
// por articulo con aviso (min_stock es solo de insumos) y que un servicio
// descuente los insumos que usa.
const RUBROS = [
  {
    nombre: 'Gastronomía',
    filas: [
      ['Catálogo online y pedidos de salón, mostrador y delivery', HOY],
      ['Mesas y comandas del salón', HOY],
      ['Cocina en pantalla, por sector', HOY],
      ['Recetas con el costo de cada plato', HOY],
      ['Stock de insumos con compras, conteos y mínimo', HOY],
      ['Cada venta descuenta los insumos de su receta', HOY],
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
      ['Stock por artículo: cada venta lo descuenta', HOY],
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

function Rubros() {
  return (
    <section className="pl-seccion pl-rubros" id="rubros" aria-labelledby="pl-rubros-titulo">
      <span className="pl-ancla" id="modulos" aria-hidden="true" />
      <span className="pl-ancla" id="integraciones" aria-hidden="true" />
      <h2 id="pl-rubros-titulo" className="pl-h2 pl-rubros-titulo" data-reveal>Lo que hace hoy, por rubro</h2>
      <div className="pl-lista">
        {RUBROS.map((r, i) => (
          <div className="pl-lista-grupo" key={r.nombre} data-reveal={(i % 3) + 1}>
            <h3 className="pl-lista-grupo-nombre">{r.nombre}</h3>
            <ul>
              {r.filas.map(([que, estado]) => (
                <li className={`pl-lista-fila${estado === HOY ? '' : ' pendiente'}`} key={que}>
                  <span className="pl-lista-punto" aria-hidden="true" />
                  <span className="pl-lista-que">{que}</span>
                  <span className="pl-lista-estado">{estado}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="pl-lista-cierre" data-reveal>
          ¿Tu negocio necesita algo que está en desarrollo, o que no está en la
          lista? Lo desarrollamos con vos.{' '}
          <a className="pl-enlace" href={AGENDA_URL} target="_blank" rel="noreferrer" onClick={marcarAgenda}>
            Contanos qué necesitás
          </a>
        </p>
      </div>
    </section>
  );
}

/* ─────────────── Clientes: una tabla y sus productos ─────────────── */

function Clientes() {
  return (
    <section className="pl-seccion pl-clientes" aria-labelledby="pl-clientes-titulo">
      <h2 id="pl-clientes-titulo" className="pl-h2 pl-escalon" data-reveal>
        <span>Ya trabajan</span> <span className="pl-escalon-2">con Dico</span>
      </h2>
      <table className="pl-tabla" data-reveal="1">
        <caption className="pl-oculto">Negocios que usan Dico</caption>
        <thead>
          <tr><th scope="col">Negocio</th><th scope="col">Rubro</th><th scope="col">Lo que venden</th></tr>
        </thead>
        <tbody>
          {CLIENTES.map(([negocio, rubro, venden]) => (
            <tr key={negocio}>
              <th scope="row">{negocio}</th>
              <td>{rubro}</td>
              <td>{venden}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pl-fotos">
        {FOTOS.map((f, i) => (
          <figure className="pl-foto" key={f.src} data-reveal={(i % 3) + 1}>
            <span className="pl-foto-marco">
              <img src={f.src} alt={f.alt} width={f.ancho} height={f.alto} loading="lazy" />
            </span>
            <figcaption>{f.pie}, de {f.de}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ─────────────── Planes, como una carta ─────────────── */

// Los precios salen de la tabla `plans` del edificio (migracion 0052). El plan
// `total` queda afuera a proposito: esta modelado y marcado no disponible.
const PLANES = [
  {
    grupo: 'Para empezar',
    nombre: 'Digital',
    precio: 'Gratis',
    texto: 'Catálogo online con link propio, pedidos, caja y arqueo, stock, equipo y el resultado de cada día y de cada mes. En gastronomía, también recetas con costo y la ganancia neta de cada noche.',
  },
  {
    grupo: 'Un local',
    nombre: 'Local',
    precio: '$59.000',
    texto: 'Todo lo de Digital, con soporte por mail y chat, y lo que llega cuando salga: facturación ARCA.',
    anual: 'O $47.200 por mes pagando el año.',
  },
  {
    grupo: 'Varias sucursales',
    nombre: 'Cadena',
    precio: '$99.000',
    texto: 'Por local. Sucursales sin tope, consolidado y comparativa entre locales, roles por local y soporte por teléfono.',
    anual: 'O $79.200 por mes pagando el año.',
  },
];

function Planes({ onDiagnostico }) {
  return (
    <section className="pl-seccion pl-planes" id="precios" aria-labelledby="pl-planes-titulo">
      <div className="pl-planes-cab">
        <h2 id="pl-planes-titulo" className="pl-h2" data-reveal>Planes</h2>
        <figure className="pl-foto pl-planes-foto" data-reveal="1">
          <span className="pl-foto-marco">
            <img
              className="pl-deriva"
              src="/brand/landing/crazy-dulce-nebulosa.webp"
              alt="Cookie con chips de dulce de leche sobre una piedra oscura"
              width="900" height="900" loading="lazy"
            />
          </span>
          <figcaption>Dulce Nebulosa, de Crazy Miga</figcaption>
        </figure>
      </div>
      <div className="pl-carta" data-reveal="2">
        {PLANES.map((p) => (
          <div className="pl-carta-grupo" key={p.nombre}>
            <h3 className="pl-carta-item">
              <span>{p.nombre}</span>
              <span>{p.precio === 'Gratis' ? p.precio : `${p.precio} por mes`}</span>
            </h3>
            <p className="pl-carta-texto"><strong>{p.grupo}.</strong> {p.texto}</p>
            {p.anual && <p className="pl-carta-texto">{p.anual}</p>}
          </div>
        ))}
        <p className="pl-carta-nota">
          Precios en pesos, por local, sin IVA. Sin cargo por usuario ni por
          pedido. La cuenta empieza gratis y sin tarjeta.{' '}
          <button type="button" className="pl-enlace pl-enlace-boton" onClick={onDiagnostico}>
            El diagnóstico te dice cuál te conviene
          </button>
          , o <a className="pl-enlace" href="/registro">probá gratis sin diagnóstico</a>.
        </p>
      </div>
    </section>
  );
}

/* ─────────────── Preguntas, como texto de lectura ─────────────── */

const FAQ = [
  {
    p: '¿Qué es el diagnóstico?',
    r: 'Son unas pocas preguntas sobre tu negocio: el rubro, lo que más te preocupa, '
      + 'los canales, el tamaño, cómo lo controlás hoy, para cuándo lo querés y cuánto '
      + 'pensás invertir. Con eso Dico te dice qué resolver primero, cómo lo resuelve y '
      + 'qué plan te conviene. No pide email ni tarjeta.',
  },
  {
    p: '¿Qué pasa si se cae el sistema en pleno servicio?',
    r: 'Te lo digo derecho: hoy no hay modo offline. Si se cae la conexión o el '
      + 'servicio, no vas a poder cargar pedidos hasta que vuelva. No es algo que '
      + 'pase seguido, pero prometerte que seguís cobrando sin internet sería '
      + 'mentirte. El modo offline está en la lista de lo que falta.',
  },
  {
    p: '¿Puedo migrar desde el sistema que uso hoy?',
    r: 'Sí. El catálogo, el stock y los clientes los importamos si los tenés '
      + 'digitalizados. Las recetas y el equipo se cargan una vez, y ahí se va '
      + 'el grueso del tiempo.',
  },
  {
    p: 'No entiendo nada de tecnología. ¿Igual lo puedo usar?',
    r: 'Por eso la puesta en marcha la hacemos juntos: te muestro cada módulo y '
      + 'lo practicás con tus propios datos. Después es cargar pedidos y mirar '
      + 'el número. Si algo no se entiende, WhatsApp.',
    whatsapp: true,
  },
  {
    p: '¿Cuánto tarda la puesta en marcha?',
    r: 'Crear la cuenta y tener el catálogo online es cuestión de minutos, y eso '
      + 'lo hacés solo. Dejarlo completo, con recetas costeadas, equipo y '
      + 'horarios cargados, es un par de horas conmigo.',
  },
  {
    p: '¿Y si mi negocio necesita algo que Dico no hace?',
    r: 'Contanos qué es. Lo que está en desarrollo, como la agenda de turnos o '
      + 'los talles y colores, se puede adelantar para tu negocio, y lo que no '
      + 'está en la lista lo desarrollamos con vos.',
  },
  {
    p: '¿Y si abro una segunda sucursal?',
    r: 'Pasás al plan Cadena cuando quieras, sin penalidad. Cada local tiene su '
      + 'resultado y sus roles, y arriba ves el consolidado.',
  },
  {
    p: 'Si dejo de pagar, ¿pierdo mis datos?',
    r: 'No se borran. Perdés el acceso hasta que retomes, y cuando volvés está '
      + 'todo donde lo dejaste.',
  },
  {
    p: '¿Sirve con mi caja registradora vieja?',
    r: 'Si es una máquina mecánica, no se conecta. Dico trae su propia caja, con '
      + 'efectivo, tarjeta y MercadoPago, y el arqueo al cerrar.',
  },
  {
    p: '¿Quién ve qué adentro de mi negocio?',
    r: 'Cada rol ve lo suyo: un mozo o un vendedor no ve el resultado ni los '
      + 'sueldos. Y un negocio nunca ve los números de otro: eso lo separa la '
      + 'base de datos, no una pantalla.',
  },
];

function Preguntas() {
  return (
    <section className="pl-seccion pl-preguntas" id="preguntas" aria-labelledby="pl-preguntas-titulo">
      <span className="pl-ancla" id="seguridad" aria-hidden="true" />
      <h2 id="pl-preguntas-titulo" className="pl-h2 pl-preguntas-titulo" data-reveal>Preguntas</h2>
      <div className="pl-lectura-texto" data-reveal="1">
        {FAQ.map((f) => (
          <p className="pl-respuesta" key={f.p}>
            <strong>{f.p}</strong>{' '}
            {f.r}
            {f.whatsapp && (
              <>
                {' '}
                <a className="pl-enlace" href={WHATSAPP_URL} target="_blank" rel="noreferrer" onClick={marcarWhatsApp}>
                  Escribime al {WHATSAPP_VISIBLE}
                </a>
                , {WHATSAPP_HORARIO}.
              </>
            )}
          </p>
        ))}
      </div>
    </section>
  );
}

/* ─────────────── Cierre: una frase y el boton ─────────────── */

function Cierre({ onDiagnostico }) {
  return (
    <section className="pl-seccion pl-cierre" id="contacto" aria-label="Empezar">
      <div className="pl-cierre-dentro" data-reveal>
        <p className="pl-cierre-frase">
          Unas pocas preguntas, sin email, y sabés qué resolver primero en tu negocio.
        </p>
        <div className="pl-acciones">
          <button type="button" className="pl-boton" onClick={onDiagnostico}>Quiero Dico</button>
          <a className="pl-enlace" href={AGENDA_URL} target="_blank" rel="noreferrer" onClick={marcarAgenda}>
            Agendá una reunión
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Pie: una linea ─────────────── */

function Pie() {
  return (
    <footer className="pl-pie">
      <p className="pl-pie-que">Dico, de Grupo Divianco. Buenos Aires.</p>
      <p className="pl-pie-links">
        <a className="pl-enlace" href={WHATSAPP_URL} target="_blank" rel="noreferrer" onClick={marcarWhatsApp}>
          WhatsApp {WHATSAPP_VISIBLE}
        </a>
        <a className="pl-enlace" href={AGENDA_URL} target="_blank" rel="noreferrer" onClick={marcarAgenda}>
          Reuniones {AGENDA_HORARIO}
        </a>
        <a className="pl-enlace" href="mailto:hola@divianco.app">hola@divianco.app</a>
        <a className="pl-enlace" href="/registro">Probar gratis</a>
        <a className="pl-enlace" href="/entrar">Entrar</a>
      </p>
      <p className="pl-pie-legal">
        © {new Date().getFullYear()} Grupo Divianco. Fotos: productos de La Nona Pato y Crazy Miga.
      </p>
    </footer>
  );
}
