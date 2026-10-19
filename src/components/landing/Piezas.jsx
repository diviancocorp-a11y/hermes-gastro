// src/components/landing/Piezas.jsx
// Las piezas del producto que muestran la landing (src/pages/PlatformLanding.jsx)
// y el resultado del diagnostico (src/pages/Diagnostico.jsx): fragmentos de la
// interfaz de Dico construidos en HTML, oscuros (data-ui), con cifras de
// ejemplo que cierran entre si.
//
// Los estilos viven en src/styles/platform-landing.css (.pl-pieza y lo que
// cuelga de ella): las dos paginas lo cargan. Se extrajeron de la landing el
// 19/oct/2026 sin cambiar como se ven ahi: cada pieza arranca con el contenido
// de gastronomia, que es el que mostraba la landing.
//
// `rubro` cambia SOLO el contenido de ejemplo, para que el resultado del
// diagnostico de una barberia no muestre harina y comandas de cocina. Los ids
// son los de VERTICALES (src/lib/diagnostico.js); `otro` usa el contenido de
// comercio, que no promete nada de un rubro (catalogo, pedidos, caja, stock).
//
// REGLA DE CONTENIDO (la de la landing): nada que el producto no haga hoy. En
// comercio y servicios no hay recetas, asi que ninguna fila habla de costo por
// venta: en el cierre van las compras del dia, no el costo de lo vendido.

import { useState } from 'react';

const pesos = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;
const porcentaje = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** El contenido de ejemplo de un rubro, con gastronomia como base. */
const deRubro = (tabla, rubro) => tabla[rubro] || tabla.comercio;

/* ─────────────── Cierre de caja ─────────────── */

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
      // Sin recetas no hay costo por venta: lo que hay son las compras.
      ['Compras de mercadería', 745000],
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
      ['Compras de insumos', 25000],
      ['Personal', 248000],
      ['Gastos del día', 31000],
    ],
    lectura: 'El personal se llevó el 40 % de la venta. El martes fue el 22 %.',
  },
};
const RUBROS_DEL_CIERRE = Object.keys(CIERRES);

/* El cierre de caja de Dico. Con `elegible`, se elige el rubro y la cuenta
   cambia (la promesa de la landing); sin eso, queda fijo en `rubro`. */
export function PiezaCierre({ rubro = 'gastronomia', elegible = true }) {
  const [elegido, setElegido] = useState(CIERRES[rubro] ? rubro : 'comercio');
  const actual = elegible ? elegido : (CIERRES[rubro] ? rubro : 'comercio');
  const c = CIERRES[actual];
  const totalCostos = c.costos.reduce((s, [, m]) => s + m, 0);
  const neto = c.ventas - totalCostos;
  const margen = (neto / c.ventas) * 100;

  return (
    <div className="pl-pieza pl-cierre" data-ui aria-label={elegible ? undefined : 'Ejemplo: cierre de caja'}>
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Cierre de caja</span>
        <span className="pl-pieza-meta">{c.cuando}</span>
      </div>

      {elegible && (
        <div className="pl-segmento" role="group" aria-label="Rubro del ejemplo">
          {RUBROS_DEL_CIERRE.map((id) => (
            <button
              key={id}
              type="button"
              className="pl-segmento-op"
              aria-pressed={actual === id}
              onClick={() => setElegido(id)}
            >
              {CIERRES[id].nombre}
            </button>
          ))}
        </div>
      )}

      {/* key: al cambiar de rubro las filas se reemplazan y entran de nuevo */}
      <div className="pl-cierre-cuenta" key={actual} aria-live={elegible ? 'polite' : undefined}>
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

/* ─────────────── Receta con costo (solo gastronomia) ─────────────── */

// Bife: 4.200 + 540 + 360 = 5.100 de insumos; 18.000 - 5.100 - 2.775 = 10.125.
export function PiezaReceta() {
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

/* ─────────────── Turno con nomina ─────────────── */

// 186.000 / 490.000 = 37,96 %. Vale para cualquier rubro.
export function PiezaTurno() {
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

/* ─────────────── Arqueo ─────────────── */

// Registrado: 418.500 + 1.960.000 + 1.821.500 = 4.200.000 (el viernes del cierre).
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

const PEDIDOS = {
  gastronomia: {
    hora: '21:40',
    lista: [
      ['#214', 'Salón · mesa 6', 'En cocina', '$38.400', 'cocina'],
      ['#215', 'Mostrador', 'Listo', '$12.900', 'listo'],
      ['#216', 'Catálogo online · delivery', 'Confirmado', '$27.600', 'nuevo'],
      ['#217', 'Salón · mesa 2', 'Cobrado', '$51.300', 'cobrado'],
    ],
    resumen: '48 pedidos de 3 canales',
    total: '$1.126.000',
  },
  comercio: {
    hora: '19:10',
    lista: [
      ['#318', 'Mostrador', 'Cobrado', '$24.900', 'cobrado'],
      ['#319', 'Catálogo online · envío', 'Confirmado', '$61.500', 'nuevo'],
      ['#320', 'Catálogo online · retiro', 'Listo', '$18.700', 'listo'],
      ['#321', 'Mostrador', 'Preparando', '$9.800', 'cocina'],
    ],
    resumen: '36 pedidos de 2 canales',
    total: '$842.000',
  },
};

export function PiezaPedidos({ rubro = 'gastronomia' }) {
  const p = deRubro(PEDIDOS, rubro);
  return (
    <div className="pl-pieza pl-pedidos" data-ui aria-label="Ejemplo: pedidos de todos los canales">
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
    lectura: 'La harina quedó debajo del mínimo. Te avisé al celular.',
  },
  comercio: {
    lista: [
      ['Yerba mate 1 kg', '6 u.', 'mínimo 12 u.', true],
      ['Aceite de girasol 1,5 l', '18 u.', 'mínimo 10 u.', false],
      ['Fideos secos 500 g', '40 u.', 'mínimo 24 u.', false],
    ],
    lectura: 'La yerba quedó debajo del mínimo. Te avisé al celular.',
  },
  servicios: {
    lista: [
      ['Shampoo profesional 1 l', '2 u.', 'mínimo 4 u.', true],
      ['Cera para peinar', '11 u.', 'mínimo 6 u.', false],
      ['Hojas de afeitar', '140 u.', 'mínimo 100 u.', false],
    ],
    lectura: 'El shampoo quedó debajo del mínimo. Te avisé al celular.',
  },
};

export function PiezaStock({ rubro = 'gastronomia' }) {
  const s = deRubro(STOCK, rubro);
  return (
    <div className="pl-pieza pl-stock" data-ui aria-label="Ejemplo: stock con mínimo">
      <div className="pl-pieza-cab">
        <span className="pl-pieza-titulo">Stock</span>
        <span className="pl-pieza-meta">Actualizado con la última venta</span>
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
    case 'cierre': return <PiezaCierre rubro={rubro} elegible={false} />;
    case 'receta': return <PiezaReceta />;
    case 'turno': return <PiezaTurno />;
    case 'arqueo': return <PiezaArqueo />;
    case 'pedidos': return <PiezaPedidos rubro={rubro} />;
    case 'stock': return <PiezaStock rubro={rubro} />;
    default: return null;
  }
}
