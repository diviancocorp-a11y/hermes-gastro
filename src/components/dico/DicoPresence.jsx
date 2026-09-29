/**
 * DicoPresence — presencia Native y Physical sin compartir layout.
 *
 * Native puede vivir en la topbar o en el riel. Physical no vive en ninguno
 * de esos lugares: se porta al body y tiene una capa fija propia. Asi la
 * apertura de la sidebar no puede moverlo ni disparar un ciclo de hover.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DicoAvisos from '../admin/platform/DicoAvisos';
import DicoFloatingPhysical from './DicoFloatingPhysical';

function estadoDe({ intervencion, avisoAbierto }) {
  if (intervencion) return 'physical_open';
  return avisoAbierto ? 'native_notice' : 'native_idle';
}

export default function DicoPresence({
  onStateChange,
  anclaje = 'arriba',
  intervencion = null,
  objetivo = null,
  onIntervencionCta,
  onIntervencionCerrada,
  contenedorAvisos = null,
  silenciarNative = false,
  onAbrirSala = null,
  ...avisos
}) {
  const [avisoAbierto, setAvisoAbierto] = useState(false);
  const estado = estadoDe({ intervencion, avisoAbierto });

  useEffect(() => {
    if (intervencion) setAvisoAbierto(false);
  }, [intervencion?.id]);

  useEffect(() => {
    onStateChange?.(estado);
  }, [estado, onStateChange]);

  const nativo = (
    <div data-dico-presence-state={estado}>
      <DicoAvisos
      {...avisos}
        abierto={!intervencion && avisoAbierto && !onAbrirSala}
        mostrarBadge={!onAbrirSala}
        onAbrir={() => (onAbrirSala ? onAbrirSala() : setAvisoAbierto(true))}
        onCerrar={() => setAvisoAbierto(false)}
        anclaje={anclaje}
      />
    </div>
  );

  return (
    <>
      {!intervencion && !silenciarNative && (contenedorAvisos ? createPortal(nativo, contenedorAvisos) : nativo)}
      {intervencion && (
        <DicoFloatingPhysical
          key={intervencion.id}
          intervencion={intervencion}
          objetivo={objetivo}
          onAccion={onIntervencionCta}
          onCerrar={onIntervencionCerrada}
        />
      )}
    </>
  );
}
