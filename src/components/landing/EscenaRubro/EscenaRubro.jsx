// Escena 3D de rubros para la landing de Dico. React 19, JavaScript puro.
// Por ahora solo se integra rubro="gastronomia".
// momento: null = recorrido automático · 'pedido' | 'stock' | 'cobro' = pausa en ese encuadre.
import { useEffect, useRef } from 'react';
import { createDicoScene } from './motor/escenaGastronomia.js';
import imagenAlternativa from './assets/gastronomia-estatica.webp';
import './EscenaRubro.css';

const srcDe = (img) => (typeof img === 'string' ? img : img?.src ?? null);

export default function EscenaRubro({ rubro = 'gastronomia', momento = null, guia = null, revision = 0, pausado = false, onFinMomento, onMomento, onDisponibilidad }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const onMomentoRef = useRef(onMomento);
  const onFinRef = useRef(onFinMomento);
  const disponibilidadRef = useRef(onDisponibilidad);
  useEffect(() => { onFinRef.current = onFinMomento; onMomentoRef.current = onMomento; disponibilidadRef.current = onDisponibilidad; }, [onFinMomento, onMomento, onDisponibilidad]);

  // Un motor por montaje. En StrictMode React monta, desmonta y vuelve a montar:
  // dispose() libera todo y el segundo montaje arranca limpio.
  useEffect(() => {
    const escena = createDicoScene(hostRef.current, { proporcion: null, imagenAlternativa: srcDe(imagenAlternativa), onFinMomento: id => onFinRef.current?.(id), onMomento: id => onMomentoRef.current?.(id) });
    sceneRef.current = escena;
    disponibilidadRef.current?.(escena.stats().calidad !== 'sin-webgl');
    return () => {
      escena.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.set({ rubro, momento, guia });
  }, [rubro, momento, guia, revision]);

  useEffect(() => { sceneRef.current?.pausar?.(pausado); }, [pausado]);

  return <div ref={hostRef} className="dse-host" />;
}
