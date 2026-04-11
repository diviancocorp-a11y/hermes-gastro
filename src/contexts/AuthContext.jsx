import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [favorites, setFavorites] = useState([]);   // array de recipe_id
  const [loading, setLoading] = useState(true);

  // Cargar perfil, direcciones y favoritos
  const loadUserData = async (userId) => {
    if (!userId) { setProfile(null); setAddresses([]); setFavorites([]); return; }
    try {
      const [profRes, addrRes, favRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("addresses").select("*").eq("user_id", userId).order("created_at"),
        supabase.from("favorites").select("recipe_id").eq("user_id", userId),
      ]);
      if (profRes.data) setProfile(profRes.data);
      if (addrRes.data) setAddresses(addrRes.data);
      if (favRes.data) setFavorites(favRes.data.map(f => f.recipe_id));
    } catch (e) {
      console.warn("Error cargando datos de usuario:", e);
    }
  };

  // Inicializar sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user || null;
      setUser(u);
      if (u) loadUserData(u.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) loadUserData(u.id);
      else { setProfile(null); setAddresses([]); setFavorites([]); }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- MAGIC LINK ---
  const sendMagicLink = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { ok: !error, error: error?.message };
  };

  // --- LOGOUT ---
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setAddresses([]);
    setFavorites([]);
  };

  // --- PERFIL ---
  const updateProfile = async (data) => {
    if (!user) return false;
    const { error } = await supabase.from("profiles").update({
      ...data,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (!error) {
      setProfile(p => ({ ...p, ...data }));
      return true;
    }
    return false;
  };

  // --- DIRECCIONES ---
  const addAddress = async (addr) => {
    if (!user) return null;
    const { data, error } = await supabase.from("addresses").insert({
      user_id: user.id,
      label: addr.label || "Casa",
      address: addr.address,
      lat: addr.lat || null,
      lng: addr.lng || null,
      notes: addr.notes || null,
    }).select().single();
    if (!error && data) {
      setAddresses(p => [...p, data]);
      return data;
    }
    return null;
  };

  const removeAddress = async (id) => {
    if (!user) return false;
    const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
    if (!error) {
      setAddresses(p => p.filter(a => a.id !== id));
      return true;
    }
    return false;
  };

  const updateAddress = async (id, data) => {
    if (!user) return false;
    const { error } = await supabase.from("addresses").update(data).eq("id", id).eq("user_id", user.id);
    if (!error) {
      setAddresses(p => p.map(a => a.id === id ? { ...a, ...data } : a));
      return true;
    }
    return false;
  };

  // --- FAVORITOS ---
  const toggleFavorite = async (recipeId) => {
    if (!user) return false;
    const isFav = favorites.includes(recipeId);
    if (isFav) {
      const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
      if (!error) setFavorites(p => p.filter(id => id !== recipeId));
    } else {
      const { error } = await supabase.from("favorites").insert({ user_id: user.id, recipe_id: recipeId });
      if (!error) setFavorites(p => [...p, recipeId]);
    }
    return true;
  };

  const isFavorite = (recipeId) => favorites.includes(recipeId);

  // --- HISTORIAL ---
  const getOrderHistory = async () => {
    if (!user) return [];
    const { data } = await supabase
      .from("orders")
      .select("id, date, total, status, created_at, delivery, payment, customer")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    return data || [];
  };

  return (
    <AuthContext.Provider value={{
      user, profile, addresses, favorites, loading,
      sendMagicLink, signOut,
      updateProfile,
      addAddress, removeAddress, updateAddress,
      toggleFavorite, isFavorite,
      getOrderHistory,
      reload: () => user && loadUserData(user.id),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
