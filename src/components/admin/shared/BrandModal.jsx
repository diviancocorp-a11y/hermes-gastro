/**
 * BrandModal — overlay de personalización accesible desde el avatar del header.
 *
 * Secciones:
 *   · Identidad (nombre, logo: imagen o letra+color)
 *   · Foto de portada
 *   · Carátulas de categorías
 *
 * Autosave debounced — sin botón "Guardar".
 *
 * Props:
 *   open:        bool
 *   onClose:     () => void
 *   settings:    objeto settings actual
 *   setSettings: (s) => void  (refleja el save al state global)
 *   showToast:   (msg) => void
 *   onCategories: opcional · abre overlay de gestión de categorías
 */
import { memo, useEffect, useRef, useState } from "react";
import {
  updateSettings,
  uploadCoverImage,
  uploadCatImage,
  uploadLogoImage,
} from "../../../lib/adminService";
import CategoryEditor from "../CategoryEditor";
import DynamicQrs from "../DynamicQrs";
import { useConfirm } from "../../ConfirmSlideProvider";
import ToggleSwitch from "./forms/ToggleSwitch";
import DecimalInput from "../../ui/DecimalInput";
import { fetchCategoryGroups } from "../../../services/categories";
const COLORS = [
  { h: "#C45D3E", l: "Terracota" },
  { h: "#3A7D44", l: "Verde" },
  { h: "#1565C0", l: "Azul" },
  { h: "#7A2E4A", l: "Borgoña" },
  { h: "#8D6E00", l: "Dorado" },
  { h: "#2D1B0E", l: "Negro" },
];

function EyeIcon({ off = false }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function BrandModal({ open, onClose, settings, setSettings, showToast }) {
  const [s, setS] = useState({ ...settings });
  const confirmSlide = useConfirm();
  const [section, setSection] = useState('identity'); // 'identity' | 'cover' | 'cats'
  const [editorOpen, setEditorOpen] = useState(false); // sub-página: CategoryEditor
  const [qrsOpen, setQrsOpen] = useState(false); // sub-página: DynamicQrs
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingCat, setUploadingCat] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  // Categorias reales del backend de ESTE tenant (no hardcoded).
  // Fallback: solo "Todos" para clientes nuevos.
  const [catNames, setCatNames] = useState(["Todos"]);
  const reloadCatNames = () => {
    fetchCategoryGroups().then(groups => {
      const names = ["Todos", ...groups.map(g => g.name).filter(Boolean)];
      setCatNames(names);
    }).catch(() => setCatNames(["Todos"]));
  };
  useEffect(() => {
    if (!open) return;
    reloadCatNames();

  }, [open]);

  // Sincroniza si se abre y settings cambió desde afuera
  useEffect(() => {
    if (open) setS({ ...settings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ─── Autosave debounced ───
  const skipFirst = useRef(true);
  const saveTimer = useRef(null);
  const saveSeq = useRef(0);
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    if (!open) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const mySeq = ++saveSeq.current;
      const saved = await updateSettings(s);
      if (mySeq !== saveSeq.current) return;
      if (saved) setSettings(saved);
      else showToast("Error al guardar");
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  // Sincroniza catalog_theme cuando settings cambia desde afuera (post-save).
  // Sin esto, después del save inicial el chip quedaba "pegado".
  useEffect(() => {
    if (!open) return;
    if (saveTimer.current) return; // hay save pendiente, no pisar
    if (settings?.catalog_theme && settings.catalog_theme !== s.catalog_theme) {
      setS(p => ({ ...p, catalog_theme: settings.catalog_theme }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.catalog_theme]);

  const set = (k, v) => setS(p => ({ ...p, [k]: v }));
  const setCatImg = (name, url) => setS(p => ({ ...p, cat_images: { ...(p.cat_images || {}), [name]: url } }));
  const toggleCatHidden = (name) => setS(p => {
    const cur = p.hidden_cats || [];
    return { ...p, hidden_cats: cur.includes(name) ? cur.filter(x => x !== name) : [...cur, name] };
  });
  const setCatName = (origName, val) => setS(p => ({ ...p, cat_names: { ...(p.cat_names || {}), [origName]: val } }));

  // Upload handlers
  const handleCoverFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingCover(true);
    const result = await uploadCoverImage(file);
    setUploadingCover(false);
    if (result?.__error) { showToast(result.__error); return; }
    if (result) { set("cover_url", result); showToast("Imagen cargada ✓"); } else { showToast("Error al subir"); }
  };
  const handleCatFile = async (catName, e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingCat(catName);
    const result = await uploadCatImage(file, catName);
    setUploadingCat(null);
    if (result?.__error) { showToast(result.__error); return; }
    if (result) { setCatImg(catName, result); showToast(`Imagen "${catName}" cargada ✓`); } else { showToast("Error al subir"); }
  };
  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingLogo(true);
    const result = await uploadLogoImage(file);
    setUploadingLogo(false);
    if (result?.__error) { showToast(result.__error); return; }
    if (result) { set("logo_url", result); showToast("Logo cargado ✓"); } else { showToast("Error al subir"); }
  };

  // OG image y favicon: reusan uploadLogoImage (mismo bucket de assets de marca).
  // En una iteración futura conviene tener uploadBrandAsset(file, kind) con bucket dedicado.
  const [uploadingOg, setUploadingOg] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const handleOgFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingOg(true);
    const result = await uploadLogoImage(file);
    setUploadingOg(false);
    if (result?.__error) { showToast(result.__error); return; }
    if (result) { set("og_image_url", result); showToast("Imagen OG cargada ✓"); } else { showToast("Error al subir"); }
  };
  const handleFaviconFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingFavicon(true);
    const result = await uploadLogoImage(file);
    setUploadingFavicon(false);
    if (result?.__error) { showToast(result.__error); return; }
    if (result) { set("favicon_url", result); showToast("Favicon cargado ✓"); } else { showToast("Error al subir"); }
  };

  const TABS = [
    { id: 'identity', label: 'Identidad' },
    { id: 'catalog',  label: 'Catálogo' },
    { id: 'qrs',      label: 'QRs' },
    { id: 'cats',     label: 'Categorías' },
  ];

  // ─── catalog_payment_methods: subset de payment_methods visible en el catálogo público.
  //
  // La lista MASTER se administra en Configuración → Finanzas → Medios de pago
  // (campo settings.payment_methods). Acá solo se elige qué subset de esa lista se
  // ofrece a los clientes en el catálogo.
  //
  // Default (catalog_payment_methods undefined o vacío): todos los del master están on.
  const toggleCatalogPayment = (method) => setS(p => {
    const master = p.payment_methods || ['efectivo', 'transferencia', 'mercadopago'];
    const cur = p.catalog_payment_methods ?? master;  // default: todos enabled
    const next = cur.includes(method) ? cur.filter(x => x !== method) : [...cur, method];
    return { ...p, catalog_payment_methods: next };
  });
  const isCatalogPaymentOn = (method) => {
    const master = s.payment_methods || ['efectivo', 'transferencia', 'mercadopago'];
    const cur = s.catalog_payment_methods ?? master;
    return cur.includes(method);
  };

  return (
    <>
      <div
        className={`ag-modal-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={`ag-modal-sheet ${open ? 'open' : ''}`}
        role="dialog"
        aria-label="Personalización"
        aria-hidden={!open}
      >
        <header className="ag-modal-header">
          {editorOpen ? (
            <button
              type="button"
              className="ag-subpage-back"
              onClick={() => setEditorOpen(false)}
              aria-label="Atrás"
              style={{ marginLeft: -4 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Atrás</span>
            </button>
          ) : (
            <div>
              <h3>Personalización</h3>
              <p>Marca, imágenes y categorías · autosave</p>
            </div>
          )}
          {editorOpen && (
            <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: 16, paddingRight: 60 }}>Categorías</h3>
          )}
          <button type="button" className="ag-modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        {/* Tabs (ocultos cuando estamos en sub-página) */}
        {!editorOpen && (
          <div className="ag-modal-tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                className={`ag-modal-tab ${section === t.id ? 'active' : ''}`}
                onClick={() => setSection(t.id)}
              >{t.label}</button>
            ))}
          </div>
        )}

        <div className="ag-modal-body">
          {editorOpen && (
            <CategoryEditor embedded msg={showToast} onClose={() => { setEditorOpen(false); reloadCatNames(); }} />
          )}
          {qrsOpen && (
            <DynamicQrs onClose={() => setQrsOpen(false)} showToast={showToast} />
          )}
          {!editorOpen && (<>


          {/* ── IDENTIDAD ── */}
          {section === 'identity' && (
            <div>
              <label className="ag-field-lbl">Nombre del negocio</label>
              <input
                className="ag-field-input"
                value={s.biz_name || ""}
                onChange={e => set("biz_name", e.target.value)}
                placeholder="La Nona Pato"
              />

              <label className="ag-field-lbl" style={{ marginTop: 16 }}>Logo</label>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 18, overflow: "hidden",
                  background: s.logo_url ? "transparent" : (s.logo_color || "#C45D3E"),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 26, fontWeight: 700,
                  fontFamily: "'DM Serif Display', serif",
                  flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}>
                  {s.logo_url
                    ? <img src={s.logo_url} alt="logo" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = 'none' }} />
                    : (s.logo_letter || "N")}
                </div>
                <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                  <label className="ag-btn-primary" style={{ flex: 1 }}>
                    {uploadingLogo ? "Subiendo..." : "Subir logo"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoFile} disabled={uploadingLogo} />
                  </label>
                  {s.logo_url && (
                    <button type="button" className="ag-btn-ghost" onClick={() => set("logo_url", "")}>Quitar</button>
                  )}
                </div>
              </div>

              {!s.logo_url && (
                <>
                  <label className="ag-field-lbl" style={{ marginTop: 16 }}>Inicial (si no hay imagen)</label>
                  <input
                    className="ag-field-input"
                    value={s.logo_letter || ""}
                    onChange={e => set("logo_letter", e.target.value.slice(0, 2).toUpperCase())}
                    maxLength={2}
                    style={{ width: 90, textAlign: "center", fontSize: 22, fontWeight: 700 }}
                  />

                  <label className="ag-field-lbl" style={{ marginTop: 16 }}>Color del logo</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                    {COLORS.map(c => (
                      <button
                        type="button"
                        key={c.h}
                        onClick={() => set("logo_color", c.h)}
                        style={{
                          aspectRatio: "1", borderRadius: 12,
                          background: c.h, color: "#fff",
                          fontSize: 16, fontWeight: 700,
                          fontFamily: "'DM Serif Display', serif",
                          border: s.logo_color === c.h ? "3px solid var(--ag-ink)" : "0",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        title={c.l}
                      >{s.logo_letter || "N"}</button>
                    ))}
                  </div>
                </>
              )}

              {/* ── Slogan / Descripción ── */}
              <label className="ag-field-lbl" style={{ marginTop: 18 }}>Slogan</label>
              <input
                className="ag-field-input"
                value={s.slogan || ""}
                onChange={e => set("slogan", e.target.value.slice(0, 80))}
                placeholder="Una frase corta · ej: Comida casera con alma"
                maxLength={80}
              />

              {/* ── Local físico ── */}
              <div style={{ marginTop: 18, fontSize: 12, fontWeight: 700, color: 'var(--ag-ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Local físico
              </div>
              <ToggleSwitch
                checked={s.has_physical_store !== false}
                onChange={(v) => set("has_physical_store", v)}
                label="Tengo local físico para retiro en persona"
                hint="Si lo desactivás, los pedidos serán solo por envío y no aparece la opción de retiro en el checkout."
              />
              {s.has_physical_store !== false && (
                <>
                  <label className="ag-field-lbl" style={{ marginTop: 12 }}>Dirección del local</label>
                  <input
                    className="ag-field-input"
                    value={s.store_address || ""}
                    onChange={e => set("store_address", e.target.value.slice(0, 200))}
                    placeholder="Ej: Av. Corrientes 1234, CABA"
                    maxLength={200}
                  />
                  <div style={{ fontSize: 10.5, color: 'var(--ag-ink-3)', marginTop: 3 }}>
                    Aparece debajo del nombre del local en el catálogo y en la confirmación de pedidos.
                  </div>
                </>
              )}

              {/* ── Contacto / Redes ── */}
              <div style={{ marginTop: 18, fontSize: 12, fontWeight: 700, color: 'var(--ag-ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Redes y contacto
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="ag-field-lbl">WhatsApp</label>
                  <input
                    className="ag-field-input"
                    value={s.whatsapp || ""}
                    onChange={e => set("whatsapp", e.target.value.replace(/\D/g, '').slice(0, 15))}
                    placeholder="549112345678"
                    inputMode="numeric"
                  />
                  <div style={{ fontSize: 10.5, color: 'var(--ag-ink-3)', marginTop: 3 }}>
                    Sin + ni espacios · burbuja flotante en el catálogo.
                  </div>
                </div>
                <div>
                  <label className="ag-field-lbl">Instagram</label>
                  <input
                    className="ag-field-input"
                    value={s.instagram || ""}
                    onChange={e => set("instagram", e.target.value.replace(/[@\s]/g, '').slice(0, 30))}
                    placeholder="tu_usuario"
                  />
                </div>
                <div>
                  <label className="ag-field-lbl">Facebook</label>
                  <input
                    className="ag-field-input"
                    value={s.facebook || ""}
                    onChange={e => set("facebook", e.target.value.replace(/\s/g, '').slice(0, 60))}
                    placeholder="tu_pagina"
                  />
                </div>
                <div>
                  <label className="ag-field-lbl">TikTok</label>
                  <input
                    className="ag-field-input"
                    value={s.tiktok || ""}
                    onChange={e => set("tiktok", e.target.value.replace(/[@\s]/g, '').slice(0, 30))}
                    placeholder="tu_usuario"
                  />
                </div>
                <div>
                  <label className="ag-field-lbl">YouTube</label>
                  <input
                    className="ag-field-input"
                    value={s.youtube || ""}
                    onChange={e => set("youtube", e.target.value.replace(/\s/g, '').slice(0, 60))}
                    placeholder="@tu_canal o ID"
                  />
                </div>
                <div>
                  <label className="ag-field-lbl">X / Twitter</label>
                  <input
                    className="ag-field-input"
                    value={s.twitter || ""}
                    onChange={e => set("twitter", e.target.value.replace(/[@\s]/g, '').slice(0, 30))}
                    placeholder="tu_usuario"
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="ag-field-lbl">LinkedIn</label>
                  <input
                    className="ag-field-input"
                    value={s.linkedin || ""}
                    onChange={e => set("linkedin", e.target.value.replace(/\s/g, '').slice(0, 80))}
                    placeholder="company/tu-empresa o in/tu-usuario"
                  />
                  <div style={{ fontSize: 10.5, color: 'var(--ag-ink-3)', marginTop: 3 }}>
                    Path completo después de linkedin.com/
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── QRS DINÁMICOS (tab propio) ── */}
          {section === 'qrs' && (
            <div className="ag-catalog-group">
              <div style={{ fontSize: 13, color: 'var(--ag-ink-3)', marginBottom: 14, lineHeight: 1.5 }}>
                Crea un QR con un slug fijo para imprimir. Cambia a donde redirige sin reimprimir nada.
              </div>
              <button type="button" onClick={() => setQrsOpen(true)}
                style={{ width: '100%', padding: '14px', background: 'var(--ag-bg-card)', border: '1.5px solid var(--ag-c-terra)', color: 'var(--ag-c-terra)', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
                Gestionar QRs dinámicos →
              </button>
              <div style={{ fontSize: 13, color: 'var(--ag-ink-3)', marginBottom: 14, lineHeight: 1.5 }}>
                Páginas informativas (ej: instrucciones de un producto). El QR puede apuntar a una de estas páginas.
              </div>
              <button type="button" onClick={() => { window.location.href = '/admin/paginas'; }}
                style={{ width: '100%', padding: '14px', background: 'var(--ag-bg-card)', border: '1.5px solid var(--ag-c-terra)', color: 'var(--ag-c-terra)', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Gestionar páginas informativas →
              </button>
            </div>
          )}

          {/* ── CATÁLOGO ── */}
          {section === 'catalog' && (
            <div>
              {/* Tema del catálogo (reemplaza el color de fondo del banner) */}
              <div className="ag-catalog-group">
                <div className="ag-catalog-group-title">Tema del catálogo</div>
                <div style={{ fontSize: 12, color: 'var(--ag-ink-3)', marginBottom: 10 }}>
                  Define el look general del catálogo público para tus clientes.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { id: 'ambar',  label: 'Ambar',  bg: '#FFFFFF', tx: '#262626', t2: '#6E6755', ac: '#F59E0B', line: 'rgba(0,0,0,0.08)' },
                    { id: 'noche',  label: 'Noche',  bg: '#161412', tx: '#F4EAD0', t2: '#B5A98E', ac: '#E8B947', line: '#2E2A24' },
                    { id: 'carbon', label: 'Carbon', bg: '#FAF5EE', tx: '#1A1612', t2: '#6B5D4F', ac: '#2D1B0E', line: '#E8DFD0' },
                  ].map(t => {
                    const active = (s.catalog_theme || 'ambar') === t.id;
                    const handleChange = async () => {
                      if (active) return;
                      // Cambio importante → requiere confirmación deslizable.
                      const ok = await confirmSlide({
                        title: `Cambiar tema a "${t.label}"`,
                        body: 'Esto cambia los colores del catálogo público que ven tus clientes.',
                        label: `Deslizá para aplicar "${t.label}"`,
                      });
                      if (!ok) return;
                      // Save explícito (no esperamos debounce).
                      setS(p => ({ ...p, catalog_theme: t.id }));
                      const saved = await updateSettings({ ...s, catalog_theme: t.id });
                      if (saved) {
                        setSettings(saved);
                        try { showToast(`Tema aplicado: ${t.label} ✓`); } catch { /* opcional */ }
                      } else {
                        try { showToast('Error al guardar tema'); } catch { /* opcional */ }
                      }
                    };
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={handleChange}
                        title={active ? 'Tema actual' : `Aplicar tema ${t.label}`}
                        style={{
                          padding: 0,
                          background: 'transparent',
                          border: active ? `2px solid ${t.ac}` : '1px solid var(--ag-ink-4, rgba(0,0,0,0.12))',
                          borderRadius: 12,
                          cursor: active ? 'default' : 'pointer',
                          fontFamily: 'inherit',
                          overflow: 'hidden',
                          transition: 'all 150ms ease',
                          opacity: active ? 1 : 0.95,
                        }}
                      >
                        {/* Mini preview real del tema */}
                        <div style={{ background: t.bg, color: t.tx, padding: '10px 8px 8px', textAlign: 'left' }}>
                          <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1, marginBottom: 4 }}>
                            Hermes
                          </div>
                          <div style={{ fontSize: 9, color: t.t2, marginBottom: 6 }}>
                            Cocina italiana
                          </div>
                          <div style={{ background: t.ac, color: t.bg, fontSize: 9, fontWeight: 700, padding: '3px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 4 }}>
                            $ 3.500
                          </div>
                          <div style={{ borderTop: `1px solid ${t.line}`, marginTop: 4, paddingTop: 4, fontSize: 9, color: t.t2 }}>
                            {t.label} {active ? '·  actual' : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Banner de bienvenida */}
              <div className="ag-catalog-group">
                <div className="ag-catalog-group-title">Banner de bienvenida</div>
                <label className="ag-field-lbl">Mensaje (aparece arriba del catálogo)</label>
                <input
                  className="ag-field-input"
                  value={s.banner_text || ""}
                  onChange={e => set("banner_text", e.target.value.slice(0, 120))}
                  placeholder="Ej: ¡Promo del jueves: 2x1 en empanadas!"
                  maxLength={120}
                />
              </div>

              {/* Operación */}
              <div className="ag-catalog-group">
                <div className="ag-catalog-group-title">Operación visible al cliente</div>
                <div className="ag-settings-group" style={{ marginBottom: 0 }}>

                  <div className="ag-cat-row">
                    <div className="ag-cat-row-main">
                      <div className="ag-cat-row-label">Mínimo de pedido</div>
                      <div className="ag-cat-row-hint">0 = sin mínimo. Aplica al carrito.</div>
                    </div>
                    <div className="ag-cat-row-input">
                      <span className="ag-cat-row-prefix">$</span>
                      <DecimalInput
                        step="100"
                        value={s.min_order_amount ?? 0}
                        onChange={(n) => set("min_order_amount", n)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Costo de envio por distancia (settings.delivery_pricing, Sprint 2) */}
                  <div style={{ paddingTop: 10 }}>
                    <div className="ag-cat-row-label" style={{ marginBottom: 2 }}>Costo de envío por distancia</div>
                    <div className="ag-cat-row-hint" style={{ marginBottom: 8 }}>El último escalón (sin km) aplica a distancias mayores.</div>
                    {(Array.isArray(s.delivery_pricing) && s.delivery_pricing.length > 0
                      ? s.delivery_pricing
                      : [{ max_km: 2, cost: 500 }, { max_km: 5, cost: 1000 }, { max_km: 10, cost: 1800 }, { max_km: 15, cost: 2500 }, { max_km: 25, cost: 3500 }, { max_km: null, cost: 5000 }]
                    ).map((step, i, arr) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {step.max_km != null ? (
                          <>
                            <span style={{ fontSize: 12, color: 'var(--ag-ink-3)', minWidth: 42 }}>hasta</span>
                            <div style={{ width: 64 }}>
                              <DecimalInput
                                step="1"
                                value={step.max_km}
                                onChange={(n) => {
                                  const next = arr.map((x, j) => j === i ? { ...x, max_km: Math.max(1, n || 1) } : x);
                                  set("delivery_pricing", next);
                                }}
                                placeholder="km"
                              />
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--ag-ink-3)' }}>km →</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--ag-ink-3)', minWidth: 132 }}>más lejos →</span>
                        )}
                        <span className="ag-cat-row-prefix">$</span>
                        <div style={{ width: 84 }}>
                          <DecimalInput
                            step="50"
                            value={step.cost}
                            onChange={(n) => {
                              const next = arr.map((x, j) => j === i ? { ...x, cost: Math.max(0, n || 0) } : x);
                              set("delivery_pricing", next);
                            }}
                            placeholder="0"
                          />
                        </div>
                        {step.max_km != null && arr.length > 2 && (
                          <button type="button" aria-label="Quitar escalón"
                            onClick={() => set("delivery_pricing", arr.filter((_, j) => j !== i))}
                            style={{ background: 'none', border: 'none', color: 'var(--ag-ink-3)', cursor: 'pointer', fontSize: 16, padding: 2 }}>×</button>
                        )}
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => {
                        const cur = Array.isArray(s.delivery_pricing) && s.delivery_pricing.length > 0
                          ? s.delivery_pricing
                          : [{ max_km: 2, cost: 500 }, { max_km: 5, cost: 1000 }, { max_km: 10, cost: 1800 }, { max_km: 15, cost: 2500 }, { max_km: 25, cost: 3500 }, { max_km: null, cost: 5000 }];
                        const numeric = cur.filter(x => x.max_km != null);
                        const rest = cur.filter(x => x.max_km == null);
                        const lastKm = numeric.length > 0 ? Math.max(...numeric.map(x => x.max_km)) : 0;
                        const lastCost = numeric.length > 0 ? numeric[numeric.length - 1].cost : 500;
                        set("delivery_pricing", [...numeric, { max_km: lastKm + 5, cost: lastCost + 500 }, ...rest]);
                      }}
                      style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px dashed var(--ag-line, rgba(127,127,127,0.35))', background: 'none', color: 'var(--ag-ink-2)', cursor: 'pointer' }}>
                      + Agregar escalón
                    </button>
                  </div>

                </div>
              </div>

              {/* Métodos de pago aceptados en el catálogo
                  Solo TOGGLEA cuáles de los métodos creados en Configuración
                  se muestran a los clientes. Para crear/eliminar, ir a Configuración. */}
              <div className="ag-catalog-group">
                <div className="ag-catalog-group-title">Métodos de pago aceptados en el catálogo</div>

                {(() => {
                  const PRESET_META = {
                    efectivo:      { label: 'Efectivo',     icon: '💵' },
                    transferencia: { label: 'Transferencia',icon: '🏦' },
                    mercadopago:   { label: 'MercadoPago',  icon: '💳' },
                    tarjeta:       { label: 'Tarjeta',      icon: '💳' },
                  };
                  const master = s.payment_methods || ['efectivo', 'transferencia', 'mercadopago'];

                  if (master.length === 0) {
                    return (
                      <div style={{
                        padding: '12px 14px',
                        background: 'var(--ag-bg-card)',
                        border: '1px solid var(--ag-line)',
                        borderRadius: 10,
                        fontSize: 12.5, color: 'var(--ag-ink-3)', textAlign: 'center',
                      }}>
                        Sin medios de pago configurados.<br />
                        Andá a <strong>Configuración → Finanzas → Medios de pago</strong> para crearlos.
                      </div>
                    );
                  }

                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {master.map(key => {
                          const meta = PRESET_META[key];
                          const label = meta?.label || (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '));
                          const icon = meta?.icon || '🏷️';
                          const on = isCatalogPaymentOn(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleCatalogPayment(key)}
                              className={`ag-pm-chip ${on ? 'on' : ''}`}
                            >
                              <span style={{ fontSize: 16 }}>{icon}</span>
                              <span style={{ flex: 1, textAlign: 'left', textTransform: meta ? 'none' : 'capitalize' }}>{label}</span>
                              {on && <span style={{ fontSize: 14 }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{
                        marginTop: 10, padding: '8px 12px',
                        background: 'var(--ag-bg-soft)',
                        borderRadius: 8,
                        fontSize: 11.5, color: 'var(--ag-ink-3)', lineHeight: 1.5,
                      }}>
                        Estos son los medios habilitados para tus clientes. Para <strong>crear o eliminar</strong> medios de pago, andá a <strong>Configuración → Finanzas → Medios de pago</strong>.
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Favicon */}
              <div className="ag-catalog-group">
                <div className="ag-catalog-group-title">Favicon</div>
                <div style={{ fontSize: 11, color: 'var(--ag-ink-3)', marginBottom: 8 }}>
                  Icono del navegador. Si no subis uno, se usa el logo de la empresa.
                </div>
                <label className="ag-field-lbl">Favicon</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 10,
                    background: 'var(--ag-bg-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', flexShrink: 0,
                    border: '1px solid var(--ag-line)',
                  }}>
                    {s.favicon_url
                      ? <img src={s.favicon_url} alt="favicon" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                      : <span style={{ fontSize: 10, color: 'var(--ag-ink-3)' }}>Sin</span>}
                  </div>
                  <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <label className="ag-btn-primary" style={{ flex: 1, minWidth: 0 }}>
                      {uploadingFavicon ? 'Subiendo…' : '📷 Subir'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFaviconFile} disabled={uploadingFavicon} />
                    </label>
                    <label className="ag-btn-ghost" style={{ flex: 1, minWidth: 0 }}>
                      📸 Cámara
                      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFaviconFile} disabled={uploadingFavicon} />
                    </label>
                    {s.favicon_url && (
                      <button type="button" className="ag-btn-ghost" onClick={() => set('favicon_url', '')} style={{ flex: 0 }}>Quitar</button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--ag-ink-3)', marginTop: 6 }}>
                  Icono del navegador · ideal 32×32 px (ico, png o svg)
                </div>
              </div>
            </div>
          )}

          {/* ── CARÁTULAS DE CATEGORÍAS ── */}
          {section === 'cats' && (
            <div>
              <p style={{ fontSize: 12, color: "var(--ag-ink-3)", marginTop: 0, marginBottom: 12, lineHeight: 1.4 }}>
                Imagen, nombre y visibilidad de cada categoría. El ojito oculta/muestra del catálogo.
              </p>
              <button
                type="button"
                className="ag-btn-ghost"
                style={{ width: "100%", marginBottom: 12 }}
                onClick={() => setEditorOpen(true)}
              >
                Crear · editar · eliminar categorías
              </button>
              {catNames.map(name => {
                const img = (s.cat_images || {})[name];
                const isHidden = (s.hidden_cats || []).includes(name);
                const customName = (s.cat_names || {})[name] || "";
                const isTodos = name === "Todos";
                return (
                  <div
                    key={name}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--ag-line)",
                      opacity: isHidden ? 0.5 : 1,
                      transition: "opacity .2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {!isTodos && (
                        <button
                          type="button"
                          onClick={() => toggleCatHidden(name)}
                          style={{
                            background: "none", border: 0, cursor: "pointer", padding: 4, flexShrink: 0,
                            color: isHidden ? "var(--ag-ink-3)" : "var(--ag-c-sales)",
                          }}
                          title={isHidden ? "Mostrar" : "Ocultar"}
                          aria-label={isHidden ? "Mostrar categoría" : "Ocultar categoría"}
                        >
                          <EyeIcon off={isHidden} />
                        </button>
                      )}
                      <div style={{
                        width: 56, height: 42, borderRadius: 10, overflow: "hidden",
                        background: "var(--ag-bg-soft)", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {img
                          ? <img src={img} alt={name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 10, color: "var(--ag-ink-3)" }}>Sin img</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isTodos
                          ? <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ag-ink)" }}>{name}</div>
                          : (
                            <input
                              className="ag-field-input"
                              value={customName || name}
                              onChange={e => setCatName(name, e.target.value)}
                              placeholder={name}
                              style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 8px", marginBottom: 0 }}
                            />
                          )
                        }
                      </div>
                      <label className="ag-btn-mini" title="Subir imagen">
                        {uploadingCat === name ? "..." : "📷"}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleCatFile(name, e)} disabled={uploadingCat === name} />
                      </label>
                      {img && (
                        <button
                          type="button"
                          onClick={() => setCatImg(name, "")}
                          style={{ background: "none", border: 0, fontSize: 14, color: "var(--ag-c-orders)", cursor: "pointer", padding: 4 }}
                          aria-label="Quitar imagen"
                        >X</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>)}
        </div>
      </div>
    </>
  );
}

export default memo(BrandModal);
