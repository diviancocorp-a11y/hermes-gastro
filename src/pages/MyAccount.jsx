import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { fi, saleCode, imgOpt } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { validateCouponPublic } from "../lib/catalogService";

const TABS = ["perfil", "direcciones", "historial", "favoritos", "cupones"];
const TAB_ICONS = { perfil: "👤", direcciones: "📍", historial: "📦", favoritos: "❤️", cupones: "🎟️" };

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
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [showNotRegistered, setShowNotRegistered] = useState(false);
  // Registration fields
  const [regName, setRegName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regPhone, setRegPhone] = useState("");

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
  const [geoLoading, setGeoLoading] = useState(false);

  // Favorites products
  const [favProducts, setFavProducts] = useState([]);

  // Cupones
  const [couponCode, setCouponCode] = useState("");
  const [couponCheckLoading, setCouponCheckLoading] = useState(false);
  const [couponCheckResult, setCouponCheckResult] = useState(null);

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

  // Load favorite products
  useEffect(() => {
    if (tab === "favoritos" && favorites.length > 0) {
      const fetchFavProducts = async () => {
        const { data, error } = await supabase
          .from('recipes')
          .select('id, name, sale_price, image_url, category')
          .in('id', favorites);
        if (!error && data) {
          setFavProducts(data);
        }
      };
      fetchFavProducts();
    } else if (tab === "favoritos" && favorites.length === 0) {
      setFavProducts([]);
    }
  }, [tab, favorites]);

  if (loading) return (
    <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <p style={{ color: "var(--t3)", fontSize: 15 }}>Cargando...</p>
    </div>
  );

  // --- LOGIN / REGISTER SCREEN ---
  if (!user) {
    const validEmail = loginEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail);

    const validRegister = authMode === "register" ? (regName.trim().length >= 2 && regLastName.trim().length >= 2 && regPhone.trim().length >= 6) : true;

    const handleAuth = async () => {
      if (authMode === "register" && !validRegister) {
        setLoginError("Completá todos los campos para registrarte.");
        return;
      }
      setSendingLink(true);
      setLoginError("");
      setShowNotRegistered(false);
      const isSignUp = authMode === "register";
      const metadata = isSignUp ? { name: `${regName.trim()} ${regLastName.trim()}`, phone: regPhone.trim() } : {};
      const { ok, error } = await sendMagicLink(loginEmail, isSignUp, metadata);
      setSendingLink(false);

      if (ok) {
        setLinkSent(true);
      } else if (error === "not_registered") {
        setShowNotRegistered(true);
        setLoginError("");
      } else if (error === "already_registered") {
        setLoginError("Este email ya tiene cuenta. Usá \"Iniciar sesión\" para entrar.");
        setAuthMode("login");
      } else if (error === "rate_limit") {
        setLoginError("Enviamos demasiados emails en poco tiempo. Esperá unos minutos antes de intentar de nuevo. Si ya recibiste un email, revisá tu bandeja de entrada y spam.");
      } else {
        setLoginError(error || "Error al enviar el link. Intentá de nuevo.");
      }
    };

    return (
    <div className="app" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--b2)" }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--tx)", padding: 4 }}>←</button>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, margin: 0 }}>Mi Cuenta</h2>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🦆</div>
        <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 24, marginBottom: 8, color: "var(--tx)" }}>
          {linkSent ? "¡Revisá tu email!" : authMode === "register" ? "Crear cuenta" : "Iniciá sesión"}
        </h2>

        {linkSent ? (
          <div style={{ maxWidth: 340 }}>
            <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, marginBottom: 20 }}>
              Te enviamos un link mágico a <strong>{loginEmail}</strong>. Tocá el link en tu email para entrar. Si no lo ves, revisá la carpeta de spam.
            </p>
            <button onClick={() => { setLinkSent(false); setLoginEmail(""); setShowNotRegistered(false); }} style={{ fontSize: 13, color: "var(--ac)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Usar otro email
            </button>
          </div>
        ) : (
          <div style={{ width: "100%", maxWidth: 340 }}>
            <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, marginBottom: 20 }}>
              {authMode === "register"
                ? "Registrate con tu email. Te mandamos un link mágico para activar tu cuenta, sin contraseña."
                : "Ingresá tu email y te mandamos un link para entrar. Sin contraseña, simple y seguro."}
            </p>

            {/* Toggle Login / Registro */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--b2)", borderRadius: 12, padding: 4 }}>
              <button onClick={() => { setAuthMode("login"); setLoginError(""); setShowNotRegistered(false); }} style={{
                flex: 1, padding: "10px 0", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: authMode === "login" ? "var(--ac)" : "transparent", color: authMode === "login" ? "#fff" : "var(--t2)",
                transition: "all .2s",
              }}>Iniciar sesión</button>
              <button onClick={() => { setAuthMode("register"); setLoginError(""); setShowNotRegistered(false); }} style={{
                flex: 1, padding: "10px 0", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: authMode === "register" ? "var(--ac)" : "transparent", color: authMode === "register" ? "#fff" : "var(--t2)",
                transition: "all .2s",
              }}>Registrarse</button>
            </div>

            <div style={{ background: "var(--b2)", borderRadius: 16, padding: "20px", textAlign: "left" }}>
              {/* Campos de registro: nombre, apellido, teléfono */}
              {authMode === "register" && (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 4, display: "block" }}>Nombre</label>
                      <input className="cki" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Juan" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 4, display: "block" }}>Apellido</label>
                      <input className="cki" value={regLastName} onChange={e => setRegLastName(e.target.value)} placeholder="Pérez" />
                    </div>
                  </div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 4, display: "block" }}>Teléfono</label>
                  <input className="cki" type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value.replace(/\D/g, ""))} placeholder="Ej: 1155443322" style={{ marginBottom: 8 }} />
                </>
              )}

              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", marginBottom: 6, display: "block" }}>Email</label>
              <input
                type="email"
                className="cki"
                value={loginEmail}
                onChange={e => { setLoginEmail(e.target.value); setLoginError(""); setShowNotRegistered(false); }}
                placeholder="tu@email.com"
                autoFocus
                onKeyDown={e => e.key === "Enter" && validEmail && handleAuth()}
                style={{ marginBottom: 12 }}
              />

              {/* Error genérico */}
              {loginError && <p style={{ fontSize: 12, color: "#C62828", margin: "0 0 8px", lineHeight: 1.4 }}>{loginError}</p>}

              {/* Error: usuario no registrado → ofrecer registrarse */}
              {showNotRegistered && (
                <div style={{ background: "#FFF3E0", border: "1px solid #FFB74D", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                  <p style={{ fontSize: 13, color: "#E65100", fontWeight: 700, margin: "0 0 6px" }}>
                    Este email no está registrado
                  </p>
                  <p style={{ fontSize: 12, color: "#BF360C", margin: "0 0 10px", lineHeight: 1.4 }}>
                    No encontramos una cuenta con <strong>{loginEmail}</strong>. Registrate para crear tu cuenta en La Nona Pato.
                  </p>
                  <button
                    className="abtn"
                    style={{ width: "100%", fontSize: 13, background: "#E65100" }}
                    onClick={() => { setAuthMode("register"); setShowNotRegistered(false); }}
                  >
                    Registrarme con este email
                  </button>
                </div>
              )}

              {!showNotRegistered && (
                <button
                  className="abtn"
                  style={{ width: "100%", fontSize: 15 }}
                  disabled={sendingLink || !validEmail || (authMode === "register" && !validRegister)}
                  onClick={handleAuth}
                >
                  {sendingLink ? "Enviando..." : authMode === "register" ? "Crear mi cuenta" : "Enviar Magic Link"}
                </button>
              )}
            </div>

            {authMode === "login" && !showNotRegistered && (
              <p style={{ marginTop: 14, fontSize: 12, color: "var(--t3)" }}>
                ¿No tenés cuenta?{" "}
                <button onClick={() => { setAuthMode("register"); setLoginError(""); setShowNotRegistered(false); }} style={{ background: "none", border: "none", color: "var(--ac)", fontWeight: 700, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>
                  Registrate acá
                </button>
              </p>
            )}
            {authMode === "register" && (
              <p style={{ marginTop: 14, fontSize: 12, color: "var(--t3)" }}>
                ¿Ya tenés cuenta?{" "}
                <button onClick={() => { setAuthMode("login"); setLoginError(""); setShowNotRegistered(false); }} style={{ background: "none", border: "none", color: "var(--ac)", fontWeight: 700, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>
                  Iniciá sesión
                </button>
              </p>
            )}

            <div style={{ marginTop: 20, padding: "16px", background: "linear-gradient(135deg, #FFF8E1, #FFF3E0)", borderRadius: 14, textAlign: "left" }}>
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
  }

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
                <button
                  onClick={async () => {
                    setGeoLoading(true);
                    try {
                      const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject);
                      });
                      const { latitude, longitude } = position.coords;
                      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
                      const geoData = await geoRes.json();
                      setAddrText(geoData.address?.road ? `${geoData.address.road}${geoData.address.house_number ? ' ' + geoData.address.house_number : ''}, ${geoData.address.city || geoData.address.town || geoData.address.village || ''}` : geoData.display_name);
                    } catch (err) {
                      alert("No pudimos obtener tu ubicación. Asegúrate de permitir acceso a la ubicación en tu navegador.");
                    }
                    setGeoLoading(false);
                  }}
                  disabled={geoLoading}
                  style={{ padding: "8px 14px", background: "var(--bg)", border: "1px solid var(--b2)", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "var(--t2)", cursor: "pointer", marginBottom: 8, width: "100%" }}
                >
                  {geoLoading ? "Localizando..." : "📍 Usar mi ubicación actual"}
                </button>
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
              const isActive = ["new", "confirmed", "preparing", "ready", "delivering"].includes(o.status);
              const isDelivered = o.status === "delivered";
              return (
                <div key={o.id} style={{ background: "var(--bg)", border: "1px solid var(--b2)", borderRadius: 14, padding: "14px 16px", marginBottom: 8 }}>
                  <div onClick={() => navigate(`/order/${o.id}`)} style={{ cursor: "pointer" }}>
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
                  <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--b2)" }}>
                    {isActive && (
                      <button onClick={() => navigate(`/order/${o.id}`)} style={{ flex: 1, padding: "6px 8px", background: "var(--ac)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        🔴 Seguir pedido
                      </button>
                    )}
                    {isDelivered && (
                      <button onClick={() => navigate("/")} style={{ flex: 1, padding: "6px 8px", background: "var(--ac)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        🔄 Repetir pedido
                      </button>
                    )}
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

            {favorites.length > 0 && favProducts.length > 0 && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
                  {favProducts.map(p => (
                    <div key={p.id} style={{ background: "var(--bg)", border: "1px solid var(--b2)", borderRadius: 12, overflow: "hidden", cursor: "pointer" }} onClick={() => navigate(`/product/${p.id}`)}>
                      <div style={{ width: "100%", aspectRatio: "1", overflow: "hidden", background: "var(--b2)" }}>
                        {p.image_url && <img src={imgOpt(p.image_url, 200, 200)} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      </div>
                      <div style={{ padding: "12px", fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: "var(--tx)", marginBottom: 4, minHeight: "2.4em", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.name}</div>
                        {p.category && <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6 }}>{p.category}</div>}
                        {p.sale_price && <div style={{ fontWeight: 700, color: "var(--ac)" }}>${fi(p.sale_price)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate("/")} className="abtn" style={{ width: "100%", fontSize: 14 }}>
                  Ir a la tienda
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── CUPONES Y DESCUENTOS ─── */}
        {tab === "cupones" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Descuentos y cupones</div>

            <div style={{ background: "linear-gradient(135deg, #E3F2FD, #F3E5F5)", borderRadius: 14, padding: "16px", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1565C0", marginBottom: 8 }}>Descuentos Rotativos Diarios</div>
              <p style={{ fontSize: 12, color: "#283593", lineHeight: 1.6, marginBottom: 10 }}>
                Cada lunes a jueves tenemos un descuento del 15% en diferentes categorías:
              </p>
              <div style={{ display: "grid", gap: 6 }}>
                {[
                  { day: "Lunes", categories: "Pastas" },
                  { day: "Martes", categories: "Salsas y condimentos" },
                  { day: "Miércoles", categories: "Conservas" },
                  { day: "Jueves", categories: "Bebidas" }
                ].map((d, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#1565C0" }}>
                    <strong>{d.day}:</strong> {d.categories}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "var(--b2)", borderRadius: 14, padding: "16px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)", marginBottom: 10 }}>Validar cupón</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="cki"
                  type="text"
                  value={couponCode}
                  onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponCheckResult(null); }}
                  placeholder="Ingresá tu código"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={async () => {
                    if (!couponCode.trim()) return;
                    setCouponCheckLoading(true);
                    try {
                      const result = await validateCouponPublic(couponCode);
                      setCouponCheckResult(result);
                    } catch (err) {
                      setCouponCheckResult({ valid: false, message: "Error al validar el cupón" });
                    }
                    setCouponCheckLoading(false);
                  }}
                  disabled={couponCheckLoading || !couponCode.trim()}
                  className="abtn"
                  style={{ fontSize: 13, padding: "10px 16px", whiteSpace: "nowrap" }}
                >
                  {couponCheckLoading ? "Validando..." : "Validar"}
                </button>
              </div>

              {couponCheckResult && (
                <div style={{
                  marginTop: 12,
                  padding: "12px",
                  borderRadius: 10,
                  background: couponCheckResult.valid ? "#E8F5E9" : "#FFEBEE",
                  border: `1px solid ${couponCheckResult.valid ? "#81C784" : "#EF5350"}`,
                  fontSize: 12,
                  color: couponCheckResult.valid ? "#2E7D32" : "#C62828"
                }}>
                  {couponCheckResult.valid ? "✓" : "✕"} {couponCheckResult.message || (couponCheckResult.valid ? "Cupón válido" : "Cupón no válido")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
