// Escena 3D de Comercio para la landing de Dico. React 19, JavaScript puro.
// La landing controla el momento; la escena no trae títulos, leyendas ni botones propios.
//
// Props
//   momento           null = recorrido completo automático (compra presencial + compra online)
//                     'p-eleccion' | 'p-venta' | 'p-cobro' | 'o-pedido' | 'o-preparacion' | 'o-completar' | 'o-cobro'
//                     = congela personajes, cámara y efectos en ese instante. Volver a null continúa desde ahí.
//   onMomento(id)     avisa qué momento se está viendo (para sincronizar textos y controles externos).
//   onDisponibilidad(estado)  'animada' | 'estatica' (movimiento reducido) | 'sin-webgl' | 'contexto-perdido'.
import { useEffect, useRef } from 'react';
import { createDicoScene } from './motor/escenaComercio.js';
import imagenAlternativa from './assets/comercio-estatica.webp';
import './EscenaComercio.css';

export default function EscenaComercio({ momento = null, onMomento, onDisponibilidad }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const momentoRef = useRef(momento);
  const onMomentoRef = useRef(onMomento);
  const onDisponibilidadRef = useRef(onDisponibilidad);

  // los callbacks pueden cambiar en cada render sin recrear la escena
  useEffect(() => {
    onMomentoRef.current = onMomento;
    onDisponibilidadRef.current = onDisponibilidad;
  }, [onMomento, onDisponibilidad]);

  // Un motor por montaje. En StrictMode React monta, desmonta y vuelve a montar:
  // dispose() libera todo y el segundo montaje arranca limpio.
  useEffect(() => {
    const escena = createDicoScene(hostRef.current, {
      imagenAlternativa,
      onMomento: (id) => onMomentoRef.current?.(id),
      onDisponibilidad: (estado) => onDisponibilidadRef.current?.(estado),
    });
    sceneRef.current = escena;
    escena.set({ rubro: 'comercio', momento: momentoRef.current });
    return () => {
      escena.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    momentoRef.current = momento;
    sceneRef.current?.set({ rubro: 'comercio', momento });
  }, [momento]);

  return <div ref={hostRef} className="dse-comercio-host" />;
}
