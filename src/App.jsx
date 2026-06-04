import { Routes, Route } from 'react-router-dom'
import QrRedirect from './pages/QrRedirect'
import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import SkipToContent from './components/ui/SkipToContent'
import OfflineBanner from './components/ui/OfflineBanner'
import useTheme from './hooks/useTheme'
import Catalog from './pages/Catalog'
import { useEffect } from 'react'
import { fetchSettings } from './services/settings'
import { supabase } from './lib/supabase'

const Admin = lazy(() => import('./pages/Admin'))
const Personalizacion = lazy(() => import('./pages/Personalizacion'))
const OrderTracker = lazy(() => import('./pages/OrderTracker'))
const MyAccount = lazy(() => import('./pages/MyAccount'))
const MpCallback = lazy(() => import('./pages/MpCallback'))
const MpStatus = lazy(() => import('./pages/MpStatus'))

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <p style={{ color: '#9C8B7A', fontSize: 15 }}>Cargando...</p>
  </div>
)

export default function App() {
  useTheme();

  useEffect(() => {
    let cancelled = false;
    const apply = (sett) => {
      const t = ['ambar','noche','carbon'].includes(sett?.catalog_theme) ? sett.catalog_theme : 'ambar';
      document.body.setAttribute('data-cp-theme', t);
      // Favicon: usa favicon_url si esta, sino el logo de la empresa
      const faviconSrc = sett?.favicon_url || sett?.logo_url;
      if (faviconSrc) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = faviconSrc;
      }
      // og:image (preview al compartir): siempre el logo de la empresa
      if (sett?.logo_url) {
        let og = document.querySelector("meta[property='og:image']");
        if (!og) {
          og = document.createElement('meta');
          og.setAttribute('property', 'og:image');
          document.head.appendChild(og);
        }
        og.setAttribute('content', sett.logo_url);
      }
    };
    fetchSettings().then((sett) => { if (!cancelled) apply(sett); });

    const channel = supabase
      .channel('app-theme-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' },
        (payload) => apply(payload?.new))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  return (
    <ErrorBoundary>
      <SkipToContent />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Suspense fallback={<Loading />}>
            <main id="main-content">
            <Routes>
              <Route path="/" element={<Catalog />} />
              <Route path="/q/:slug" element={<QrRedirect />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/personalizacion" element={<Personalizacion />} />
              <Route path="/order/:id" element={<OrderTracker />} />
              <Route path="/mi-cuenta" element={<MyAccount />} />
              <Route path="/mp-callback" element={<MpCallback />} />
              <Route path="/pago/exitoso" element={<MpStatus status="exitoso" />} />
              <Route path="/pago/fallido" element={<MpStatus status="fallido" />} />
              <Route path="/pago/pendiente" element={<MpStatus status="pendiente" />} />
            </Routes>
            </main>
          </Suspense>
        </AuthProvider>
      </QueryClientProvider>
      <OfflineBanner />
    </ErrorBoundary>
  )
}
