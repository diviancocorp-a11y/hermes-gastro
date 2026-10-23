// src/components/landing/Piezas.jsx
// Las piezas del producto que muestran la landing (src/pages/PlatformLanding.jsx)
// y el resultado del diagnostico (src/components/landing/Diagnostico.jsx):
// fragmentos de la interfaz de Dico construidos en HTML, oscuros (data-ui),
// con cifras de ejemplo que cierran entre si.
//
// Los estilos viven en src/styles/platform-landing.css (.pl-pieza y lo que
// cuelga de ella): las dos paginas lo cargan.
//
// `rubro` cambia SOLO el contenido de ejemplo, para que el resultado del
// diagnostico de una barberia no muestre harina y comandas de cocina. Los ids
// son los de VERTICALES (src/lib/diagnostico.js); `otro` usa el contenido de
// comercio, que no promete nada de un rubro (catalogo, pedidos, caja, stock).
//
// REGLA DE CONTENIDO (verificada en el codigo el 19/oct/2026; el resultado
// del dia, el 20/oct):
//   - el resultado del dia (resultado_del_dia, 0103; solapa "Hoy" de Ventas)
//     da la ganancia neta por sucursal: ventas, costo segun la receta, nomina
//     fichada, merma, gastos del dia y fijos del mes prorrateados. El costo
//     por venta sale SOLO de las recetas: fuera de gastronomia el dia no lo
//     tiene, asi que ahi la pieza muestra el resultado del MES (MonthSummary),
//     con las compras, que es la cuenta completa;
//   - el costo laboral es POR DIA (labor_cost_vs_sales), no por turno;
//   - el stock entra con compras y conteos; desde la 0104, completar un pedido
//     descuenta la receta (gastronomia) o el articulo mismo si no tiene receta
//     y tiene stock (comercio, y los productos que vende un servicio). El
//     minimo con aviso EN EL PANEL existe solo para insumos (ingredients):
//     el minimo por articulo y que un servicio descuente sus insumos, no;
//   - Dico solo "dice" (pl-lectura) lo que respalda una regla del sistema;
//     el resto es texto del sistema (pl-pieza-nota);
//   - el salon y las mesas son solo de gastronomia; en comercio y servicios no
//     hay costo por venta (sale de las recetas): van las compras.

import { useLayoutEffect, useRef, useState } from 'react';
import { sinMovimiento } from './useEntradas';

const pesos = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;
const porcentaje = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** El contenido de ejemplo de un rubro; si no hay, el de comercio. */
const deRubro = (tabla, rubro) => tabla[rubro] || tabla.comercio;

/* ─────────────── Resultado: la noche en gastronomia, el mes en el resto ─────────────── */

// Gastronomia: un viernes, con las lineas y los nombres de la solapa "Hoy"
// del panel (lineasDelResultado en src/services/platformResultado.js; el
// detalle va despues de " · "). Es un dia fuerte de un mes de ~42,6 M:
// 2.168.000 - 18.000 - 645.000 - 387.000 - 43.000 - 96.000 - 310.000 = 669.000;
// 30,9 % sobre ventas, como margenDelDia. Lo cobrado (ventas - descuentos)
// es 2.150.000, lo registrado en PiezaArqueo. Nomina: 43 h a $9.000.
// Comercio y servicios: el mes, con las compras (sin recetas el dia no tiene
// costo de lo vendido y su "ganancia" seria mas alta que la real):
// comercio 18.900.000 - 11.340.000 - 5.290.000 = 2.270.000 (12,0 %);
// servicios 9.400.000 - 610.000 - 6.150.000 = 2.640.000 (28,1 %).
const RESULTADOS = {
  gastronomia: {
    nombre: 'Gastronomía',
    titulo: 'Resultado de hoy',
    meta: 'Viernes',
    periodo: 'un viernes',
    neto: 'Ganancia neta',
    ventas: 2168000,
    costos: [
      ['Descuentos', 18000],
      ['Costo de lo vendido · según recetas', 645000],
      ['Nómina · 43 h fichadas', 387000],
      ['Merma', 43000],
      ['Gastos del día', 96000],
      ['Gastos fijos · parte del mes', 310000],
    ],
  },
  comercio: {
    nombre: 'Comercio',
    titulo: 'Resultado del mes',
    meta: 'Septiembre',
    periodo: 'el mes',
    neto: 'Resultado',
    ventas: 18900000,
    costos: [
      // Sin recetas no hay costo por venta: lo que hay son las compras.
      ['Compras de mercadería', 11340000],
      ['Gastos', 5290000],
    ],
  },
  servicios: {
    nombre: 'Servicios',
    titulo: 'Resultado del mes',
    meta: 'Septiembre',
    periodo: 'el mes',
    neto: 'Resultado',
    ventas: 9400000,
    costos: [
      ['Compras de insumos', 610000],
      ['Gastos', 6150000],
    ],
  },
};
const RUBROS_DEL_RESULTADO = Object.keys(RESULTADOS);

/** Un token de tiempo ('160ms' o '0.16s') en milisegundos. */
const aMs = (valor) => {
  const v = valor.trim();
  const n = parseFloat(v);
  return v.endsWith('ms') ? n : v.endsWith('s') ? n * 1000 : n;
};

/** La cuenta se arma una vez, al entrar en pantalla: las filas entran
 *  escalonadas (CSS, bajo .pl-cuenta-arma), despues el neto y su cifra cuenta
 *  desde 0, y al final aparece el margen. El estado oculto solo existe bajo
 *  esa clase, que se pone aca: sin IntersectionObserver, con movimiento
 *  reducido o en el molde invisible del hero (inert), la cuenta queda armada
 *  desde el primer pintado. `clave` (el rubro) la vuelve a armar.
 *  Devuelve las refs de la cuenta y de la cifra. */
function useCuentaQueSeArma(final, clave) {
  const cuentaRef = useRef(null);
  const cifraRef = useRef(null);
  // useLayoutEffect: la clase entra antes del primer pintado, asi las filas
  // no se ven enteras y despues desaparecen para entrar.
  useLayoutEffect(() => {
    const cuenta = cuentaRef.current;
    // El nodo de texto que pinto React: se le cambia el valor sin re-render
    // por cuadro y al terminar queda en el mismo `final` que tiene React.
    const texto = cifraRef.current?.firstChild;
    if (!cuenta || !texto || cuenta.closest('[inert]') || sinMovimiento()
      || typeof IntersectionObserver === 'undefined') return undefined;

    // Tiempos de los tokens (plataforma-claro.css). El paso entre filas es
    // --pl-paso (rapido / 4) en el CSS: el neto entra cuando termina la
    // escalera, una fila despues de la ultima.
    const estilo = getComputedStyle(cuenta);
    const rapido = aMs(estilo.getPropertyValue('--pc-t-rapido'));
    const dura = aMs(estilo.getPropertyValue('--pc-t-estructura'));
    if (!(rapido > 0) || !(dura > 0)) return undefined;
    const espera = (rapido / 4) * cuenta.querySelectorAll('.pl-fila').length;

    let vivo = true;
    let cuadro = 0;
    let reloj = 0;
    let respaldo = 0;
    cuenta.classList.add('pl-cuenta-arma');

    // La cifra pasa a $0 recien al contar: hasta ahi el neto esta oculto y,
    // si se imprime antes, sale el valor final.
    const contar = () => {
      texto.nodeValue = pesos(0);
      cuenta.classList.add('is-cuenta');
      const inicio = performance.now();
      const avanzar = (ahora) => {
        const t = Math.min(1, (ahora - inicio) / dura);
        // Sale rapido y asienta, como --pc-curva; sin pasarse del final.
        texto.nodeValue = pesos(final * (1 - (1 - t) ** 3));
        if (t < 1) cuadro = requestAnimationFrame(avanzar);
        else cuenta.classList.add('is-lista');
      };
      cuadro = requestAnimationFrame(avanzar);
    };

    const arrancar = () => {
      if (!vivo || cuenta.classList.contains('is-in')) return;
      clearTimeout(respaldo);
      cuenta.classList.add('is-in');
      reloj = setTimeout(contar, espera);
    };

    // En el hero la pieza vive en una columna que entra con su propia
    // animacion (.pl-anim .dg-cerrado .pl-split-lado > *): la escalera espera
    // a que termine, si no se jugaria con el contenedor invisible. Respaldo
    // por si `finished` no llega: lo que dura esa entrada (rapido +
    // estructura) mas un rapido de holgura, para no ganarle a `finished`.
    const entrando = () => {
      const pendientes = [];
      for (let n = cuenta.parentElement; n; n = n.parentElement) {
        for (const a of n.getAnimations?.() || []) {
          const fin = a.effect?.getComputedTiming?.().endTime;
          if (a.playState !== 'finished' && Number.isFinite(fin)) pendientes.push(a.finished);
        }
      }
      if (!pendientes.length) { arrancar(); return; }
      respaldo = setTimeout(arrancar, rapido * 2 + dura);
      Promise.allSettled(pendientes).then(arrancar);
    };

    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      entrando();
    }, { threshold: 0.3 });
    io.observe(cuenta);

    return () => {
      vivo = false;
      io.disconnect();
      clearTimeout(respaldo);
      clearTimeout(reloj);
      cancelAnimationFrame(cuadro);
      texto.nodeValue = pesos(final);
      cuenta.classList.remove('pl-cuenta-arma', 'is-in', 'is-cuenta', 'is-lista');
    };
  }, [final, clave]);
  return [cuentaRef, cifraRef];
}

/* El resultado en Dico: la noche en gastronomia, el mes en comercio y
   servicios. Con `elegible`, se elige el rubro y la cuenta cambia (la pieza
   viva del hero); sin eso, queda fijo en `rubro`. */
export function PiezaResultado({ rubro = 'gastronomia', elegible = true }) {
  const inicial = RESULTADOS[rubro] ? rubro : 'comercio';
  const [elegido, setElegido] = useState(inicial);
  const actual = elegible ? elegido : inicial;
  const r = RESULTADOS[actual];
  const totalCostos = r.costos.reduce((s, [, m]) => s + m, 0);
  const resultado = r.ventas - totalCostos;
  const margen = (resultado / r.ventas) * 100;
  const [cuentaRef, cifraRef] = useCuentaQueSeArma(resultado, actual);

  return (
    <div
      className="pl-pieza pl-resultado"
      data-ui
      role="figure"
      aria-label={`Ejemplo: resultado de ${r.periodo} en ${r.nombre.toLowerCase()}`}
    >
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">{r.titulo}</span>
        <span className="pl-pieza-meta">{r.meta}</span>
      </div>

      {elegible && (
        <div className="pl-segmento" role="group" aria-label="Rubro del ejemplo">
          {RUBROS_DEL_RESULTADO.map((id) => (
            <button
              key={id}
              type="button"
              className="pl-segmento-op"
              aria-pressed={actual === id}
              onClick={() => setElegido(id)}
            >
              {RESULTADOS[id].nombre}
            </button>
          ))}
        </div>
      )}

      {/* key: al cambiar de rubro las filas se reemplazan y entran de nuevo */}
      <div
        className="pl-resultado-cuenta"
        key={actual}
        ref={cuentaRef}
        aria-live={elegible ? 'polite' : undefined}
      >
        <dl className="pl-filas">
          <div className="pl-fila">
            <dt>Ventas</dt>
            <dd>{pesos(r.ventas)}</dd>
          </div>
          {r.costos.map(([concepto, monto]) => (
            <div className="pl-fila" key={concepto}>
              <dt>{concepto}</dt>
              <dd>−{pesos(monto)}</dd>
            </div>
          ))}
        </dl>
        <div className="pl-resultado-neto">
          <span className="pl-resultado-neto-nombre">{r.neto}</span>
          {/* La cifra que cuenta no se lee (ni la anuncia aria-live cuadro a
              cuadro): el lector escucha solo el valor final. */}
          <span className="pl-resultado-neto-cifra" ref={cifraRef} aria-hidden="true">{pesos(resultado)}</span>
          <span className="pl-oculto">{pesos(resultado)}</span>
          <span className="pl-resultado-neto-margen">{porcentaje(margen)} % de la venta</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Receta con costo (solo gastronomia) ─────────────── */

// El costeo de Dico (services/platformRecipes.js): insumos x (1 + merma% +
// gastos%). Bife: 4.200 + 540 + 360 = 5.100 de insumos; con 15 % de merma y
// gastos, 765 mas: 5.865 de costo; 18.000 - 5.865 = 12.135, el 67,4 %.
export function PiezaReceta() {
  return (
    <div className="pl-pieza pl-receta" data-ui role="figure" aria-label="Ejemplo: receta con costo">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Bife de chorizo con papas</span>
        <span className="pl-pieza-meta">Precio $18.000</span>
      </div>
      <dl className="pl-filas">
        <div className="pl-fila"><dt>Bife de chorizo · 350 g</dt><dd>$4.200</dd></div>
        <div className="pl-fila"><dt>Papas · 300 g</dt><dd>$540</dd></div>
        <div className="pl-fila"><dt>Manteca, sal y aceite</dt><dd>$360</dd></div>
        <div className="pl-fila pl-fila-suma"><dt>Insumos</dt><dd>$5.100</dd></div>
        <div className="pl-fila pl-fila-suma"><dt>Merma y gastos · 15 %</dt><dd>$765</dd></div>
      </dl>
      <div className="pl-pieza-cifra">
        <span className="pl-pieza-cifra-nombre">Te deja</span>
        <span className="pl-pieza-cifra-valor pl-oro">$12.135</span>
        <span className="pl-pieza-cifra-nota">67,4 % del precio</span>
      </div>
      <p className="pl-pieza-nota">Costo calculado con el último precio de cada insumo.</p>
    </div>
  );
}

/* ─────────────── Un dia: personal contra venta ─────────────── */

// 186.000 / 490.000 = 37,96 %. Vale para cualquier rubro: el costo laboral es
// por dia, con las horas fichadas.
export function PiezaTurno() {
  return (
    <div className="pl-pieza pl-turno" data-ui role="figure" aria-label="Ejemplo: personal contra la venta de un día">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Martes 13 de octubre</span>
        <span className="pl-pieza-meta">3 personas · 24 h fichadas</span>
      </div>
      <div className="pl-turno-cuenta">
        <div><span className="pl-pieza-meta">Ventas del día</span><span className="pl-turno-monto">$490.000</span></div>
        <div><span className="pl-pieza-meta">Personal</span><span className="pl-turno-monto">$186.000</span></div>
      </div>
      <div className="pl-pieza-cifra">
        <span className="pl-pieza-cifra-nombre">Personal sobre venta</span>
        <span className="pl-pieza-cifra-valor">38 %</span>
      </div>
    </div>
  );
}

/* ─────────────── Arqueo ─────────────── */

// El mismo viernes del resultado: registrado 418.500 + 958.000 + 773.500 =
// 2.150.000, lo cobrado esa noche (ventas 2.168.000 - descuentos 18.000).
export function PiezaArqueo() {
  const medios = [
    ['Efectivo', '$412.000', '$418.500'],
    ['Tarjeta', '$958.000', '$958.000'],
    ['MercadoPago', '$773.500', '$773.500'],
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

/* ─────────────── Pedidos de todos los canales ─────────────── */

// El salon (mesas) es solo de gastronomia.
const PEDIDOS = {
  gastronomia: {
    hora: '21:40',
    lista: [
      ['#214', 'Salón · mesa 6', 'En cocina', '$38.400', 'curso'],
      ['#215', 'Mostrador', 'Listo', '$12.900', 'listo'],
      ['#216', 'Catálogo online · delivery', 'Confirmado', '$27.600', 'curso'],
      ['#217', 'Salón · mesa 2', 'Cobrado', '$51.300', 'cobrado'],
    ],
    resumen: '48 pedidos de 3 canales',
    total: '$1.126.000',
  },
  comercio: {
    hora: '19:10',
    lista: [
      ['#318', 'Mostrador', 'Cobrado', '$24.900', 'cobrado'],
      ['#319', 'Catálogo online · envío', 'Confirmado', '$61.500', 'curso'],
      ['#320', 'Catálogo online · retiro', 'Listo', '$18.700', 'listo'],
      ['#321', 'Mostrador', 'Preparando', '$9.800', 'curso'],
    ],
    resumen: '36 pedidos de 2 canales',
    total: '$842.000',
  },
  servicios: {
    hora: '18:30',
    lista: [
      ['#512', 'Mostrador · corte y barba', 'Cobrado', '$18.000', 'cobrado'],
      ['#513', 'Catálogo online · color', 'Confirmado', '$42.000', 'curso'],
      ['#514', 'Mostrador · corte', 'Cobrado', '$12.000', 'cobrado'],
      ['#515', 'Catálogo online · manicura', 'Confirmado', '$15.500', 'curso'],
    ],
    resumen: '22 servicios de 2 canales',
    total: '$318.500',
  },
};

export function PiezaPedidos({ rubro = 'gastronomia' }) {
  const p = deRubro(PEDIDOS, rubro);
  return (
    <div className="pl-pieza pl-pedidos" data-ui role="figure" aria-label="Ejemplo: pedidos de todos los canales">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Pedidos de hoy</span>
        <span className="pl-pieza-meta">{p.hora}</span>
      </div>
      <ul className="pl-pedidos-lista">
        {p.lista.map(([n, canal, estado, monto, tono]) => (
          <li key={n} className="pl-pedido">
            <span className="pl-pedido-n">{n}</span>
            <span className="pl-pedido-canal">{canal}</span>
            <span className={`pl-pedido-estado pl-estado-${tono}`}>{estado}</span>
            <span className="pl-pedido-monto">{monto}</span>
          </li>
        ))}
      </ul>
      <div className="pl-pieza-cifra">
        <span className="pl-pieza-cifra-nombre">{p.resumen}</span>
        <span className="pl-pieza-cifra-valor pl-oro">{p.total}</span>
      </div>
    </div>
  );
}

/* ─────────────── Stock ─────────────── */

// Gastronomia: los insumos tienen minimo con aviso en el panel y la venta
// descuenta la receta. Comercio: la venta descuenta el articulo; el minimo
// por articulo no existe todavia. Servicios: los productos que vende bajan
// con la venta; los insumos tienen minimo pero no se descuentan solos.
const STOCK = {
  gastronomia: {
    meta: 'Compras y ventas, según la receta',
    lista: [
      ['Harina 000', '6 kg', 'mínimo 10 kg', true],
      ['Muzzarella', '8,4 kg', 'la venta #214 usó 0,3 kg', false],
      ['Tomate perita', '12 kg', 'mínimo 8 kg', false],
    ],
    lectura: 'La harina quedó debajo del mínimo. Te lo marqué en el panel.',
  },
  comercio: {
    meta: 'Compras y ventas',
    lista: [
      ['Yerba mate 1 kg', '11 u.', 'la venta #318 descontó 1 u.', false],
      ['Aceite de girasol 1,5 l', '18 u.', 'la compra del lunes sumó 24 u.', false],
      ['Fideos secos 500 g', '38 u.', 'la venta #321 descontó 2 u.', false],
    ],
    nota: 'Cada venta descuenta el artículo del stock.',
  },
  servicios: {
    meta: 'Compras y ventas',
    lista: [
      ['Cera para peinar', '10 u.', 'la venta #514 descontó 1 u.', false],
      ['Shampoo profesional 1 l', '2 u.', 'mínimo 4 u.', true],
      ['Hojas de afeitar', '140 u.', 'mínimo 100 u.', false],
    ],
    lectura: 'El shampoo quedó debajo del mínimo. Te lo marqué en el panel.',
  },
};

export function PiezaStock({ rubro = 'gastronomia' }) {
  const s = deRubro(STOCK, rubro);
  return (
    <div className="pl-pieza pl-stock" data-ui role="figure" aria-label="Ejemplo: stock">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Stock</span>
        <span className="pl-pieza-meta">{s.meta}</span>
      </div>
      <ul className="pl-stock-lista">
        {s.lista.map(([nombre, hay, detalle, bajo]) => (
          <li key={nombre} className={`pl-stock-item${bajo ? ' bajo' : ''}`}>
            <span className="pl-stock-nombre">{nombre}</span>
            <span className="pl-stock-hay">{hay}</span>
            <span className="pl-stock-min">{detalle}</span>
          </li>
        ))}
      </ul>
      {s.lectura && (
        <p className="pl-lectura">
          <span className="pl-lectura-quien">Dico</span>
          {s.lectura}
        </p>
      )}
      {s.nota && <p className="pl-pieza-nota">{s.nota}</p>}
    </div>
  );
}

/** La pieza que nombra `solucion().pieza` (src/lib/diagnostico.js). */
export function PiezaPorNombre({ nombre, rubro }) {
  switch (nombre) {
    case 'cierre': return <PiezaResultado rubro={rubro} elegible={false} />;
    case 'receta': return <PiezaReceta />;
    case 'turno': return <PiezaTurno />;
    case 'arqueo': return <PiezaArqueo />;
    case 'pedidos': return <PiezaPedidos rubro={rubro} />;
    case 'stock': return <PiezaStock rubro={rubro} />;
    default: return null;
  }
}
