import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  venimosDeTelegram, cargarSdk, iniciarMiniApp, aplicarColores, enlazarAtras,
} from '../lib/telegram';

/**
 * Si la pagina se abrio desde Telegram, la integra con el cliente: expandida,
 * barra con el color del negocio y boton Atras nativo. Fuera de Telegram no
 * hace nada ni carga nada.
 *
 * El Atras se muestra cuando hay algo para volver: una ruta que no es la raiz,
 * o capas abiertas del catalogo (detalle, carrito, checkout). Esas capas no son
 * rutas: useAndroidBack avisa su cantidad con el evento `hg-layers`.
 */
export default function useTelegramMiniApp() {
  const { pathname } = useLocation();
  const [tg, setTg] = useState(null);
  const [capas, setCapas] = useState(0);

  // Carga e inicializa una sola vez.
  useEffect(() => {
    if (!venimosDeTelegram()) return undefined;
    let vivo = true;
    cargarSdk().then((webApp) => {
      if (!vivo || !webApp) return;
      iniciarMiniApp(webApp);
      setTg(webApp);
    });
    return () => { vivo = false; };
  }, []);

  // El tema del negocio llega despues de la primera pintada: se repinta cuando
  // el body cambia de tema.
  useEffect(() => {
    if (!tg || typeof MutationObserver === 'undefined') return undefined;
    const obs = new MutationObserver(() => aplicarColores(tg));
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-cp-theme', 'data-ui-owner'] });
    return () => obs.disconnect();
  }, [tg]);

  // Cantidad de capas abiertas del catalogo.
  useEffect(() => {
    if (!tg) return undefined;
    const onCapas = (e) => setCapas(Number(e.detail) || 0);
    window.addEventListener('hg-layers', onCapas);
    return () => window.removeEventListener('hg-layers', onCapas);
  }, [tg]);

  // Atras nativo.
  useEffect(() => {
    if (!tg) return undefined;
    const visible = pathname !== '/' || capas > 0;
    return enlazarAtras(tg, { visible, onBack: () => window.history.back() });
  }, [tg, pathname, capas]);
}
