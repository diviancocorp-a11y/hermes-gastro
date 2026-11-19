// src/catalog-pro/plantillas/PopMenu.jsx
// Menu: aviso de tasa, buscador, chips de categoria y grilla. Siempre presente.
// El filtrado lo hace PlantillaPop (getCatalogCategories / applyCatalogFacets);
// aca solo se pinta.
import PopProductoCard from "./PopProductoCard";
import conAcento from "./conAcento";

export default function PopMenu({
  textos = {}, categorias = [], activa, onCategoria, busqueda, onBusqueda,
  items = [], cargando, aviso, oscuro = false, acento = false, ...resto
}) {
  return (
    <section className={`pop-menu-fondo${oscuro ? " pop-menu-fondo--oscuro" : ""}`} id="pop-menu" aria-labelledby="pop-menu-t">
    <div className="pop-seccion pop-menu">
      <div className="pop-seccion__cabeza" data-revelar>
        {textos.menu_eyebrow && <p className="pop-kicker">{textos.menu_eyebrow}</p>}
        <h2 id="pop-menu-t" className="pop-titulo">{conAcento(textos.menu_titulo || "Nuestro menú", acento)}</h2>
        {textos.menu_lead && <p className="pop-seccion__aside">{textos.menu_lead}</p>}
      </div>

      {aviso && (
        <p className={`pop-aviso pop-aviso--${aviso.nivel}`} role="status">
          <strong>{aviso.nivel === "aviso" ? "Ojo: " : "Tasa: "}</strong>{aviso.texto}
        </p>
      )}

      <div className="pop-menu__controles">
        <div className="pop-buscar">
          <label htmlFor="pop-buscar" className="pop-sr">Buscar en el menú</label>
          <input id="pop-buscar" type="search" value={busqueda} placeholder="Buscar en el menú"
            onChange={(e) => onBusqueda(e.target.value)} autoComplete="off" />
        </div>
        <div className="pop-chips" role="group" aria-label="Categorías">
          {categorias.map((c) => (
            <button key={c.name} type="button" className="pop-chip" aria-pressed={activa === c.name} onClick={() => onCategoria(c.name)}>
              {c.displayName || c.name}
              {c.count != null && <span className="pop-chip__n"> {c.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <p className="pop-menu__cuenta" role="status">
        {cargando ? "Cargando el menú…" : `${items.length} ${items.length === 1 ? "producto" : "productos"}`}
      </p>

      {cargando ? (
        <div className="pop-grilla" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="pop-skeleton" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="pop-vacio">No encontramos nada con ese filtro. Probá con otra categoría o borrá la búsqueda.</p>
      ) : (
        <div className="pop-grilla">
          {items.map((v) => <PopProductoCard key={v.id} v={v} {...resto} />)}
        </div>
      )}
    </div>
    </section>
  );
}
