import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import QrRedirect from './pages/QrRedirect'
import InfoPage from './pages/InfoPage'
import { Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import SkipToContent from './components/ui/SkipToContent'
import OfflineBanner from './components/ui/OfflineBanner'
import UpdateBanner from './components/ui/UpdateBanner'
import useTheme from './hooks/useTheme'
import useTelegramMiniApp from './hooks/useTelegramMiniApp'
import Catalog from './pages/Catalog'
import PlatformLanding from './pages/PlatformLanding'
import Consola from './pages/Consola'
import Signup from './pages/Signup'
import Bienvenido from './pages/Bienvenido'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import { isPlatformRoot } from './lib/tenantHost'
import { lazyReload } from './lib/lazyReload'
import { useEffect } from 'react'
import { applyTheme, clearAppliedTheme } from './services/theme'
import { resolveThemeOwner, THEME_OWNERS } from './lib/themeOwnership'

// lazyReload (src/lib/lazyReload.js): recarga UNA vez si el chunk ya no
// existe tras un deploy (HERMES-GASTRO-8).
const PlatformAdmin = lazyReload(() => import('./pages/PlatformAdmin'))
const InfoPagesAdmin = lazyReload(() => import('./pages/admin/InfoPages'))
const OrderTracker = lazyReload(() => import('./pages/OrderTracker'))
const MyAccount = lazyReload(() => import('./pages/MyAccount'))
const MpStatus = lazyReload(() => import('./pages/MpStatus'))
// El diagnostico como pagina propia: la home lo abre en el lugar, asi que
// /diagnostico es un chunk aparte para links viejos y de afuera.
const Diagnostico = lazyReload(() => import('./pages/Diagnostico'))

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
  // No-op fuera de Telegram: ni carga el SDK ni toca el DOM.
  useTelegramMiniApp();

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
                  Windows. Tambien en los previews *.vercel.app, que es donde
                  Ricky mira una rama antes del merge (ahi `/` cae al catalogo
                  de respaldo). Ningun cliente entra por *.vercel.app. */}
              {(import.meta.env.DEV || window.location.hostname.endsWith('.vercel.app')) && (
                <Route path="/landing" element={<PlatformLanding />} />
              )}
              {/* El diagnostico de la landing: mismo criterio que /landing
                  (la raiz, local y los previews *.vercel.app). En el
                  subdominio de un tenant no hay nada que diagnosticar. */}
              <Route
                path="/diagnostico"
                element={(isPlatformRoot(window.location.hostname)
                  || import.meta.env.DEV
                  || window.location.hostname.endsWith('.vercel.app'))
                  ? <Diagnostico />
                  : <NotFound />}
              />
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
              <Route path="/admin/personalizacion" element={<Navigate to="/admin" replace />} />
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
