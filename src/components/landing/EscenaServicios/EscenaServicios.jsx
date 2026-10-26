// Escena 3D de Servicios (barbería) para la landing de Dico. React 19, JavaScript puro.
// SIMULACIÓN con datos ficticios de funciones objetivo. NO PUBLICAR hasta validar las funciones representadas.
// La landing controla el momento; la escena no trae títulos, explicaciones ni botones propios.
//
// Props
//   momento           null = historia automática en bucle
//                     'llegada' | 'reserva' | 'cancelacion' | 'recuperado'
//                     = congela reloj, personajes, cámara y efectos en ese instante. Volver a null continúa desde ahí.
//   onMomento(id)     avisa qué etapa se está viendo (para sincronizar textos y controles externos).
//   onDisponibilidad(estado)  'animada' | 'estatica' (movimiento reducido) | 'sin-webgl' | 'contexto-perdido'.
import { useEffect, useRef } from 'react';
import { createDicoScene } from './motor/escenaServicios.js';
import imagenAlternativa from './assets/servicios-estatica.webp';
import './EscenaServicios.css';

export default function EscenaServicios({ momento = null, onMomento, onDisponibilidad }) {
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
  // dispose() libera canvas, listeners y observers, y el segundo montaje arranca limpio.
  useEffect(() => {
    const escena = createDicoScene(hostRef.current, {
      imagenAlternativa,
      onMomento: (id) => onMomentoRef.current?.(id),
      onDisponibilidad: (estado) => onDisponibilidadRef.current?.(estado),
    });
    sceneRef.current = escena;
    escena.set({ rubro: 'servicios', momento: momentoRef.current });
    return () => {
      escena.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    momentoRef.current = momento;
    sceneRef.current?.set({ rubro: 'servicios', momento });
  }, [momento]);

  return <div ref={hostRef} className="dse-servicios-host" />;
}
