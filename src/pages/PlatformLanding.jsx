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
// pantalla que existe. Donde la verdad es "todavia no", lo dice. Lo que hace
// cada rubro sale de src/modules/registry.js (`implementado`).
//
// V2 (19/oct/2026, rama landing/rediseno). Criterio de Ricky: fondo claro,
// multirubro, una historia que va de "te muestro el sistema" a "te lo vendo"
// y que termina en el diagnostico, con Dico como guia.
//
// Direccion de design-taste-frontend: "the product performs". El producto
// trabaja adelante tuyo: la pagina abre con el cierre de caja funcionando
// (se elige el rubro y cambia la cuenta), cada pieza del sistema aparece en
// un bloque oscuro con su cifra, y el diagnostico se ve ya abierto en su
// primera pregunta. El oscuro es SOLO para piezas del producto; el oro, para
// la accion y las cifras de valor; el volt, para lo que Dico lee y para el
// diagnostico. Paleta en src/styles/plataforma-claro.css.
//
// Orden de la historia: promesa -> el problema -> un solo lugar (las piezas)
// -> tu rubro -> el diagnostico como puente -> clientes -> planes ->
// preguntas -> cierre -> pie.
//
// PRUEBA SOCIAL: solo nombres y fotos reales de productos de clientes que
// corren sobre Dico (La Nona Pato y Crazy Miga). Sin cifras de resultados:
// no hay datos firmes. Cada foto lleva el nombre del negocio y nunca se
// presenta como "un plato de ejemplo de Dico". Las cifras de las piezas del
// producto son ejemplos y cierran entre si.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cargarAnalitica, marcarEvento } from '../lib/analiticaPlataforma';
import {
  AGENDA_HORARIO, AGENDA_URL, WHATSAPP_HORARIO, WHATSAPP_URL, WHATSAPP_VISIBLE,
} from '../lib/contactoPlataforma';
import { VERTICALES } from '../lib/diagnostico';
import '../styles/plataforma-claro.css';
import '../styles/platform-landing.css';

const TITULO = 'Dico — Sabé cuánto ganás. Todo lo que necesitás en un solo lugar';
const DESCRIPCION = 'El sistema de gestión para gastronomía, comercio y servicios: '
  + 'pedidos, caja, stock, equipo y la ganancia real de cada día, en un solo '
  + 'lugar. Empezá con un diagnóstico de 6 preguntas.';

// Cuantas preguntas tiene el diagnostico, tal como lo dice la pagina. Si
// src/lib/diagnostico.js cambia el recorrido, se cambia aca.
const PREGUNTAS = 6;
const DIAGNOSTICO_URL = '/diagnostico';

// Telefono, agenda y horarios: src/lib/contactoPlataforma.js.
const marcarWhatsApp = () => marcarEvento('whatsapp');
const marcarAgenda = () => marcarEvento('agenda');
const marcarDiagnostico = () => marcarEvento('diagnostico-cta');

const pesos = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;
const porcentaje = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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

const sinMovimiento = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Entradas por seccion: cada [data-reveal] entra una sola vez cuando aparece.
 *  El estado oculto solo existe bajo .pl-anim, que se pone aca: sin
 *  IntersectionObserver o con movimiento reducido, todo esta a la vista. */
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
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
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
      <Problema />
      <UnSoloLugar />
      <Rubros />
      <Puente />
      <Clientes />
      <Planes />
      <Preguntas />
      <Cierre />
      <Pie />
    </div>
  );
}

/* ─────────────── Acciones comunes ─────────────── */

function BotonDiagnostico({ className = '' }) {
  return (
    <a className={`pl-boton ${className}`.trim()} href={DIAGNOSTICO_URL} onClick={marcarDiagnostico}>
      Hacer mi diagnóstico
    </a>
  );
}

function LinkAgenda({ children = 'Agendá una reunión' }) {
  return (
    <a className="pl-enlace" href={AGENDA_URL} target="_blank" rel="noreferrer" onClick={marcarAgenda}>
      {children}
    </a>
  );
}

/* ─────────────── 1. Promesa: el cierre funcionando ─────────────── */

// El mismo cierre en tres rubros. Las cifras son de ejemplo y cierran:
// gastronomia 4.200.000 - 1.050.000 - 650.000 - 140.000 = 2.360.000 (los
// numeros de la v1 por mil); comercio 1.380.000 - 745.000 - 180.000 - 62.000
// = 393.000; servicios 620.000 - 25.000 - 248.000 - 31.000 = 316.000.
const CIERRES = {
  gastronomia: {
    nombre: 'Gastronomía',
    cuando: 'Viernes, 23:52',
    ventas: 4200000,
    costos: [
      ['Insumos, según tus recetas', 1050000],
      ['Nómina, por horas fichadas', 650000],
      ['Merma', 140000],
    ],
    lectura: 'La merma de hoy duplica la del viernes pasado. Casi toda es de verdulería.',
  },
  comercio: {
    nombre: 'Comercio',
    cuando: 'Sábado, 20:15',
    ventas: 1380000,
    costos: [
      ['Costo de lo vendido', 745000],
      ['Personal', 180000],
      ['Gastos del día', 62000],
    ],
    lectura: 'Tres artículos quedaron debajo del mínimo. Te dejé la lista en Stock.',
  },
  servicios: {
    nombre: 'Servicios',
    cuando: 'Sábado, 19:40',
    ventas: 620000,
    costos: [
      ['Insumos', 25000],
      ['Personal', 248000],
      ['Gastos del día', 31000],
    ],
    lectura: 'El personal se llevó el 40 % de la venta. El martes fue el 22 %.',
  },
};
const RUBROS_DEL_CIERRE = Object.keys(CIERRES);

function Hero() {
  return (
    <section className="pl-hero" aria-labelledby="pl-hero-titulo">
      <header className="pl-cabecera">
        <a className="pl-marca" href="/">
          <img src="/brand/dico/logo/dico-claro.png" alt="Dico" width="1368" height="452" />
        </a>
        <nav className="pl-nav" aria-label="Principal">
          <a className="pl-nav-link" href="#sistema">Sistema</a>
          <a className="pl-nav-link" href="#rubros">Rubros</a>
          <a className="pl-nav-link" href="#precios">Precios</a>
          <a className="pl-nav-link" href="/entrar">Entrar</a>
        </nav>
      </header>

      <div className="pl-hero-texto">
        <h1 id="pl-hero-titulo" className="pl-h1 pl-lineas">
          <span className="pl-linea"><span className="pl-linea-in">Sabé cuánto</span></span>{' '}
          <span className="pl-linea"><span className="pl-linea-in pl-linea-2">ganás.</span></span>
        </h1>
        <p className="pl-hero-bajada pl-hero-sigue">
          Todo lo que necesitás en un solo lugar: pedidos, caja, stock, equipo y
          la ganancia real de cada día. Para gastronomía, comercio y servicios.
        </p>
        <div className="pl-hero-dico pl-hero-sigue">
          <img className="pl-dico-img" src="/brand/dico/dico-2d-question.png" alt="" width="256" height="256" />
          <p className="pl-dico-dice">
            ¿Te hago un diagnóstico? Son {PREGUNTAS} preguntas y te digo por dónde empezar.
          </p>
        </div>
        <div className="pl-acciones pl-hero-sigue">
          <BotonDiagnostico />
          <a className="pl-enlace" href="/registro">Probar gratis</a>
          <LinkAgenda />
        </div>
      </div>

      <div className="pl-hero-escena">
        <CierreEnVivo />
      </div>
    </section>
  );
}

/* El cierre de caja de Dico, construido en HTML. Se elige el rubro y la
   cuenta cambia: es la prueba de "multirubro" en el primer pantallazo. */
function CierreEnVivo() {
  const [rubro, setRubro] = useState('gastronomia');
  const c = CIERRES[rubro];
  const totalCostos = c.costos.reduce((s, [, m]) => s + m, 0);
  const neto = c.ventas - totalCostos;
  const margen = (neto / c.ventas) * 100;

  return (
    <div className="pl-pieza pl-cierre" data-ui>
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Cierre de caja</span>
        <span className="pl-pieza-meta">{c.cuando}</span>
      </div>

      <div className="pl-segmento" role="group" aria-label="Rubro del ejemplo">
        {RUBROS_DEL_CIERRE.map((id) => (
          <button
            key={id}
            type="button"
            className="pl-segmento-op"
            aria-pressed={rubro === id}
            onClick={() => setRubro(id)}
          >
            {CIERRES[id].nombre}
          </button>
        ))}
      </div>

      {/* key: al cambiar de rubro las filas se reemplazan y entran de nuevo */}
      <div className="pl-cierre-cuenta" key={rubro} aria-live="polite">
        <dl className="pl-filas">
          <div className="pl-fila">
            <dt>Ventas</dt>
            <dd>{pesos(c.ventas)}</dd>
          </div>
          {c.costos.map(([concepto, monto]) => (
            <div className="pl-fila" key={concepto}>
              <dt>{concepto}</dt>
              <dd>−{pesos(monto)}</dd>
            </div>
          ))}
        </dl>
        <div className="pl-cierre-neto">
          <span className="pl-cierre-neto-nombre">Ganancia neta</span>
          <span className="pl-cierre-neto-cifra">{pesos(neto)}</span>
          <span className="pl-cierre-neto-margen">{porcentaje(margen)} % de la venta</span>
        </div>
        <p className="pl-lectura">
          <span className="pl-lectura-quien">Dico</span>
          {c.lectura}
        </p>
      </div>
    </div>
  );
}

/* ─────────────── 2. El problema: vender no es ganar ─────────────── */

const FUGAS = [
  ['La mercadería sube', 'y el precio de venta queda igual. Si nadie recalcula el costo, el margen se achica sin aviso, producto por producto.'],
  ['Los sueldos pesan', 'distinto cada día. Un turno con mucha gente y poca venta no se paga solo, y en la planilla no se ve.'],
  ['Lo que se pierde', 'no queda anotado: la merma, lo que se vence, lo que se regala. Nadie lo suma, pero sale de la ganancia.'],
  ['La caja no cierra', 'por poco y nadie sabe por qué. Una diferencia chica todos los días es mucha plata a fin de mes.'],
];

function Problema() {
  return (
    <section className="pl-problema" aria-label="Vender no es ganar">
      <p className="pl-lead" data-reveal>
        Vender no es ganar. Entre la mercadería, los sueldos, lo que se pierde y
        la caja que no cierra, la venta se achica antes de llegar a tu bolsillo.
        Y casi siempre te enterás a fin de mes.
      </p>
      <div className="pl-fugas">
        {FUGAS.map(([frase, resto], i) => (
          <p className="pl-fuga" key={frase} data-reveal={i + 1}>
            <strong>{frase}</strong> {resto}
          </p>
        ))}
      </div>
      <div className="pl-problema-fotos">
        <figure className="pl-foto pl-foto-ancha" data-reveal>
          <span className="pl-foto-marco">
            <img
              className="pl-foto-deriva"
              src="/brand/landing/lnp-picada.webp"
              alt="Tabla de picada con fiambres, quesos, aceitunas y palta"
              width="789" height="374" loading="lazy"
            />
          </span>
          <figcaption>Picada de La Nona Pato</figcaption>
        </figure>
        <figure className="pl-foto pl-foto-cuadrada" data-reveal="2">
          <span className="pl-foto-marco">
            <img
              src="/brand/landing/lnp-tortilla.webp"
              alt="Tortilla de papas en un plato blanco, con una porción cortada"
              width="789" height="374" loading="lazy"
            />
          </span>
          <figcaption>Tortilla de La Nona Pato</figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ─────────────── 3. Un solo lugar: las piezas del producto ─────────────── */

function UnSoloLugar() {
  return (
    <section className="pl-lugar" id="sistema" aria-labelledby="pl-lugar-titulo">
      <div className="pl-lugar-cab">
        <h2 id="pl-lugar-titulo" className="pl-h2" data-reveal>Un solo lugar.</h2>
        <p className="pl-lugar-intro" data-reveal="1">
          Las planillas, el cuaderno de caja, el grupo de WhatsApp, el stock
          contado a ojo y la espera del contador a fin de mes. Dico junta todo
          y te da el número cada día.
        </p>
      </div>

      <div className="pl-lugar-filas">
        <FilaPieza
          antes="Antes, la planilla de costos."
          titulo="El costo de cada plato, siempre al día."
          texto="Cargás la receta una vez. Cuando el proveedor sube un insumo, Dico recalcula el costo y te muestra cuánto te deja cada venta. Es de gastronomía: un corte de pelo no lleva receta."
        >
          <PiezaReceta />
        </FilaPieza>
        <FilaPieza
          antes="Antes, las horas anotadas en un papel."
          titulo="Cada turno, contra lo que vendió."
          texto="El equipo ficha entrada y salida. Dico cruza las horas con la venta y te dice qué parte se fue en sueldos, turno por turno."
        >
          <PiezaTurno />
        </FilaPieza>
        <FilaPieza
          antes="Antes, el cuaderno de caja."
          titulo="La diferencia de caja aparece sola."
          texto="Efectivo, tarjeta y MercadoPago. Al cerrar, el arqueo compara lo declarado con lo registrado y te muestra la diferencia, medio por medio."
        >
          <PiezaArqueo />
        </FilaPieza>
        <FilaPieza
          antes="Antes, el grupo de WhatsApp."
          titulo="Todos los pedidos en el mismo panel."
          texto="Salón, mostrador y catálogo online entran al mismo lugar, con su estado y su cobro. Cuando entra un pedido, te avisa al celular."
        >
          <PiezaPedidos />
        </FilaPieza>
        <FilaPieza
          antes="Antes, el stock contado a ojo."
          titulo="El stock baja con cada venta."
          texto="Cada venta descuenta lo que usó. Cuando algo queda debajo del mínimo, Dico te avisa antes de que falte."
        >
          <PiezaStock />
        </FilaPieza>
      </div>
    </section>
  );
}

function FilaPieza({ antes, titulo, texto, children }) {
  return (
    <article className="pl-fila-pieza">
      <div className="pl-fila-texto" data-reveal>
        <p className="pl-antes">{antes}</p>
        <h3 className="pl-h3">{titulo}</h3>
        <p className="pl-fila-parrafo">{texto}</p>
      </div>
      <div className="pl-fila-escena" data-reveal="2">
        {children}
      </div>
    </article>
  );
}

// Bife: 4.200 + 540 + 360 = 5.100 de insumos; 18.000 - 5.100 - 2.775 = 10.125.
function PiezaReceta() {
  return (
    <div className="pl-pieza pl-receta" data-ui aria-label="Ejemplo: receta con costo">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Bife de chorizo con papas</span>
        <span className="pl-pieza-meta">Precio $18.000</span>
      </div>
      <dl className="pl-filas">
        <div className="pl-fila"><dt>Bife de chorizo · 350 g</dt><dd>$4.200</dd></div>
        <div className="pl-fila"><dt>Papas · 300 g</dt><dd>$540</dd></div>
        <div className="pl-fila"><dt>Manteca, sal y aceite</dt><dd>$360</dd></div>
        <div className="pl-fila pl-fila-suma"><dt>Insumos</dt><dd>$5.100</dd></div>
        <div className="pl-fila pl-fila-suma"><dt>Mano de obra</dt><dd>$2.775</dd></div>
      </dl>
      <div className="pl-pieza-cifra">
        <span className="pl-pieza-cifra-nombre">Te deja</span>
        <span className="pl-pieza-cifra-valor pl-oro">$10.125</span>
        <span className="pl-pieza-cifra-nota">56,3 % del precio</span>
      </div>
      <p className="pl-lectura">
        <span className="pl-lectura-quien">Dico</span>
        La carne subió 8 % el lunes. Ya está en el costo.
      </p>
    </div>
  );
}

// 186.000 / 490.000 = 37,96 %.
function PiezaTurno() {
  return (
    <div className="pl-pieza pl-turno" data-ui aria-label="Ejemplo: turno con nómina">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Martes, de 14 a 17 h</span>
        <span className="pl-pieza-meta">3 personas · 9 h fichadas</span>
      </div>
      <div className="pl-turno-cuenta">
        <div><span className="pl-pieza-meta">Ventas</span><span className="pl-turno-monto">$490.000</span></div>
        <div><span className="pl-pieza-meta">Nómina</span><span className="pl-turno-monto">$186.000</span></div>
      </div>
      <div className="pl-pieza-cifra">
        <span className="pl-pieza-cifra-nombre">Nómina sobre venta</span>
        <span className="pl-pieza-cifra-valor pl-alerta">38 %</span>
      </div>
      <p className="pl-lectura">
        <span className="pl-lectura-quien">Dico</span>
        Arriba del 30 %, este turno no se paga solo.
      </p>
    </div>
  );
}

// Registrado: 418.500 + 1.960.000 + 1.821.500 = 4.200.000 (el viernes del cierre).
function PiezaArqueo() {
  const medios = [
    ['Efectivo', '$412.000', '$418.500'],
    ['Tarjeta', '$1.960.000', '$1.960.000'],
    ['MercadoPago', '$1.821.500', '$1.821.500'],
  ];
  return (
    <div className="pl-pieza pl-arqueo" data-ui>
      <table className="pl-arqueo-tabla">
        <caption className="pl-pieza-titulo pl-arqueo-titulo">Arqueo · viernes</caption>
        <thead>
          <tr><th scope="col">Medio</th><th scope="col">Declarado</th><th scope="col">Registrado</th></tr>
        </thead>
        <tbody>
          {medios.map(([medio, dec, reg]) => (
            <tr key={medio}><th scope="row">{medio}</th><td>{dec}</td><td>{reg}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="pl-pieza-cifra">
        <span className="pl-pieza-cifra-nombre">Diferencia en efectivo</span>
        <span className="pl-pieza-cifra-valor pl-error">−$6.500</span>
      </div>
    </div>
  );
}

function PiezaPedidos() {
  const pedidos = [
    ['#214', 'Salón · mesa 6', 'En cocina', '$38.400', 'cocina'],
    ['#215', 'Mostrador', 'Listo', '$12.900', 'listo'],
    ['#216', 'Catálogo online · delivery', 'Confirmado', '$27.600', 'nuevo'],
    ['#217', 'Salón · mesa 2', 'Cobrado', '$51.300', 'cobrado'],
  ];
  return (
    <div className="pl-pieza pl-pedidos" data-ui aria-label="Ejemplo: pedidos de todos los canales">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Pedidos de hoy</span>
        <span className="pl-pieza-meta">21:40</span>
      </div>
      <ul className="pl-pedidos-lista">
        {pedidos.map(([n, canal, estado, monto, tono]) => (
          <li key={n} className="pl-pedido">
            <span className="pl-pedido-n">{n}</span>
            <span className="pl-pedido-canal">{canal}</span>
            <span className={`pl-pedido-estado pl-estado-${tono}`}>{estado}</span>
            <span className="pl-pedido-monto">{monto}</span>
          </li>
        ))}
      </ul>
      <div className="pl-pieza-cifra">
        <span className="pl-pieza-cifra-nombre">48 pedidos de 3 canales</span>
        <span className="pl-pieza-cifra-valor pl-oro">$1.126.000</span>
      </div>
    </div>
  );
}

function PiezaStock() {
  const insumos = [
    ['Harina 000', '6 kg', 'mínimo 10 kg', true],
    ['Muzzarella', '8,4 kg', 'mínimo 5 kg', false],
    ['Tomate perita', '12 kg', 'mínimo 8 kg', false],
  ];
  return (
    <div className="pl-pieza pl-stock" data-ui aria-label="Ejemplo: stock con mínimo">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Stock</span>
        <span className="pl-pieza-meta">Actualizado con la última venta</span>
      </div>
      <ul className="pl-stock-lista">
        {insumos.map(([nombre, hay, minimo, bajo]) => (
          <li key={nombre} className={`pl-stock-item${bajo ? ' bajo' : ''}`}>
            <span className="pl-stock-nombre">{nombre}</span>
            <span className="pl-stock-hay">{hay}</span>
            <span className="pl-stock-min">{minimo}</span>
          </li>
        ))}
      </ul>
      <p className="pl-lectura">
        <span className="pl-lectura-quien">Dico</span>
        La harina quedó debajo del mínimo. Te avisé al celular.
      </p>
    </div>
  );
}

/* ─────────────── 4. Para tu rubro: lo que hace hoy ─────────────── */

const HOY = 'Funciona hoy';
const PRUEBAS = 'En pruebas';
const DESARROLLO = 'En desarrollo';

const RUBROS = [
  {
    id: 'gastronomia',
    nombre: 'Gastronomía',
    quienes: 'Restaurantes, parrillas, cafés, panaderías, bares y cocinas de delivery.',
    modulos: [
      ['Catálogo y pedidos', 'Tu carta online con QR. Salón, mostrador y delivery en el mismo panel.', HOY],
      ['Salón y comandas', 'Mapa de mesas, comandas y el estado de cada mesa.', HOY],
      ['Recetas con costo', 'El costo de cada plato por insumo, recalculado cuando sube un precio.', HOY],
      ['Stock y compras', 'Baja con cada venta y avisa cuando algo queda debajo del mínimo.', HOY],
      ['Caja y arqueo', 'Efectivo, tarjeta y MercadoPago, con la diferencia al cerrar.', HOY],
      ['Equipo y horarios', 'Fichaje, costo por hora y nómina contra la venta de cada turno.', HOY],
      ['Cocina en pantalla', 'La comanda digital por sector. Está construida y se termina de probar.', PRUEBAS],
    ],
  },
  {
    id: 'comercio',
    nombre: 'Comercio',
    quienes: 'Indumentaria, almacenes, kioscos, licorerías y tiendas.',
    modulos: [
      ['Catálogo online y pedidos', 'Tu tienda en tu-negocio.divianco.app. Mostrador y online en el mismo panel.', HOY],
      ['Stock por artículo', 'Baja con cada venta y avisa antes de que algo falte.', HOY],
      ['Caja y arqueo', 'Efectivo, tarjeta y MercadoPago, con la diferencia al cerrar.', HOY],
      ['Ventas y gastos', 'El resultado del día y del mes, con los gastos cargados.', HOY],
      ['Equipo', 'Fichaje y costo por hora de cada vendedor.', HOY],
      ['Talles y colores', 'Variantes por artículo, cada una con su stock.', DESARROLLO],
    ],
  },
  {
    id: 'servicios',
    nombre: 'Servicios',
    quienes: 'Barberías, peluquerías, centros de estética, uñas y spa.',
    modulos: [
      ['Catálogo de servicios', 'Tus servicios online, con precio y duración.', HOY],
      ['Pedidos y cobros', 'Cada servicio vendido, con su medio de pago.', HOY],
      ['Caja y arqueo', 'Lo cobrado en el día y la diferencia al cerrar.', HOY],
      ['Stock de insumos', 'Productos y repuestos, con aviso cuando llegan al mínimo.', HOY],
      ['Ventas y gastos', 'El resultado del día y del mes, con los gastos cargados.', HOY],
      ['Equipo', 'Fichaje y costo de cada profesional.', HOY],
      ['Agenda de turnos online', 'Reservas desde tu catálogo. Te avisamos cuando salga.', DESARROLLO],
    ],
  },
];

function Rubros() {
  const [activo, setActivo] = useState(0);
  const tabsRef = useRef([]);
  const rubro = RUBROS[activo];

  // Teclado de un tablist: flechas, Inicio y Fin mueven el foco y la seleccion.
  const alTeclear = (e) => {
    const ultimo = RUBROS.length - 1;
    const mapa = {
      ArrowDown: activo === ultimo ? 0 : activo + 1,
      ArrowRight: activo === ultimo ? 0 : activo + 1,
      ArrowUp: activo === 0 ? ultimo : activo - 1,
      ArrowLeft: activo === 0 ? ultimo : activo - 1,
      Home: 0,
      End: ultimo,
    };
    if (!(e.key in mapa)) return;
    e.preventDefault();
    setActivo(mapa[e.key]);
    tabsRef.current[mapa[e.key]]?.focus();
  };

  return (
    <section className="pl-rubros" id="rubros" aria-labelledby="pl-rubros-titulo">
      <h2 id="pl-rubros-titulo" className="pl-h2" data-reveal>Lo que hace hoy en tu rubro.</h2>

      <div className="pl-rubros-cuerpo">
        <div className="pl-tabs" role="tablist" aria-label="Rubros" aria-orientation="vertical" data-reveal="1">
          {RUBROS.map((r, i) => (
            <button
              key={r.id}
              ref={(el) => { tabsRef.current[i] = el; }}
              type="button"
              role="tab"
              id={`pl-tab-${r.id}`}
              className="pl-tab"
              aria-selected={i === activo}
              aria-controls={`pl-panel-${r.id}`}
              tabIndex={i === activo ? 0 : -1}
              onClick={() => setActivo(i)}
              onKeyDown={alTeclear}
            >
              <span className="pl-tab-nombre">{r.nombre}</span>
              <span className="pl-tab-cuenta">
                {r.modulos.filter((m) => m[2] === HOY).length} módulos hoy
              </span>
            </button>
          ))}
        </div>

        <div
          className="pl-rubro-panel"
          role="tabpanel"
          id={`pl-panel-${rubro.id}`}
          aria-labelledby={`pl-tab-${rubro.id}`}
          key={rubro.id}
        >
          <p className="pl-rubro-quienes">{rubro.quienes}</p>
          <ul className="pl-bandas">
            {rubro.modulos.map(([nombre, que, estado]) => (
              <li key={nombre} className={`pl-banda${estado === HOY ? '' : ' pendiente'}`}>
                <span className="pl-banda-nombre">{nombre}</span>
                <span className="pl-banda-que">{que}</span>
                <span className="pl-banda-estado">{estado}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="pl-rubros-nota" data-reveal>
        En todos los rubros, la facturación ARCA está en desarrollo y no la
        ofrecemos hasta que emita una factura de verdad. Rappi y PedidosYa están
        en la lista y todavía no tienen fecha.
      </p>
    </section>
  );
}

/* ─────────────── 5. El puente: el diagnostico ya abierto ─────────────── */

/* Es un form GET a /diagnostico: el rubro elegido viaja como ?vertical=<id>
   (los ids de VERTICALES, los mismos de la tabla diagnosticos). */
function Puente() {
  return (
    <section className="pl-puente" id="diagnostico" aria-labelledby="pl-puente-titulo">
      <div className="pl-puente-texto">
        <img className="pl-dico-img pl-puente-dico" src="/brand/dico/dico-2d-curious.png" alt="" width="256" height="256" data-reveal />
        <h2 id="pl-puente-titulo" className="pl-h1 pl-puente-titular" data-reveal="1">
          Empezá por el diagnóstico.
        </h2>
        <p className="pl-dico-dice pl-puente-dice" data-reveal="2">
          Te hago {PREGUNTAS} preguntas sobre tu negocio. En dos minutos te digo qué
          resolver primero, cómo lo resuelve Dico y qué plan te conviene. Sin
          reunión y sin tarjeta.
        </p>
      </div>

      <form className="pl-dialogo" data-ui action={DIAGNOSTICO_URL} method="get" onSubmit={marcarDiagnostico} data-reveal="2">
        <div className="pl-dialogo-cab">
          <span className="pl-dialogo-titulo">Diagnóstico</span>
          <span className="pl-dialogo-paso">Pregunta 1 de {PREGUNTAS}</span>
        </div>
        <div className="pl-progreso" aria-hidden="true">
          {Array.from({ length: PREGUNTAS }, (_, i) => (
            <span key={i} className={`pl-progreso-tramo${i === 0 ? ' hecho' : ''}`} />
          ))}
        </div>
        <fieldset className="pl-dialogo-campo">
          <legend className="pl-dialogo-pregunta">¿Qué tipo de negocio tenés?</legend>
          {VERTICALES.map((v, i) => (
            <label className="pl-opcion" key={v.id}>
              <input type="radio" name="vertical" value={v.id} defaultChecked={i === 0} />
              <span>{v.label}</span>
            </label>
          ))}
        </fieldset>
        <button type="submit" className="pl-boton pl-boton-ancho">Hacer mi diagnóstico</button>
      </form>
    </section>
  );
}

/* ─────────────── 6. Clientes: nombres y fotos ─────────────── */

// Solo tenants reales del edificio (verificado en la base el 19/oct/2026).
const CLIENTES = [
  {
    nombre: 'La Nona Pato',
    que: 'Panadería',
    fotos: [
      { src: '/brand/landing/lnp-empanadas.webp', ancho: 789, alto: 374, alt: 'Fuente blanca con empanadas horneadas sobre una tabla de madera', pie: 'Empanadas' },
      { src: '/brand/landing/lnp-alfajores.webp', ancho: 789, alto: 374, alt: 'Alfajores de maicena con dulce de leche y coco rallado', pie: 'Alfajores de maicena' },
      { src: '/brand/landing/lnp-bruschettas.webp', ancho: 789, alto: 374, alt: 'Bruschettas con jamón crudo, morrones asados y cebolla caramelizada', pie: 'Bruschettas' },
    ],
  },
  {
    nombre: 'Crazy Miga',
    que: 'Cookies con delivery en Zona Norte',
    fotos: [
      { src: '/brand/landing/crazy-orbita-blanca.webp', ancho: 900, alto: 900, alt: 'Cookie con chips de chocolate blanco sobre una piedra oscura', pie: 'Órbita Blanca' },
      { src: '/brand/landing/crazy-choco-eclipse.webp', ancho: 900, alto: 900, alt: 'Cookie con chips de chocolate negro sobre una piedra oscura', pie: 'Choco Eclipse' },
      { src: '/brand/landing/crazy-dulce-nebulosa.webp', ancho: 900, alto: 900, alt: 'Cookie con chips de dulce de leche sobre una piedra oscura', pie: 'Dulce Nebulosa' },
    ],
  },
];

function Clientes() {
  return (
    <section className="pl-clientes" aria-labelledby="pl-clientes-titulo">
      <h2 id="pl-clientes-titulo" className="pl-h2" data-reveal>Ya trabajan con Dico.</h2>
      {CLIENTES.map((c) => (
        <div className={`pl-tablero pl-tablero-${c.fotos.length}`} key={c.nombre}>
          <div className="pl-tablero-nombre" data-reveal>
            <p className="pl-tablero-cliente">{c.nombre}</p>
            <p className="pl-tablero-que">{c.que}</p>
          </div>
          {c.fotos.map((f, i) => (
            <figure className="pl-foto pl-tablero-foto" key={f.src} data-reveal={i + 1}>
              <span className="pl-foto-marco">
                <img src={f.src} alt={f.alt} width={f.ancho} height={f.alto} loading="lazy" />
              </span>
              <figcaption>{f.pie}, de {c.nombre}</figcaption>
            </figure>
          ))}
        </div>
      ))}
    </section>
  );
}

/* ─────────────── 7. Planes: los nombres y una cifra viva ─────────────── */

// Los precios salen de la tabla `plans` del edificio (migracion 0052). El plan
// `total` queda afuera a proposito: esta modelado y marcado no disponible.
const PLANES = [
  {
    id: 'digital',
    nombre: 'Digital',
    mensual: 0,
    texto: 'Todo el sistema, sin pagar: catálogo online con link propio, pedidos, '
      + 'caja y arqueo, stock, equipo con costo por hora y el resultado de cada '
      + 'día. En gastronomía, también recetas con costo.',
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

function Planes() {
  const [elegido, setElegido] = useState('local');

  return (
    <section className="pl-planes" id="precios" aria-label="Planes y precios">
      <div className="pl-planes-grilla">
        {PLANES.map((p) => {
          const abierto = elegido === p.id;
          const pago = p.mensual > 0;
          return (
            <div className="pl-plan" key={p.id}>
              <h2 className="pl-plan-nombre">
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
            </div>
          );
        })}
      </div>
      <p className="pl-planes-nota" data-reveal>
        Precios en pesos, por local, sin IVA. Sin cargo por usuario, por pedido
        ni por factura procesada. ¿No sabés cuál te conviene?{' '}
        <a className="pl-enlace" href={DIAGNOSTICO_URL} onClick={marcarDiagnostico}>
          El diagnóstico te lo dice
        </a>
        .
      </p>
    </section>
  );
}

/* ─────────────── 8. Preguntas ─────────────── */

const FAQ = [
  {
    p: '¿Qué es el diagnóstico?',
    r: `Son ${PREGUNTAS} preguntas sobre tu negocio: el rubro, los canales, cuántos `
      + 'locales y cuánta gente tenés, cómo lo controlás hoy y qué te preocupa. '
      + 'Con eso Dico te dice qué resolver primero, cómo lo resuelve y qué plan te '
      + 'conviene. Lleva un par de minutos y no pide tarjeta.',
  },
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
      + 'resultado y sus roles, y arriba ves el consolidado y la comparativa '
      + 'entre sucursales.',
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
    p: '¿Quién ve qué adentro de mi negocio?',
    r: 'Cada rol ve lo suyo. Un mozo o un vendedor no ve el resultado ni la '
      + 'nómina. No es una pantalla escondida: el permiso se aplica en la base de '
      + 'datos, así que tampoco se llega por otro lado. Y un negocio nunca ve los '
      + 'números de otro.',
  },
];

function Preguntas() {
  return (
    <section className="pl-preguntas" id="preguntas" aria-labelledby="pl-preguntas-titulo">
      <h2 id="pl-preguntas-titulo" className="pl-h2 pl-preguntas-titulo" data-reveal>
        Lo que todos preguntan
      </h2>
      <div className="pl-preguntas-lista">
        {FAQ.map((f) => (
          <details className="pl-pregunta" name="pl-faq" key={f.p} data-reveal>
            <summary>
              <span>{f.p}</span>
              <span className="pl-signo" aria-hidden="true" />
            </summary>
            <p>
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
          </details>
        ))}
      </div>
    </section>
  );
}

/* ─────────────── 9. Cierre: la fila de tres ─────────────── */

function Cierre() {
  return (
    <section className="pl-cierre-final" aria-labelledby="pl-cierre-titulo">
      <figure className="pl-tile pl-tile-foto" aria-hidden="true">
        <img src="/brand/landing/lnp-picada.webp" alt="" width="789" height="374" loading="lazy" />
      </figure>
      <div className="pl-tile pl-tile-centro" data-reveal>
        <div className="pl-tile-texto">
          <h2 id="pl-cierre-titulo" className="pl-h2 pl-cierre-titular">Seis preguntas y sabés qué hacer.</h2>
          <p className="pl-cierre-texto">
            Dico te dice qué resolver primero y qué plan te conviene. Si ya lo
            tenés claro, probá gratis o agendá una reunión.
          </p>
          <div className="pl-acciones">
            <BotonDiagnostico />
            <a className="pl-enlace" href="/registro">Probar gratis</a>
            <LinkAgenda />
          </div>
        </div>
      </div>
      {/* El campo volt es donde aparece Dico: el mismo color del diagnostico. */}
      <div className="pl-tile pl-tile-volt">
        <img className="pl-dico-img pl-cierre-dico" src="/brand/dico/dico-2d-happy.png" alt="" width="256" height="256" data-reveal />
      </div>
    </section>
  );
}

/* ─────────────── 10. Pie: una linea ─────────────── */

function Pie() {
  return (
    <footer className="pl-pie">
      <p className="pl-pie-que">Dico, de Grupo Divianco. Buenos Aires.</p>
      <p className="pl-pie-links">
        <a className="pl-enlace" href={WHATSAPP_URL} target="_blank" rel="noreferrer" onClick={marcarWhatsApp}>
          WhatsApp {WHATSAPP_VISIBLE}
        </a>
        <LinkAgenda>Agendá una reunión</LinkAgenda>
        <a className="pl-enlace" href="mailto:hola@divianco.app">hola@divianco.app</a>
        <a className="pl-enlace" href="/entrar">Entrar</a>
      </p>
      <p className="pl-pie-legal">
        © {new Date().getFullYear()} Grupo Divianco. Fotos: productos de La Nona Pato y Crazy Miga.
      </p>
      <p className="pl-pie-horarios">
        WhatsApp {WHATSAPP_HORARIO}. Reuniones {AGENDA_HORARIO}.
      </p>
    </footer>
  );
}
