import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { fi, saleCode } from "../lib/utils";

const TABS = ["perfil", "direcciones", "historial", "favoritos"];
const TAB_ICONS = { perfil: "👤", direcciones: "📍", historial: "📦", favoritos: "❤️" };

export default function MyAccount() {
  const navigate = useNavigate();
  const { user, profile, addresses, favorites, loading, sendMagicLink, signOut, updateProfile, addAddress, removeAddress, getOrderHistory } = useAuth();

  const [tab, setTab] = useState("perfil");
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [sendingLink, setSendingLink] = useState(false);

  // Profile edit state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Address form state
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState("Casa");
  const [addrText, setAddrText] = useState("");
  const [addrNotes, setAddrNotes] = useState("");
  const [addingAddr, setAddingAddr] = useState(false);

  // Sync profile fields
  useEffect(() => {
    if (profile) {
      setEditName(profile.name || "");
      setEditPhone(profile.phone || "");
    }
  }, [profile]);

  // Load orders on tab switch
  useEffect(() => {
    if (tab === "historial" && user && orders.length === 0) {
      setLoadingOrders(true);
      getOrderHistory().then(data => { setOrders(data); setLoadingOrders(false); });
    }
  }, [tab, user]);

  if (loading) return (
    <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <p style={{ color: "var(--t3)", fontSize: 15 }}>Cargando...</p>
    </div>
  );

  // --- LOGIN SCREEN ---
  if (!user) return (
    <div className="app" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--b2)" }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--tx)", padding: 4 }}>←</button>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, margin: 0 }}>Mi Cuenta</h2>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🦆</div>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 24, marginBottom: 8, color: "var(--tx)" }}>
          {linkSent ? "¡Revisá tu email!" : "Iniciá sesión"}
        </h2>

        {linkSent ? (
          <div style={{ maxWidth: 340 }}>
            <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, marginBottom: 20 }}>
              Te enviamos un link mágico a <strong>{loginEmail}</strong>. Tocá el link en tu email para entrar. Si no lo ves, revisá spam.
            </p>
            <button onClick={() => { setLinkSent(false); setLoginEmail(""); }} style={{ fontSize: 13, color: "var(--ac)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Usar otro email
            </button>
          </div>
        ) : (
          <div style={{ width: "100%", maxWidth: 340 }}>
            <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, marginBottom: 20 }}>
              Ingresá tu email y te mandamos un link para entrar. Sin contraseña, simple y seguro.
            </p>

            <div style={{ background: "var(--b2)", borderRadius: 16, padding: "20px", textAlign: "left" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 6, display: "block" }}>Email</label>
              <input
                type="email"
                className="cki"
                value={loginEmail}
                onChange={e => { setLoginEmail(e.target.value); setLoginError(""); }}
                placeholder="tu@email.com"
                autoFocus
                style={{ marginBottom: 12 }}
              />
              {loginError && <p style={{ fontSize: 12, color: "#C62828", margin: "0 0 8px" }}>{loginError}</p>}
              <button
                className="abtn"
                style={{ width: "100%", fontSize: 15 }}
                disabled={sendingLink || !loginEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)}
                onClick={async () => {
                  setSendingLink(true);
                  setLoginError("");
                  const { ok, error } = await sendMagicLink(loginEmail);
                  setSendingLink(false);
                  if (ok) setLinkSent(true);
                  else setLoginError(error || "Error al enviar el link. Intentá de nuevo.");
                }}
              >
                {sendingLink ? "Enviando..." : "Enviar Magic Link"}
              </button>
            </div>

            <div style={{ marginTop: 24, padding: "16px", background: "linear-gradient(135deg, #FFF8E1, #FFF3E0)", borderRadius: 14, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#5D4037", marginBottom: 8 }}>Beneficios de tener cuenta</div>
              <div style={{ fontSize: 13, color: "#5D4037", lineHeight: 1.7 }}>
                {["Guardá tus direcciones para pedir más rápido", "Accedé a tu historial de pedidos", "Marcá productos como favoritos", "Cupones y descuentos exclusivos", "No volvés a cargar tus datos"].map((b, i) => (
                  <div key={i}>✓ {b}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        <button onClick={() => navigate("/")} style={{ marginTop: 24, fontSize: 13, color: "var(--t3)", background: "none", border: "none", cursor: "pointer" }}>
          ← Volver a la tienda
        </button>
      </div>
    </div>
  );

  // --- LOGGED IN: MY ACCOUNT ---
  return (
    <div className="app" style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--b2)" }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--tx)", padding: 4 }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, margin: 0 }}>Mi Cuenta</h2>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{user.email}</div>
        </div>
        <button onClick={signOut} style={{ padding: "8px 14px", background: "var(--b2)", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "var(--t2)", cursor: "pointer" }}>
          Cerrar sesión
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "12px 16px", overflowX: "auto", borderBottom: "1px solid var(--b2)" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: tab === t ? "var(--ac)" : "var(--b2)", color: tab === t ? "#fff" : "var(--t2)",
            whiteSpace: "nowrap", transition: "all .2s",
          }}>
            {TAB_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 16px" }}>

        {/* ─── PERFIL ─── */}
        {tab === "perfil" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Datos personales</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 4, display: "block" }}>Nombre</label>
                <input className="cki" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Tu nombre completo" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 4, display: "block" }}>Teléfono</label>
                <input className="cki" type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value.replace(/\D/g, ""))} placeholder="Ej: 1155443322" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 4, display: "block" }}>Email</label>
                <input className="cki" value={user.email} disabled style={{ opacity: 0.6 }} />
              </div>
            </div>
            <button
              className="abtn"
              style={{ width: "100%", marginTop: 16 }}
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const ok = await updateProfile({ name: editName, phone: editPhone });
                setSaving(false);
                if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
              }}
            >
              {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar cambios"}
            </button>
          </div>
        )}

        {/* ─── DIRECCIONES ─── */}
        {tab === "direcciones" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5 }}>Mis direcciones</div>
              <button onClick={() => setShowAddrForm(!showAddrForm)} style={{ padding: "6px 14px", background: "var(--ac)", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {showAddrForm ? "Cancelar" : "+ Agregar"}
              </button>
            </div>

            {showAddrForm && (
              <div style={{ background: "var(--b2)", borderRadius: 14, padding: "16px", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {["Casa", "Trabajo", "Otro"].map(l => (
                    <button key={l} onClick={() => setAddrLabel(l)} style={{
                      padding: "6px 14px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: addrLabel === l ? "var(--ac)" : "var(--bg)", color: addrLabel === l ? "#fff" : "var(--t2)",
                    }}>{l}</button>
                  ))}
                </div>
                <input className="cki" value={addrText} onChange={e => setAddrText(e.target.value)} placeholder="Calle, número, localidad..." style={{ marginBottom: 8 }} />
                <input className="cki" value={addrNotes} onChange={e => setAddrNotes(e.target.value)} placeholder="Piso, depto, timbre (opcional)" style={{ marginBottom: 12 }} />
                <button
                  className="abtn"
                  style={{ width: "100%", fontSize: 13 }}
                  disabled={addingAddr || addrText.length < 5}
                  onClick={async () => {
                    setAddingAddr(true);
                    await addAddress({ label: addrLabel, address: addrText, notes: addrNotes });
                    setAddingAddr(false);
                    setAddrText("");
                    setAddrNotes("");
                    setShowAddrForm(false);
                  }}
                >
                  {addingAddr ? "Guardando..." : "Guardar dirección"}
                </button>
              </div>
            )}

            {addresses.length === 0 && !showAddrForm && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--t3)" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📍</div>
                <p style={{ fontSize: 14 }}>No tenés direcciones guardadas</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Agregá una para que el checkout sea más rápido</p>
              </div>
            )}

            {addresses.map(a => (
              <div key={a.id} style={{ background: "var(--bg)", border: "1px solid var(--b2)", borderRadius: 14, padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ac)", marginBottom: 4 }}>{a.label}</div>
                    <div style={{ fontSize: 14, color: "var(--tx)", lineHeight: 1.4 }}>{a.address}</div>
                    {a.notes && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>{a.notes}</div>}
                  </div>
                  <button onClick={async () => { if (confirm("¿Eliminar esta dirección?")) await removeAddress(a.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--t3)", padding: "4px 8px" }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── HISTORIAL ─── */}
        {tab === "historial" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Mis pedidos</div>

            {loadingOrders && <p style={{ fontSize: 14, color: "var(--t3)", textAlign: "center", padding: 20 }}>Cargando pedidos...</p>}

            {!loadingOrders && orders.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--t3)" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
                <p style={{ fontSize: 14 }}>Todavía no hiciste pedidos</p>
                <button onClick={() => navigate("/")} className="abtn" style={{ marginTop: 12, fontSize: 13 }}>Ir a la tienda</button>
              </div>
            )}

            {orders.map(o => {
              const statusMap = { new: "Nuevo", confirmed: "Confirmado", preparing: "Preparando", ready: "Listo", delivering: "En camino", delivered: "Entregado", cancelled: "Cancelado" };
              const statusColors = { new: "#1976D2", confirmed: "#7B1FA2", preparing: "#E65100", ready: "#2E7D32", delivering: "#0277BD", delivered: "#388E3C", cancelled: "#C62828" };
              return (
                <div key={o.id} onClick={() => navigate(`/order/${o.id}`)} style={{ background: "var(--bg)", border: "1px solid var(--b2)", borderRadius: 14, padding: "14px 16px", marginBottom: 8, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <code style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)", letterSpacing: 1 }}>{saleCode(o.id)}</code>
                    <span style={{ fontSize: 11, fontWeight: 700, color: statusColors[o.status] || "var(--t3)", background: `${statusColors[o.status] || "#999"}15`, padding: "3px 10px", borderRadius: 20 }}>
                      {statusMap[o.status] || o.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--t3)" }}>
                    <span>{o.date || o.created_at?.split("T")[0]}</span>
                    <span style={{ fontWeight: 700, color: "var(--tx)" }}>${fi(o.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── FAVORITOS ─── */}
        {tab === "favoritos" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Mis favoritos</div>

            {favorites.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--t3)" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>❤️</div>
                <p style={{ fontSize: 14 }}>No tenés favoritos todavía</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Tocá el corazón en un producto del catálogo para agregarlo</p>
                <button onClick={() => navigate("/")} className="abtn" style={{ marginTop: 12, fontSize: 13 }}>Ir a la tienda</button>
              </div>
            )}

            {favorites.length > 0 && (
              <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 12 }}>
                Tenés {favorites.length} producto{favorites.length > 1 ? "s" : ""} en favoritos. Visitá la tienda para verlos destacados.
              </p>
            )}

            <button onClick={() => navigate("/")} className="abtn" style={{ width: "100%", fontSize: 14 }}>
              Ir a la tienda
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
