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
//
// REDISENO (17/oct/2026, rama landing/rediseno): direccion "la frase es el
// layout" de design-taste-frontend. La idea: la ganancia neta del cierre de
// caja es la palabra que falta en la frase. El titular lleva adentro, en el
// lugar de una palabra, la ficha del cierre del viernes ($2.360 neto). Lo
// vivo de la pagina es la cuenta de la seccion #cuenta: el visitante escribe
// cuanto vendio y ve insumos, nomina, merma y ganancia neta.
//
// Primero el alta, despues la reunion: la accion principal en toda la pagina
// es "Probar gratis" (/registro) y la secundaria "Agendá una reunión" (Cal.com).
//
// PRUEBA SOCIAL: solo nombres y fotos reales de productos de clientes que
// corren sobre Dico (La Nona Pato y Crazy Miga). Sin cifras de
// resultados: no hay datos firmes. Cada foto lleva el nombre del negocio al
// pie y nunca se presenta como "un plato de ejemplo de Dico".

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cargarAnalitica, marcarEvento } from '../lib/analiticaPlataforma';
import {
  AGENDA_HORARIO, AGENDA_URL, WHATSAPP_HORARIO, WHATSAPP_URL,
  WHATSAPP_VISIBLE, WHATSAPP_VISIBLE_PARTES,
} from '../lib/contactoPlataforma';
import '../styles/platform-landing.css';

const TITULO = 'Dico — Sabé cuánto ganás, no solo cuánto vendés';
const DESCRIPCION = 'El sistema de gestión para restaurantes, parrillas, cafés y '
  + 'cocinas de delivery que te muestra la ganancia real de cada plato, cada '
  + 'turno y cada noche. Recetas con costo, nómina por hora y P&L en tiempo real.';

// Telefono, agenda y horarios: src/lib/contactoPlataforma.js.
const marcarWhatsApp = () => marcarEvento('whatsapp');
const marcarAgenda = () => marcarEvento('agenda');

const pesos = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;
const porcentaje = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

// ── La noche del viernes ──
// Es la misma noche en toda la pagina: la ficha del titular y el estado
// inicial de la cuenta. Con estos porcentajes, $4.200 de venta dan
// 1.050 + 650 + 140 = 1.840 de costos y 2.360 de ganancia neta, los mismos
// numeros que la ficha del titular.
const VIERNES = { venta: 4200, insumos: '25', nomina: '15,48', merma: '3,33' };

const EJEMPLOS = [
  { nombre: 'Un martes flojo', venta: 1900 },
  { nombre: 'El viernes', venta: 4200 },
  { nombre: 'Un sábado lleno', venta: 7800 },
];

// Modulos activos: una banda por modulo. La consecuencia con cifras sale de
// los ejemplos que la pagina ya usaba (bife, martes, merma, cierre); donde no
// hay cifra, se dice lo que hace sin inventar una.
const MODULOS = [
  {
    id: 'catalogo',
    nombre: 'Catálogo público',
    frase: 'Tu carta online, con QR en cada mesa.',
    consecuencia: 'Queda en tu-nombre.divianco.app. El pedido lo hace el cliente '
      + 'desde el QR o lo carga el mozo, y aparece en el mismo lugar.',
  },
  {
    id: 'salon',
    nombre: 'Pedidos y salón',
    frase: 'El salón entero, mesa por mesa.',
    consecuencia: 'Mapa de mesas, comandas, estado de cada mesa y pedidos para '
      + 'llevar. Cuando la cocina marca listo, el salón se entera.',
  },
  {
    id: 'caja',
    nombre: 'Caja y arqueo',
    frase: 'La caja que te muestra la diferencia.',
    consecuencia: 'Efectivo, tarjeta o MercadoPago. Al cierre, el arqueo compara '
      + 'lo declarado con lo registrado y la diferencia aparece sola.',
  },
  {
    id: 'recetas',
    nombre: 'Recetas con costo real',
    frase: 'El costo de cada plato, siempre al día.',
    consecuencia: 'Bife de chorizo a $1.200: insumos $340, hora de trabajo $185. '
      + 'Te deja $675. Si el proveedor sube, el costo se recalcula solo.',
  },
  {
    id: 'stock',
    nombre: 'Stock y compras',
    frase: 'El stock que baja con cada venta.',
    consecuencia: 'Esta semana tiraste $1.200, casi el triple del promedio del '
      + 'mes, casi todo en verdulería. Y te avisa antes de que algo falte.',
  },
  {
    id: 'equipo',
    nombre: 'Equipo y horarios',
    frase: 'Las horas fichadas, contra lo vendido.',
    consecuencia: 'Martes de 14 a 17: vendiste $4.900 y la nómina fue $1.850. '
      + 'Es el 38 % de la venta: ese turno no paga.',
  },
  {
    id: 'pl',
    nombre: 'Reportes y P&L',
    frase: 'La ganancia de la noche, al cerrar.',
    consecuencia: 'Viernes: ventas $4.200, insumos $1.050, nómina $650, merma '
      + '$140. Ganancia neta $2.360, esa misma noche y no a fin de mes.',
  },
];

const ENCENDIDOS_AL_CARGAR = ['recetas', 'equipo'];

// Las preguntas de siempre, mas dos de seguridad resumidas.
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
    r: 'Por eso la puesta en marcha la hacemos juntos. Te muestro cada módulo y '
      + 'lo practicás con tus propios datos. Después es cargar pedidos y mirar '
      + 'el número al cierre. Si algo no se entiende, WhatsApp.',
    whatsapp: true,
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
  {
    p: '¿Quién ve qué adentro de mi local?',
    r: 'Cada rol ve lo suyo. Un mozo no ve el P&L ni la nómina; un cocinero no '
      + 've el precio de venta ni el costo. No es una pantalla escondida: el '
      + 'permiso se aplica en la base de datos, así que tampoco se llega por '
      + 'otro lado.',
  },
  {
    p: '¿Otro negocio puede ver mis números?',
    r: 'No. Un negocio no ve al otro: cada local es un inquilino separado con '
      + 'seguridad por fila. Si tenés dos sucursales, cada una ve su data, y si '
      + 'sumás un contador, ve reportes sin ver la operación.',
  },
];

// Los precios salen de la tabla `plans` del edificio (migracion 0052). El plan
// `total` queda afuera a proposito: esta modelado y marcado no disponible.
const PLANES = [
  {
    id: 'digital',
    nombre: 'Digital',
    mensual: 0,
    texto: 'Todo el sistema, sin pagar: catálogo público con link propio, '
      + 'pedidos, caja y arqueo, recetas con costo y margen, stock e insumos, '
      + 'equipo con costo por hora y P&L con números reales.',
    accion: 'Empezar con Digital',
  },
  {
    id: 'local',
    nombre: 'Local',
    mensual: 59000,
    anual: 47200,
    texto: 'Un local, con todo lo del plan Digital y lo que llega: facturación '
      + 'ARCA y cocina en pantalla cuando salgan. Soporte por mail y chat.',
    accion: 'Hablar del plan Local',
  },
  {
    id: 'cadena',
    nombre: 'Cadena',
    mensual: 99000,
    anual: 79200,
    texto: 'Todo lo del plan Local, con sucursales sin tope, consolidado y '
      + 'comparativa entre locales, roles por local y soporte por teléfono.',
    accion: 'Hablar del plan Cadena',
  },
];

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

    // La landing es oscura aunque el resto de la app no lo sea: con
    // color-scheme dark la barra de scroll, el autocompletado y los controles
    // nativos no aparecen claros. Se devuelve el valor previo al desmontar.
    const raiz = document.documentElement;
    const esquemaPrevio = raiz.style.colorScheme;
    raiz.style.colorScheme = 'dark';
    return () => { raiz.style.colorScheme = esquemaPrevio; };
  }, []);
}

const sinMovimiento = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Entradas por seccion: cada [data-reveal] entra una sola vez cuando aparece.
 *  El estado oculto solo existe bajo .pl-anim, que se pone aca: sin script,
 *  sin IntersectionObserver o con movimiento reducido, todo esta a la vista. */
function useEntradas(raizRef) {
  // useLayoutEffect: la clase entra antes del primer pintado, asi el titular
  // no aparece entero y despues desaparece para animarse.
  useLayoutEffect(() => {
    const raiz = raizRef.current;
    if (!raiz || sinMovimiento() || typeof IntersectionObserver === 'undefined') return undefined;
    raiz.classList.add('pl-anim');
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    raiz.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [raizRef]);
}

export default function PlatformLanding() {
  useMetaDeLaPlataforma();
  const raizRef = useRef(null);
  useEntradas(raizRef);

  return (
    <div className="pl-root" ref={raizRef}>
      {/* div y no main: App.jsx ya envuelve todas las rutas en
          <main id="main-content">, y un main adentro de otro rompe el landmark. */}
      <Hero />
      <Intro />
      <Cuenta />
      <Tramos />
      <Clientes />
      <Modulos />
      <Planes />
      <Preguntas />
      <Cierre />
      <Pie />
    </div>
  );
}

/* ─────────────── 1. Hero: la frase con la ficha adentro ─────────────── */

function Hero() {
  return (
    <section className="pl-hero" aria-labelledby="pl-hero-titulo">
      <header className="pl-cabecera">
        <a className="pl-marca" href="/">
          <img src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" />
        </a>
        <nav className="pl-cabecera-links" aria-label="Principal">
          <a className="pl-enlace" href="#precios">Precios</a>
          <a className="pl-enlace" href="/entrar">Entrar</a>
        </nav>
      </header>

      <div className="pl-hero-centro">
        <h1 id="pl-hero-titulo" className="pl-frase">
          <span className="pl-frase-palabras">Sabé cuánto</span>{' '}
          <FichaCierre />{' '}
          <span className="pl-frase-palabras">ganás.</span>
        </h1>
        <div className="pl-acciones">
          <a className="pl-boton" href="/registro">Probar gratis</a>
          <a className="pl-enlace" href={AGENDA_URL} target="_blank" rel="noreferrer" onClick={marcarAgenda}>
            Agendá una reunión
          </a>
        </div>
      </div>

      <p className="pl-hero-apoyo">
        Dico junta la receta con costo, las horas del equipo y la merma, y al
        cerrar la caja te da la ganancia neta de esa noche.
      </p>
    </section>
  );
}

/* La ficha no es una captura: es el cierre de caja de Dico en miniatura, con
   los numeros del viernes. Ocupa el lugar de una palabra del titular y es
   aria-hidden: el titular se lee "Sabé cuánto ganás." y la bajada dice lo que
   la ficha muestra. */
function FichaCierre() {
  // "resumen" junta los tres costos para los anchos donde no entran los tres
  // (la cuenta tiene que cerrar a cualquier ancho: 4.200 − 1.840 = 2.360).
  const filas = [
    ['Ventas', '$4.200', ''],
    ['Insumos', '−$1.050', ' pl-ficha-detalle'],
    ['Nómina', '−$650', ' pl-ficha-detalle'],
    ['Merma', '−$140', ' pl-ficha-detalle'],
    ['Costos', '−$1.840', ' pl-ficha-resumen'],
  ];
  return (
    <span className="pl-ficha" data-ui aria-hidden="true">
      <span className="pl-ficha-in">
        <span className="pl-ficha-cab">Cierre de caja · viernes</span>
        {filas.map(([concepto, valor, clase]) => (
          <span className={`pl-ficha-fila${clase}`} key={concepto}>
            <span className="pl-ficha-concepto">{concepto}</span>
            <span className="pl-ficha-valor">{valor}</span>
          </span>
        ))}
        <span className="pl-ficha-fila pl-ficha-neto">
          <span className="pl-ficha-concepto">Ganancia neta</span>
          <span className="pl-ficha-valor">$2.360</span>
        </span>
      </span>
    </span>
  );
}

/* ─────────────── 2. Intro: la frase fija y las fotos que pasan ─────────────── */

function Intro() {
  return (
    <section className="pl-intro" aria-label="Vender no es ganar">
      <div className="pl-intro-fija">
        <p className="pl-intro-frase" data-reveal>
          Vendiste $10.000. ¿Cuánto te quedó después de insumos, sueldos y lo
          que se tiró?
        </p>
      </div>
      <div className="pl-intro-fotos">
        <figure className="pl-foto pl-foto-retrato" data-reveal>
          <img
            src="/brand/landing/crazy-orbita-blanca.webp"
            alt="Cookie con chips de chocolate blanco sobre una piedra oscura"
            width="900" height="900" loading="lazy"
          />
          <figcaption>Órbita Blanca, de Crazy Miga</figcaption>
        </figure>
        <figure className="pl-foto pl-foto-apaisada" data-reveal>
          <span className="pl-foto-marco">
            <img
              className="pl-foto-lenta"
              src="/brand/landing/lnp-picada.webp"
              alt="Tabla de picada con fiambres, quesos, aceitunas y palta"
              width="789" height="374" loading="lazy"
            />
          </span>
          <figcaption>Picada de La Nona Pato</figcaption>
        </figure>
        <figure className="pl-foto pl-foto-cuadrada" data-reveal>
          <img
            src="/brand/landing/lnp-empanadas.webp"
            alt="Fuente blanca con empanadas horneadas sobre una tabla de madera"
            width="789" height="374" loading="lazy"
          />
          <figcaption>Empanadas de La Nona Pato</figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ─────────────── 3. La cuenta: lo vivo de la pagina ─────────────── */

const numeroDe = (texto) => {
  const n = parseFloat(String(texto).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
};

const CONCEPTOS = [
  { id: 'insumos', nombre: 'Insumos' },
  { id: 'nomina', nombre: 'Nómina' },
  { id: 'merma', nombre: 'Merma' },
];

function Cuenta() {
  const [venta, setVenta] = useState(VIERNES.venta);
  const [pct, setPct] = useState({
    insumos: VIERNES.insumos, nomina: VIERNES.nomina, merma: VIERNES.merma,
  });

  const costos = CONCEPTOS.map((c) => ({
    ...c, pct: numeroDe(pct[c.id]), monto: Math.round((venta * numeroDe(pct[c.id])) / 100),
  }));
  const neto = venta - costos.reduce((s, c) => s + c.monto, 0);
  const margen = venta > 0 ? (neto / venta) * 100 : 0;
  const nomina = costos.find((c) => c.id === 'nomina');

  let aviso = null;
  if (venta > 0 && neto < 0) aviso = 'Esa noche perdiste plata: los costos superan la venta.';
  else if (nomina.pct > 30) aviso = `La nómina se lleva el ${porcentaje(nomina.pct)} % de la venta. Arriba del 30 %, ese turno no paga.`;

  const cambiarVenta = (e) => {
    const digitos = e.target.value.replace(/\D/g, '').slice(0, 9);
    setVenta(digitos ? Number(digitos) : 0);
  };

  return (
    <section className="pl-cuenta" id="cuenta" aria-labelledby="pl-cuenta-titulo">
      <h2 id="pl-cuenta-titulo" className="pl-cuenta-linea" data-reveal>
        <label htmlFor="pl-venta">Vendí $</label>
        <input
          id="pl-venta"
          className="pl-cuenta-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={venta ? venta.toLocaleString('es-AR') : ''}
          placeholder="0"
          onChange={cambiarVenta}
        />
      </h2>

      <div className="pl-cuenta-cuerpo">
        <div className="pl-cierre-ui" data-ui data-reveal>
          <table className="pl-cierre-tabla">
            <caption>Cierre de la noche</caption>
            <tbody>
              <tr>
                <th scope="row">Ventas</th>
                <td />
                <td className="pl-cierre-monto">{pesos(venta)}</td>
              </tr>
              {costos.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.nombre}</th>
                  <td className="pl-cierre-pct">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Porcentaje de ${c.nombre.toLowerCase()} sobre la venta`}
                      value={pct[c.id]}
                      onChange={(e) => setPct((p) => ({ ...p, [c.id]: e.target.value.replace(/[^\d.,]/g, '').slice(0, 5) }))}
                    />
                    <span aria-hidden="true">%</span>
                  </td>
                  <td className="pl-cierre-monto">−{pesos(c.monto)}</td>
                </tr>
              ))}
              <tr className={`pl-cierre-neto${neto < 0 ? ' negativo' : ''}`}>
                <th scope="row">Ganancia neta</th>
                <td className="pl-cierre-margen">{porcentaje(margen)} %</td>
                <td className="pl-cierre-monto" aria-live="polite">{neto < 0 ? `−${pesos(-neto)}` : pesos(neto)}</td>
              </tr>
            </tbody>
          </table>
          <div aria-live="polite">
            {aviso && (
              <p className="pl-cierre-aviso">
                <img src="/brand/dico/dico-2d-neutral.png" alt="" width="256" height="256" />
                {aviso}
              </p>
            )}
          </div>
        </div>

        <div className="pl-cuenta-lado">
          <p className="pl-cuenta-nota" data-reveal>
            Escribí cuánto vendiste en una noche y mirá lo que queda. Los
            porcentajes son de ejemplo y se pueden cambiar: en Dico salen de
            tus recetas y de las horas que fichó tu equipo.
          </p>
          <div className="pl-cuenta-ejemplos" data-reveal>
            {EJEMPLOS.map((e) => (
              <button
                key={e.nombre}
                type="button"
                className="pl-ejemplo"
                aria-pressed={venta === e.venta}
                onClick={() => setVenta(e.venta)}
              >
                {e.nombre}: {pesos(e.venta)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── 4. Cuanto lleva: las etapas como una barra ─────────────── */

function Tramos() {
  return (
    <section className="pl-tramos" id="como" aria-labelledby="pl-tramos-titulo">
      <h2 id="pl-tramos-titulo" className="pl-titulo" data-reveal>Lo que lleva empezar</h2>
      <ol className="pl-barra" data-ui>
        <li className="pl-tramo pl-tramo-minutos" data-reveal>
          <span className="pl-tramo-bloque"><span className="pl-tramo-dur">Unos minutos</span></span>
          <span className="pl-tramo-texto">
            Primero creás la cuenta y tu carta queda online. Lo hacés solo,
            desde <a className="pl-enlace" href="/registro">Probar gratis</a>.
          </span>
        </li>
        <li className="pl-tramo pl-tramo-horas" data-reveal>
          <span className="pl-tramo-bloque"><span className="pl-tramo-dur">Un par de horas</span></span>
          <span className="pl-tramo-texto">
            Después cargamos juntos las recetas, el equipo y los horarios.
          </span>
        </li>
        <li className="pl-tramo pl-tramo-dias" data-reveal>
          <span className="pl-tramo-bloque"><span className="pl-tramo-dur">Todos los días</span></span>
          <span className="pl-tramo-texto">
            Desde ahí, Dico calcula la ganancia solo cada vez que cerrás la caja.
          </span>
        </li>
      </ol>
    </section>
  );
}

/* ─────────────── 5. Quienes ya lo usan: nombres como una frase ─────────────── */

// Solo tenants reales del edificio (verificado en la base el 17/oct/2026).
const CLIENTES = ['La Nona Pato', 'Crazy Miga'];

const FOTOS_CLIENTES = [
  { src: '/brand/landing/crazy-choco-eclipse.webp', ancho: 900, alto: 900, alt: 'Cookie con chips de chocolate negro sobre una piedra oscura', pie: 'Choco Eclipse, de Crazy Miga' },
  { src: '/brand/landing/lnp-alfajores.webp', ancho: 789, alto: 374, alt: 'Alfajores de maicena con dulce de leche y coco rallado', pie: 'Alfajores de La Nona Pato' },
  { src: '/brand/landing/crazy-dulce-nebulosa.webp', ancho: 900, alto: 900, alt: 'Cookie con chips de dulce de leche sobre una piedra oscura', pie: 'Dulce Nebulosa, de Crazy Miga' },
  { src: '/brand/landing/lnp-bruschettas.webp', ancho: 789, alto: 374, alt: 'Bruschettas con jamón crudo, morrones asados y cebolla caramelizada', pie: 'Bruschettas de La Nona Pato' },
];

// Los nombres se encienden de a uno UNA sola vuelta, cuando la seccion entra
// en pantalla, y despues quedan todos en tinta plena. Con movimiento reducido
// (o si alguien lo activa a mitad de camino) quedan todos encendidos de una.
const TODOS = -1;

function Clientes() {
  const [encendido, setEncendido] = useState(TODOS);
  const seccionRef = useRef(null);

  useEffect(() => {
    const seccion = seccionRef.current;
    if (!seccion || typeof IntersectionObserver === 'undefined' || !window.matchMedia) return undefined;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reloj = null;
    const frenar = () => { clearInterval(reloj); reloj = null; setEncendido(TODOS); };
    const arrancar = () => {
      if (reducido.matches) return;
      let i = 0;
      setEncendido(0);
      reloj = setInterval(() => {
        i += 1;
        if (i >= CLIENTES.length) frenar(); else setEncendido(i);
      }, 2000);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { io.disconnect(); arrancar(); }
    }, { threshold: 0.4 });
    io.observe(seccion);
    const alCambiar = () => { if (reducido.matches) frenar(); };
    reducido.addEventListener('change', alCambiar);
    return () => { io.disconnect(); clearInterval(reloj); reducido.removeEventListener('change', alCambiar); };
  }, []);

  return (
    <section className="pl-clientes" aria-label="Quiénes ya usan Dico" ref={seccionRef}>
      <p className="pl-clientes-frase" data-reveal>
        Ya trabajan con Dico{' '}
        {CLIENTES.map((nombre, i) => (
          <Fragment key={nombre}>
            <span className={`pl-cliente${encendido === TODOS || i === encendido ? ' encendido' : ''}`}>{nombre}</span>
            {i < CLIENTES.length - 2 ? ', ' : i === CLIENTES.length - 2 ? ' y ' : '.'}
          </Fragment>
        ))}
      </p>
      <ul className="pl-clientes-fotos">
        {FOTOS_CLIENTES.map((f) => (
          <li key={f.src} data-reveal>
            <figure className="pl-foto">
              <img src={f.src} alt={f.alt} width={f.ancho} height={f.alto} loading="lazy" />
              <figcaption>{f.pie}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────────── 6. Modulos: frases con interruptor ─────────────── */

function Modulos() {
  const [encendidos, setEncendidos] = useState(() => new Set(ENCENDIDOS_AL_CARGAR));

  const alternar = (id) => setEncendidos((prev) => {
    const sig = new Set(prev);
    if (sig.has(id)) sig.delete(id); else sig.add(id);
    return sig;
  });

  return (
    <section className="pl-modulos" id="modulos" aria-label="Lo que hace Dico hoy">
      <ul className="pl-bandas">
        {MODULOS.map((m) => {
          const on = encendidos.has(m.id);
          return (
            <li className={`pl-banda pl-banda-${m.id}${on ? ' on' : ''}`} key={m.id} data-reveal>
              <div className="pl-banda-texto">
                <p className="pl-banda-frase">{m.frase}</p>
                <p className="pl-banda-consecuencia" id={`pl-banda-${m.id}-detalle`} hidden={!on}>{m.consecuencia}</p>
              </div>
              {/* Muestra u oculta la consecuencia: no prende ni apaga el modulo,
                  por eso es un boton con aria-expanded y no un switch. */}
              <button
                type="button"
                aria-expanded={on}
                aria-controls={`pl-banda-${m.id}-detalle`}
                className="pl-interruptor"
                data-ui
                onClick={() => alternar(m.id)}
              >
                <span className="pl-interruptor-nombre">{m.nombre}</span>
                <span className="pl-interruptor-pista" aria-hidden="true">
                  <span className="pl-interruptor-perilla" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="pl-modulos-honesto">
        <p data-reveal>
          Todo eso funciona hoy. Se conecta con MercadoPago (Checkout Pro con la
          cuenta de tu negocio, por ahora solo Argentina), responde los pedidos
          por WhatsApp, avisa al celular cuando entra un pedido o falta stock y
          te deja bajar en CSV o PDF lo que ves en pantalla, para tu contador.
        </p>
        <p data-reveal>
          Lo que todavía no está, dicho así: <strong>Cocina en pantalla</strong>,
          la comanda digital por sector, está construida y se termina de probar.{' '}
          <strong>Facturación ARCA</strong> está en desarrollo y no la ofrecemos
          hasta que emita una factura de verdad. <strong>Rappi y Pedidos Ya</strong>{' '}
          están en la lista y no tienen fecha.
        </p>
      </div>
    </section>
  );
}

/* ─────────────── 7. Planes: los nombres y una cifra viva ─────────────── */

function Planes() {
  const [elegido, setElegido] = useState('local');

  return (
    <section className="pl-planes" id="precios" aria-label="Planes y precios">
      <div className="pl-planes-grilla">
        {PLANES.map((p) => {
          const abierto = elegido === p.id;
          const pago = p.mensual > 0;
          return (
            <Fragment key={p.id}>
              <h2 className={`pl-plan-nombre pl-plan-nombre-${p.id}`}>
                <button
                  type="button"
                  aria-expanded={abierto}
                  aria-controls={`pl-plan-${p.id}`}
                  onClick={() => setElegido(p.id)}
                  onFocus={() => setElegido(p.id)}
                >
                  {p.nombre}
                </button>
              </h2>
              <div className="pl-plan-escena" id={`pl-plan-${p.id}`} hidden={!abierto}>
                <p className="pl-plan-precio">
                  <span className="pl-plan-cifra">{pago ? pesos(p.mensual) : 'Gratis'}</span>
                  <span className="pl-plan-periodo">{pago ? 'por mes y por local' : 'sin tarjeta'}</span>
                </p>
                {pago && <p className="pl-plan-anual">O {pesos(p.anual)} por mes pagando el año.</p>}
                <p className="pl-plan-texto">{p.texto}</p>
                {pago ? (
                  <a className="pl-boton" href={AGENDA_URL} target="_blank" rel="noreferrer" onClick={marcarAgenda}>
                    {p.accion}
                  </a>
                ) : (
                  <a className="pl-boton" href="/registro">{p.accion}</a>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
      <p className="pl-planes-nota" data-reveal>
        Precios en pesos, por local, sin IVA. Sin cargo por usuario, por pedido
        ni por factura procesada.
      </p>
    </section>
  );
}

/* ─────────────── 8. Preguntas ─────────────── */

function Preguntas() {
  return (
    <section className="pl-preguntas" id="preguntas" aria-labelledby="pl-preguntas-titulo">
      <h2 id="pl-preguntas-titulo" className="pl-titulo" data-reveal>Lo que todos preguntan</h2>
      <div className="pl-preguntas-lista">
        {FAQ.map((f) => (
          <details className="pl-pregunta" key={f.p} data-reveal>
            <summary>
              <span>{f.p}</span>
              <span className="pl-pregunta-signo" aria-hidden="true" />
            </summary>
            <p>
              {f.r}
              {f.whatsapp && (
                <>
                  {' '}
                  <a className="pl-enlace" href={WHATSAPP_URL} target="_blank" rel="noreferrer" onClick={marcarWhatsApp}>
                    Escribime al {WHATSAPP_VISIBLE}, {WHATSAPP_HORARIO}
                  </a>
                  .
                </>
              )}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ─────────────── 9. Cierre: la frase con un hueco ─────────────── */

/* Es un form GET a /registro: sin script igual llega con ?negocio=<nombre>, y
   Signup precarga ese nombre. */
function Cierre() {
  return (
    <section className="pl-cierre" aria-labelledby="pl-cierre-frase">
      <form className="pl-cierre-form" action="/registro" method="get">
        <h2 id="pl-cierre-frase" className="pl-cierre-frase" data-reveal>
          <span>Creá</span>{' '}
          <input
            className="pl-cierre-input"
            type="text"
            name="negocio"
            maxLength={80}
            autoComplete="organization"
            placeholder="tu negocio"
            aria-label="Nombre de tu negocio"
          />{' '}
          <span>en Dico</span>{' '}
          <button type="submit" className="pl-cierre-boton" aria-label="Crear mi negocio hoy">hoy</button>
          <span>.</span>
        </h2>
        <p className="pl-cierre-nota" data-reveal>
          Te lleva al alta con el nombre ya cargado. El plan Digital es gratis y
          no pide tarjeta. Si preferís armarlo juntos,{' '}
          <a className="pl-enlace" href={AGENDA_URL} target="_blank" rel="noreferrer" onClick={marcarAgenda}>
            agendá una reunión
          </a>
          .
        </p>
      </form>
    </section>
  );
}

/* ─────────────── 10. Pie: el contacto es el titular ─────────────── */

function Pie() {
  return (
    <footer className="pl-pie">
      <div className="pl-pie-arriba">
        <img className="pl-pie-marca" src="/brand/dico/logo/dico-claro.png" alt="Dico" width="1368" height="452" />
        <p>Divianco, Buenos Aires.</p>
        <p>WhatsApp con Ricardo Rodríguez, {WHATSAPP_HORARIO}.</p>
        <p>
          <a className="pl-enlace" href={AGENDA_URL} target="_blank" rel="noreferrer" onClick={marcarAgenda}>
            Agendá una reunión
          </a>
          , {AGENDA_HORARIO}.
        </p>
        <a className="pl-enlace pl-pie-arriba-link" href="#pl-hero-titulo">Volver arriba</a>
      </div>

      <a
        className="pl-pie-telefono"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        onClick={marcarWhatsApp}
        aria-label={`Escribir por WhatsApp al ${WHATSAPP_VISIBLE}`}
      >
        <span>{WHATSAPP_VISIBLE_PARTES[0]}</span>{' '}
        <span>{WHATSAPP_VISIBLE_PARTES[1]}</span>
      </a>

      <div className="pl-pie-meta">
        <p className="pl-pie-links">
          <a className="pl-enlace" href="mailto:hola@divianco.app">hola@divianco.app</a>
          <a className="pl-enlace" href="/entrar">Entrar</a>
        </p>
        <p>Fotos: productos de La Nona Pato y Crazy Miga.</p>
        <p>© {new Date().getFullYear()} Grupo Divianco</p>
      </div>
    </footer>
  );
}
