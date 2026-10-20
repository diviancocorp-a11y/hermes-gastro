/**
 * ResultadoDelDia — la solapa "Hoy" de Ventas: cuanto se gano en el dia.
 *
 * Es la promesa del producto ("sabe cuanto ganas cada noche"), asi que la
 * pantalla tiene UNA cifra protagonista, la ganancia neta, y debajo la cuenta
 * que la explica linea por linea para que se pueda sumar a ojo.
 *
 * La cuenta la hace la base (resultado_del_dia, 0103). Aca no se suma nada:
 * se muestra lo que vino y se comprueba que cierre (cierraLaCuenta). Si no
 * cierra no se esconde nada; se avisa.
 *
 * El "hoy" tambien lo decide la base: se pide con dia null y la RPC usa la
 * zona y la hora de corte de la sucursal. Ese dia queda como tope de la
 * navegacion (no hay dias futuros). Las fechas se formatean desde el ISO en
 * UTC para no pasar por la zona del navegador, que puede ser otra.
 *
 * Props:
 *   sucursal          {id, name, timezone} | null | undefined
 *                     undefined = todavia se esta buscando (esqueleto);
 *                     null = el negocio no tiene sucursal.
 *   cargar            (branchId, dia|null) => {ok, data}|{ok:false, error}
 *                     Default fetchResultadoDelDia; se inyecta en tests.
 *   resultadoInicial  un resultado ya traido: arranca con el, sin pedirlo.
 *                     Lo usa el preview (renderToStaticMarkup no corre
 *                     efectos y sin esto solo se veria el esqueleto).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchResultadoDelDia, lineasDelResultado, cierraLaCuenta,
  margenDelDia, avisosDelResultado, sumarDias,
} from '../../../services/platformResultado';
import '../../../styles/admin-resultado.css';

const conCentavos = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sinCentavos = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const porcentaje = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const diaDeSemana = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'UTC' });

// El signo menos tipografico (U+2212), no el guion: alinea con los numeros.
const MENOS = '−';

/** Algun monto de la cuenta (o la ganancia) trae centavos. */
function tieneCentavos(r) {
  const montos = [...lineasDelResultado(r).map(l => l.monto), r.ganancia_neta];
  return montos.some(m => Math.round(Math.abs(Number(m) || 0) * 100) % 100 !== 0);
}

/**
 * $ en es-AR. Los decimales son de TODA la cuenta, no de cada monto: si una
 * linea trae centavos van 2 fijos en todas (151.000,00 encima de 43.574,60),
 * asi la columna alinea y se suma a ojo sin redondear a pesos. Si ninguna
 * trae, ninguna los muestra.
 */
function plata(n, centavos) {
  const v = Number(n) || 0;
  const texto = `$${(centavos ? conCentavos : sinCentavos).format(Math.abs(v))}`;
  return v < 0 ? `${MENOS}${texto}` : texto;
}

/** "lunes 13/10" desde 'YYYY-MM-DD', sin pasar por la zona del navegador. */
function fechaCorta(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const semana = diaDeSemana.format(new Date(Date.UTC(y, m - 1, d)));
  return `${semana} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** "Hoy", "Ayer" o la fecha corta, medido contra el hoy de la sucursal. */
function nombreDelDia(iso, hoy) {
  if (!iso || !hoy || iso === hoy) return 'Hoy';
  if (iso === sumarDias(hoy, -1)) return 'Ayer';
  return fechaCorta(iso);
}

function Flecha({ hacia }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points={hacia === 'atras' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
    </svg>
  );
}

function Esqueleto() {
  return (
    <div className="ag-resultado-cuerpo" aria-hidden="true">
      <div className="ag-resultado-cifra">
        <span className="ag-resultado-hueso" data-forma="cifra" />
        <span className="ag-resultado-hueso" data-forma="texto" />
      </div>
      <div className="ag-resultado-cuenta">
        {[0, 1, 2, 3, 4].map(i => <span key={i} className="ag-resultado-hueso" data-forma="linea" />)}
      </div>
    </div>
  );
}

function Cuenta({ r, centavos }) {
  const lineas = lineasDelResultado(r);
  const negativo = r.ganancia_neta < 0;
  return (
    <div className="ag-resultado-cuenta">
      <table className="ag-resultado-tabla">
        <caption>La cuenta del día</caption>
        <tbody>
          {lineas.map(l => (
            <tr key={l.id} className="ag-resultado-fila" data-linea={l.id} data-cero={l.monto === 0 ? 'true' : undefined}>
              <th scope="row">
                {l.label}
                {l.detalle && <span className="ag-resultado-detalle">{l.detalle}</span>}
              </th>
              {/* El signo lo pone `signo`: con Math.abs un negativo de la base no
                  sale como doble menos. */}
              <td>{l.signo < 0 && l.monto !== 0 ? MENOS : ''}{plata(Math.abs(l.monto), centavos)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="ag-resultado-total">
            <th scope="row">Ganancia neta</th>
            <td data-signo={negativo ? 'negativo' : undefined}>{plata(r.ganancia_neta, centavos)}</td>
          </tr>
        </tfoot>
      </table>
      {!cierraLaCuenta(r) && (
        <p className="ag-resultado-descuadre">Las líneas no suman el total: avisá a soporte.</p>
      )}
    </div>
  );
}

function Resultado({ r }) {
  const margen = margenDelDia(r);
  const avisos = avisosDelResultado(r);
  const negativo = r.ganancia_neta < 0;
  const sinMovimientos = lineasDelResultado(r).every(l => l.monto === 0) && r.tickets === 0;
  const centavos = tieneCentavos(r);

  const meta = [];
  if (margen !== null) {
    meta.push(`${margen < 0 ? MENOS : ''}${porcentaje.format(Math.abs(margen))} % sobre ventas`);
  }
  meta.push(r.tickets === 1 ? '1 ticket' : `${r.tickets} tickets`);

  return (
    <div className="ag-resultado-cuerpo">
      <div className="ag-resultado-cifra">
        <p className="ag-resultado-neta" data-signo={negativo ? 'negativo' : undefined}>
          {plata(r.ganancia_neta, centavos)}
        </p>
        <p className="ag-resultado-etiqueta">{negativo ? 'Ganancia neta · el día dio pérdida' : 'Ganancia neta'}</p>
        <p className="ag-resultado-meta">{meta.join(' · ')}</p>
        {sinMovimientos && (
          <p className="ag-resultado-quieto">
            Este día no tuvo ventas, gastos ni fichajes. Cuando entre el primer movimiento, la cuenta se arma sola.
          </p>
        )}
        {avisos.length > 0 && (
          <ul className="ag-resultado-avisos" aria-label="Avisos sobre la cuenta">
            {avisos.map(a => <li key={a} className="ag-resultado-aviso">{a}</li>)}
          </ul>
        )}
      </div>
      <Cuenta r={r} centavos={centavos} />
    </div>
  );
}

export default function ResultadoDelDia({
  sucursal,
  cargar = fetchResultadoDelDia,
  resultadoInicial = null,
}) {
  const branchId = sucursal?.id || null;
  const [estado, setEstado] = useState(resultadoInicial ? 'listo' : 'cargando');
  const [resultado, setResultado] = useState(resultadoInicial);
  const [error, setError] = useState(null);
  // El dia que se esta mirando y el hoy de la sucursal. Arrancan en null: los
  // dos los define la primera respuesta de la base.
  const [dia, setDia] = useState(resultadoInicial?.dia || null);
  const [tope, setTope] = useState(resultadoInicial?.dia || null);

  // Si se navega rapido, la respuesta de un dia viejo no pisa la del nuevo.
  const pedido = useRef(0);
  const saltarPrimera = useRef(Boolean(resultadoInicial));

  const traer = useCallback(async (diaPedido) => {
    if (!branchId) return;
    const n = ++pedido.current;
    setEstado('cargando');
    setError(null);
    setDia(diaPedido);
    let res;
    try {
      res = await cargar(branchId, diaPedido);
    } catch {
      res = { ok: false, error: 'No se pudo traer el resultado del día' };
    }
    if (n !== pedido.current) return;
    if (!res?.ok) {
      setEstado('error');
      setError(res?.error || 'No se pudo traer el resultado del día');
      return;
    }
    // Sin dia pedido, el que vuelve es el hoy de la sucursal: el tope.
    if (diaPedido === null) setTope(res.data.dia);
    setDia(res.data.dia);
    setResultado(res.data);
    setEstado('listo');
  }, [branchId, cargar]);

  useEffect(() => {
    if (saltarPrimera.current) { saltarPrimera.current = false; return; }
    setTope(null);
    setResultado(null);
    traer(null);
  }, [traer]);

  if (sucursal === undefined) {
    return (
      <section className="ag-resultado" aria-label="Resultado del día" aria-busy="true">
        <Esqueleto />
      </section>
    );
  }

  if (!branchId) {
    return (
      <section className="ag-resultado" aria-label="Resultado del día">
        <div className="ag-resultado-estado">
          <p>Todavía no hay sucursal cargada.</p>
        </div>
      </section>
    );
  }

  const cargando = estado === 'cargando';
  const nombre = nombreDelDia(dia, tope);
  const subtitulo = [
    dia && (nombre === 'Hoy' || nombre === 'Ayer') ? fechaCorta(dia) : null,
    sucursal.name || null,
  ].filter(Boolean).join(' · ');

  const puedeAtras = Boolean(dia) && !cargando;
  const puedeAdelante = Boolean(dia && tope) && dia < tope && !cargando;

  let anuncio = '';
  if (cargando) anuncio = 'Cargando el resultado del día';
  else if (estado === 'error') anuncio = error;
  else if (resultado) anuncio = `${nombre}: ganancia neta ${plata(resultado.ganancia_neta, tieneCentavos(resultado))}`;

  return (
    <section className="ag-resultado" aria-label="Resultado del día">
      <header className="ag-resultado-dia">
        <button
          type="button"
          className="ag-resultado-nav"
          onClick={() => traer(sumarDias(dia, -1))}
          disabled={!puedeAtras}
          aria-label="Día anterior"
        >
          <Flecha hacia="atras" />
        </button>
        <div className="ag-resultado-dia-texto">
          <h2>{nombre}</h2>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        <button
          type="button"
          className="ag-resultado-nav"
          onClick={() => traer(sumarDias(dia, 1))}
          disabled={!puedeAdelante}
          aria-label="Día siguiente"
        >
          <Flecha hacia="adelante" />
        </button>
      </header>

      <p className="ag-sr-only" aria-live="polite">{anuncio}</p>

      <div aria-busy={cargando ? 'true' : 'false'}>
        {cargando && <Esqueleto />}

        {estado === 'error' && (
          <div className="ag-resultado-estado">
            <p>{error}</p>
            <button type="button" className="ag-resultado-reintentar" onClick={() => traer(dia)}>
              Reintentar
            </button>
          </div>
        )}

        {estado === 'listo' && resultado && <Resultado r={resultado} />}
      </div>
    </section>
  );
}
