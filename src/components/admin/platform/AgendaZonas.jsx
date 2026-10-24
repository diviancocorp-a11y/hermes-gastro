/**
 * Zonas de domicilio: cada localidad o barrio donde se atiende, con los
 * minutos de viaje hasta ahi. Al reservar a domicilio se elige la zona y esos
 * minutos se descuentan antes del turno. Sin zona se usa el traslado fijo de
 * Reglas de reserva.
 *
 * Guardado explicito: se editan las filas y un solo boton guarda lo que
 * cambio. Quitar pide confirmacion y es baja logica (los turnos viejos
 * conservan su zona).
 */
import { useEffect, useRef, useState } from 'react';
import { saveZone, removeZone } from '../../../services/platformAgenda';
import { PieGuardar, Aviso } from './AgendaHoja';

let contador = 0;

const sin = (obj, id) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== id));

export default function AgendaZonas({ base, tenantId, onGuardado }) {
  const zonas = base.zonas || [];
  const [cambios, setCambios] = useState({});   // por id de zona existente
  const [nuevas, setNuevas] = useState([]);     // filas sin guardar { k, name, travel_min }
  const [quitando, setQuitando] = useState(null); // fila que pide confirmacion: { id?, k?, name }
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [res, setRes] = useState(null);
  const [resQuitar, setResQuitar] = useState(null);
  const confirmaRef = useRef(null);

  // La confirmacion se pinta debajo de la lista: al abrirla recibe el foco y
  // se acerca a la vista.
  useEffect(() => {
    if (!quitando) return;
    confirmaRef.current?.focus();
    confirmaRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [quitando]);

  const valor = (z, k) => (cambios[z.id]?.[k] ?? z[k] ?? '');
  const editar = (z, k, v) => {
    setCambios(prev => ({ ...prev, [z.id]: { ...prev[z.id], [k]: v } }));
    setRes(null);
  };
  const editarNueva = (n, k, v) => {
    setNuevas(prev => prev.map(x => (x.k === n.k ? { ...x, [k]: v } : x)));
    setRes(null);
  };
  const agregar = () => {
    contador += 1;
    setNuevas(prev => [...prev, { k: `nueva-${contador}`, name: '', travel_min: '' }]);
    setRes(null);
  };

  const guardar = async () => {
    const ids = Object.keys(cambios);
    if (!ids.length && !nuevas.length) { setRes({ tipo: 'ok', texto: 'No hay cambios para guardar.' }); return; }
    setGuardando(true);
    let guardoAlgo = false;
    const fallo = (texto, campo) => {
      setGuardando(false);
      setRes({ tipo: 'error', texto });
      document.getElementById(campo)?.focus();
      // Lo que ya se guardo tiene que verse: se recarga aunque el resto falle.
      if (guardoAlgo) onGuardado();
    };
    for (const id of ids) {
      const z = zonas.find(x => x.id === id);
      if (!z) continue;
      const r = await saveZone(tenantId, { id, name: valor(z, 'name'), travel_min: valor(z, 'travel_min') });
      if (r?.__error) {
        fallo(`${z.name}: ${r.message}`, `ag-z-${r.__error === 'minutos' ? 'm' : 'n'}-${id}`);
        return;
      }
      guardoAlgo = true;
      setCambios(prev => sin(prev, id));
    }
    for (const n of nuevas) {
      const r = await saveZone(tenantId, { name: n.name, travel_min: n.travel_min });
      if (r?.__error) {
        fallo(r.message || 'No se pudo guardar la zona.', `ag-z-${r.__error === 'minutos' ? 'm' : 'n'}-${n.k}`);
        return;
      }
      guardoAlgo = true;
      setNuevas(prev => prev.filter(x => x.k !== n.k));
    }
    setGuardando(false);
    setRes({ tipo: 'ok', texto: 'Zonas guardadas.' });
    onGuardado();
  };

  const confirmarQuitar = async () => {
    const q = quitando;
    if (!q) return;
    if (!q.id) {
      setNuevas(prev => prev.filter(x => x.k !== q.k));
      setQuitando(null);
      document.getElementById('ag-z-agregar')?.focus();
      return;
    }
    setBorrando(true); setResQuitar(null);
    const ok = await removeZone(tenantId, q.id);
    setBorrando(false);
    if (!ok) { setResQuitar({ tipo: 'error', texto: 'No se pudo quitar la zona. Probá de nuevo.' }); return; }
    setCambios(prev => sin(prev, q.id));
    setQuitando(null);
    document.getElementById('ag-z-agregar')?.focus();
    setResQuitar({ tipo: 'ok', texto: 'Zona quitada. Los turnos que ya tenían esa zona la conservan.' });
    onGuardado();
  };

  const volver = () => {
    const q = quitando;
    setQuitando(null);
    document.getElementById(`ag-z-q-${q?.id || q?.k}`)?.focus();
  };

  const fila = (id, rotuloNombre, nombre, min, onNombre, onMin, quitar) => (
    <li key={id} className="ag-agd-fila-serv ag-agd-fila-zona">
      <div className="ag-agd-campo" data-ancho="completo">
        <label htmlFor={`ag-z-n-${id}`}>{rotuloNombre}</label>
        <input id={`ag-z-n-${id}`} className="ag-agd-input" value={nombre} autoComplete="off"
          onChange={(e) => onNombre(e.target.value)} />
      </div>
      <div className="ag-agd-campo">
        <label htmlFor={`ag-z-m-${id}`}>Viaje (min)</label>
        <input id={`ag-z-m-${id}`} className="ag-agd-input" type="number" inputMode="numeric" min={0}
          value={min} onChange={(e) => onMin(e.target.value)} />
      </div>
      <div className="ag-agd-fila-acciones">
        <button type="button" className="ag-agd-btn" data-chico="true" disabled={borrando || guardando} id={`ag-z-q-${id}`}
          aria-label={`Quitar zona ${nombre || 'sin nombre'}`} onClick={quitar}>
          Quitar
        </button>
      </div>
    </li>
  );

  return (
    <section className="ag-agd-seccion" aria-labelledby="ag-agd-h-zonas">
      <header>
        <h3 id="ag-agd-h-zonas">Zonas de domicilio</h3>
        <p className="ag-agd-ayuda">
          Cada zona es una localidad o barrio con sus minutos de viaje. El viaje se cuenta desde el local o desde el turno anterior hasta esa zona. Al reservar a domicilio se elige la zona.
        </p>
      </header>

      {!zonas.length && !nuevas.length && (
        <Aviso>
          {base.reglas?.offers_home
            ? 'Todavía no cargaste zonas. Mientras tanto, los turnos a domicilio usan el traslado fijo de Reglas de reserva.'
            : 'Todavía no cargaste zonas. Las vas a necesitar cuando atiendas a domicilio.'}
        </Aviso>
      )}

      {(zonas.length > 0 || nuevas.length > 0) && (
        <ul className="ag-agd-dias">
          {zonas.map(z => fila(z.id, 'Zona', valor(z, 'name'), valor(z, 'travel_min'),
            (v) => editar(z, 'name', v), (v) => editar(z, 'travel_min', v),
            () => { setQuitando({ id: z.id, name: z.name }); setResQuitar(null); }))}
          {nuevas.map(n => fila(n.k, 'Zona nueva', n.name, n.travel_min,
            (v) => editarNueva(n, 'name', v), (v) => editarNueva(n, 'travel_min', v),
            () => { setQuitando({ k: n.k, name: n.name }); setResQuitar(null); }))}
        </ul>
      )}

      {quitando && (
        <div className="ag-agd-aviso" data-tipo="error" role="alertdialog" aria-label="Confirmar quitar zona"
          aria-describedby="ag-z-confirma-t" tabIndex={-1} ref={confirmaRef}>
          <span id="ag-z-confirma-t">
            ¿Quitar la zona {quitando.name || 'sin nombre'}? Los turnos que ya la tienen la conservan, pero no se va a poder elegir en turnos nuevos.
          </span>
          <div className="ag-agd-fila-acciones">
            <button type="button" className="ag-agd-btn" data-chico="true" onClick={volver}>Volver</button>
            <button type="button" className="ag-agd-btn" data-chico="true" data-peligro="true" disabled={borrando}
              onClick={confirmarQuitar}>
              {borrando ? 'Quitando...' : 'Sí, quitar zona'}
            </button>
          </div>
        </div>
      )}
      {resQuitar && <Aviso tipo={resQuitar.tipo}>{resQuitar.texto}</Aviso>}

      <div>
        <button type="button" id="ag-z-agregar" className="ag-agd-btn" onClick={agregar}>Agregar zona</button>
      </div>

      {(zonas.length > 0 || nuevas.length > 0) && (
        <PieGuardar onGuardar={guardar} guardando={guardando || borrando} res={res} etiqueta="Guardar zonas" />
      )}
    </section>
  );
}
