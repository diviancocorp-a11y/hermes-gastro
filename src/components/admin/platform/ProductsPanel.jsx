/**
 * ProductsPanel — el ABM de productos del edificio.
 *
 * Es la pantalla que hace que el alta self-service sirva de algo: hasta ahora
 * un tenant nuevo se registraba y no tenia donde cargar nada.
 *
 * A diferencia de Recipes.jsx (legacy), aca NO hay ingredientes, ni costeo, ni
 * combos: el edificio no tiene modelo de costos todavia. Un producto es
 * nombre + precio + categoria.
 */
import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { useConfirm } from '../../ConfirmSlideProvider';
import ProductEditor from './ProductEditor';
import { categoriesFrom, normalizarCategoriaProducto } from '../../../services/platformAdmin';
import { margen, indexarInsumos } from '../../../services/platformRecipes';
import { terminologia } from '../../../modules/registry';
import DicoCoreEscena from '../../dico/DicoCoreEscena';
import GestionProductosPanel from './GestionProductosPanel';

function money(n) {
  return `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function numero(n) {
  return Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

const MINIMO_MARGEN_PCT = 30;

const ProductsPanel = forwardRef(function ProductsPanel({
  products, vertical, loading, onSave, onToggleActive, onArchive, onSaveSettings, showToast,
  /**
   * Cuando Dico Physical esta atendiendo el catalogo vacio, esta pantalla NO
   * monta su propia escena 2D: serian dos Dicos a la vez. Publica el nodo al
   * que Physical se ancla —el dedo de `pointDown` cae ahi— y deja el CTA real
   * debajo.
   */
  intervencionActiva = false,
  anclaDico,
  ingredientes = [], recetas = null, settings = null, onSubirImagen = null,
  orders = [], itemsPorPedido = null, operativo = false, turno = null, minutosOperando = null,
  turnosPrevios = [], timezone = null, onImpulsar = null, onIr = null,
  onDicoResumenChange = null,
}, ref) {
  const confirmSlide = useConfirm();
  const [editing, setEditing] = useState(null); // objeto producto | 'new' | null
  const [search, setSearch] = useState('');
  const [categoriasAbiertas, setCategoriasAbiertas] = useState(() => new Set());
  const [configAbierta, setConfigAbierta] = useState(false);
  const [minimoInput, setMinimoInput] = useState('30');

  useImperativeHandle(ref, () => ({
    nuevoProducto: () => setEditing('new'),
  }), []);

  // Como se llama lo que vende este negocio. Un corte de pelo no es un
  // "producto": la palabra cambia toda la pantalla.
  const t = terminologia(vertical);
  const categories = useMemo(() => categoriesFrom(products), [products]);
  const minimoConfigurado = Number(settings?.min_product_margin_pct);
  const minimoMargenPct = Number.isFinite(minimoConfigurado) ? minimoConfigurado : MINIMO_MARGEN_PCT;

  // Indice de insumos una sola vez: el margen se calcula para cada fila de la
  // lista, y rearmarlo por producto seria O(productos x insumos) por render.
  const insumosPorId = useMemo(() => indexarInsumos(ingredientes), [ingredientes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  /* PASS 2 — la tira de resumen.
   *
   * SOLO datos que ya estan en esta pantalla y que se pueden verificar
   * contando. Nada de "valor de inventario": el edificio no tiene modelo de
   * costos —`unit_cost` va en 0— asi que ese numero seria una invencion con
   * formato de dato. El de stock aparece unicamente si ALGUN producto lo
   * tiene cargado; con la columna vacia, un "0 con stock bajo" diria que esta
   * todo bien cuando en realidad no se sabe.
   */
  const resumen = useMemo(() => {
    const visibles = products.filter(x => x.active !== false).length;
    const conStock = products.filter(x => x.stock !== null && x.stock !== undefined);
    return {
      visibles,
      ocultos: products.length - visibles,
      categorias: new Set(products.map(x => (
        normalizarCategoriaProducto(x.category, categories) || 'Sin categoría'
      ))).size,
      sinStock: conStock.length > 0 ? conStock.filter(x => Number(x.stock) <= 0).length : null,
    };
  }, [products, categories]);

  // Agrupado por categoria, respetando el orden que ya trae el service.
  const margenDe = useCallback((producto) => recetas
    ? margen(producto, recetas.get(producto.id), insumosPorId, settings)
    : null, [recetas, insumosPorId, settings]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const p of filtered) {
      const key = normalizarCategoriaProducto(p.category, categories) || 'Sin categoría';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return [...map.entries()]
      .map(([key, items]) => [key, [...items].sort((a, b) => {
        const margenA = margenDe(a)?.pct ?? -Infinity;
        const margenB = margenDe(b)?.pct ?? -Infinity;
        return margenB - margenA || a.name.localeCompare(b.name, 'es');
      })])
      .sort((a, b) => {
        const mejorA = margenDe(a[1][0])?.pct ?? -Infinity;
        const mejorB = margenDe(b[1][0])?.pct ?? -Infinity;
        return mejorB - mejorA || a[0].localeCompare(b[0], 'es');
      });
  }, [filtered, categories, margenDe]);

  const toggleCategoria = (categoria) => {
    setCategoriasAbiertas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(categoria)) siguiente.delete(categoria);
      else siguiente.add(categoria);
      return siguiente;
    });
  };

  const actualizarBusqueda = (valor) => {
    setSearch(valor);
    const consulta = valor.trim().toLowerCase();
    if (!consulta) {
      setCategoriasAbiertas(new Set());
      return;
    }
    setCategoriasAbiertas(new Set(products.filter(producto => (
      producto.name.toLowerCase().includes(consulta)
      || (producto.category || '').toLowerCase().includes(consulta)
    )).map(producto => (
      normalizarCategoriaProducto(producto.category, categories) || 'Sin categoría'
    ))));
  };

  // La receta se guarda DESPUES del producto y no antes: un producto nuevo
  // todavia no tiene id, y las lineas de receta lo necesitan.
  const handleSave = async (form, lineas) => {
    const saved = await onSave(form, lineas);
    if (saved?.__error) { showToast?.(saved.message || 'No se pudo guardar'); return; }
    showToast?.(form.id ? `${t.singular} actualizado` : `${t.singular} creado`);
    setEditing(null);
  };

  const handleDelete = async (p) => {
    const ok = await confirmSlide({
      title: `Archivar ${p.name}`,
      body: 'Sale del catálogo, pero conserva pedidos, receta e historial para siempre.',
      label: 'Deslizá para archivar',
    });
    if (!ok) return;
    const res = await onArchive(p.id);
    if (res?.__error) { showToast?.(res.message); return; }
    showToast?.('Producto archivado · historial conservado');
  };

  const guardarMinimoMargen = async (event) => {
    event.preventDefault();
    const valor = Math.max(0, Math.min(100, Number(minimoInput) || 0));
    const saved = await onSaveSettings?.({ min_product_margin_pct: valor });
    if (!saved) return;
    setMinimoInput(String(valor));
    setConfigAbierta(false);
    showToast?.(`Alerta de margen configurada en ${valor}%`);
  };

  /* ── Formulario a pantalla completa ── */
  if (editing) {
    const isNew = editing === 'new';
    return (
      <div className="ag-page-over">
        <div className="ag-page-over-head">
          <button type="button" className="ag-subpage-back" onClick={() => setEditing(null)} aria-label="Volver">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Atrás</span>
          </button>
          <h2 className="ag-page-over-title">{isNew ? t.nuevo : `Editar ${t.singular}`}</h2>
        </div>
        <div className="ag-page-over-body">
          <ProductEditor
            product={isNew ? null : editing}
            products={products}
            vertical={vertical}
            categories={categories}
            ingredientes={ingredientes}
            lineasReceta={isNew ? [] : (recetas?.get(editing.id) || [])}
            settings={settings}
            onSave={handleSave}
            onSubirImagen={onSubirImagen}
            onCancel={() => setEditing(null)}
          />
        </div>
      </div>
    );
  }

  /* ── Listado ──
     Contenedor EN FLUJO, no `ag-page-over`. Esa clase es un overlay de
     pantalla completa (position:fixed, z-index 950) y admin-shared.css tiene
     una regla explicita que esconde el topbar y el bottom nav mientras haya
     uno en el DOM. Usarla para una pestania principal dejaba el panel sin
     engranaje y sin navegacion: los elementos se renderizaban y quedaban
     tapados. Los overlays de verdad —el formulario de abajo— si la usan. */
  return (
    // `ag-pantalla-productos` es el limite de la Golden Screen. Dentro de
    // `.ag-main` tambien viven las oportunidades y el aviso de Dico, que son de
    // Phase 8/9 y tienen su propia deuda declarada; sin este ancla, el gate de
    // Phase 4 les cobraria a ellos.
    <div className="ag-pantalla-productos">
      {/* NO va un <h2> con el nombre de la seccion.
          El shell ya lo pone en `.ag-section-title` (PlatformAdmin), asi que
          la pantalla mostraba "Productos" DOS VECES, una arriba de la otra y
          en dos tipografias distintas: Butler el del shell, DM Sans clavado a
          mano el de aca. Era el sintoma mas visible de "mezcla de eras" y el
          unico lugar de la pantalla que forzaba una familia tipografica. */}

      {/* La accion principal entra en la misma tira de indicadores y ocupa el
          primer lugar. El titulo ya da contexto suficiente; repetir aca la
          cantidad total y las categorias agregaba una tercera lectura del
          mismo dato. */}
      {products.length > 0 && (
        <div className="ag-productos-resumen">
          <div className="ag-kpi">
            <span className="ag-kpi-valor">{resumen.visibles}</span>
            <span className="ag-kpi-pie">en el catálogo</span>
          </div>
          <div className={`ag-kpi${resumen.ocultos > 0 ? ' es-aviso' : ''}`}>
            <span className="ag-kpi-valor">{resumen.ocultos}</span>
            <span className="ag-kpi-pie">ocultos</span>
          </div>
          <div className="ag-kpi">
            <span className="ag-kpi-valor">{resumen.categorias}</span>
            <span className="ag-kpi-pie">categorías</span>
          </div>
          {resumen.sinStock !== null && (
            <div className={`ag-kpi${resumen.sinStock > 0 ? ' es-alerta' : ''}`}>
              <span className="ag-kpi-valor">{resumen.sinStock}</span>
              <span className="ag-kpi-pie">sin stock</span>
            </div>
          )}
        </div>
      )}

      {/* ── C · Toolbar ──────────────────────────────────────────────── */}
      {products.length > 0 && (
        <div className="ag-productos-barra">
          <div className="ag-productos-buscador">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" value={search} onChange={e => actualizarBusqueda(e.target.value)}
              placeholder={t.buscar}
              aria-label={t.buscar}
            />
          </div>
        </div>
      )}

      {loading && <p className="ag-productos-estado ag-body">Cargando...</p>}

      {!loading && products.length === 0 && (
        <div className="ag-productos-vacio">
          {intervencionActiva ? (
            <>
              {/* El ancla. Physical viaja hasta aca y el dedo queda sobre el
                  boton de abajo; el texto lo pone la burbuja de la
                  intervencion, no esta pantalla. */}
              <div className="dico-objetivo" data-dico-objetivo="catalogo-vacio" ref={anclaDico} />
              <button
                type="button"
                className="ag-cta dico-cuadro-accion"
                onClick={() => setEditing('new')}
              >
                {`+ Agregar ${t.singular}`}
              </button>
            </>
          ) : (
            <DicoCoreEscena
              estado="pregunta"
              lookY={0.65}
              size={188}
              texto={`Empecemos por tu primer ${t.singular}. Cargalo y queda publicado en tu catálogo.`}
              accion={`+ Agregar ${t.singular}`}
              onAccion={() => setEditing('new')}
              title={`Dico mira el botón para agregar el primer ${t.singular}`}
            />
          )}
        </div>
      )}

      {!loading && products.length > 0 && filtered.length === 0 && (
        <p className="ag-productos-estado ag-body">
          Nada coincide con “{search}”.
        </p>
      )}

      {/* ── D · Categorias como paneles ─────────────────────────────────
          Una card POR CATEGORIA con filas compactas adentro, no una card
          gigante por producto. Con 21 productos lo anterior era una tira de
          21 tarjetas de 60px de alto: nada agrupaba y nada terminaba. */}
      {!loading && products.length > 0 && (
      <div className="ag-productos-cuerpo">
        <div className="ag-productos-categorias">
        <div className="ag-productos-categorias-titulo">
          <h2>Categorías</h2>
          <div className="ag-categorias-config">
            <button
              type="button"
              className="ag-categorias-menu"
              aria-label="Configurar categorías"
              aria-expanded={configAbierta}
              onClick={() => {
                setMinimoInput(String(minimoMargenPct));
                setConfigAbierta(valor => !valor);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {configAbierta && (
              <form className="ag-categorias-popover" onSubmit={guardarMinimoMargen}>
                <strong>Parámetros de categorías</strong>
                <label htmlFor="ag-minimo-margen">Alertar debajo de</label>
                <div>
                  <input
                    id="ag-minimo-margen"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={minimoInput}
                    onChange={event => setMinimoInput(event.target.value)}
                  />
                  <span>% de margen</span>
                </div>
                <button type="submit">Guardar</button>
              </form>
            )}
          </div>
        </div>
        {groups.map(([cat, items]) => {
          const abierta = categoriasAbiertas.has(cat);
          const bajoMinimo = items.filter((producto) => {
            const calculado = margenDe(producto);
            return calculado && calculado.pct < minimoMargenPct;
          }).length;
          return (
          <section key={cat} className={`ag-categoria${abierta ? ' esta-abierta' : ''}`}>
            <header className="ag-categoria-head">
              <button
                type="button"
                className="ag-categoria-toggle"
                aria-expanded={abierta}
                aria-label={`${abierta ? 'Cerrar' : 'Abrir'} categoría ${cat}`}
                onClick={() => toggleCategoria(cat)}
              >
                <h3 className="ag-categoria-nombre">{cat}</h3>
                <span className="ag-categoria-cuenta">
                  {items.length} {items.length === 1 ? t.singular : t.plural.toLowerCase()}
                  {bajoMinimo > 0 && ` · ${bajoMinimo} bajo mínimo`}
                </span>
                <i className="ag-categoria-flecha" aria-hidden="true" />
              </button>
            </header>

            {abierta && <div className="ag-categoria-filas">
              <div className="ag-fila-columnas" aria-hidden="true">
                <span>Producto</span><span>Costo</span><span>Ganancia</span><span>Margen</span><span>Precio</span><span />
              </div>
              {items.map(p => {
                // null cuando no hay receta cargada: sin insumos el costo da 0
                // y el margen daria 100%, que es una mentira comoda.
                const m = margenDe(p);
                const margenOk = m ? m.pct >= minimoMargenPct : false;
                const margenVisual = m ? Math.max(0, Math.min(100, m.pct)) : 0;
                return (
                <div key={p.id} className={`ag-fila${p.active ? '' : ' esta-oculta'}${m && !margenOk ? ' tiene-alerta' : ''}`}>
                  <span className="ag-fila-foto" aria-hidden="true">
                    <span className="ag-fila-foto-inicial">{p.name.trim().charAt(0).toLocaleUpperCase('es-AR') || '?'}</span>
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt=""
                        loading="lazy"
                        onError={event => { event.currentTarget.hidden = true; }}
                      />
                    )}
                  </span>
                  <button
                    type="button"
                    className="ag-fila-abrir"
                    onClick={() => setEditing(p)}
                    aria-label={`Editar ${p.name}`}
                  >
                    <span className="ag-fila-nombre">
                      {p.name}
                      {p.requires_age_gate && <span className="ag-fila-edad">+18</span>}
                    </span>
                    {!p.active && <span className="ag-fila-oculto">oculto</span>}
                  </button>
                  <span className="ag-fila-costo">{m ? numero(m.costo) : 'Sin receta'}</span>
                  <span className="ag-fila-ganancia">{m ? numero(m.ganancia) : '—'}</span>
                  <span className={`ag-fila-margen-celda${margenOk ? ' esta-ok' : ' esta-alerta'}`}>
                    {m ? <>
                      <strong>{m.pct.toFixed(0)}%</strong>
                      <span className="ag-fila-margen-track" aria-label={`Mínimo ${minimoMargenPct}%`}>
                        <i style={{ width: `${margenVisual}%` }} />
                        <b style={{ left: `${minimoMargenPct}%` }} />
                      </span>
                    </> : <small>Sin receta cargada</small>}
                  </span>
                  <span className="ag-fila-precio">{money(p.price)}</span>
                  <div className="ag-fila-acciones">
                    <button
                      type="button"
                      className="ag-btn-mini"
                      onClick={() => onToggleActive(p)}
                      title={p.active ? 'Ocultar del catálogo' : 'Mostrar en el catálogo'}
                      aria-label={p.active ? `Ocultar ${p.name}` : `Mostrar ${p.name}`}
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                        <circle cx="12" cy="12" r="2.5" />
                        {!p.active && <path d="m4 4 16 16" />}
                      </svg>
                    </button>

                    <button
                      type="button"
                      className="ag-producto-archivar"
                      onClick={() => handleDelete(p)}
                      title="Archivar"
                      aria-label={`Archivar ${p.name}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h16v13H4z" />
                        <path d="M3 7h18M8 7l1-3h6l1 3M8 11h8" />
                      </svg>
                    </button>
                  </div>
                </div>
                );
              })}
            </div>}
          </section>
          );
        })}
        </div>

        <GestionProductosPanel
          key={turno?.id || (operativo ? 'operativo-sin-caja' : 'cerrado')}
          products={products}
          orders={orders}
          itemsPorPedido={itemsPorPedido}
          recetas={recetas}
          ingredientes={ingredientes}
          settings={settings}
          busqueda={search}
          operativo={operativo}
          minutosOperando={minutosOperando}
          turno={turno}
          turnosPrevios={turnosPrevios}
          timezone={timezone}
          onToggleActive={onToggleActive}
          onImpulsar={onImpulsar}
          onIr={onIr}
          showToast={showToast}
          onDicoResumenChange={onDicoResumenChange}
        />
      </div>
      )}
    </div>
  );
});

export default ProductsPanel;
