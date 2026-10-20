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
// el codigo el 19/oct: el resultado es MENSUAL, el costo laboral es POR DIA,
// el stock se mueve con compras, merma y conteos (en gastronomia, ademas, la
// venta descuenta los insumos de la receta desde la 0104) y avisa
// en el panel, y el salon es solo de gastronomia.
//
// V3 (20/oct/2026, rama landing/rediseno). La home ES el embudo: la frase de
// valor y un boton que abre el diagnostico en la misma pagina, en la misma
// columna (src/components/landing/Diagnostico.jsx). Lo que explica el sistema
// queda debajo, para quien quiere leer.
//
// Direccion de design-taste-frontend: `quiet-instrument` (seed 2118221348).
// Columna angosta, la frase como unica cosa grande, demostraciones chicas y
// exactas, mucho aire compuesto. Idea: lo que Dico lee de tu negocio se
// imprime en un instrumento al lado de la columna: el resultado del mes en la
// portada, tus respuestas durante el diagnostico, la pieza que resuelve tu
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
import { desafiosDe } from '../lib/diagnostico';
import Diagnostico, { PREGUNTAS } from '../components/landing/Diagnostico';
import { PiezaResultado } from '../components/landing/Piezas';
import { CLIENTES, FOTOS } from '../components/landing/clientes';
import useEntradas from '../components/landing/useEntradas';
import '../styles/plataforma-claro.css';
import '../styles/platform-landing.css';
import '../styles/diagnostico.css';

const TITULO = 'Dico — Todo tu negocio, en un solo lugar';
const DESCRIPCION = 'Ventas, costos, sueldos, stock, caja y pedidos de tu gastronomía, '
  + `comercio o servicio, en un solo lugar. Empezá con un diagnóstico de ${PREGUNTAS} preguntas, sin email.`;

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
  const abrirRef = useRef(null);
  useEntradas(raizRef);

  // Los botones de mas abajo abren el mismo diagnostico, arriba.
  const abrirDiagnostico = () => {
    marcarEvento('diagnostico-cta');
    abrirRef.current?.();
  };

  return (
    <div className="pl-root" ref={raizRef}>
      {/* div y no main: App.jsx ya envuelve todas las rutas en
          <main id="main-content">, y un main adentro de otro rompe el landmark. */}
      <section className="pl-hero" aria-label="Dico">
        <header className="pl-cabecera">
          <a className="pl-marca" href="/">
            <img src="/brand/dico/logo/dico-claro.png" alt="Dico" width="1368" height="452" />
          </a>
          <a className="pl-enlace pl-cabecera-link" href="/entrar">Entrar</a>
        </header>
        <Diagnostico
          modo="home"
          nivel="h2"
          abrirRef={abrirRef}
          Portada={Portada}
          lado={(
            <div className="pl-instrumento">
              <PiezaResultado />
              <p className="pl-instrumento-nota">Un mes de ejemplo. Elegí el rubro y mirá cómo cierra la cuenta.</p>
            </div>
          )}
        />
      </section>
      <QueHace />
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
  const alAbrir = () => {
    marcarEvento('diagnostico-cta');
    onAbrir();
  };
  return (
    <div className="pl-portada">
      <h1 className="pl-h1 pl-lineas">
        <span className="pl-linea"><span className="pl-linea-in">Todo tu negocio,</span></span>{' '}
        <span className="pl-linea"><span className="pl-linea-in pl-linea-2">en un solo lugar.</span></span>
      </h1>
      <p className="pl-bajada pl-sigue">
        Ventas, costos, sueldos, stock, caja y pedidos: cada variable de tu
        gastronomía, comercio o servicio, cubierta en Dico. Lo que todavía no
        hace, lo desarrollamos con vos.
      </p>
      <div className="pl-guia pl-sigue">
        <img src="/brand/dico/dico-2d-question.png" alt="" width="256" height="256" />
        <p className="pl-dico-dice">
          Te hago {PREGUNTAS} preguntas, sin email, y te digo por dónde empezar.
        </p>
      </div>
      <div className="pl-acciones pl-sigue">
        <button type="button" className="pl-boton" data-abrir onClick={alAbrir}>
          Hacer mi diagnóstico
        </button>
        <a className="pl-enlace" href="#que-hace">Qué hace Dico</a>
      </div>
    </div>
  );
}

/* ─────────────── Que hace Dico: tu dolor y la parte que lo resuelve ─────────────── */

// Cada nota es un dolor tal como lo dice el duenio (la lib del diagnostico)
// y, al lado, la parte del panel de Dico que lo resuelve. El panel es de un
// restaurante de ejemplo; las cifras cierran con las de Piezas.jsx.
const dolor = (vertical, id) => desafiosDe(vertical).find((d) => d.id === id)?.label;

const PARTES = [
  {
    id: 'pedidos',
    dolor: dolor('gastronomia', 'pedidos'),
    nota: 'Salón, mostrador y catálogo online entran al mismo panel, con su estado y su cobro.',
    titulo: 'Pedidos de hoy',
    meta: '48 pedidos',
    filas: [['Salón · mesa 6', '$38.400'], ['Mostrador', '$12.900'], ['Catálogo online', '$27.600']],
  },
  {
    id: 'costos',
    dolor: dolor('gastronomia', 'costos'),
    nota: 'Cargás la receta una vez. Cuando sube un insumo, Dico recalcula el plato y te dice cuánto te deja.',
    titulo: 'Bife de chorizo con papas',
    meta: 'Precio $18.000',
    filas: [['Insumos', '$5.100'], ['Mano de obra', '$2.775']],
    cifra: ['Te deja', '$10.125'],
  },
  {
    id: 'costo_laboral',
    dolor: dolor('gastronomia', 'costo_laboral'),
    nota: 'El equipo ficha entrada y salida, y ves qué parte de la venta de cada día se fue en sueldos.',
    titulo: 'Martes 14',
    meta: '24 h fichadas',
    filas: [['Ventas del día', '$490.000'], ['Personal', '$186.000']],
    cifra: ['Personal sobre venta', '38 %'],
  },
  {
    id: 'stock',
    dolor: dolor('comercio', 'stock'),
    nota: 'Cargás compras, merma y conteos. Lo que queda debajo del mínimo te lo marca el panel.',
    titulo: 'Stock',
    meta: 'Con la última compra',
    filas: [['Harina 000', '6 kg · mínimo 10'], ['Muzzarella', '8,4 kg · mínimo 5']],
  },
  {
    id: 'mermas_caja',
    dolor: dolor('gastronomia', 'mermas_caja'),
    nota: 'La merma queda asentada y el arqueo compara lo declarado con lo registrado, medio por medio.',
    titulo: 'Arqueo del viernes',
    meta: 'Efectivo',
    filas: [['Declarado', '$412.000'], ['Registrado', '$418.500']],
    cifra: ['Diferencia', '−$6.500'],
  },
  {
    id: 'rentabilidad',
    dolor: dolor('gastronomia', 'rentabilidad'),
    nota: 'Ventas, costo según tus recetas y gastos: el resultado del mes se arma solo.',
    titulo: 'Resultado de septiembre',
    meta: '20,0 % de la venta',
    filas: [['Ventas', '$42.600.000'], ['Costo y gastos', '−$34.080.000']],
    cifra: ['Resultado', '$8.520.000'],
  },
];

function QueHace() {
  const [activa, setActiva] = useState(null);

  return (
    <section className="pl-seccion pl-que-hace" id="que-hace" aria-labelledby="pl-que-hace-titulo">
      <div className="pl-plancha">
        <h2 id="pl-que-hace-titulo" className="pl-h2 pl-plancha-titulo" data-reveal>Qué hace Dico</h2>
        <p className="pl-nota-texto pl-plancha-intro" data-reveal="1">
          Cada dolor, al lado de la parte del panel que lo resuelve. Es un
          restaurante de ejemplo.
        </p>
        <div className="pl-plancha-tapa pl-pieza" data-ui aria-hidden="true">
          <span className="pl-pieza-titulo">Panel de Dico</span>
          <span className="pl-pieza-meta">Gastronomía</span>
        </div>
        {PARTES.map((p, i) => (
          <PartePlancha
            key={p.id}
            parte={p}
            indice={i}
            activa={activa === p.id}
            onActivar={(on) => setActiva(on ? p.id : null)}
          />
        ))}
      </div>
    </section>
  );
}

function PartePlancha({ parte, indice, activa, onActivar }) {
  const ultima = indice === PARTES.length - 1;
  const lado = indice % 2 === 0 ? 'izq' : 'der';
  return (
    <>
      <div
        className={`pl-plancha-parte pl-pieza pl-r${indice + 2}${ultima ? ' ultima' : ''}${activa ? ' activa' : ''}`}
        data-ui
        role="figure"
        aria-label={`Ejemplo: ${parte.titulo}`}
      >
        <div className="pl-pieza-cab">
          <span className="pl-pieza-titulo">{parte.titulo}</span>
          <span className="pl-pieza-meta">{parte.meta}</span>
        </div>
        <dl className="pl-filas">
          {parte.filas.map(([a, b]) => (
            <div className="pl-fila" key={a}><dt>{a}</dt><dd>{b}</dd></div>
          ))}
        </dl>
        {parte.cifra && (
          <p className="pl-plancha-cifra">
            <span>{parte.cifra[0]}</span>
            <span className={parte.id === 'mermas_caja' ? 'pl-error' : 'pl-oro'}>{parte.cifra[1]}</span>
          </p>
        )}
      </div>
      <div
        className={`pl-nota pl-nota-${lado} pl-r${indice + 2}`}
        data-reveal
        onPointerEnter={() => onActivar(true)}
        onPointerLeave={() => onActivar(false)}
      >
        <h3 className="pl-nota-nombre">{parte.dolor}</h3>
        <p className="pl-nota-texto">{parte.nota}</p>
      </div>
    </>
  );
}

/* ─────────────── Lo que hace hoy cada rubro ─────────────── */

const HOY = 'Hoy';
const DESARROLLO = 'En desarrollo';

// De src/modules/registry.js: `implementado: true` es Hoy. Lo demas, en
// desarrollo (agenda de turnos y variantes estan en false; el resultado del
// dia no existe todavia). En gastronomia la venta descuenta los insumos de la
// receta desde la 0104 (aplicada el 20/oct); en comercio y servicios no.
const RUBROS = [
  {
    nombre: 'Gastronomía',
    filas: [
      ['Catálogo online y pedidos de salón, mostrador y delivery', HOY],
      ['Mesas y comandas del salón', HOY],
      ['Cocina en pantalla, por sector', HOY],
      ['Recetas con el costo de cada plato', HOY],
      ['Stock con compras, merma y conteos', HOY],
      ['Caja y arqueo por medio de pago', HOY],
      ['Fichaje y costo del personal por día', HOY],
      ['Gastos y resultado del mes', HOY],
      ['Cada venta descuenta los insumos de su receta', HOY],
      ['Resultado del día, con nómina y merma', DESARROLLO],
    ],
  },
  {
    nombre: 'Comercio',
    filas: [
      ['Catálogo online y pedidos de mostrador', HOY],
      ['Stock por artículo, con mínimo', HOY],
      ['Caja y arqueo por medio de pago', HOY],
      ['Fichaje y costo del personal por día', HOY],
      ['Compras, gastos y resultado del mes', HOY],
      ['Talles y colores por artículo', DESARROLLO],
      ['Stock que baja solo con cada venta', DESARROLLO],
    ],
  },
  {
    nombre: 'Servicios',
    filas: [
      ['Catálogo de servicios online, con precio', HOY],
      ['Ventas y cobros de cada servicio', HOY],
      ['Caja y arqueo por medio de pago', HOY],
      ['Stock de insumos, con mínimo', HOY],
      ['Fichaje y costo del personal por día', HOY],
      ['Gastos y resultado del mes', HOY],
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
    texto: 'Catálogo online con link propio, pedidos, caja y arqueo, stock, equipo y el resultado de cada mes. En gastronomía, también recetas con costo.',
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
          .
        </p>
      </div>
    </section>
  );
}

/* ─────────────── Preguntas, como texto de lectura ─────────────── */

const FAQ = [
  {
    p: '¿Qué es el diagnóstico?',
    r: `Son ${PREGUNTAS} preguntas sobre tu negocio: el rubro, lo que más te preocupa, `
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
    <section className="pl-seccion pl-cierre" aria-label="Empezar">
      <div className="pl-cierre-dentro" data-reveal>
        <p className="pl-cierre-frase">
          {PREGUNTAS} preguntas, sin email, y sabés qué resolver primero en tu negocio.
        </p>
        <div className="pl-acciones">
          <button type="button" className="pl-boton" onClick={onDiagnostico}>Hacer mi diagnóstico</button>
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
        <a className="pl-enlace" href="/entrar">Entrar</a>
      </p>
      <p className="pl-pie-legal">
        © {new Date().getFullYear()} Grupo Divianco. Fotos: productos de La Nona Pato y Crazy Miga.
      </p>
    </footer>
  );
}
