/**
 * SugerenciaEditor — "Agregale papas a tu shawarma": ofrecer ESTE producto,
 * a un precio especial, cuando el cliente pide de ciertas categorias.
 * Va dentro de ProductEditor, solo con el producto ya guardado (la regla
 * apunta a su id). Guarda por su cuenta: es otra tabla (product_suggestions).
 */
import { useEffect, useState } from 'react';
import { fetchSugerenciaDeProducto, saveSugerencia, deleteSugerencia } from '../../../services/platformAdmin';
import './opciones-editor.css';

const VACIA = { title: '', body: '', when_categories: [], special_price: '', max_per_item: 1, active: true };

export default function SugerenciaEditor({ tenantId, product, categories = [] }) {
  const [regla, setRegla] = useState(null); // null = cargando
  const [estado, setEstado] = useState({ tipo: 'idle', texto: '' });
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetchSugerenciaDeProducto(tenantId, product.id).then((r) => {
      if (vivo) setRegla(r ? { ...r, special_price: r.special_price ?? '' } : { ...VACIA, title: `Agregale ${product.name}` });
    });
    return () => { vivo = false; };
  }, [tenantId, product.id, product.name]);

  if (!regla) return null;
  const set = (parche) => { setRegla((r) => ({ ...r, ...parche })); setEstado({ tipo: 'idle', texto: '' }); };
  const alternar = (cat) => set({
    when_categories: regla.when_categories.includes(cat)
      ? regla.when_categories.filter((c) => c !== cat)
      : [...regla.when_categories, cat],
  });
  const otras = categories.filter((c) => c && c !== product.category);

  const guardar = async () => {
    setOcupado(true);
    const res = await saveSugerencia(tenantId, product.id, regla);
    setOcupado(false);
    if (res?.__error) { setEstado({ tipo: 'error', texto: res.message }); return; }
    setRegla({ ...res, special_price: res.special_price ?? '' });
    setEstado({ tipo: 'ok', texto: 'Sugerencia guardada.' });
  };
  const quitar = async () => {
    if (!regla.id) return;
    setOcupado(true);
    const res = await deleteSugerencia(tenantId, regla.id);
    setOcupado(false);
    if (res?.__error) { setEstado({ tipo: 'error', texto: res.message }); return; }
    setRegla({ ...VACIA, title: `Agregale ${product.name}` });
    setEstado({ tipo: 'ok', texto: 'Sugerencia quitada.' });
  };

  return (
    <section className="pe-catalog-section oe" aria-labelledby="se-title">
      <h3 id="se-title">Sugerirlo al pedir</h3>
      <p>Cuando alguien pide de las categorías que elijas, la ficha le ofrece este producto (a su precio o a uno especial).</p>

      <label className="oe-check">
        <input type="checkbox" checked={regla.active !== false} onChange={(e) => set({ active: e.target.checked })} />
        <span>Sugerencia activa</span>
      </label>

      <div className="oe-fila">
        <div className="pe-catalog-field oe-crece">
          <label htmlFor="se-titulo">Texto de la sugerencia</label>
          <input id="se-titulo" type="text" maxLength={80} value={regla.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
      </div>
      <div className="oe-fila">
        <div className="pe-catalog-field oe-crece">
          <label htmlFor="se-detalle">Detalle (opcional)</label>
          <input id="se-detalle" type="text" maxLength={200} value={regla.body || ''} placeholder="Ración pequeña con tu pedido"
            onChange={(e) => set({ body: e.target.value })} />
        </div>
      </div>

      <fieldset className="oe-grupo">
        <legend>Se ofrece cuando piden de</legend>
        {otras.length === 0 && <p>Todavía no hay otras categorías cargadas.</p>}
        <div className="oe-fila">
          {otras.map((cat) => (
            <label className="oe-check" key={cat}>
              <input type="checkbox" checked={regla.when_categories.includes(cat)} onChange={() => alternar(cat)} />
              <span>{cat}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="oe-fila">
        <div className="pe-catalog-field oe-crece">
          <label htmlFor="se-precio">Precio especial (vacío = el normal)</label>
          <input id="se-precio" type="number" inputMode="decimal" min="0" step="0.01" value={regla.special_price}
            onChange={(e) => set({ special_price: e.target.value })} />
        </div>
        <div className="pe-catalog-field oe-corto">
          <label htmlFor="se-max">Por producto</label>
          <input id="se-max" type="number" inputMode="numeric" min="1" max="20" step="1" value={regla.max_per_item}
            onChange={(e) => set({ max_per_item: e.target.value })} />
        </div>
      </div>

      <div className="oe-fila oe-fila--entre">
        <button type="button" className="ag-btn-primary" onClick={guardar} disabled={ocupado}>Guardar sugerencia</button>
        {regla.id && <button type="button" className="ag-btn-ghost oe-peligro" onClick={quitar} disabled={ocupado}>Quitar</button>}
      </div>
      <p role="status" aria-live="polite" style={{ color: estado.tipo === 'error' ? 'var(--ag-danger, #b3261e)' : 'var(--ag-ink-2)' }}>
        {estado.texto}
      </p>
    </section>
  );
}
