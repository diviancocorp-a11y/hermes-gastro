// Edicion de option_groups en el panel (0135): del estado del formulario (con
// strings de inputs y sin ids en lo recien creado) al jsonb que valida el Zod
// y la base. Puro, con test.

const slug = (texto) => String(texto || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

function idUnico(base, usados, prefijo) {
  const raiz = slug(base) || prefijo;
  let id = raiz;
  for (let n = 2; usados.has(id); n += 1) id = `${raiz}-${n}`;
  usados.add(id);
  return id;
}

export const grupoNuevo = () => ({ name: '', type: 'single', required: true, max: '', choices: [{ label: '', price: '', max_qty: '' }] });

/**
 * Estado del formulario -> option_groups listo para guardar.
 * Los ids existentes se conservan (los pedidos viejos guardan el id elegido);
 * los nuevos salen del nombre. Grupos u opciones sin nombre se descartan.
 */
export function normalizarGrupos(grupos) {
  const idsGrupo = new Set((grupos || []).map((g) => g.id).filter(Boolean));
  const salida = [];
  for (const g of grupos || []) {
    const name = String(g.name || '').trim();
    if (!name) continue;
    const idsOpcion = new Set((g.choices || []).map((c) => c.id).filter(Boolean));
    const choices = [];
    for (const c of g.choices || []) {
      const label = String(c.label || '').trim();
      if (!label) continue;
      const precio = c.price === '' || c.price == null ? null : Number(c.price);
      const maxQty = c.max_qty === '' || c.max_qty == null ? null : Number(c.max_qty);
      choices.push({
        id: c.id || idUnico(label, idsOpcion, 'opcion'),
        label,
        ...(precio ? { price: precio } : {}),
        ...(g.type === 'multiple' && maxQty > 1 ? { max_qty: maxQty } : {}),
      });
    }
    if (!choices.length) continue;
    const max = g.max === '' || g.max == null ? null : Number(g.max);
    salida.push({
      id: g.id || idUnico(name, idsGrupo, 'grupo'),
      name,
      type: g.type === 'multiple' ? 'multiple' : 'single',
      required: !!g.required,
      ...(g.type === 'multiple' && max ? { max: Math.min(max, choices.length) } : {}),
      choices,
    });
  }
  return salida;
}

/** option_groups guardado -> estado de formulario (numeros a string para los inputs). */
export function gruposAFormulario(grupos) {
  return (Array.isArray(grupos) ? grupos : []).map((g) => ({
    ...g,
    max: g.max ?? '',
    choices: g.choices.map((c) => ({ ...c, price: c.price ?? '', max_qty: c.max_qty ?? '' })),
  }));
}
