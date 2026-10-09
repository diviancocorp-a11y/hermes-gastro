/**
 * Settings — configuración del admin. Se renderiza como página por sección
 * (Operación · Finanzas · Zona de riesgo) desde el dropdown de perfil.
 *
 * Patrón estilo iOS Settings:
 *  · Página raíz con grupos
 *  · Items complejos abren sub-páginas con flecha atrás (no expand inline)
 *  · Autosave debounced (sin botón "Guardar")
 *
 * Props:
 *   settings, setSettings · estado en PlatformAdmin (sincroniza con DB)
 *   showToast             · feedback
 *   section               · 'operacion' | 'finanzas' | 'riesgo' | null (todo)
 *                           (el toggle de modo oscuro vive ahora en el topbar)
 *
 * "Exportar datos" se eliminó (12/jun): el export mensual vive en
 * Resumen del mes → Exportar.
 */
import { useConfirm } from "../ConfirmSlideProvider";
import { useEffect, useRef, useState } from "react";
import SettingsRow from "./shared/forms/SettingsRow";
import TimePicker from "./shared/forms/TimePicker";
import CatChipsEditor from "../ui/CatChipsEditor";
import DecimalInput from "../ui/DecimalInput";
import BrandModal from "./shared/BrandModal";
import DynamicQrs from "./DynamicQrs";
import InfoPagesAdmin from "../../pages/admin/InfoPages";
import PaymentAccountsEditor from "../ui/PaymentAccountsEditor";

function Icon({ d, viewBox = "0 0 24 24" }) {
  return (
    <svg width="16" height="16" viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function BackChevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

// Titulos cuando Settings se renderiza como pagina de UNA seccion
// (abierta desde el dropdown de perfil del topbar)
const SECTION_TITLES = {
  operacion: "Operación",
  finanzas: "Finanzas",
  riesgo: "Zona de riesgo",
};

/**
 * @param onSave  (settings) => Promise<settingsGuardados|null>. Lo inyecta el
 *                panel (guarda por tenant).
 * @param onAbrirUsuarios / onAbrirPasarelas  abren Equipo y Cobros online
 *                (CobrosOnline). Sin permiso para ese destino, la fila no se
 *                muestra.
 *
 * Hasta el 29/sep tambien tenia pasarelas, canales de venta y reinicio del
 * ERP legacy, apagados en el edificio por "capacidades". Se borraron.
 */
function Settings({
  settings, setSettings, showToast, section = null, onBack,
  onSave,
  onSubirImagen,
  onAbrirUsuarios = null,
  onAbrirPasarelas = null,
}) {
  const confirmSlide = useConfirm();
  const [s, setS] = useState({ ...settings });
  const [page, setPage] = useState('root'); // 'root' | 'hours' | 'expCats' | 'ingCats' | 'costs' | 'usarTargets'
  const [brandOpen, setBrandOpen] = useState(false); // Personalizacion (marca, logo, tema del catalogo)
  const [qrsOpen, setQrsOpen] = useState(false); // overlay QRs dinamicos (vive en Operacion)
  const [pagesOpen, setPagesOpen] = useState(false); // overlay Paginas informativas (debajo de QRs)
  const [accountsOpen, setAccountsOpen] = useState(false); // overlay Cuentas de pago (atajo en Finanzas)
  const show = (g) => !section || section === g;

  // ─── Autosave debounced ───
  const skipFirst = useRef(true);
  const saveTimer = useRef(null);
  const saveSeq = useRef(0);

  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const mySeq = ++saveSeq.current;
      const saved = await onSave(s);
      if (mySeq !== saveSeq.current) return;
      if (saved) setSettings(saved);
      else showToast("Error al guardar");
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  const set = (k, v) => setS(p => ({ ...p, [k]: v }));

  const storeOpen = s.store_open !== false;

  const goTo = (p) => setPage(p);
  const goBack = () => setPage('root');

  return (
    <div className="ag-subpage-stack">

      {/* ── ROOT ── */}
      <div className={`ag-subpage is-root ${page !== 'root' ? 'has-child' : ''}`}>
        <div className="ag-subpage-body" style={{ paddingTop: 6 }}>
          <div style={{ padding: "0 4px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Volver"
                style={{
                  width: 34, height: 34, borderRadius: 10, border: "1px solid var(--ag-line)",
                  background: "var(--ag-bg-card)", color: "var(--ag-ink)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <BackChevron />
              </button>
            )}
            <div>
              <h2 style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 800,
                fontSize: 20,
                margin: 0,
                color: section === "riesgo" ? "var(--ag-c-orders)" : "var(--ag-ink)",
                letterSpacing: "-0.01em",
              }}>{SECTION_TITLES[section] || "Configuración"}</h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ag-ink-3)" }}>Cambios se guardan automáticamente</p>
            </div>
          </div>

          {/* ─── OPERACIÓN ───
              El toggle de modo oscuro se mudo al topbar (sol/luna junto a
              la burbuja de perfil) — aca queda lo operativo. */}
          {show('operacion') && (
          <>
          {!section && <div className="ag-settings-group-title">Operación</div>}
          <div className="ag-settings-group">
            {onSubirImagen && <SettingsRow
              state="recipes"
              icon={<Icon d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.6 7.6" />}
              label="Personalización"
              hint="Nombre, logo, portada y tema del catálogo"
              onClick={() => setBrandOpen(true)}
            />}
            <SettingsRow
              state="stock"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>}
              label="Horarios del local"
              hint="Días y franjas de apertura"
              onClick={() => goTo('hours')}
            />
            {/* QRs dinamicos: mudado desde Personalizacion (12/jun) */}
            {<SettingsRow
              state="crm"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z M20 14h1 M14 20h1 M20 20h1"/></svg>}
              label="QRs dinámicos"
              hint="QRs impresos que cambian de destino sin reimprimir"
              onClick={() => setQrsOpen(true)}
            />}
            {/* Paginas informativas: contenido al que apuntan los QRs */}
            {<SettingsRow
              state="recipes"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}
              label="Páginas informativas"
              hint="Contenido para tus QRs y links · /info/..."
              onClick={() => setPagesOpen(true)}
            />}
          </div>
          </>
          )}

          {/* ─── FINANZAS ─── */}
          {show('finanzas') && (
          <>
          {!section && <div className="ag-settings-group-title">Finanzas</div>}
          <div className="ag-settings-group">
            {/* Cuentas de pago: atajo a la unica verdad (vive en Gastos).
                Pedido 12/jun: "no veo los medios de pago" — estaba escondido. */}
            <SettingsRow
              state="sales"
              icon={<Icon d="M3 21h18 M5 21V7l7-4 7 4v14 M9 9h1 M9 13h1 M14 9h1 M14 13h1" />}
              label="Cuentas y medios de pago"
              hint="Efectivo, transferencias, billeteras — checkout y proveedores"
              onClick={() => setAccountsOpen(true)}
            />
            {onAbrirPasarelas && <SettingsRow
              state="sales"
              icon={<Icon d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M1 10h22" />}
              label="Pasarelas de pago"
              hint="Conectar MercadoPago para cobrar online"
              onClick={onAbrirPasarelas}
            />}
            <SettingsRow
              state="sales"
              icon={<Icon d="M3 3v18h18 M7 14l4-4 4 4 5-5" />}
              label="Objetivos del negocio"
              hint="Límites de gasto y piso de ganancia (semáforos del P&L)"
              onClick={() => goTo('usarTargets')}
            />
            {/* "Medios de pago" se mudo a Finanzas → Gastos → 🏦 Cuentas
                (unica verdad de cuentas para checkout y proveedores) */}
            <SettingsRow
              state="orders"
              icon={<Icon d="M3 3v18h18 M7 14l4-4 4 4 5-5" />}
              label="Costos proyectados"
              hint="Colchón de merma y gastos que se suma al costo de cada receta"
              onClick={() => goTo('costs')}
            />
          </div>
          </>
          )}

          {/* ─── ZONA DE RIESGO ─── */}
          {show('riesgo') && (
          <>
          {!section && <div className="ag-settings-group-title" style={{ color: "var(--ag-c-orders)" }}>Zona de riesgo</div>}
          <div className="ag-settings-group">
            {/* Cierre de emergencia: bloquea los pedidos del catálogo */}
            <SettingsRow
              state={storeOpen ? "sales" : "orders"}
              icon={<Icon d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" />}
              label={storeOpen ? "Cierre de emergencia" : "Tienda cerrada"}
              hint={storeOpen ? "Tocá para bloquear pedidos" : "Tocá para reabrir pedidos"}
              onClick={async () => {
                const willClose = storeOpen; // si está abierta, vamos a cerrar
                const ok = await confirmSlide(willClose ? {
                  title: "Cerrar tienda de emergencia",
                  body: "Los clientes verán el catálogo pero NO podrán hacer pedidos hasta que reabras.",
                  label: "Deslizá para bloquear",
                  loadingLabel: "Bloqueando…",
                  successLabel: "Tienda cerrada ✓",
                } : {
                  title: "Reabrir tienda",
                  body: "Los clientes podrán volver a hacer pedidos desde el catálogo.",
                  label: "Deslizá para desbloquear",
                  loadingLabel: "Reabriendo…",
                  successLabel: "Tienda abierta ✓",
                });
                if (!ok) return;
                set("store_open", !willClose);
              }}
              right={
                // Indicador visual de estado (no clickeable)
                <div aria-hidden="true" style={{
                  width: 10, height: 10, borderRadius: 999,
                  background: storeOpen ? "var(--ag-c-sales)" : "var(--ag-c-orders)",
                  boxShadow: `0 0 8px ${storeOpen ? "var(--ag-c-sales)" : "var(--ag-c-orders)"}88`,
                }} />
              }
            />
            {onAbrirUsuarios && <SettingsRow
              state="crm"
              icon={<Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />}
              label="Equipo"
              hint="Quién más puede entrar al panel y con qué permisos"
              onClick={onAbrirUsuarios}
            />}
          </div>
          </>
          )}

          <p style={{ textAlign: "center", color: "var(--ag-ink-3)", fontSize: 11, margin: "18px 0 0" }}>
            Dico
          </p>
        </div>
      </div>

      {/* ── SUB-PÁGINAS ── */}
      <HoursPage
        open={page === 'hours'}
        hours={s.store_hours || {}}
        onChange={v => set("store_hours", v)}
        onBack={goBack}
      />
      <CatsSubPage
        open={page === 'expCats'}
        title="Categorías de gastos"
        intro="Estas categorías se usan al registrar gastos. Cambios afectan al selector en todos los módulos."
        field="exp_cats"
        label="Categorías de gastos"
        icon="💰"
        settings={settings}
        setSettings={setSettings}
        showToast={showToast}
        onBack={goBack}
        onSave={onSave}
      />
      <CatsSubPage
        open={page === 'ingCats'}
        title="Categorías de stock"
        intro="Se usan para agrupar ingredientes en el módulo Stock."
        field="ing_cats"
        label="Categorías de stock"
        icon="📦"
        settings={settings}
        setSettings={setSettings}
        showToast={showToast}
        onBack={goBack}
        onSave={onSave}
      />
      <CostsSubPage
        open={page === 'costs'}
        settings={s}
        setS={setS}
        onBack={goBack}
      />
      <UsarTargetsSubPage
        open={page === 'usarTargets'}
        settings={s}
        setS={setS}
        showToast={showToast}
        onBack={goBack}
      />
      {/* Personalizacion: BrandModal como pagina, con guardado y subida por tenant */}
      {brandOpen && (
        <BrandModal
          open
          asPage
          settings={settings}
          setSettings={setSettings}
          showToast={showToast}
          onSave={onSave}
          onSubirImagen={onSubirImagen}
          onClose={() => setBrandOpen(false)}
        />
      )}

      {/* Overlay de QRs dinamicos (componente autonomo a pantalla completa) */}
      {qrsOpen && <DynamicQrs onClose={() => setQrsOpen(false)} showToast={showToast} />}

      {/* Overlay de Paginas informativas (gestion completa con editor de bloques) */}
      {pagesOpen && (
        <div className="ag-page-over" style={{ overflowY: "auto" }}>
          <InfoPagesAdmin embedded onBack={() => setPagesOpen(false)} />
        </div>
      )}

      {/* Overlay de Cuentas de pago: misma unica verdad que Finanzas → Gastos
          → 🏦 Cuentas, accesible tambien desde la pagina de configuracion */}
      {accountsOpen && (
        <div className="ag-page-over">
          <div className="ag-page-over-head">
            <button type="button" className="ag-subpage-back" onClick={() => setAccountsOpen(false)} aria-label="Cerrar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Atrás</span>
            </button>
            <h2 className="ag-page-over-title">Cuentas de pago</h2>
          </div>
          <div className="ag-page-over-body">
            <PaymentAccountsEditor settings={settings} setSettings={setSettings} showToast={showToast} onSave={onSave} />
          </div>
        </div>
      )}
    </div>
  );
}

function CatsSubPage({ open, title, intro, field, label, icon, settings, setSettings, showToast, onBack, onSave }) {
  return (
    <SubPage open={open} title={title} onBack={onBack}>
      <p className="ag-subpage-intro">{intro}</p>
      <CatChipsEditor
        settings={settings}
        setSettings={setSettings}
        field={field}
        label={label}
        icon={icon}
        showToast={showToast}
        onSave={onSave}
      />
    </SubPage>
  );
}

// PaymentsSubPage ELIMINADA: el editor de cuentas vive en Finanzas → Gastos
// → 🏦 Cuentas (unica verdad para checkout y pago a proveedores).

/* ─── CostsSubPage: % merma + % gastos proyectados ─────────
 * Ambos se SUMAN al costo del producto al calcular rentabilidad.
 * Ej: costo base $100 + merma 5% + gastos 12% → costo real $117.
 * Esto hace que el margen mostrado sea más realista.
 *
 * Usa autosave debounced del padre — solo escribimos en `s` y el
 * Settings principal persiste a los 600ms. */
function CostsSubPage({ open, settings, setS, onBack }) {
  const wastePct = settings?.waste_pct ?? 5;
  const expensePct = settings?.expense_pct ?? 0;
  const totalPct = Number(wastePct) + Number(expensePct);
  const exampleBase = 1000;
  const exampleReal = Math.round(exampleBase * (1 + totalPct / 100));

  return (
    <SubPage open={open} title="Costos proyectados" onBack={onBack}>
      <p className="ag-subpage-intro">
        Estos porcentajes se <strong>suman al costo base</strong> de cada producto para que la rentabilidad mostrada sea más exacta y refleje los costos reales del negocio.
      </p>

      {/* % MERMA */}
      <div className="ag-card" style={{ padding: "14px 16px", marginBottom: 12, borderTop: "3px solid var(--ag-c-stock)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink)", marginBottom: 2 }}>⚠ % Merma proyectada</div>
            <div style={{ fontSize: 11.5, color: "var(--ag-ink-3)", lineHeight: 1.45 }}>
              Pérdida normal por vencimientos, roturas y mal manejo. Sugerido: 3-8%.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <DecimalInput
              min={0} max={100} step="0.5"
              value={wastePct}
              onChange={(n) => setS(p => ({ ...p, waste_pct: n }))}
              style={{
                width: 80, padding: "8px 10px", textAlign: "center",
                fontSize: 16, fontWeight: 700,
                border: "1px solid var(--ag-line)", borderRadius: 10,
                background: "var(--ag-bg)", color: "var(--ag-ink)",
                outline: "none", fontFamily: "inherit",
              }}
            />
            <span style={{ fontSize: 14, color: "var(--ag-c-stock)", fontWeight: 700 }}>%</span>
          </div>
        </div>
      </div>

      {/* % GASTOS */}
      <div className="ag-card" style={{ padding: "14px 16px", marginBottom: 14, borderTop: "3px solid var(--ag-c-orders)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ag-ink)", marginBottom: 2 }}>💸 % Gastos operativos</div>
            <div style={{ fontSize: 11.5, color: "var(--ag-ink-3)", lineHeight: 1.45 }}>
              Costos indirectos prorrateados: alquiler, servicios, sueldos, packaging. Sugerido: 10-20%.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <DecimalInput
              min={0} max={100} step="0.5"
              value={expensePct}
              onChange={(n) => setS(p => ({ ...p, expense_pct: n }))}
              style={{
                width: 80, padding: "8px 10px", textAlign: "center",
                fontSize: 16, fontWeight: 700,
                border: "1px solid var(--ag-line)", borderRadius: 10,
                background: "var(--ag-bg)", color: "var(--ag-ink)",
                outline: "none", fontFamily: "inherit",
              }}
            />
            <span style={{ fontSize: 14, color: "var(--ag-c-orders)", fontWeight: 700 }}>%</span>
          </div>
        </div>
      </div>

      {/* Preview del impacto */}
      <div className="ag-card" style={{
        padding: "14px 16px", background: "var(--ag-bg-card)",
        borderTop: "3px solid var(--ag-c-terra)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ag-c-terra)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          Cómo se aplica
        </div>
        <div style={{ fontSize: 13, color: "var(--ag-ink-2)", lineHeight: 1.5 }}>
          Si un producto tiene costo base <strong>$1.000</strong>,<br />
          con <strong>{wastePct}% + {expensePct}% = {totalPct}%</strong> ajuste,<br />
          el costo real proyectado es <strong style={{ color: "var(--ag-c-terra)", fontSize: 15 }}>${exampleReal}</strong>.
        </div>
        <div style={{ fontSize: 11, color: "var(--ag-ink-3)", marginTop: 8, lineHeight: 1.5 }}>
          La rentabilidad mostrada en Recetas se calcula con este costo ajustado.
        </div>
      </div>
    </SubPage>
  );
}

/* ───────────────────────────────────────────────────── */
/*                  SUB-PÁGINAS                          */
/* ───────────────────────────────────────────────────── */

function SubPage({ open, title, onBack, children }) {
  return (
    <div className={`ag-subpage is-child ${open ? 'is-open' : ''}`}>
      <div className="ag-subpage-head">
        <button type="button" className="ag-subpage-back" onClick={onBack} aria-label="Atrás">
          <BackChevron /> <span>Atrás</span>
        </button>
        <h2 className="ag-subpage-title">{title}</h2>
      </div>
      <div className="ag-subpage-body">{children}</div>
    </div>
  );
}

function HoursPage({ open, hours, onChange, onBack }) {
  const set = (i, k, v) => { const nh = { ...hours }; nh[i] = { ...(hours[i] || {}), [k]: v }; onChange(nh); };
  const set24h = (i, checked) => {
    const nh = { ...hours };
    nh[i] = { ...(hours[i] || {}), h24: checked, open: checked ? "00:00" : "", close: checked ? "23:59" : "", closed: false };
    onChange(nh);
  };
  return (
    <SubPage open={open} title="Horarios" onBack={onBack}>
      <p className="ag-subpage-intro">Definí los días y franjas en que el local acepta pedidos.</p>
      {["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"].map((day, i) => {
        const d = hours[i] || { open: "", close: "", closed: false, h24: false };
        return (
          <div key={day} style={{ padding: "10px 0", borderBottom: i < 6 ? "1px solid var(--ag-line)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 84, fontSize: 13, fontWeight: 600, color: d.closed ? "var(--ag-ink-3)" : "var(--ag-ink)" }}>{day}</div>
              {d.closed
                ? <div style={{ flex: 1, fontSize: 12, color: "var(--ag-ink-3)", fontStyle: "italic" }}>Cerrado</div>
                : d.h24
                  ? <div style={{ flex: 1, fontSize: 12, color: "var(--ag-c-sales)", fontWeight: 600 }}>● 24 horas</div>
                  : <>
                      {/* Desplegable de hora/minuto (12/jun) — antes input type=time
                          que en desktop selecciona el texto para escribir */}
                      <TimePicker value={d.open || ""} onChange={v => set(i, "open", v)} ariaLabel={`Apertura del ${day}`} />
                      <span style={{ fontSize: 11, color: "var(--ag-ink-3)" }}>a</span>
                      <TimePicker value={d.close || ""} onChange={v => set(i, "close", v)} ariaLabel={`Cierre del ${day}`} />
                    </>
              }
              <button type="button" onClick={() => set(i, "closed", !d.closed)}
                style={{ background: "none", border: 0, fontSize: 11.5, color: d.closed ? "var(--ag-c-sales)" : "var(--ag-c-orders)", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "inherit" }}>
                {d.closed ? "Abrir" : "Cerrar"}
              </button>
            </div>
            {!d.closed && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, marginLeft: 92, fontSize: 11, color: "var(--ag-ink-3)", cursor: "pointer" }}>
                <input type="checkbox" checked={!!d.h24} onChange={e => set24h(i, e.target.checked)} style={{ margin: 0, cursor: "pointer" }} />
                Abierto 24 horas
              </label>
            )}
          </div>
        );
      })}
    </SubPage>
  );
}

/* ─── UsarTargetsSubPage: editar % objetivo USAR ───────
 * En español + guia (12/jun): cada % es un TECHO (o piso, EBITDA)
 * independiente sobre el ingreso del mes — NO tienen que sumar 100. */
function UsarTargetsSubPage({ open, settings, setS, showToast, onBack }) {
  const t = settings?.usar_targets || {};
  const set = (k, v) => setS({ ...settings, usar_targets: { ...t, [k]: Math.max(0, Math.min(100, Number(v) || 0)) } });
  const rows = [
    {
      key: "food_cost_pct", label: "Costo de comida (máx.)",
      hint: "De cada $100 que vendés, cuánto puede irse en ingredientes. Lo normal en una dark kitchen: 30%.",
    },
    {
      key: "packaging_pct", label: "Packaging (máx.)",
      hint: "Cajas, bolsas, stickers, cubiertos. Lo normal: 5%.",
    },
    {
      key: "labor_pct", label: "Mano de obra de cocina (máx.)",
      hint: "Sueldos del equipo que cocina y arma pedidos. Lo normal: 20%.",
    },
    {
      key: "marketing_pct", label: "Publicidad (máx.)",
      hint: "Pauta en redes, promos, influencers. Lo normal: 3 a 7%.",
    },
    {
      key: "target_ebitda_pct", label: "Ganancia operativa (mín.)",
      hint: "Lo que tiene que quedarte ANTES de impuestos. Un negocio sano deja 10 a 20%. Este es el único que es un piso: más es mejor.",
    },
  ];

  return (
    <SubPage open={open} title="Objetivos del negocio" onBack={onBack}>
      <p className="ag-subpage-intro">
        Cada porcentaje es un <strong>límite que te ponés a vos mismo</strong> sobre lo que facturás en el mes.
        En el Resumen del mes, cada métrica se pinta <span style={{ color: "var(--ag-c-sales)", fontWeight: 700 }}>verde</span> si
        la cumpliste o <span style={{ color: "var(--ag-c-orders)", fontWeight: 700 }}>roja</span> si te pasaste.
      </p>
      <div style={{
        padding: "10px 12px", borderRadius: 10, marginBottom: 16,
        background: "rgba(245, 158, 11, 0.10)", border: "1px solid rgba(245, 158, 11, 0.25)",
        fontSize: 11.5, lineHeight: 1.55, color: "var(--ag-ink-2)",
      }}>
        💡 <strong>No tienen que sumar 100%</strong> — son límites independientes, no un reparto de la torta.
        Ejemplo: si vendés $1.000.000 y el objetivo de comida es 30%, gastar más de $300.000 en ingredientes pinta esa línea en rojo.
      </div>

      {rows.map(r => (
        <div key={r.key} style={{ marginBottom: 14 }}>
          <label className="ag-field-lbl">{r.label}</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="ag-field-input"
              type="number" min="0" max="100" step="0.5"
              value={t[r.key] ?? ""}
              onChange={e => set(r.key, e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ag-ink-2)" }}>%</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--ag-ink-3)", margin: "4px 0 0 2px", lineHeight: 1.5 }}>{r.hint}</p>
        </div>
      ))}
    </SubPage>
  );
}

export default Settings;
