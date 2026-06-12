// src/catalog-pro/CheckoutScreen.jsx
// Checkout stepper 3 pasos: Datos -> Entrega -> Pago (el pago es el paso final).
// Reescrito desde el inline de Catalog.jsx para usar SOLO tokens del catalog-pro
// (--ac, --bg, --tx, --t2, --line, --b2, --ok, --err) y respetar el tema activo
// (ambar/noche/carbon).
//
// Antes vivia en Catalog.jsx con 600 lineas mezcladas + 88 colores hardcoded +
// 71 referencias a tokens --ag-* del admin. El catalogo cambiaba de tema pero
// al entrar al checkout el cliente "salia" del tema.

import { useState, useEffect } from "react";
import Icon from "./Icon";
import { fmtAR } from "./format";
import SchedulePicker from "./SchedulePicker";

const STEPS = ["Datos", "Entrega", "Pago"];

// Genera 7 dias hacia adelante para el dropdown de programar.
// La gente no programa pedidos a mas de 1 semana; ofrecer mas confunde.
function buildNext7Days() {
  const DOW = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const out = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const value = d.toISOString().split("T")[0];
    let label;
    if (i === 0) label = "Hoy";
    else if (i === 1) label = "Mañana";
    else label = `${DOW[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
    out.push({ value, label });
  }
  return out;
}

export default function CheckoutScreen(props) {
  const {
    // navegacion
    step, onStepChange, onClose,
    // auth + form
    user, profile, form, sf, navigate,
    // schedule
    scheduleMode, setScheduleMode, storeStatus, minDate, availableHours, selectedDayInfo,
    // entrega
    addresses, geoLoading, setGeoLoading, estimateDelivery, calcingDelivery,
    deliveryCost, setDeliveryCost, deliveryKm, setDeliveryKm,
    haversine, STORE_LAT, STORE_LNG, calcDeliveryCost,
    // pago
    mpConnected, payments, paymentIcon, paymentLabel,
    receiptFile, setReceiptFile, receiptPreview, setReceiptPreview, receiptStatus,
    // cart / totales
    cart, ct, ctWithDelivery, discount, deliveryKmDisplay,
    coupon, couponCode, setCouponCode, setCoupon, applyCoupon, validatingCoupon, couponErr, setCouponErr,
    ffGift,
    // settings (para min_order_amount)
    settings,
    // submit
    orderErr, sending, onSubmit,
  } = props;

  // Minimo de pedido (settings.min_order_amount). 0 o null = sin minimo.
  const minOrder = Number(settings?.min_order_amount) || 0;
  const minOk = minOrder === 0 || ct >= minOrder;

  const canNext0 =
    form.name.trim().length >= 2 &&
    form.phone.length >= 10 &&
    (!form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) &&
    minOk;
  const canNext1 = form.delivery === "retiro" || (form.delivery === "envio" && form.address.trim().length > 3);

  // Cuentas de pago (settings.payment_accounts) = unica fuente. Efectivo implicito.
  const paymentAccounts = (Array.isArray(settings?.payment_accounts) ? settings.payment_accounts : [])
    .filter(a => a && a.active !== false && (a.scope ?? "ambos") !== "proveedores")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const selectedAccount = form.payment_account_id
    ? (paymentAccounts.find(a => a.id === form.payment_account_id) || null)
    : null;
  // MP pasarela (integracion API): proceso externo, se cobra solo, sin comprobante.
  const isGateway = !form.payment_account_id && form.payment === "mercadopago" && mpConnected;
  const isEfectivo = !form.payment_account_id && !isGateway;

  const canNext2 = isEfectivo
    ? (form.change_amount === "justo" || (form.change_amount && Number(form.change_amount) > 0))
    : (!!selectedAccount || isGateway);
  // Toda cuenta registrada es manual: pide comprobante (gating en el paso final).
  const needsReceipt = !!selectedAccount;

  const goNext = () => onStepChange(Math.min(step + 1, 2));
  const goBack = () => { if (step === 0) onClose(); else onStepChange(step - 1); };

  // Tag de contexto para Sentry: en que paso del checkout estaba el cliente
  // cuando exploto algo (sentryFull.js lo lee en beforeSend)
  useEffect(() => {
    window.__HG_CHECKOUT_STEP = "checkout-paso-" + (step + 1);
    return () => { window.__HG_CHECKOUT_STEP = null; };
  }, [step]);

  // Boton de ayuda (header): abre WhatsApp del negocio con mensaje pre-llenado.
  const bizWhatsapp = (settings?.whatsapp || "").replace(/\D/g, "");
  const helpHref = bizWhatsapp
    ? "https://wa.me/" + bizWhatsapp + "?text=" + encodeURIComponent("Hola! No puedo completar mi pedido porque: ")
    : null;

  return (
    <div className="cp-root cp-surface cp-no-scrollbar" style={{ position: "fixed", inset: 0, zIndex: 240, overflowY: "auto", paddingBottom: 130 }}>
      {/* Header sticky */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", borderBottom: "1px solid var(--line)", padding: "14px 18px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={goBack} aria-label="Atras" style={iconBtn}><Icon name="arrow-left" size={18} /></button>
        <div style={{ flex: 1, fontFamily: "var(--font-heading)", fontSize: 18, color: "var(--tx)" }}>{STEPS[step]}</div>
        {helpHref && (
          <a href={helpHref} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--err, #C62828)", padding: "5px 12px", borderRadius: 999, textDecoration: "none" }}>
            Ayuda
          </a>
        )}
        <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>{step + 1}/{STEPS.length}</span>
      </div>

      {/* Indicador del stepper */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px 4px", gap: 8 }}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: done ? "var(--ac)" : active ? "var(--ac)" : "var(--b2)",
                color: done || active ? (active && !done ? "#fff" : "#fff") : "var(--t3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                border: active ? "2px solid var(--ac)" : "1px solid var(--line)",
              }}>{done ? "✓" : i + 1}</div>
              <span style={{ fontSize: 10, color: active ? "var(--tx)" : "var(--t3)", fontWeight: active ? 600 : 400 }}>{s}</span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "18px 22px 0" }}>
        {step === 0 && <Step0Datos {...props} canNext={canNext0} onNext={goNext} minOrder={minOrder} minOk={minOk} ct={ct} />}
        {step === 1 && <Step1Entrega {...props} canNext={canNext1} onNext={goNext} />}
        {step === 2 && <Step2Pago {...props} accounts={paymentAccounts} selectedAccount={selectedAccount} needsReceipt={needsReceipt} />}
      </div>
    </div>
  );
}

// ─── PASO 0: Datos ─────────────────────────────────────────────────
function Step0Datos({ user, profile, form, sf, cart, navigate, scheduleMode, setScheduleMode, storeStatus, minDate, availableHours, selectedDayInfo, storeHours, getAvailableHours, canNext, onNext, minOrder, minOk, ct }) {
  return (
    <>
      {minOrder > 0 && !minOk && (
        <div style={{
          ...section,
          padding: "12px 14px",
          background: "var(--err-soft, #FFE8E5)",
          border: "1px solid var(--err, #C62828)",
          borderRadius: 12,
          color: "var(--err, #C62828)",
          fontSize: 13, fontWeight: 600,
        }}>
          Te faltan ${(minOrder - ct).toLocaleString("es-AR")} para alcanzar el mínimo de pedido (${minOrder.toLocaleString("es-AR")}).
        </div>
      )}
      {/* Si esta logueado, mostrar saludo */}
      {user ? (
        <div style={section}>
          <div style={{
            padding: "14px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 12,
            background: "var(--b2)", border: "1px solid var(--line)",
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%", background: "var(--ac)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16,
            }}>{(profile?.name || user.email)?.[0]?.toUpperCase() || "U"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tx)" }}>{profile?.name || "Mi cuenta"}</div>
              <div style={{ fontSize: 12, color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--ok, #2A9D6E)", fontWeight: 700, background: "var(--ac-soft, var(--b2))", padding: "4px 10px", borderRadius: 999, border: "1px solid var(--ok, #2A9D6E)" }}>Registrado</div>
          </div>
        </div>
      ) : (
        <>
          <div style={section}>
            <label style={labelStyle}>Tus datos</label>
            <input style={input} value={form.name} onChange={e => sf("name", e.target.value.slice(0, 200))} placeholder="Nombre y Apellido" autoFocus />
            <input style={{ ...input, marginTop: 10 }} type="tel" value={form.phone} onChange={e => sf("phone", e.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="Telefono (Ej: 1155443322)" maxLength={15} />
            {form.phone && form.phone.length < 10 && (
              <p style={hint("err")}>Minimo 10 digitos · ({form.phone.length}/10)</p>
            )}
          </div>

          {/* Banner Top de la semana — el guest se crea solo al confirmar el pedido (#79),
              asi que no hace falta promover registro. Mejor cautivar con el sistema de puntos. */}
          <div style={section}>
            <div style={{ padding: 18, background: "var(--ac-soft, var(--b2))", borderRadius: 14, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ac-soft-fg, var(--tx))", marginBottom: 6 }}>
                Sumás puntos con este pedido
              </div>
              <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 4 }}>
                Cada $10.000 = 1 punto. Cada lunes premiamos al podio de la semana.
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>
                Mira el ranking en la home del catalogo.
              </div>
            </div>
          </div>
        </>
      )}

      {/* Cuando lo necesitas */}
      <div style={section}>
        <label style={labelStyle}>¿Para cuando?</label>
        <div style={{ display: "flex", gap: 10 }}>
          <Chip
            disabled={!storeStatus.open}
            active={scheduleMode === "now" && storeStatus.open}
            onClick={() => { if (!storeStatus.open) return; setScheduleMode("now"); sf("delivery_date", ""); sf("delivery_time", ""); }}
            label="Ahora"
          />
          <Chip active={scheduleMode === "later"} onClick={() => setScheduleMode("later")} label="Programar" />
        </div>
        {!storeStatus.open && <p style={hint("err")}>{storeStatus.msg}</p>}
        {storeStatus.open && storeStatus.msg && scheduleMode === "now" && <p style={hint("ok")}>✓ {storeStatus.msg}</p>}
      </div>

      {scheduleMode === "later" && (
        <div style={section}>
          {/* Calendario + pills de horario (SchedulePicker, jun 2026).
              Reemplaza los dos selects de fecha/hora manteniendo el mismo
              estado del form (delivery_date / delivery_time). */}
          <SchedulePicker
            dateValue={form.delivery_date}
            timeValue={form.delivery_time}
            onSelectDate={(d) => { sf("delivery_date", d); sf("delivery_time", ""); }}
            onSelectTime={(t) => sf("delivery_time", t)}
            storeHours={storeHours}
            getAvailableHours={getAvailableHours}
          />
          {!form.delivery_date && <p style={hint("err")}>Seleccioná una fecha</p>}
        </div>
      )}

      <NextButton
        disabled={!canNext || (scheduleMode === "now" && !storeStatus.open) || (scheduleMode === "later" && (!form.delivery_date || !form.delivery_time))}
        onClick={onNext}
      />
    </>
  );
}

// ─── PASO 1: Entrega ───────────────────────────────────────────────
function Step1Entrega({ form, sf, user, addresses, setDeliveryCost, setDeliveryKm, haversine, STORE_LAT, STORE_LNG, calcDeliveryCost, estimateDelivery, calcingDelivery, deliveryCost, deliveryKm, geoLoading, setGeoLoading, canNext, onNext, settings }) {
  // Si el local no tiene local fisico, forzamos delivery (sin chance de retiro).
  const hasPhysical = settings?.has_physical_store !== false;
  useEffect(() => {
    if (!hasPhysical && form.delivery !== "envio") sf("delivery", "envio");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPhysical]);
  return (
    <>
      {hasPhysical && (
        <div style={section}>
          <label style={labelStyle}>¿Cómo lo recibís?</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <CardOption
              active={form.delivery === "retiro"}
              onClick={() => { sf("delivery", "retiro"); setDeliveryCost(0); setDeliveryKm(null); }}
              title="Retiro en local"
              subtitle={settings?.store_address || "Dirección del local"}
            />
            <CardOption
              active={form.delivery === "envio"}
              onClick={() => sf("delivery", "envio")}
              title="Delivery"
              subtitle="Te lo llevamos a tu dirección"
            />
          </div>
        </div>
      )}

      {form.delivery === "envio" && (
        <div style={section}>
          <label style={labelStyle}>Direccion de entrega</label>

          {user && addresses.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...miniLabel, marginBottom: 6 }}>Seleccioná una dirección guardada</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {addresses.map(a => {
                  const isSelected = form.address === a.address;
                  return (
                    <button key={a.id} onClick={() => {
                      sf("address", a.address);
                      sf("address_piso", a.notes || "");
                      if (a.lat && a.lng) {
                        const km = haversine(STORE_LAT, STORE_LNG, a.lat, a.lng);
                        setDeliveryKm(Math.round(km * 10) / 10);
                        setDeliveryCost(calcDeliveryCost(km));
                      } else { estimateDelivery(a.address); }
                    }} style={{
                      width: "100%", padding: "11px 14px",
                      background: isSelected ? "var(--ac)" : "var(--b2)",
                      color: isSelected ? "#fff" : "var(--tx)",
                      border: `1px solid ${isSelected ? "var(--ac)" : "var(--line)"}`,
                      borderRadius: 12, textAlign: "left", cursor: "pointer", fontSize: 13, lineHeight: 1.4,
                    }}>
                      <span style={{ fontWeight: 700 }}>{a.label}:</span> {a.address}
                      {a.notes && <span style={{ opacity: 0.7, fontSize: 12 }}> · {a.notes}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <input style={input} value={form.address} onChange={e => {
            sf("address", e.target.value);
            clearTimeout(window._deliveryTimer);
            window._deliveryTimer = setTimeout(() => estimateDelivery(e.target.value), 1500);
          }} placeholder="Calle y numero (Ej: Av. San Martin 1234)" />
          {form.address && form.address.length < 5 && <p style={hint("err")}>Ingresá una dirección más completa</p>}

          <button
            disabled={geoLoading}
            onClick={async () => {
              if (!navigator.geolocation) { alert("Tu navegador no soporta geolocalizacion"); return; }
              setGeoLoading(true);
              try {
                const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
                const { latitude, longitude } = pos.coords;
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=18`);
                const d = await r.json();
                const a = d.address || {};
                const street = a.road || a.pedestrian || a.footway || "";
                let number = a.house_number || "";
                if (!number && street) {
                  try {
                    const r2 = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=21`);
                    const d2 = await r2.json();
                    number = d2.address?.house_number || "";
                  } catch { /* ignore */ }
                }
                if (!number) {
                  const approx = Math.round(Math.abs((latitude * 10000) % 9000) / 5) * 5 + 100;
                  number = `~${approx}`;
                }
                const locality = a.city || a.town || a.village || a.suburb || "";
                const fullAddr = street ? `${street} ${number}, ${locality}`.trim() : d.display_name?.split(",").slice(0, 3).join(",") || "";
                sf("address", fullAddr);
                const km = haversine(STORE_LAT, STORE_LNG, latitude, longitude);
                setDeliveryKm(Math.round(km * 10) / 10);
                setDeliveryCost(calcDeliveryCost(km));
              } catch {
                alert("No pudimos obtener tu ubicacion. Permiti acceso en tu navegador.");
              }
              setGeoLoading(false);
            }}
            style={{
              marginTop: 10, width: "100%", padding: "11px 14px",
              background: "transparent", border: "1.5px dashed var(--line)",
              borderRadius: 10, fontSize: 13, fontWeight: 600,
              color: "var(--ac)", cursor: "pointer", fontFamily: "inherit",
            }}
          >{geoLoading ? "Localizando..." : "Usar mi ubicacion actual"}</button>

          <input style={{ ...input, marginTop: 10 }} value={form.address_piso} onChange={e => sf("address_piso", e.target.value)} placeholder="Piso / Depto (opcional)" />
          <input style={{ ...input, marginTop: 10 }} value={form.address_notas} onChange={e => sf("address_notas", e.target.value)} placeholder="Referencia para el delivery (timbre, esquina...)" />

          {calcingDelivery && <div style={{ marginTop: 10, fontSize: 13, color: "var(--ac)", fontWeight: 600 }}>Calculando costo...</div>}
          {!calcingDelivery && deliveryKm !== null && deliveryCost > 0 && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--b2)", borderRadius: 12, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>Costo de envío</div>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>~{deliveryKm} km desde el local</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ac)" }}>{fmtAR(deliveryCost)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <NextButton disabled={!canNext} onClick={onNext} />
    </>
  );
}

// ─── PASO 2: Pago ──────────────────────────────────────────────────
function Step2Pago({ form, sf, payments, paymentIcon, paymentLabel, mpConnected, accounts, selectedAccount, ct, ctWithDelivery, deliveryCost, deliveryKm, tipAmount, receiptFile, setReceiptFile, receiptPreview, setReceiptPreview, receiptStatus, coupon, couponCode, setCouponCode, setCoupon, applyCoupon, validatingCoupon, couponErr, setCouponErr, discount, ffGift, tip, setTip, tipCustom, setTipCustom, tipCap, needsReceipt, cart, scheduleMode, settings, onSubmit, sending, orderErr }) {
  return (
    <>
      <div style={section}>
        <label style={labelStyle}>Medio de pago</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <CardOption
            active={!form.payment_account_id && form.payment !== "mercadopago"}
            onClick={() => { sf("payment", "efectivo"); sf("payment_account_id", null); setReceiptFile(null); setReceiptPreview(null); }}
            icon="💵"
            title="Efectivo"
            subtitle="Pagás al recibir"
          />
          {mpConnected && (
            <CardOption
              active={!form.payment_account_id && form.payment === "mercadopago"}
              onClick={() => { sf("payment", "mercadopago"); sf("payment_account_id", null); setReceiptFile(null); setReceiptPreview(null); }}
              icon="💳"
              title="MercadoPago (pago online)"
              subtitle="Pagás online al confirmar"
            />
          )}
          {accounts.map(acc => {
            const sub = acc.alias ? "Alias: " + acc.alias
              : acc.cbu ? "CBU ···" + String(acc.cbu).slice(-4)
              : "Coordiná con el local";
            return (
              <CardOption
                key={acc.id}
                active={form.payment_account_id === acc.id}
                onClick={() => { sf("payment", "transferencia"); sf("payment_account_id", acc.id); setReceiptFile(null); setReceiptPreview(null); }}
                icon="🏦"
                title={acc.banco || acc.label}
                subtitle={sub}
              />
            );
          })}
        </div>
      </div>

      {/* Detalles efectivo */}
      {!form.payment_account_id && (
        <div style={detailBox}>
          <div style={labelStyle}>¿Con cuanto pagas?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <ToggleBtn active={form.change_amount === "justo"} onClick={() => sf("change_amount", "justo")}>Pago justo</ToggleBtn>
            <ToggleBtn active={form.change_amount !== null && form.change_amount !== "justo"} onClick={() => sf("change_amount", "")}>Necesito cambio</ToggleBtn>
          </div>
          {form.change_amount !== null && form.change_amount !== "justo" && (
            <input
              style={{ ...input, marginTop: 12 }}
              type="number" inputMode="numeric"
              value={form.change_amount === "justo" ? "" : form.change_amount}
              onChange={e => sf("change_amount", e.target.value.replace(/\D/g, ""))}
              placeholder="Ej: pago con $20.000"
            />
          )}
        </div>
      )}

      {/* MP pasarela (integracion API): redirige al checkout de MP */}
      {!form.payment_account_id && form.payment === "mercadopago" && mpConnected && (
        <div style={detailBox}>
          <div style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: "#009EE3", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>MP</span>
            Pagá con MercadoPago
          </div>
          <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}>
            Al confirmar te vamos a redirigir al <strong style={{ color: "var(--tx)" }}>checkout seguro de MercadoPago</strong>. Tarjeta de credito, debito, dinero en cuenta o efectivo en Rapipago/Pago Facil.
          </div>
          <div style={{ marginTop: 14, fontWeight: 700, color: "var(--tx)" }}>Monto a pagar: <span style={{ color: "var(--ac)" }}>{fmtAR(ctWithDelivery)}</span></div>
        </div>
      )}

      {/* Cuenta manual: datos para transferir (el comprobante se sube en el resumen) */}
      {selectedAccount && (
        <PayBankBox account={selectedAccount} amount={ctWithDelivery} />
      )}

      {/* Propina (movida desde el carrito: el cliente la decide aca, cuando ya sabe envio + total) */}
      <div style={section}>
        <label style={labelStyle}>Propina para la cocina</label>
        <p style={{ fontSize: 11.5, color: "var(--t3)", margin: "0 0 10px" }}>Opcional. 100% va para el equipo.</p>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 5, 10, 15, 20].map(v => {
            const active = tipCustom == null && tip === v;
            return (
              <button
                key={v} type="button" onClick={() => { setTip(v); setTipCustom(null); }}
                style={{
                  flex: 1, height: 44, borderRadius: 10,
                  background: active ? "var(--tx)" : "transparent",
                  color: active ? "var(--bg)" : "var(--t2)",
                  border: `1px solid ${active ? "var(--tx)" : "var(--line)"}`,
                  fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                }}
              >{v === 0 ? "No" : `${v}%`}</button>
            );
          })}
          <button
            type="button" onClick={() => setTipCustom(tipCustom != null ? tipCustom : 0)}
            style={{
              flex: 1, height: 44, borderRadius: 10,
              background: tipCustom != null ? "var(--tx)" : "transparent",
              color: tipCustom != null ? "var(--bg)" : "var(--t2)",
              border: `1px solid ${tipCustom != null ? "var(--tx)" : "var(--line)"}`,
              fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >Otro</button>
        </div>
        {tipCustom != null && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 12, padding: "0 12px", background: "var(--bg)" }}>
              <span style={{ color: "var(--t2)", fontSize: 15, fontWeight: 600 }}>$</span>
              <input
                type="text" inputMode="numeric" autoFocus
                value={tipCustom ? tipCustom : ""}
                onChange={e => {
                  const digits = e.target.value.replace(/[^\d]/g, "");
                  let n = digits === "" ? 0 : parseInt(digits, 10);
                  if (tipCap > 0 && n > tipCap) n = tipCap;
                  setTipCustom(n);
                }}
                placeholder="Monto en pesos"
                style={{ flex: 1, height: 44, border: 0, padding: 0, background: "transparent", fontFamily: "inherit", fontSize: 15, color: "var(--tx)", outline: "none" }}
              />
            </div>
            <p style={{ fontSize: 11, color: "var(--t3)", margin: "6px 2px 0" }}>Maximo {fmtAR(tipCap)} (total del pedido).</p>
          </div>
        )}
        {tipAmount > 0 && (
          <p style={{ ...hint("ok"), marginTop: 8 }}>
            Dejás <strong>{fmtAR(tipAmount)}</strong> de propina
          </p>
        )}
      </div>

      {/* Cupon */}
      <div style={section}>
        <label style={labelStyle}>¿Tenés un cupón?</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid var(--line)", borderRadius: 12, padding: 4, background: "var(--bg)" }}>
          <input
            value={couponCode}
            onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null); setCouponErr(""); }}
            disabled={!!coupon || validatingCoupon}
            placeholder="Ingresá tu cupón"
            style={{ flex: 1, height: 40, border: 0, padding: "0 12px", background: "transparent", fontFamily: "monospace", fontSize: 13, color: "var(--tx)", outline: "none", letterSpacing: "0.05em" }}
          />
          {!coupon ? (
            <button onClick={applyCoupon} disabled={validatingCoupon || !couponCode.trim()} style={{
              height: 38, padding: "0 16px", borderRadius: 8, border: 0,
              background: couponCode.trim() ? "var(--ac)" : "var(--b3)",
              color: couponCode.trim() ? "#fff" : "var(--t3)",
              fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}>{validatingCoupon ? "..." : "Aplicar"}</button>
          ) : (
            <button onClick={() => { setCoupon(null); setCouponCode(""); }} style={{
              height: 38, padding: "0 14px", borderRadius: 8, border: 0,
              background: "var(--ok, #2A9D6E)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>✓ -{coupon.discount_pct}%</button>
          )}
        </div>
        {couponErr && <p style={hint("err")}>{couponErr}</p>}
        {coupon && <p style={hint("ok")}>Descuento {coupon.discount_pct}% — ahorrás {fmtAR(discount)}</p>}
      </div>

      {/* Productos + total (este es el paso final; reemplaza al resumen) */}
      <div style={{ ...section, padding: "14px 16px", background: "var(--b2)", borderRadius: 12, border: "1px solid var(--line)" }}>
        <div style={miniLabel}>Productos</div>
        {cart.map(it => (
          <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, color: "var(--tx)" }}>{it.name}</span>
              <span style={{ color: "var(--t3)", fontSize: 12 }}> x{it.qty}</span>
            </div>
            <span style={{ fontWeight: 700, color: "var(--tx)" }}>{fmtAR(it.price * it.qty)}</span>
          </div>
        ))}
        {form.delivery === "envio" && deliveryCost > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 13 }}>
            <span style={{ color: "var(--t2)" }}>Envío {deliveryKm ? `(~${deliveryKm} km)` : ""}</span>
            <span style={{ fontWeight: 700, color: "var(--tx)" }}>{fmtAR(deliveryCost)}</span>
          </div>
        )}
        {coupon && discount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, color: "var(--ok, #2A9D6E)" }}>
            <span>Cupón -{coupon.discount_pct}%</span>
            <span>−{fmtAR(discount)}</span>
          </div>
        )}
        {tipAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: "var(--t2)" }}>
            <span>{tipCustom != null ? "Propina" : `Propina (${tip}%)`}</span>
            <span style={{ color: "var(--tx)" }}>{fmtAR(tipAmount)}</span>
          </div>
        )}
        <hr style={{ margin: "10px 0", border: 0, borderTop: "1px solid var(--line)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--tx)" }}>Total a pagar</span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 26, color: "var(--tx)" }}>{fmtAR(ctWithDelivery)}</span>
        </div>
      </div>

      {/* Comprobante: debajo del total. Solo cuentas manuales lo piden (desbloquea el boton). */}
      {needsReceipt && (
        <div style={section}>
          <div style={miniLabel}>Comprobante de pago</div>
          <p style={{ fontSize: 12, color: "var(--t3)", margin: "2px 0 10px" }}>Cargá la foto o PDF de tu comprobante para desbloquear el botón.</p>
          <ReceiptUploader
            receiptFile={receiptFile} setReceiptFile={setReceiptFile}
            receiptPreview={receiptPreview} setReceiptPreview={setReceiptPreview}
            receiptStatus={receiptStatus}
          />
        </div>
      )}

      {/* Entrega: debajo del comprobante */}
      <div style={section}>
        <div style={miniLabel}>Entrega</div>
        <div style={summaryVal}>{form.delivery === "retiro" ? `Retiro en local${settings?.store_address ? ` — ${settings.store_address}` : ""}` : `Delivery — ${form.address}`}</div>
        {scheduleMode === "later" && (
          <div style={{ ...summaryVal, fontSize: 12, color: "var(--ac)" }}>
            Programado: {form.delivery_date}{form.delivery_time ? ` a las ${form.delivery_time}` : ""}
          </div>
        )}
      </div>

      {/* Datos del cliente: debajo de la direccion, para corroborar */}
      <div style={section}>
        <div style={miniLabel}>Tus datos</div>
        <div style={summaryVal}>{form.name}</div>
        <div style={{ ...summaryVal, fontSize: 12, color: "var(--t3)" }}>{form.phone}{form.email ? ` · ${form.email}` : ""}</div>
      </div>

      {orderErr && <div style={{ background: "var(--err-soft, rgba(220,38,38,0.1))", color: "var(--err, #C62828)", fontSize: 13, padding: "10px 14px", borderRadius: 10, marginBottom: 12, textAlign: "center", border: "1px solid var(--err, #C62828)" }}>{orderErr}</div>}

      <button
        disabled={sending || ctWithDelivery === 0 || (needsReceipt && !receiptFile)}
        onClick={onSubmit}
        style={{
          ...btnPrimary,
          background: (sending || ctWithDelivery === 0 || (needsReceipt && !receiptFile)) ? "var(--b3)" : "var(--ok, #2A9D6E)",
          color: (sending || ctWithDelivery === 0 || (needsReceipt && !receiptFile)) ? "var(--t3)" : "#fff",
          cursor: (sending || ctWithDelivery === 0 || (needsReceipt && !receiptFile)) ? "not-allowed" : "pointer",
          fontSize: 16, height: 56,
        }}
      >{sending ? "Enviando..." : (needsReceipt && !receiptFile ? "Cargá el comprobante" : "Completar pedido")}</button>
    </>
  );
}

// (Paso Resumen eliminado: el Pago es ahora el paso final — ver Step2Pago)

// ─── Sub-componentes ──────────────────────────────────────────────

function Chip({ active, disabled, onClick, label }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        flex: 1, height: 44, borderRadius: 999,
        background: active ? "var(--tx)" : "transparent",
        color: active ? "var(--bg)" : "var(--t2)",
        border: `1px solid ${active ? "var(--tx)" : "var(--line)"}`,
        fontFamily: "inherit", fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >{label}</button>
  );
}

function CardOption({ active, onClick, title, subtitle, icon }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        width: "100%", padding: "14px 16px", textAlign: "left",
        background: active ? "var(--ac-soft, var(--b2))" : "var(--bg)",
        border: `1.5px solid ${active ? "var(--ac)" : "var(--line)"}`,
        borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      {icon && <span style={{ fontSize: 22 }}>{icon}</span>}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--tx)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
      </div>
      {active && (
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--ac)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>✓</div>
      )}
    </button>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: "12px 14px", borderRadius: 12,
      background: active ? "var(--ac)" : "var(--b2)",
      color: active ? "#fff" : "var(--tx)",
      border: `1px solid ${active ? "var(--ac)" : "var(--line)"}`,
      fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
    }}>{children}</button>
  );
}

function NextButton({ disabled, onClick, label = "Siguiente" }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "100%", marginTop: 24, height: 52, borderRadius: 14, border: 0,
        background: disabled ? "var(--b3)" : "var(--ac)",
        color: disabled ? "var(--t3)" : "#fff",
        fontFamily: "inherit", fontSize: 15, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}
    >
      {label}{!disabled && <Icon name="arrow-right" size={16} />}
    </button>
  );
}

function PayBankBox({ account, amount }) {
  const [copied, setCopied] = useState("");
  const copy = (key, val) => {
    if (!val) return;
    navigator.clipboard?.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };
  const rows = [
    account.alias ? { key: "alias", label: "Alias", value: account.alias } : null,
    account.cbu ? { key: "cbu", label: "CBU / CVU", value: account.cbu } : null,
  ].filter(Boolean);
  return (
    <div style={detailBox}>
      <div style={{ ...labelStyle, marginBottom: 12 }}>{"Datos para pagar" + (account.banco ? " — " + account.banco : "")}</div>
      {account.titular && (
        <div style={{ fontSize: 12.5, color: "var(--t2)", marginBottom: 8 }}>Titular: <strong style={{ color: "var(--tx)" }}>{account.titular}</strong></div>
      )}
      {rows.map(r => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 2 }}>{r.label}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--tx)", letterSpacing: 0.5, overflowWrap: "anywhere" }}>{r.value}</div>
          </div>
          <button onClick={() => copy(r.key, r.value)} style={{
            padding: "8px 14px", borderRadius: 8, border: "1px solid var(--ac)",
            background: copied === r.key ? "var(--ac)" : "transparent",
            color: copied === r.key ? "#fff" : "var(--ac)",
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
          }}>{copied === r.key ? "✓ Copiado" : "Copiar"}</button>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: 14, color: "var(--tx)", fontWeight: 700 }}>
        Monto a transferir: <span style={{ color: "var(--ac)" }}>{fmtAR(amount)}</span>
      </div>

    </div>
  );
}

// Subida de comprobante reutilizable. Se usa en el resumen (Step3) y desbloquea
// el boton de "Realizar pedido".
function ReceiptUploader({ receiptFile, setReceiptFile, receiptPreview, setReceiptPreview, receiptStatus }) {
  return (
    <div>
      <label style={{
        display: "block", padding: 18, background: "var(--bg)",
        border: "1.5px dashed var(--line)", borderRadius: 12, cursor: "pointer", textAlign: "center",
      }}>
        <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e => {
          const file = e.target.files?.[0]; if (!file) return;
          setReceiptFile(file);
          if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = ev => setReceiptPreview(ev.target.result);
            reader.readAsDataURL(file);
          } else { setReceiptPreview(null); }
        }} />
        {receiptPreview ? (
          <img src={receiptPreview} alt="Comprobante" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 10 }} />
        ) : receiptFile ? (
          <div style={{ color: "var(--tx)" }}><div style={{ fontSize: 28 }}>📄</div><div style={{ fontSize: 13, marginTop: 6 }}>{receiptFile.name}</div></div>
        ) : (
          <div style={{ color: "var(--t3)" }}>
            <div style={{ fontSize: 28 }}>📸</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Tocá para subir foto o PDF</div>
          </div>
        )}
      </label>
      {receiptFile && receiptStatus === "" && <p style={hint("ok")}>Comprobante cargado ✓</p>}
      {receiptStatus === "ok" && <p style={hint("ok")}>Comprobante verificado</p>}
      {receiptStatus === "error" && <p style={hint("err")}>No pudimos verificar — lo revisaremos manualmente</p>}
    </div>
  );
}

// ─── Estilos compartidos (tokens-only) ──────────────────────────

const section = { marginBottom: 20 };

const labelStyle = {
  display: "block",
  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
  color: "var(--t2)", marginBottom: 10,
};

const miniLabel = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--t3)", marginBottom: 6,
};

const input = {
  width: "100%", height: 46, padding: "0 14px",
  background: "var(--bg)", color: "var(--tx)",
  border: "1px solid var(--line)", borderRadius: 12,
  fontFamily: "inherit", fontSize: 14, outline: "none",
  boxSizing: "border-box",
};

const detailBox = {
  marginTop: -10, marginBottom: 20,
  padding: "16px 18px",
  background: "var(--b2)", border: "1px solid var(--line)", borderRadius: 14,
};

const btnPrimary = {
  width: "100%", padding: "12px 16px",
  background: "var(--ac)", color: "#fff",
  border: 0, borderRadius: 12,
  fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer",
};

const iconBtn = {
  width: 38, height: 38, borderRadius: 999,
  background: "transparent", border: "1px solid var(--line)",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--tx)", cursor: "pointer", flexShrink: 0,
};

const summaryVal = { fontSize: 14, color: "var(--tx)", marginTop: 2 };

function hint(tone = "neutral") {
  const colors = {
    neutral: "var(--t3)",
    ok: "var(--ok, #2A9D6E)",
    err: "var(--err, #C62828)",
    warn: "var(--ac)",
  };
  return { fontSize: 11, color: colors[tone], margin: "6px 0 0 2px" };
}

function infoBox(tone = "neutral") {
  const cfg = {
    err: { bg: "var(--err-soft, rgba(220,38,38,0.08))", border: "var(--err, #C62828)", fg: "var(--err, #C62828)" },
    warn: { bg: "var(--ac-soft, var(--b2))", border: "var(--ac)", fg: "var(--ac)" },
  }[tone] || { bg: "var(--b2)", border: "var(--line)", fg: "var(--t2)" };
  return {
    marginTop: 12, padding: "10px 14px",
    background: cfg.bg, border: `1px solid ${cfg.border}`,
    borderRadius: 10, fontSize: 13, color: cfg.fg, lineHeight: 1.4,
  };
}
