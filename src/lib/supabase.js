import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Revisá tu archivo .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'hermes-auth',
  },
})

// ── Self-healing: clear a corrupt refresh token automatically ──
// Cuando el refresh token guardado en localStorage es viejo / invalidado
// (multi-tab, manual logout en otra pestaña, sesión expirada hace mucho),
// supabase-js dispara este evento. Sin handler, el user queda con UI logueada
// pero todas las requests al server tiran 401, y el realtime channel se cierra
// sin avisar. La solución es signOut() local: limpia el storage y obliga a
// re-login. La próxima vez que abra la app va a entrar limpio, sin error en
// consola y sin sesión zombi.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    // refresh attempt returned null session → token rejected by server
    console.warn('[auth] Invalid refresh token detected — clearing local session')
    supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  }
})

// Catch the AuthApiError thrown synchronously by getSession() when the
// stored refresh token is malformed. Without this, the error bubbles to the
// browser console as an uncaught rejection on every page load.
const originalGetSession = supabase.auth.getSession.bind(supabase.auth)
supabase.auth.getSession = async function safeGetSession() {
  try {
    return await originalGetSession()
  } catch (err) {
    const msg = String(err?.message || '')
    if (msg.includes('Refresh Token') || msg.includes('refresh_token')) {
      console.warn('[auth] getSession threw refresh token error — clearing local session')
      try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
      return { data: { session: null }, error: null }
    }
    throw err
  }
}
