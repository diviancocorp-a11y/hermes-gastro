/**
 * ConteoDeDeposito — la vista mobile 360 para contar parado en el depósito (1b).
 *
 * DONDE SE USA ESTO DE VERDAD
 * No en un escritorio: en el depósito, con el teléfono en una mano y a veces
 * con frío. De ahí salen las tres decisiones de esta pantalla:
 *
 *   +/- y no teclado   abrir el teclado numérico tapa media pantalla y obliga
 *                      a apuntar a un campo de 30px. Cada toque es un paso de
 *                      la unidad y el número grande se lee sin acercar nada.
 *   44px de botón      es el mínimo tocable con guante. No bajar.
 *   guardado por lote  contar es un recorrido largo. Si se guardara fila por
 *                      fila, cortar a la mitad dejaría medio depósito contado
 *                      y medio no, sin forma de saber cuál mitad.
 *
 * LO QUE SE GUARDA ES LA DIFERENCIA, NO EL NÚMERO
 * El libro guarda movimientos, no fotos. Un insumo cuyo conteo coincide con lo
 * registrado no genera movimiento: un ajuste de cero ensucia el libro y además
 * lo rechaza la base.
 *
 * EL PASO DEPENDE DE LA UNIDAD
 * Contar cajas de a 0.1 no tiene sentido y contar harina de a 1 kg tampoco. El
 * paso sale de la unidad del insumo, no de una constante.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  nivelContraMinimo, guardarConteoDeDeposito, pasoDe,
} from '../../../services/platformInventory';

const num = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

/** Redondea a 3 decimales: sumar 0.5 en punto flotante deja colas de 0.30000000004. */
const limpio = (n) => Math.round(Number(n) * 1000) / 1000;

function Item({ ing, contado, onCambiar }) {
  const paso = pasoDe(ing.unit);
  const tocado = contado !== Number(ing.stock);
  // El nivel se muestra contra lo CONTADO, no contra lo registrado: quien
  // cuenta quiere ver el efecto de lo que acaba de contar.
  const { nivel, estado } = nivelContraMinimo({ ...ing, stock: contado });

  return (
    <li className="ag-conteo-item" data-tocado={tocado} data-estado={estado}>
      <div className="ag-conteo-item-fila">
        <div className="ag-conteo-item-nombre">
          <strong>{ing.name}</strong>
          {Number(ing.min_stock) > 0
            ? <span className="ag-conteo-item-minimo">mín. {num(ing.min_stock)} {ing.unit || 'u'}</span>
            : <span className="ag-conteo-item-minimo">sin mínimo</span>}
        </div>

        <div className="ag-conteo-control">
          <button
            type="button"
            className="ag-conteo-paso"
            aria-label={`Restar ${paso} ${ing.unit || 'u'} de ${ing.name}`}
            disabled={contado <= 0}
            onClick={() => onCambiar(ing.id, Math.max(0, limpio(contado - paso)))}
          >−</button>

          <span className="ag-conteo-valor" aria-live="polite">
            {num(contado)} {ing.unit || 'u'}
          </span>

          <button
            type="button"
            className="ag-conteo-paso"
            aria-label={`Sumar ${paso} ${ing.unit || 'u'} a ${ing.name}`}
            onClick={() => onCambiar(ing.id, limpio(contado + paso))}
          >+</button>
        </div>
      </div>

      <div className="ag-conteo-barra" data-sin-minimo={nivel == null}>
        {nivel != null && <i style={{ width: `${Math.round(nivel * 100)}%` }} />}
      </div>
    </li>
  );
}

export default function ConteoDeDeposito({
  tenantId,
  insumos = [],
  cierreEnTexto,
  onGuardado,
  onMerma,
  onCerrar,
  showToast,
}) {
  const [filtro, setFiltro] = useState('bajo');
  // El borrador arranca vacío y cada insumo cae a su stock registrado: así el
  // que no se tocó no genera movimiento, aunque esté en pantalla.
  const [contados, setContados] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const contadoDe = useCallback(
    (ing) => (ing.id in contados ? contados[ing.id] : Number(ing.stock) || 0),
    [contados]);

  const cambiar = useCallback((id, valor) => {
    setContados(prev => ({ ...prev, [id]: valor }));
    setError(null);
  }, []);

  const visibles = useMemo(() => {
    const orden = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es-AR');
    if (filtro === 'bajo') {
      return insumos.filter(i => {
        const { estado } = nivelContraMinimo(i);
        return estado === 'critico' || estado === 'bajo';
      }).sort(orden);
    }
    if (filtro === 'todos') return [...insumos].sort(orden);
    return insumos.filter(i => i.category === filtro).sort(orden);
  }, [insumos, filtro]);

  // Las categorías reales del negocio, no una lista fija: un retail no tiene
  // "Cocina" y una cocina no tiene "Perfumería".
  const categorias = useMemo(() => {
    const vistas = new Set();
    for (const i of insumos) if (i.category) vistas.add(i.category);
    return [...vistas].sort((a, b) => a.localeCompare(b, 'es-AR')).slice(0, 2);
  }, [insumos]);

  const cambios = useMemo(
    () => insumos.filter(i => contadoDe(i) !== Number(i.stock)),
    [insumos, contadoDe]);

  const bajos = useMemo(
    () => insumos.filter(i => {
      const { estado } = nivelContraMinimo(i);
      return estado === 'critico' || estado === 'bajo';
    }).length, [insumos]);

  const guardar = async () => {
    if (!cambios.length) return;
    setGuardando(true);
    setError(null);
    const r = await guardarConteoDeDeposito({
      tenantId,
      conteos: cambios.map(i => ({ ingredient_id: i.id, contado: contadoDe(i) })),
    });
    setGuardando(false);
    if (r?.__error) { setError(r.message || 'No se pudo guardar el conteo.'); return; }
    showToast?.(`Conteo guardado: ${cambios.length} ${cambios.length === 1 ? 'insumo' : 'insumos'}`);
    setContados({});
    await onGuardado?.();
    onCerrar?.();
  };

  return (
    <section className="ag-conteo">
      <header className="ag-conteo-head">
        <div>
          <span className="ag-conteo-kicker">
            Conteo{bajos > 0 && <> · <b>{bajos} bajo mínimo</b></>}
          </span>
          <h1>Stock</h1>
        </div>
        {cierreEnTexto && <div className="ag-conteo-reloj">{cierreEnTexto}</div>}
      </header>

      <div className="ag-conteo-solapas">
        <button
          type="button" className="ag-conteo-solapa"
          aria-pressed={filtro === 'bajo'} onClick={() => setFiltro('bajo')}
        >Bajo</button>
        <button
          type="button" className="ag-conteo-solapa"
          aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}
        >Todos</button>
        {categorias.map(c => (
          <button
            key={c} type="button" className="ag-conteo-solapa"
            aria-pressed={filtro === c} onClick={() => setFiltro(c)}
          >{c}</button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="ag-stock-vacio">
          {filtro === 'bajo'
            ? 'Ningún insumo está bajo mínimo. Pasá a "Todos" para contar el resto.'
            : 'No hay insumos para contar acá.'}
        </p>
      ) : (
        <ul className="ag-conteo-lista">
          {visibles.map(ing => (
            <Item key={ing.id} ing={ing} contado={contadoDe(ing)} onCambiar={cambiar} />
          ))}
        </ul>
      )}

      <div className="ag-conteo-guardar">
        <div className="ag-conteo-cambios">
          <span>
            {cambios.length === 0 ? 'Sin cambios todavía' : (
              <>Vas a ajustar <b>{cambios.length}</b> {cambios.length === 1 ? 'insumo' : 'insumos'}</>
            )}
          </span>
          {onCerrar && (
            <button type="button" className="ag-btn-mini" onClick={onCerrar} aria-label="Cerrar conteo">−</button>
          )}
        </div>
        {error && <span className="ag-stock-error">{error}</span>}
        <div className="ag-conteo-guardar-botones">
          <button
            type="button" className="ag-btn-primary"
            disabled={!cambios.length || guardando} onClick={guardar}
          >
            {guardando ? 'Guardando…' : 'Guardar conteo'}
          </button>
          {onMerma && (
            <button type="button" className="ag-btn-ghost" onClick={() => onMerma(null)}>Merma</button>
          )}
        </div>
      </div>
    </section>
  );
}
