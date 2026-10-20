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
// REGLA DE CONTENIDO (verificada en el codigo el 19/oct/2026):
//   - el resultado es MENSUAL (MonthSummary): no hay resultado del dia;
//   - el costo laboral es POR DIA (labor_cost_vs_sales), no por turno;
//   - el stock se mueve con compras, merma y conteos (y en gastronomia con la
//     receta de cada venta, desde la 0104), y el
//     aviso de stock bajo es EN EL PANEL;
//   - el salon y las mesas son solo de gastronomia; en comercio y servicios no
//     hay costo por venta (sale de las recetas): van las compras.

import { useState } from 'react';

const pesos = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;
const porcentaje = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** El contenido de ejemplo de un rubro; si no hay, el de comercio. */
const deRubro = (tabla, rubro) => tabla[rubro] || tabla.comercio;

/* ─────────────── Resultado del mes ─────────────── */

// El mismo mes en tres rubros. Las cifras son de ejemplo y cierran:
// gastronomia 42.600.000 - 12.780.000 - 21.300.000 = 8.520.000 (20,0 %);
// comercio 18.900.000 - 11.340.000 - 5.290.000 = 2.270.000 (12,0 %);
// servicios 9.400.000 - 610.000 - 6.150.000 = 2.640.000 (28,1 %).
const RESULTADOS = {
  gastronomia: {
    nombre: 'Gastronomía',
    ventas: 42600000,
    costos: [
      ['Costo según tus recetas', 12780000],
      ['Gastos', 21300000],
    ],
  },
  comercio: {
    nombre: 'Comercio',
    ventas: 18900000,
    costos: [
      // Sin recetas no hay costo por venta: lo que hay son las compras.
      ['Compras de mercadería', 11340000],
      ['Gastos', 5290000],
    ],
  },
  servicios: {
    nombre: 'Servicios',
    ventas: 9400000,
    costos: [
      ['Compras de insumos', 610000],
      ['Gastos', 6150000],
    ],
  },
};
const RUBROS_DEL_RESULTADO = Object.keys(RESULTADOS);

/* El resultado del mes en Dico. Con `elegible`, se elige el rubro y la cuenta
   cambia (la pieza viva del hero); sin eso, queda fijo en `rubro`. */
export function PiezaResultado({ rubro = 'gastronomia', elegible = true }) {
  const inicial = RESULTADOS[rubro] ? rubro : 'comercio';
  const [elegido, setElegido] = useState(inicial);
  const actual = elegible ? elegido : inicial;
  const r = RESULTADOS[actual];
  const totalCostos = r.costos.reduce((s, [, m]) => s + m, 0);
  const resultado = r.ventas - totalCostos;
  const margen = (resultado / r.ventas) * 100;

  return (
    <div
      className="pl-pieza pl-resultado"
      data-ui
      role="figure"
      aria-label={`Ejemplo: resultado del mes en ${r.nombre.toLowerCase()}`}
    >
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Resultado del mes</span>
        <span className="pl-pieza-meta">Septiembre</span>
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
      <div className="pl-resultado-cuenta" key={actual} aria-live={elegible ? 'polite' : undefined}>
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
          <span className="pl-resultado-neto-nombre">Resultado</span>
          <span className="pl-resultado-neto-cifra">{pesos(resultado)}</span>
          <span className="pl-resultado-neto-margen">{porcentaje(margen)} % de la venta</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Receta con costo (solo gastronomia) ─────────────── */

// Bife: 4.200 + 540 + 360 = 5.100 de insumos; 18.000 - 5.100 - 2.775 = 10.125.
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

/* ─────────────── Un dia: personal contra venta ─────────────── */

// 186.000 / 490.000 = 37,96 %. Vale para cualquier rubro: el costo laboral es
// por dia, con las horas fichadas.
export function PiezaTurno() {
  return (
    <div className="pl-pieza pl-turno" data-ui role="figure" aria-label="Ejemplo: personal contra la venta de un día">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Martes 14 de octubre</span>
        <span className="pl-pieza-meta">3 personas · 24 h fichadas</span>
      </div>
      <div className="pl-turno-cuenta">
        <div><span className="pl-pieza-meta">Ventas del día</span><span className="pl-turno-monto">$490.000</span></div>
        <div><span className="pl-pieza-meta">Personal</span><span className="pl-turno-monto">$186.000</span></div>
      </div>
      <div className="pl-pieza-cifra">
        <span className="pl-pieza-cifra-nombre">Personal sobre venta</span>
        <span className="pl-pieza-cifra-valor pl-alerta">38 %</span>
      </div>
      <p className="pl-lectura">
        <span className="pl-lectura-quien">Dico</span>
        Arriba del 30 %, el día no paga sus sueldos.
      </p>
    </div>
  );
}

/* ─────────────── Arqueo ─────────────── */

// Registrado: 418.500 + 1.960.000 + 1.821.500 = 4.200.000.
export function PiezaArqueo() {
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

/* ─────────────── Stock con minimo ─────────────── */

const STOCK = {
  gastronomia: {
    lista: [
      ['Harina 000', '6 kg', 'mínimo 10 kg', true],
      ['Muzzarella', '8,4 kg', 'mínimo 5 kg', false],
      ['Tomate perita', '12 kg', 'mínimo 8 kg', false],
    ],
    lectura: 'La harina quedó debajo del mínimo. Te lo marqué en el panel.',
  },
  comercio: {
    lista: [
      ['Yerba mate 1 kg', '6 u.', 'mínimo 12 u.', true],
      ['Aceite de girasol 1,5 l', '18 u.', 'mínimo 10 u.', false],
      ['Fideos secos 500 g', '40 u.', 'mínimo 24 u.', false],
    ],
    lectura: 'La yerba quedó debajo del mínimo. Te lo marqué en el panel.',
  },
  servicios: {
    lista: [
      ['Shampoo profesional 1 l', '2 u.', 'mínimo 4 u.', true],
      ['Cera para peinar', '11 u.', 'mínimo 6 u.', false],
      ['Hojas de afeitar', '140 u.', 'mínimo 100 u.', false],
    ],
    lectura: 'El shampoo quedó debajo del mínimo. Te lo marqué en el panel.',
  },
};

export function PiezaStock({ rubro = 'gastronomia' }) {
  const s = deRubro(STOCK, rubro);
  return (
    <div className="pl-pieza pl-stock" data-ui role="figure" aria-label="Ejemplo: stock con mínimo">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Stock</span>
        <span className="pl-pieza-meta">Actualizado con la última compra</span>
      </div>
      <ul className="pl-stock-lista">
        {s.lista.map(([nombre, hay, minimo, bajo]) => (
          <li key={nombre} className={`pl-stock-item${bajo ? ' bajo' : ''}`}>
            <span className="pl-stock-nombre">{nombre}</span>
            <span className="pl-stock-hay">{hay}</span>
            <span className="pl-stock-min">{minimo}</span>
          </li>
        ))}
      </ul>
      <p className="pl-lectura">
        <span className="pl-lectura-quien">Dico</span>
        {s.lectura}
      </p>
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
