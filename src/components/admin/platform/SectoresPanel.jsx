/**
 * SectoresPanel — dónde se produce cada cosa.
 *
 * POR QUE ESTA PANTALLA EXISTE
 * Sin ella el KDS no sirve: los platos caen todos en "sin estación", el riel
 * queda con un solo filtro y la barra no se puede separar de la cocina. Es la
 * configuración que desbloquea todo lo demás.
 *
 * SECTOR Y ESTACION NO SON LO MISMO
 *   sector    lo que tiene pantalla propia o impresora propia. Cocina, Barra.
 *   estación  dónde se hace el plato dentro del sector. Parrilla, Plancha.
 *
 * El sector es la unidad de despacho y la estación la de trabajo. Por eso el
 * umbral de demora y el modo —pantalla o papel— viven en el sector: un gin
 * tonic sale en tres minutos y un asado en veinticinco, y un local puede
 * tener la cocina con monitor y la barra con comandera.
 *
 * EL ORDEN ES EL DEL CIRCUITO, NO EL ALFABETICO
 * Se arrastra con las flechas. Alfabético pondría "Barra" antes que
 * "Parrilla", y en el riel de la tablet eso obliga a mirar antes de tocar.
 */
import { useState, useCallback } from 'react';
import { abreviar } from '../../../services/platformProduccion';

function CampoNumero({ id, etiqueta, valor, onCambio, sufijo, min = 1 }) {
  return (
    <label className="ag-sectores-campo" htmlFor={id}>
      <span>{etiqueta}</span>
      <span className="ag-sectores-numero">
        <input
          id={id} type="number" min={min} value={valor}
          onChange={(e) => onCambio(e.target.value)}
        />
        {sufijo && <em>{sufijo}</em>}
      </span>
    </label>
  );
}

/* ─────────────────────────── Estación ─────────────────────────────── */

function Estacion({ estacion, onGuardar, onQuitar, onMover, primera, ultima }) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(estacion);
  const [error, setError] = useState(null);

  const guardar = async () => {
    const r = await onGuardar(borrador);
    if (r?.__error) { setError(r.message); return; }
    setError(null);
    setEditando(false);
  };

  if (!editando) {
    return (
      <li className="ag-sectores-estacion">
        <span className="ag-sectores-estacion-nombre">{estacion.name}</span>
        <span className="ag-sectores-estacion-corta">{abreviar(estacion)}</span>
        <span className="ag-sectores-orden">
          <button
            type="button" className="ag-btn-mini" disabled={primera}
            aria-label={`Subir ${estacion.name}`} onClick={() => onMover(estacion, -1)}
          >↑</button>
          <button
            type="button" className="ag-btn-mini" disabled={ultima}
            aria-label={`Bajar ${estacion.name}`} onClick={() => onMover(estacion, 1)}
          >↓</button>
        </span>
        <button
          type="button" className="ag-btn-mini"
          onClick={() => { setBorrador(estacion); setEditando(true); }}
        >Editar</button>
      </li>
    );
  }

  return (
    <li className="ag-sectores-estacion" data-editando="true">
      <input
        aria-label="Nombre de la estación"
        value={borrador.name}
        onChange={(e) => setBorrador({ ...borrador, name: e.target.value })}
      />
      <input
        aria-label="Abreviatura"
        placeholder={abreviar({ name: borrador.name })}
        maxLength={4}
        value={borrador.short_name || ''}
        onChange={(e) => setBorrador({ ...borrador, short_name: e.target.value })}
      />
      {error && <span className="ag-sectores-error">{error}</span>}
      <span className="ag-sectores-acciones">
        <button type="button" className="ag-btn-mini" onClick={guardar}>Guardar</button>
        <button type="button" className="ag-btn-mini" onClick={() => { setEditando(false); setError(null); }}>Cancelar</button>
        {estacion.id && (
          <button type="button" className="ag-btn-mini" onClick={() => onQuitar(estacion)}>Quitar</button>
        )}
      </span>
    </li>
  );
}

/* ─────────────────────────── Sector ───────────────────────────────── */

function Sector({ sector, onGuardar, onQuitar, onGuardarEstacion, onQuitarEstacion, onMoverEstacion }) {
  const [borrador, setBorrador] = useState(sector);
  const [sucio, setSucio] = useState(false);
  const [error, setError] = useState(null);
  const [nueva, setNueva] = useState(null);

  const cambiar = (campo, valor) => {
    setBorrador(b => ({ ...b, [campo]: valor }));
    setSucio(true);
  };

  const guardar = async () => {
    const r = await onGuardar(borrador);
    if (r?.__error) { setError(r.message); return; }
    setError(null);
    setSucio(false);
  };

  const estaciones = sector.estaciones || [];

  return (
    <article className="ag-sectores-sector" data-modo={borrador.mode}>
      <header className="ag-sectores-sector-head">
        <input
          className="ag-sectores-sector-nombre"
          aria-label={`Nombre del sector ${sector.name}`}
          value={borrador.name}
          onChange={(e) => cambiar('name', e.target.value)}
        />
        <button type="button" className="ag-btn-mini" onClick={() => onQuitar(sector)}>
          Quitar sector
        </button>
      </header>

      <div className="ag-sectores-ajustes">
        {/* El modo del sector, no del negocio: cocina con monitor y barra con
            comandera es una configuración normal, no un caso raro. */}
        <fieldset className="ag-sectores-modo">
          <legend>Cómo trabaja</legend>
          <label>
            <input
              type="radio" name={`modo-${sector.id}`} value="pantalla"
              checked={borrador.mode !== 'papel'}
              onChange={() => cambiar('mode', 'pantalla')}
            />
            <span>Pantalla</span>
            <em>Un monitor o tablet con los tickets</em>
          </label>
          <label>
            <input
              type="radio" name={`modo-${sector.id}`} value="papel"
              checked={borrador.mode === 'papel'}
              onChange={() => cambiar('mode', 'papel')}
            />
            <span>Comandera</span>
            <em>La comanda se imprime; el pedido lo cierra quien lo retira</em>
          </label>
        </fieldset>

        <CampoNumero
          id={`umbral-${sector.id}`}
          etiqueta="Se considera demorado a los"
          sufijo="min"
          valor={borrador.umbral_min}
          onCambio={(v) => cambiar('umbral_min', v)}
        />
      </div>

      {error && <p className="ag-sectores-error">{error}</p>}
      {sucio && (
        <div className="ag-sectores-guardar">
          <button type="button" className="ag-btn-primary" onClick={guardar}>Guardar sector</button>
          <button
            type="button" className="ag-btn-ghost"
            onClick={() => { setBorrador(sector); setSucio(false); setError(null); }}
          >Descartar</button>
        </div>
      )}

      <h4 className="ag-sectores-subtitulo">
        Estaciones
        <small>en el orden del circuito, no alfabético</small>
      </h4>

      <ul className="ag-sectores-estaciones">
        {estaciones.map((e, i) => (
          <Estacion
            key={e.id}
            estacion={e}
            primera={i === 0}
            ultima={i === estaciones.length - 1}
            onGuardar={onGuardarEstacion}
            onQuitar={onQuitarEstacion}
            onMover={onMoverEstacion}
          />
        ))}
        {nueva && (
          <Estacion
            key="nueva"
            estacion={nueva}
            primera ultima
            onGuardar={async (b) => {
              const r = await onGuardarEstacion(b);
              if (!r?.__error) setNueva(null);
              return r;
            }}
            onQuitar={() => setNueva(null)}
            onMover={() => {}}
          />
        )}
      </ul>

      {!nueva && (
        <button
          type="button" className="ag-btn-ghost ag-sectores-sumar"
          onClick={() => setNueva({
            name: '', short_name: '', sector_id: sector.id,
            orden: estaciones.length, active: true,
          })}
        >
          Agregar estación
        </button>
      )}

      {estaciones.length === 0 && !nueva && (
        <p className="ag-sectores-vacio">
          Sin estaciones, todo lo de este sector cae junto en una sola lista.
        </p>
      )}
    </article>
  );
}

/* ─────────────────────────── Panel ────────────────────────────────── */

export default function SectoresPanel({
  sectores = [],
  productosSinEstacion = 0,
  onGuardarSector,
  onQuitarSector,
  onGuardarEstacion,
  onQuitarEstacion,
  onCrearTipicos,
  showToast,
}) {
  const [creando, setCreando] = useState(false);

  const moverEstacion = useCallback(async (estacion, paso) => {
    const sector = sectores.find(s => s.id === estacion.sector_id);
    const lista = sector?.estaciones || [];
    const i = lista.findIndex(e => e.id === estacion.id);
    const j = i + paso;
    if (i < 0 || j < 0 || j >= lista.length) return;
    // Se guardan las DOS: el orden es una posición relativa y mover una sola
    // dejaría dos estaciones con el mismo número.
    await onGuardarEstacion({ ...lista[i], orden: j });
    await onGuardarEstacion({ ...lista[j], orden: i });
  }, [sectores, onGuardarEstacion]);

  const crearSector = useCallback(async () => {
    setCreando(true);
    const r = await onGuardarSector({
      name: 'Sector nuevo', mode: 'pantalla', umbral_min: 18,
      orden: sectores.length, active: true,
    });
    setCreando(false);
    if (r?.__error) showToast?.(r.message);
  }, [onGuardarSector, sectores.length, showToast]);

  if (sectores.length === 0) {
    return (
      <section className="ag-sectores">
        <header className="ag-sectores-head">
          <h1>Producción</h1>
        </header>
        <div className="ag-sectores-arranque">
          <strong>Todavía no hay sectores</strong>
          <p>
            Un sector es lo que tiene su propia pantalla o su propia impresora.
            La cocina y la barra son dos: tienen otra gente, otro ritmo y otro
            tiempo de demora. Sin sectores, el KDS muestra todo junto.
          </p>
          <div className="ag-sectores-arranque-botones">
            <button type="button" className="ag-btn-primary" onClick={onCrearTipicos}>
              Crear cocina y barra
            </button>
            <button type="button" className="ag-btn-ghost" disabled={creando} onClick={crearSector}>
              Armar el mío
            </button>
          </div>
          <small>
            Cocina con parrilla, plancha, fríos y postres. Barra con una sola
            estación. Después se cambia todo.
          </small>
        </div>
      </section>
    );
  }

  return (
    <section className="ag-sectores">
      <header className="ag-sectores-head">
        <div>
          <h1>Producción</h1>
          <p className="ag-sectores-sub">
            {sectores.length} {sectores.length === 1 ? 'sector' : 'sectores'}
            {' · '}
            {sectores.reduce((n, s) => n + (s.estaciones?.length || 0), 0)} estaciones
          </p>
        </div>
        <button type="button" className="ag-btn-primary" disabled={creando} onClick={crearSector}>
          Agregar sector
        </button>
      </header>

      {/* El aviso que de verdad importa: sin estación asignada, el plato no
          aparece en ninguna pantalla. */}
      {productosSinEstacion > 0 && (
        <p className="ag-sectores-aviso">
          <strong>{productosSinEstacion}</strong> {productosSinEstacion === 1 ? 'producto no tiene' : 'productos no tienen'} estación.
          Hasta que la tengan, no aparecen en ninguna pantalla de producción.
        </p>
      )}

      <div className="ag-sectores-lista">
        {sectores.map(s => (
          <Sector
            key={s.id}
            sector={s}
            onGuardar={onGuardarSector}
            onQuitar={onQuitarSector}
            onGuardarEstacion={onGuardarEstacion}
            onQuitarEstacion={onQuitarEstacion}
            onMoverEstacion={moverEstacion}
          />
        ))}
      </div>
    </section>
  );
}
