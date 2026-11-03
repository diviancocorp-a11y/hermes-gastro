import { useId, useState } from 'react';
import Dialog from '../../ui/Dialog';

/*
 * Los pasos para instalar el panel a mano, cuando el navegador no ofrece su
 * propio dialogo (iPhone, Firefox, o Chrome que todavia no aviso). Arranca en
 * la plataforma detectada y deja ver las otras dos: el que lee en la compu
 * puede estar explicandole a alguien con el celular en la mano.
 */
const DISPOSITIVOS = [
  {
    id: 'escritorio',
    label: 'Compu',
    titulo: 'En la compu, con Chrome o Edge',
    pasos: [
      'En la barra de direcciones, hacé clic en el ícono de instalar (una pantalla con una flecha), a la derecha.',
      'Si no aparece: en Chrome, menú ⋮ → “Transmitir, guardar y compartir” → “Instalar página como app”. En Edge, menú … → Aplicaciones → “Instalar este sitio como aplicación”.',
      'Confirmá con “Instalar”. En Firefox no se puede: abrí el panel en Chrome o Edge.',
    ],
  },
  {
    id: 'android',
    label: 'Android',
    titulo: 'En Android, con Chrome',
    pasos: [
      'Tocá el menú ⋮, arriba a la derecha.',
      'Elegí “Instalar app” (o “Agregar a la pantalla principal”).',
      'Confirmá.',
    ],
  },
  {
    id: 'ios',
    label: 'iPhone',
    titulo: 'En iPhone o iPad, con Safari',
    pasos: [
      'Tocá Compartir (el cuadrado con una flecha), abajo o arriba. Si no lo ves, está dentro de ⋯.',
      'Elegí “Agregar a inicio”.',
      'Tocá “Agregar”. Se abre desde el ícono, como una app.',
    ],
  },
];

export default function GuiaDeInstalacion({ abierta, onCerrar, plataforma, nombreNegocio }) {
  const [elegido, setElegido] = useState(
    () => (DISPOSITIVOS.some((d) => d.id === plataforma) ? plataforma : 'escritorio'),
  );
  const idTitulo = useId();
  const idPasos = useId();
  const actual = DISPOSITIVOS.find((d) => d.id === elegido);
  const nombre = nombreNegocio?.trim();

  return (
    <Dialog open={abierta} onClose={onCerrar} labelledBy={idTitulo} variante="sheet" className="ag-instalar">
      <header className="ag-instalar-cab">
        <h2 id={idTitulo} className="ag-h3">{nombre ? `Instalar el panel de ${nombre}` : 'Instalar el panel'}</h2>
        <button type="button" className="ag-instalar-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="ag-instalar-dispositivos" role="group" aria-label="Dispositivo">
        {DISPOSITIVOS.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={d.id === elegido}
            aria-controls={idPasos}
            onClick={() => setElegido(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <section id={idPasos} className="ag-instalar-pasos">
        <h3 className="ag-h4">{actual.titulo}</h3>
        <ol>
          {actual.pasos.map((paso) => <li key={paso}>{paso}</li>)}
        </ol>
      </section>

      <p className="ag-instalar-nota">
        La app abre directo en el panel de este negocio. Si tenés varios negocios, instalá cada uno
        desde su propio panel.
      </p>
    </Dialog>
  );
}
