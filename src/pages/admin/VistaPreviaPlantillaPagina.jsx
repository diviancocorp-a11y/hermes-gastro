// src/pages/admin/VistaPreviaPlantillaPagina.jsx
// Pagina minima que vive DENTRO del iframe de vista previa del editor de la
// plantilla. Existe para que los @media y los vw de la plantilla midan 390 px
// reales (un div angosto no cambia el viewport). No carga sesion ni red: solo
// recibe el estado por postMessage del mismo origen.
import { useEffect, useState } from 'react';
import VistaPreviaPlantilla from '../../catalog-pro/plantillas/VistaPreviaPlantilla';

export default function VistaPreviaPlantillaPagina() {
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    const recibir = (ev) => {
      if (ev.origin !== window.location.origin) return;
      const d = ev.data;
      if (!d || d.tipo !== 'plantilla-vista' || typeof d.settings !== 'object') return;
      setEstado(d);
    };
    window.addEventListener('message', recibir);
    window.parent?.postMessage({ tipo: 'plantilla-vista-lista' }, window.location.origin);
    return () => window.removeEventListener('message', recibir);
  }, []);

  if (!estado) return null;
  return (
    <VistaPreviaPlantilla
      completa settings={estado.settings} config={estado.config || {}}
      products={estado.products || []} categories={estado.categories || []}
    />
  );
}
