import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchRecipeCards, saveRecipeCard, scaleRecipeIngredients, saveProductAllergens } from '../../../services/recetario';
import { printAsPDF } from '../../../lib/exports';
import './recetario-panel.css';

const ROLES = ['owner', 'manager', 'kitchen'];
const emptyCard = () => ({ yield_qty: 1, yield_unit: 'unidades', time_minutes: '', steps: [], notes: '', visible_to: [...ROLES], is_archived: false });
const editableCard = card => ({ ...emptyCard(), ...card, steps: (card?.steps || []).map(s => ({ texto: s.texto })) });

// Explicit projection: never serialize products or ingredient records with financial fields.
export function recipeExportData(cards, products, recetas, ingredientes) {
  return cards.map(card => {
    const product = products.find(p => p.id === card.product_id);
    return {
      product_id: card.product_id, name: product?.name || 'Producto no disponible', category: product?.category || '',
      yield_qty: card.yield_qty, yield_unit: card.yield_unit, time_minutes: card.time_minutes,
      steps: (card.steps || []).map(s => ({ texto: s.texto })), notes: card.notes || '',
      allergens: [...(product?.allergens || [])], is_archived: !!card.is_archived,
      ingredients: (recetas?.get(card.product_id) || []).map(line => {
        const ingredient = ingredientes.find(i => i.id === line.ingredient_id);
        return { name: ingredient?.name || 'Insumo no disponible', qty: line.qty, unit: ingredient?.unit || '' };
      }),
    };
  });
}

export function downloadRecipeJSON(data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'recetario.json';
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

export function printRecipeCards(data) {
  printAsPDF('Recetario', ['Producto', 'Rinde / tiempo', 'Ingredientes', 'Preparación / notas / alérgenos'], data.map(c => [
    c.name, `${c.yield_qty} ${c.yield_unit} · ${c.time_minutes ?? '—'} min`,
    c.ingredients.map(i => `${i.qty} ${i.unit} ${i.name}`).join(' · '),
    c.steps.map((s, n) => `${n + 1}. ${s.texto}`).join(' / ') + ` | Notas: ${c.notes} | Alérgenos: ${c.allergens.join(', ') || 'Sin declarar'}`,
  ]));
}

export default function RecetarioPanel({ tenantId, roles = [], products = [], recetas, ingredientes = [], onEditIngredients, onDirtyChange }) {
  const canEdit = roles.some(r => ['owner', 'manager'].includes(r));
  const allowed = roles.some(r => ROLES.includes(r));
  const [result, setResult] = useState({ tenantId: null, cards: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');
  const [allergens, setAllergens] = useState('');
  const [allergenSaved, setAllergenSaved] = useState('');
  const [savingAllergens, setSavingAllergens] = useState(false);
  const [allergenOverrides, setAllergenOverrides] = useState({});
  const generation = useRef(0);
  const cards = result.tenantId === tenantId && allowed ? result.cards.filter(c => roles.includes('owner') || c.visible_to?.some(r => roles.includes(r))) : [];
  const card = cards.find(c => c.product_id === selected);
  const product = products.find(p => p.id === selected);
  const dirty = (!!draft && JSON.stringify(draft) !== JSON.stringify(editableCard(card))) || (!!selected && allergens !== allergenSaved);

  useEffect(() => {
    const id = ++generation.current;
    setResult({ tenantId: null, cards: [] }); setSelected(null); setDraft(null); setLoading(true); setError('');
    setAllergenOverrides({}); setSaving(false); setSavingAllergens(false); setAllergens(''); setAllergenSaved('');
    if (!allowed || !tenantId) { setLoading(false); return; }
    fetchRecipeCards(tenantId).then(data => {
      if (generation.current !== id) return;
      if (data?.__error) throw new Error(data.message);
      setResult({ tenantId, cards: data || [] }); setLoading(false);
    }).catch(() => { if (generation.current === id) { setError('No pudimos cargar el recetario. Volvé a intentar.'); setLoading(false); } });
    return () => { generation.current++; };
  }, [tenantId, allowed, retry]);

  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const unload = e => { e.preventDefault(); e.returnValue = ''; };
    // Protect internal navigation as well as refresh/close. In-panel transitions confirm below.
    const navigate = e => {
      if (e.target.closest?.('.ag-recetario') || e.target.closest?.('.ag-recetario-switch') || e.target.closest?.('.ag-productos-head-agregar')) return;
      if (e.target.closest?.('button, a') && !window.confirm('Hay cambios sin guardar en la ficha. ¿Querés descartarlos?')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty]);

  const filtered = useMemo(() => products.filter(p => {
    const existing = cards.find(c => c.product_id === p.id);
    return (canEdit || (existing && !existing.is_archived)) && `${p.name} ${p.category || ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'));
  }), [products, cards, canEdit, search]);

  const open = p => {
    if (saving || savingAllergens || (dirty && !window.confirm('Hay cambios sin guardar. ¿Querés descartarlos?'))) return;
    setSelected(p.id); setDraft(null); setTarget(''); setMessage('');
    const text = (allergenOverrides[p.id] || p.allergens || []).join(', ');
    setAllergens(text); setAllergenSaved(text);
  };
  const patch = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const save = async e => {
    e.preventDefault();
    if (!canEdit || !draft || saving || savingAllergens) return;
    const id = generation.current;
    setSaving(true); setMessage('');
    try {
      const input = { yield_qty: Number(draft.yield_qty), yield_unit: draft.yield_unit.trim(), time_minutes: draft.time_minutes === '' ? null : Number(draft.time_minutes),
        steps: draft.steps.map(s => ({ texto: s.texto.trim() })).filter(s => s.texto), notes: draft.notes,
        visible_to: [...new Set(['owner', ...draft.visible_to.filter(r => ROLES.includes(r)), ...(!roles.includes('owner') ? ['manager'] : [])])], is_archived: draft.is_archived };
      const saved = await saveRecipeCard(tenantId, selected, input);
      if (id !== generation.current) return;
      if (!saved || saved.__error) throw new Error(saved?.message);
      setResult(current => ({ ...current, cards: [...current.cards.filter(c => c.product_id !== selected), saved] }));
      setDraft(allergens !== allergenSaved ? editableCard(saved) : null); setMessage('Ficha guardada.');
    } catch (err) { if (id === generation.current) setMessage(err.message || 'No se pudo guardar la ficha. Reintentá.'); }
    finally { if (id === generation.current) setSaving(false); }
  };
  const saveAllergens = async () => {
    if (!canEdit || saving || savingAllergens) return;
    const id = generation.current;
    setSavingAllergens(true); setMessage('');
    try {
      const values = allergens.split(',').map(s => s.trim()).filter(Boolean);
      const saved = await saveProductAllergens(tenantId, selected, { allergens: values });
      if (id !== generation.current) return;
      if (!saved || saved.__error) throw new Error(saved?.message);
      setAllergenOverrides(current => ({ ...current, [selected]: values })); setAllergenSaved(allergens); setMessage('Alérgenos guardados en el producto.');
    } catch (err) { if (id === generation.current) setMessage(err.message || 'No se pudieron guardar los alérgenos. Reintentá.'); }
    finally { if (id === generation.current) setSavingAllergens(false); }
  };
  const exportCards = (scope, format) => {
    const source = scope === 'current' ? cards.filter(c => c.product_id === selected) : cards.filter(c => !c.is_archived);
    const data = recipeExportData(source, products.map(p => ({ ...p, allergens: allergenOverrides[p.id] || p.allergens })), recetas, ingredientes);
    if (format === 'json') downloadRecipeJSON(data); else printRecipeCards(data);
  };
  const exportButtons = scope => <div className="ag-recetario-actions">
    <button type="button" disabled={dirty || saving || savingAllergens} onClick={() => exportCards(scope, 'json')}>Descargar {scope === 'current' ? 'ficha' : 'recetario'} JSON</button>
    <button type="button" disabled={dirty || saving || savingAllergens} onClick={() => exportCards(scope, 'pdf')}>Imprimir / PDF {scope === 'current' ? 'ficha' : 'recetario'}</button>
  </div>;
  if (!allowed) return null;
  const display = draft || card;
  const lines = recetas?.get(selected) || [];
  let scaled = lines;
  let scaleError = '';
  if (display && target !== '') {
    try {
      if (!Number.isFinite(Number(target)) || Number(target) <= 0) throw new Error();
      scaled = scaleRecipeIngredients(lines.map(line => ({ ...line, qty: Number(line.qty) })), Number(display.yield_qty), Number(target));
    } catch { scaleError = 'Ingresá una cantidad válida dentro del rango de la receta.'; }
  }
  return <section className="ag-recetario" aria-label="Recetario">
    <header><div><h2>Recetario</h2><p>Preparaciones, cantidades y pasos para tu equipo.</p></div>
      {!loading && !error && cards.some(c => !c.is_archived) && exportButtons('all')}
    </header>
    <p className="ag-recetario-hint">Las exportaciones incluyen las fichas activas guardadas que tenés permiso para ver. No incluyen precios ni costos.</p>
    {loading ? <p role="status">Cargando recetario…</p> : error ? <div role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Reintentar</button></div> : <div className="ag-recetario-layout">
      <aside><label>Buscar por producto o categoría<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
        {!filtered.length && <p>{products.length ? 'No hay fichas que coincidan.' : 'Primero agregá un producto para crear su ficha.'}</p>}
        <ul>{filtered.map(p => { const c = cards.find(c => c.product_id === p.id); return <li key={p.id}><button type="button" aria-current={selected === p.id ? 'true' : undefined} onClick={() => open(p)}><strong>{p.name}</strong><span>{p.category || 'Sin categoría'} · {c ? c.is_archived ? 'Archivada' : 'Ficha guardada' : 'Sin ficha'}</span></button></li>; })}</ul>
      </aside>
      <article aria-label="Ficha de preparación">
        {!product ? <p>Elegí un producto para consultar{canEdit ? ' o crear' : ''} su ficha.</p> : <>
          <h3>{product.name}</h3>
          {card && exportButtons('current')}
          {canEdit && !draft && <button type="button" onClick={() => setDraft(editableCard(card))}>{card ? 'Editar ficha' : 'Crear ficha'}</button>}
          {display && <>
            <form onSubmit={save}>
              <fieldset disabled={saving || savingAllergens}><legend>Ficha técnica</legend>
                <div className="ag-recetario-fields">
                  <label>Rinde<input type="number" disabled={!draft} required min="0.001" step="any" value={display.yield_qty} onChange={e => patch('yield_qty', e.target.value)} /></label>
                  <label>Unidad<input disabled={!draft} required maxLength={40} value={display.yield_unit} onChange={e => patch('yield_unit', e.target.value)} /></label>
                  <label>Tiempo total (minutos)<input disabled={!draft} type="number" min="0" step="1" value={display.time_minutes ?? ''} onChange={e => patch('time_minutes', e.target.value)} /></label>
                </div>
                <h4>Preparación</h4>
                {draft ? <><ol>{draft.steps.map((step, index) => <li key={index}><label>Paso {index + 1}<textarea required maxLength={4000} value={step.texto} onChange={e => patch('steps', draft.steps.map((s, i) => i === index ? { texto: e.target.value } : s))} /></label><button type="button" onClick={() => patch('steps', draft.steps.filter((_, i) => i !== index))}>Quitar paso {index + 1}</button></li>)}</ol><button type="button" disabled={draft.steps.length >= 100} onClick={() => patch('steps', [...draft.steps, { texto: '' }])}>Agregar paso</button></> : <ol>{display.steps.map((s, i) => <li key={i}><label className="ag-recetario-check"><input type="checkbox" aria-label={`Completar paso ${i + 1}`} />{s.texto}</label></li>)}</ol>}
                <label>Notas y conservación<textarea disabled={!draft} maxLength={10000} value={display.notes || ''} onChange={e => patch('notes', e.target.value)} /></label>
                {draft && <><fieldset><legend>Quién puede ver la ficha</legend>{ROLES.map(role => <label className="ag-recetario-check" key={role}><input type="checkbox" checked={role === 'owner' || draft.visible_to.includes(role)} disabled={role === 'owner' || (role === 'manager' && !roles.includes('owner'))} onChange={e => patch('visible_to', e.target.checked ? [...draft.visible_to, role] : draft.visible_to.filter(r => r !== role))} />{{ owner: 'Dueño (siempre)', manager: 'Encargado', kitchen: 'Cocina' }[role]}</label>)}</fieldset>
                <label className="ag-recetario-check"><input type="checkbox" checked={draft.is_archived} onChange={e => patch('is_archived', e.target.checked)} />Archivar ficha</label></>}
              </fieldset>
              {draft && <div className="ag-recetario-actions"><button disabled={saving || savingAllergens} type="submit">{saving ? 'Guardando…' : 'Guardar ficha'}</button><button disabled={saving || savingAllergens} type="button" onClick={() => { if (!dirty || window.confirm('¿Descartar cambios sin guardar?')) { setDraft(null); setAllergens(allergenSaved); } }}>Cancelar edición</button></div>}
            </form>
            <h4>Ingredientes</h4>
            <label>Calcular para ({display.yield_unit})<input type="number" min="0.001" step="any" placeholder={String(display.yield_qty)} value={target} onChange={e => setTarget(e.target.value)} /></label>
            <p role={scaleError ? 'alert' : undefined}>{scaleError}</p>
            <p className="ag-recetario-hint">El cálculo no modifica las cantidades guardadas.</p>
            <ul>{scaled.map(line => { const ing = ingredientes.find(i => i.id === line.ingredient_id); return <li key={line.ingredient_id}>{ing?.name || 'Insumo no disponible'} · {Number(line.qty).toLocaleString('es-AR', { maximumFractionDigits: 3 })} {ing?.unit}</li>; })}</ul>
            {!lines.length && <p>Este producto todavía no tiene ingredientes cargados.</p>}
          </>}
          {canEdit && <button type="button" disabled={saving || savingAllergens} onClick={() => { if (!dirty || window.confirm('¿Descartar cambios antes de abrir el editor de ingredientes?')) { setDraft(null); onEditIngredients?.(product); } }}>Editar ingredientes en el producto</button>}
          <h4>Alérgenos</h4>
          {draft ? <><label>Alérgenos separados por coma<input disabled={saving || savingAllergens} value={allergens} onChange={e => setAllergens(e.target.value)} /></label><p className="ag-recetario-hint">Se guardan por separado en el producto, visibles para atención.</p><button type="button" disabled={saving || savingAllergens} onClick={saveAllergens}>{savingAllergens ? 'Guardando…' : 'Guardar alérgenos'}</button></> : <p>{(allergenOverrides[product.id] || product.allergens || []).join(', ') || 'Sin declarar. No significa libre de alérgenos.'}</p>}
        </>}
        {message && <p role="status">{message}</p>}
      </article>
    </div>}
  </section>;
}
