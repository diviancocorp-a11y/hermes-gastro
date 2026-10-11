/**
 * PromosDelCatalogo — que promos muestra el catalogo, con un boton cada una.
 * Vive arriba de la solapa Clientes de Ventas (el CRM): son las promos que le
 * hablan al cliente, y es donde el dueno las espera.
 *
 * Guarda en settings (promo_cumple, promo_programados; migracion 0094) y el
 * carrusel del inicio del catalogo las respeta. Prendidas por defecto: un
 * negocio que no toca nada ve lo mismo que antes. Un negocio por encargo (dark
 * kitchen) puede apagar las que no le sirven.
 *
 * No hay boton de "podio semanal" ni de "puntos": ese ranking se retiro del
 * catalogo del edificio el 29/sep (sus RPC eran del legacy) y no existe nada
 * que prender. Si vuelve, vuelve con su boton aca.
 */
import { useState } from 'react';
import ToggleSwitch from '../shared/forms/ToggleSwitch';

const PROMOS = [
  {
    campo: 'promo_cumple',
    label: 'Regalo de cumpleaños',
    hint: 'Tarjeta del carrusel que invita al cliente a cargar su fecha de nacimiento.',
  },
  {
    campo: 'promo_programados',
    label: 'Pedidos programados',
    hint: 'Tarjeta del carrusel que avisa que se puede elegir día y horario de entrega.',
  },
];

export default function PromosDelCatalogo({ settings, onGuardar, showToast }) {
  const [guardando, setGuardando] = useState(null);

  if (!settings || !onGuardar) return null;

  const cambiar = async (campo, valor) => {
    setGuardando(campo);
    const guardado = await onGuardar({ ...settings, [campo]: valor });
    setGuardando(null);
    if (!guardado) showToast?.('No se pudo guardar. Probá de nuevo.');
  };

  return (
    <div className="ag-card" style={{ margin: '12px 16px 0', padding: '14px 16px', borderTop: '3px solid var(--ag-c-terra)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ag-ink)', marginBottom: 2 }}>Promos del catálogo</div>
      <div style={{ fontSize: 11.5, color: 'var(--ag-ink-3)', marginBottom: 12, lineHeight: 1.4 }}>
        Elegí cuáles ven tus clientes en el inicio del catálogo. Si apagás las dos, el carrusel desaparece.
      </div>
      <div style={{ display: 'grid', gap: 12, opacity: guardando ? 0.7 : 1 }}>
        {PROMOS.map(({ campo, label, hint }) => (
          <ToggleSwitch
            key={campo}
            checked={settings[campo] !== false}
            onChange={(v) => cambiar(campo, v)}
            label={label}
            hint={hint}
          />
        ))}
      </div>
    </div>
  );
}
