import { useEffect, useState } from 'react';
import DicoPhysical from '../dico/DicoPhysical';

const EXPRESIONES = {
  vertical: 'idle', desafio: 'worried', canales: 'pointDown', escala: 'pointUp',
  gestion_actual: 'thinking', venta_mensual: 'worried', urgencia: 'pointUp', nombre_negocio: 'idle',
};

export default function DicoGuiaDiagnostico({ paso, fase, mensaje }) {
  const [saludando, setSaludando] = useState(false);
  useEffect(() => {
    if (!saludando) return undefined;
    const timer = setTimeout(() => setSaludando(false), 800);
    return () => clearTimeout(timer);
  }, [saludando]);
  const pensando = fase === 'analizando';
  return <div className={`dg-guia dg-guia-unica${pensando ? ' dg-guia-pensando' : ''}`}>
    <button type="button" className="dg-guia-cara" aria-label="Saludar a Dico"
      onPointerEnter={e => { if (e.pointerType !== 'touch') setSaludando(true); }}
      onFocus={() => setSaludando(true)} onClick={() => setSaludando(true)}>
      <DicoPhysical pose={fase === 'resultado' ? 'success' : EXPRESIONES[paso] || 'idle'}
        animacion={saludando ? 'saluda' : pensando ? 'revisa' : null}
        reducedMotion={saludando || pensando ? undefined : true} ritmo={.45} title="Dico" />
    </button>
    <p className={`dg-guia-mensaje${pensando ? ' dg-analisis-mensaje' : ''}`} role={pensando ? 'status' : undefined} aria-live={pensando ? 'polite' : undefined}>{pensando && <span className="dg-analisis-cargando" aria-hidden="true" />}<span className={pensando ? 'dg-analisis-texto' : undefined}>{mensaje}</span></p>
  </div>;
}
