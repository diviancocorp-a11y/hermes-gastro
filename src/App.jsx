import { Routes, Route, useLocation } from 'react-router-dom'
import QrRedirect from './pages/QrRedirect'
import InfoPage from './pages/InfoPage'
import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import SkipToContent from './components/ui/SkipToContent'
import OfflineBanner from './components/ui/OfflineBanner'
import UpdateBanner from './components/ui/UpdateBanner'
import useTheme from './hooks/useTheme'
import Catalog from './pages/Catalog'
import PlatformLanding from './pages/PlatformLanding'
import Consola from './pages/Consola'
import Signup from './pages/Signup'
import Bienvenido from './pages/Bienvenido'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import { isPlatformRoot } from './lib/tenantHost'
import { hardReload } from './lib/hardReload'
import { useEffect } from 'react'
import { applyTheme, clearAppliedTheme } from './services/theme'
import { resolveThemeOwner, THEME_OWNERS } from './lib/themeOwnership'

// lazy con auto-recuperacion (fix HERMES-GASTRO-8, 11/jun): si el usuario
// tiene la app abierta de ANTES de un deploy, el chunk viejo ya no existe y
// el import dinamico falla ("Failed to fetch dynamically imported module").
// Solucion: recargar la pagina UNA vez (trae el HTML nuevo con hashes nuevos).
// El guard en sessionStorage evita loops si el error es otro.
function lazyReload(importer) {
  return lazy(() =>
    importer().catch((err) => {
      try {
        // Maximo 1 recarga cada 60s: recupera tras cada deploy nuevo pero
        // nunca entra en loop si el fallo es persistente
        const last = Number(sessionStorage.getItem('hg_chunk_reload') || 0)
        if (Date.now() - last > 60000) {
          sessionStorage.setItem('hg_chunk_reload', String(Date.now()))
          // hardReload y no location.reload(): si el chunk fallo por un deploy
          // nuevo, el SW todavia tiene cacheado el index.html viejo que apunta
          // a ese mismo chunk inexistente. Recargar a secas repite el error y
          // el guard de 60s deja al usuario con la pantalla rota.
          hardReload()
          return new Promise(() => {}) // la recarga interrumpe; no renderizar nada
        }
      } catch { /* sin storage: dejar que el error suba al ErrorBoundary */ }
      throw err
    }),
  )
}

const PlatformAdmin = lazyReload(() => import('./pages/PlatformAdmin'))
const Personalizacion = lazyReload(() => import('./pages/Personalizacion'))
const InfoPagesAdmin = lazyReload(() => import('./pages/admin/InfoPages'))
const OrderTracker = lazyReload(() => import('./pages/OrderTracker'))
const MyAccount = lazyReload(() => import('./pages/MyAccount'))
const MpStatus = lazyReload(() => import('./pages/MpStatus'))

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <p style={{ color: '#9C8B7A', fontSize: 15 }}>Cargando...</p>
  </div>
)

export default function App() {
  const location = useLocation();
  const themeOwner = resolveThemeOwner({
    pathname: location.pathname,
    hostname: window.location.hostname,
  });
  useTheme(themeOwner);

  // Variables de :root para las superficies del catalogo fuera de .cp-root.
  // El tema de catalog-pro y el <head> del negocio (titulo, favicon, og) los
  // pone Catalog con applyTenantHead(get_catalog). Hasta el 29/sep aca ademas
  // se leia `settings` sin tenant ni sesion: para anon la policy cortaba con
  // 42501 (un ERROR en Postgres por visita) y el null resultante pisaba con
  // 'ambar' el tema del negocio y prendia la senial de listo antes de tiempo.
  useEffect(() => {
    if (themeOwner === THEME_OWNERS.CATALOG) applyTheme();
    else clearAppliedTheme();
  }, [themeOwner]);

  return (
    <ErrorBoundary>
      <SkipToContent />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Suspense fallback={<Loading />}>
            <main id="main-content">
            <Routes>
              {/* La raiz de la plataforma (divianco.app) no es el catalogo de
                  nadie: ahi va la landing. Cualquier otro host —subdominio de
                  tenant, dominio propio, local— sigue entrando al catalogo. */}
              <Route path="/" element={isPlatformRoot(window.location.hostname) ? <PlatformLanding /> : <Catalog />} />
              {/* La landing SOLO se ve en la raiz, y en local ningun host lo
                  es: `127.0.0.1` clasifica como desconocido y cae al catalogo
                  del tenant. Esta ruta existe para poder mirarla en QA Lite
                  sin tocar la resolucion de hosts ni el archivo hosts de
                  Windows. `import.meta.env.DEV` es constante en build, asi que
                  el bundle de produccion no la incluye. */}
              {import.meta.env.DEV && (
                <Route path="/landing" element={<PlatformLanding />} />
              )}
              {/* Alta self-service: solo tiene sentido en la raiz. En el
                  subdominio de un tenant el local ya es de alguien. */}
              <Route path="/registro" element={<Signup />} />
              {/* La consola de Divianco: la lista de clientes y los precios.
                  No es el panel de un negocio — ese es /admin. El guard de
                  staff esta adentro, y lo que de verdad protege son las
                  policies de `plans` y `tenants` (migracion 0052). */}
              <Route path="/consola" element={<Consola />} />
              <Route path="/bienvenido" element={<Bienvenido />} />
              <Route path="/entrar" element={<Login />} />
              <Route path="/q/:slug" element={<QrRedirect />} />
              <Route path="/info/:slug" element={<InfoPage />} />
              {/* El panel del edificio. El ERP legacy (pages/Admin) se borro
                  el 29/sep: ningun build lo servia y viajaba en el bundle. */}
              <Route path="/admin" element={<PlatformAdmin />} />
              <Route path="/admin/personalizacion" element={<Personalizacion />} />
              <Route path="/admin/paginas" element={<InfoPagesAdmin />} />
              <Route path="/order/:id" element={<OrderTracker />} />
              <Route path="/mi-cuenta" element={<MyAccount />} />
              <Route path="/pago/exitoso" element={<MpStatus status="exitoso" />} />
              <Route path="/pago/fallido" element={<MpStatus status="fallido" />} />
              <Route path="/pago/pendiente" element={<MpStatus status="pendiente" />} />
              {/* 404 catch-all (Sprint 4) — sin esto, URL invalida = pantalla blanca */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </main>
          </Suspense>
        </AuthProvider>
      </QueryClientProvider>
      <OfflineBanner />
      <UpdateBanner />
    </ErrorBoundary>
  )
}
