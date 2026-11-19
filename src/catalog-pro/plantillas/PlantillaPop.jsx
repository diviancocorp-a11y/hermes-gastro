// src/catalog-pro/plantillas/PlantillaPop.jsx
// Plantilla `pop` del catalogo publico. Recibe las MISMAS props que HomeScreen
// mas `config` (ya validado por HomeConPlantilla). Solo se carga via import()
// dinamico desde HomeConPlantilla: el catalogo de los demas tenants no la baja.
//
// Marca -> tokens (marcaATokens), orden y visibilidad (seccionesVisibles),
// precios en doble moneda (precios.js + useTasaCatalogo). Textos neutros por
// defecto: todo lo propio del negocio viene de `config`.
import { useEffect, useMemo, useRef, useState } from "react";
import "./plantilla-pop.css";
import { marcaATokens, urlFuentes } from "./marcaATokens";
import { seccionesVisibles, disponibilidadDePortada, flyersVigentes } from "./seccionesVisibles";
import { avisoDeTasa } from "./precios";
import usePausarAnimaciones from "./usePausarAnimaciones";
import useRevelar from "./useRevelar";
import useTasaCatalogo from "../../hooks/useTasaCatalogo";
import { resolveTenantSlug } from "../../lib/activeTenant";
import { applyCatalogFacets, getCatalogCategories, resolveCatalogProfile } from "../../lib/catalogFacets";
import { mapProduct } from "../homeHelpers";
import PopIntro from "./PopIntro";
import PopHeader from "./PopHeader";
import PopHero from "./PopHero";
import PopCinta from "./PopCinta";
import PopFavoritos from "./PopFavoritos";
import PopFlyers from "./PopFlyers";
import PopMenu from "./PopMenu";
import PopSubmarca from "./PopSubmarca";
import PopBanda from "./PopBanda";
import PopTestimonios from "./PopTestimonios";
import PopHistoria from "./PopHistoria";
import PopFooter from "./PopFooter";
import PrecioCatalogo from "./PrecioCatalogo";

const FAVORITOS_MAX = 3;
const categoriaDe = (p) => p.catalog_attributes?.category || p.category;

export default function PlantillaPop({
  config = {}, products = [], categories = [], store = {}, settings = {},
  cart = [], cartCount = 0, cartTotal = 0, hasDeal, dealPrice, soldOutIds,
  onAddToCart, onDecCart, onOpenCart, onSelectProduct,
  searchQuery, onSearchChange,
}) {
  const raizRef = useRef(null);
  const { quieto, alternar } = usePausarAnimaciones();
  const anima = useRevelar(raizRef, quieto);
  const marca = useMemo(() => config.marca || {}, [config.marca]);
  const textos = config.textos || {};
  const acento = Boolean(marca.titulo_acento);
  const zona = settings.timezone;

  // Tokens de marca sobre el tema del tenant.
  const tokens = useMemo(() => marcaATokens(marca, settings.catalog_theme), [marca, settings.catalog_theme]);

  // Un solo <link> de fuentes, con limpieza.
  useEffect(() => {
    const href = urlFuentes(marca);
    if (!href) return undefined;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-pop-fuentes", "1");
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, [marca]);

  // Moneda: principal del tenant, secundaria con tasa (solo si existe).
  const principal = settings.currency || "ARS";
  const secundaria = settings.secondary_currency || null;
  const [slug, setSlug] = useState(null);
  useEffect(() => {
    if (!secundaria) return undefined;
    let vivo = true;
    resolveTenantSlug().then((s) => { if (vivo) setSlug(s); }).catch(() => {});
    return () => { vivo = false; };
  }, [secundaria]);
  const { tasa } = useTasaCatalogo({ slug, principal, secundaria, zona });
  const moneda = useMemo(() => ({ principal, secundaria, tasa }), [principal, secundaria, tasa]);
  const aviso = useMemo(() => avisoDeTasa(tasa, { principal, secundaria }), [tasa, principal, secundaria]);

  // Productos -> vista (precio con oferta, disponibilidad de portada, agotado).
  const vista = useMemo(() => (p) => {
    const m = mapProduct(p, { hasDeal, dealPrice, soldOutIds });
    return {
      raw: p, id: p.id, name: p.name || "", desc: m.desc, price: m.price, oldPrice: m.oldPrice,
      img: m.img, soldOut: m.soldOut, tag: p.catalog_attributes?.tag || m.badge,
      disp: disponibilidadDePortada(p.catalog_attributes, zona),
    };
  }, [hasDeal, dealPrice, soldOutIds, zona]);

  const favoritos = useMemo(
    () => products.filter((p) => p.catalog_attributes?.featured).slice(0, FAVORITOS_MAX).map(vista),
    [products, vista],
  );
  const submarca = config.submarca || {};
  const submarcaItems = useMemo(() => {
    if (!submarca.categoria) return [];
    return products
      .filter((p) => categoriaDe(p) === submarca.categoria).map(vista);
  }, [products, submarca.categoria, vista]);

  const ids = seccionesVisibles(config, { favoritos: favoritos.length, submarcaProductos: submarcaItems.length }, zona);

  // Menu: categoria + buscador (el buscador es del padre si lo pasa). Si la
  // submarca se muestra, su categoria sale del menu (no se repite); si esa
  // seccion esta apagada o sin datos, los productos vuelven al menu.
  const profile = resolveCatalogProfile(settings);
  const sinSubmarca = ids.includes("submarca") && Boolean(submarca.categoria);
  const catSubmarca = submarca.categoria;
  const productosMenu = useMemo(
    () => (sinSubmarca ? products.filter((p) => categoriaDe(p) !== catSubmarca) : products),
    [products, sinSubmarca, catSubmarca],
  );
  const catalogCategories = useMemo(
    () => getCatalogCategories(productosMenu, categories, profile).filter((c) => !sinSubmarca || c.name !== catSubmarca),
    [productosMenu, categories, profile, sinSubmarca, catSubmarca],
  );
  const [activa, setActiva] = useState("Todos");
  const [busquedaLocal, setBusquedaLocal] = useState("");
  const busqueda = onSearchChange ? (searchQuery || "") : busquedaLocal;
  const cambiarBusqueda = onSearchChange || setBusquedaLocal;
  const itemsMenu = useMemo(() => {
    const lista = applyCatalogFacets(productosMenu, {
      category: activa, categories: catalogCategories, facets: {}, search: busqueda, quickFilter: null, hasDeal,
    });
    return lista.map(vista);
  }, [productosMenu, activa, catalogCategories, busqueda, hasDeal, vista]);

  // Conteo por categoria para los chips (la de "Todos" es el total del menu).
  const categoriasConConteo = useMemo(() => catalogCategories.map((c) => ({
    ...c,
    count: applyCatalogFacets(productosMenu, { category: c.name, categories: catalogCategories, facets: {}, search: "", quickFilter: null, hasDeal }).length,
  })), [catalogCategories, productosMenu, hasDeal]);

  const cantidadDe = (id) => {
    const it = (cart || []).find((c) => c.id === id || c.product_id === id);
    return it ? it.qty : 0;
  };

  const flyers = useMemo(() => flyersVigentes(config, zona), [config, zona]);
  const nombre = store.name || settings.biz_name || "Tienda";
  const logo = marca.logo_header || store.logoUrl || null;
  const letra = (store.logoLetter || nombre.charAt(0) || "D").toUpperCase();
  const comun = { moneda, isotipo: marca.isotipo, onAgregar: onAddToCart, onQuitar: onDecCart, onAbrir: onSelectProduct };

  const seccion = (id) => {
    switch (id) {
      case "hero":
        return <PopHero key={id} textos={textos} nombre={nombre} lead={settings.slogan} abierto={typeof store.isOpen === "boolean" ? store.isOpen : undefined}
          imagen={favoritos[0]?.img || products.find((p) => p.image_url)?.image_url} acento={acento} />;
      case "cinta": return <PopCinta key={id} frases={config.cinta} />;
      case "favoritos": return <PopFavoritos key={id} textos={textos} items={favoritos} acento={acento} cantidadDe={cantidadDe} {...comun} />;
      case "flyers": return <PopFlyers key={id} textos={textos} flyers={flyers} acento={acento} />;
      case "menu":
        return <PopMenu key={id} textos={textos} categorias={categoriasConConteo} oscuro={Boolean(marca.menu_oscuro)} acento={acento} activa={activa} onCategoria={setActiva}
          busqueda={busqueda} onBusqueda={cambiarBusqueda} items={itemsMenu} cargando={products.length === 0}
          aviso={aviso} cantidadDe={cantidadDe} {...comun} />;
      case "submarca": return <PopSubmarca key={id} submarca={submarca} items={submarcaItems} cantidadDe={cantidadDe} {...comun} isotipo={submarca?.isotipo} />;
      case "banda": return <PopBanda key={id} textos={textos} />;
      case "testimonios": return <PopTestimonios key={id} textos={textos} citas={(config.testimonios || []).filter((q) => q?.texto)} />;
      case "historia": return <PopHistoria key={id} textos={textos} />;
      default: return null;
    }
  };

  const clases = ["cp-root", "pop-root", quieto ? "pop-quieto" : "", anima ? "pop-anima" : "", cartCount > 0 ? "pop-con-barra" : ""]
    .filter(Boolean).join(" ");

  return (
    <div className={clases} style={tokens} ref={raizRef}>
      {config.intro !== false && <PopIntro imagen={marca.isotipo || marca.logo_header} nombre={nombre} quieto={quieto} />}
      <PopHeader nombre={nombre} logo={logo} letra={letra} anuncios={config.anuncios} ids={ids}
        cartCount={cartCount} cartTotal={cartTotal} moneda={moneda} onOpenCart={onOpenCart} acentoAnuncios={Boolean(marca.anuncios_acento)} />
      <main className="pop-main">
        {!ids.includes("hero") && <h1 className="pop-sr">{nombre}</h1>}
        {ids.map(seccion)}
      </main>
      <PopFooter nombre={nombre} logo={marca.logo_footer || logo} settings={settings} quieto={quieto} onAlternar={alternar} />
      {cartCount > 0 && (
        <div className="pop-barra">
          <button type="button" className="pop-btn pop-btn--primario pop-barra__btn" onClick={onOpenCart}>
            <span>Ver mi pedido ({cartCount})</span>
            <PrecioCatalogo monto={cartTotal} moneda={{ ...moneda, secundaria: null }} />
          </button>
        </div>
      )}
    </div>
  );
}
