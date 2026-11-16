/**
 * OpcionesEditor — grupos de opciones de un producto ("Elegí tenders o alitas").
 * Va dentro de ProductEditor. Trabaja con el estado del formulario (strings en
 * los inputs, ids solo en lo ya guardado); lib/opcionesEditor.js lo normaliza al
 * guardar. Tokens del panel (--ag-*, --ds-*), nunca los del catalogo.
 */
import { grupoNuevo } from '../../../lib/opcionesEditor';
import './opciones-editor.css';

export default function OpcionesEditor({ grupos, onChange, moneda = '' }) {
  const cambiarGrupo = (i, parche) => onChange(grupos.map((g, k) => (k === i ? { ...g, ...parche } : g)));
  const cambiarOpcion = (i, j, parche) => cambiarGrupo(i, {
    choices: grupos[i].choices.map((c, k) => (k === j ? { ...c, ...parche } : c)),
  });
  const quitarGrupo = (i) => {
    const g = grupos[i];
    const conDatos = g.name || g.choices.some((c) => c.label);
    if (conDatos && !window.confirm(`¿Quitar el grupo "${g.name || 'sin nombre'}" y sus opciones?`)) return;
    onChange(grupos.filter((_, k) => k !== i));
  };
  const quitarOpcion = (i, j) => cambiarGrupo(i, { choices: grupos[i].choices.filter((_, k) => k !== j) });
  const sumarOpcion = (i) => cambiarGrupo(i, { choices: [...grupos[i].choices, { label: '', price: '', max_qty: '' }] });

  return (
    <section className="pe-catalog-section oe" aria-labelledby="oe-title">
      <h3 id="oe-title">Opciones para elegir</h3>
      <p>
        Grupos que el cliente completa al pedir: la salsa, el acompañamiento, los extras.
        El precio de cada opción se suma al del producto{moneda ? ` (en ${moneda})` : ''}.
      </p>

      {grupos.map((g, i) => (
        <fieldset className="oe-grupo" key={g.id || `nuevo-${i}`}>
          <legend className="oe-sr">Grupo {i + 1}</legend>
          <div className="oe-fila">
            <div className="pe-catalog-field oe-crece">
              <label htmlFor={`oe-nombre-${i}`}>Pregunta o nombre del grupo</label>
              <input id={`oe-nombre-${i}`} type="text" maxLength={80} value={g.name}
                placeholder="Elegí tenders o alitas"
                onChange={(e) => cambiarGrupo(i, { name: e.target.value })} />
            </div>
            <div className="pe-catalog-field">
              <label htmlFor={`oe-tipo-${i}`}>Se puede elegir</label>
              <select id={`oe-tipo-${i}`} value={g.type} onChange={(e) => cambiarGrupo(i, { type: e.target.value })}>
                <option value="single">Una sola</option>
                <option value="multiple">Varias</option>
              </select>
            </div>
          </div>

          <div className="oe-fila oe-fila--centro">
            <label className="oe-check">
              <input type="checkbox" checked={!!g.required} onChange={(e) => cambiarGrupo(i, { required: e.target.checked })} />
              <span>Es obligatorio</span>
            </label>
            {g.type === 'multiple' && (
              <div className="pe-catalog-field oe-corto">
                <label htmlFor={`oe-max-${i}`}>Máximo a elegir</label>
                <input id={`oe-max-${i}`} type="number" inputMode="numeric" min="1" step="1" value={g.max}
                  placeholder="sin tope" onChange={(e) => cambiarGrupo(i, { max: e.target.value })} />
              </div>
            )}
          </div>

          <ul className="oe-opciones">
            {g.choices.map((c, j) => (
              <li className="oe-opcion" key={c.id || `n-${j}`}>
                <div className="pe-catalog-field oe-crece">
                  <label htmlFor={`oe-op-${i}-${j}`}>Opción {j + 1}</label>
                  <input id={`oe-op-${i}-${j}`} type="text" maxLength={80} value={c.label}
                    onChange={(e) => cambiarOpcion(i, j, { label: e.target.value })} />
                </div>
                <div className="pe-catalog-field oe-corto">
                  <label htmlFor={`oe-precio-${i}-${j}`}>Suma</label>
                  <input id={`oe-precio-${i}-${j}`} type="number" inputMode="decimal" min="0" step="0.01" value={c.price}
                    placeholder="0" onChange={(e) => cambiarOpcion(i, j, { price: e.target.value })} />
                </div>
                {g.type === 'multiple' && (
                  <div className="pe-catalog-field oe-corto">
                    <label htmlFor={`oe-cant-${i}-${j}`}>Hasta</label>
                    <input id={`oe-cant-${i}-${j}`} type="number" inputMode="numeric" min="1" max="99" step="1" value={c.max_qty}
                      placeholder="1" onChange={(e) => cambiarOpcion(i, j, { max_qty: e.target.value })} />
                  </div>
                )}
                <button type="button" className="oe-quitar" onClick={() => quitarOpcion(i, j)}
                  disabled={g.choices.length === 1} aria-label={`Quitar la opción ${j + 1} del grupo ${i + 1}`}>×</button>
              </li>
            ))}
          </ul>

          <div className="oe-fila oe-fila--entre">
            <button type="button" className="ag-btn-ghost" onClick={() => sumarOpcion(i)} disabled={g.choices.length >= 30}>
              + Sumar opción
            </button>
            <button type="button" className="ag-btn-ghost oe-peligro" onClick={() => quitarGrupo(i)}>
              Quitar este grupo
            </button>
          </div>
        </fieldset>
      ))}

      <button type="button" className="ag-btn-ghost" onClick={() => onChange([...grupos, grupoNuevo()])} disabled={grupos.length >= 8}>
        + Sumar grupo de opciones
      </button>
    </section>
  );
}
