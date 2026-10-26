// Escena 3D de rubros para la landing de Dico. React 19, JavaScript puro.
// Por ahora solo se integra rubro="gastronomia".
// momento: null = recorrido automático · 'pedido' | 'stock' | 'cobro' = pausa en ese encuadre.
import { useEffect, useRef } from 'react';
import { createDicoScene } from './motor/escenaGastronomia.js';
import imagenAlternativa from './assets/gastronomia-estatica.webp';
import './EscenaRubro.css';

const srcDe = (img) => (typeof img === 'string' ? img : img?.src ?? null);

export default function EscenaRubro({ rubro = 'gastronomia', momento = null, onMomento, onDisponibilidad }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const onMomentoRef = useRef(onMomento);
  const disponibilidadRef = useRef(onDisponibilidad);
  useEffect(() => { onMomentoRef.current = onMomento; disponibilidadRef.current = onDisponibilidad; }, [onMomento, onDisponibilidad]);

  // Un motor por montaje. En StrictMode React monta, desmonta y vuelve a montar:
  // dispose() libera todo y el segundo montaje arranca limpio.
  useEffect(() => {
    const escena = createDicoScene(hostRef.current, { imagenAlternativa: srcDe(imagenAlternativa), onMomento: id => onMomentoRef.current?.(id) });
    sceneRef.current = escena;
    disponibilidadRef.current?.(escena.stats().calidad !== 'sin-webgl');
    return () => {
      escena.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.set({ rubro, momento });
  }, [rubro, momento]);

  return <div ref={hostRef} className="dse-host" />;
}
