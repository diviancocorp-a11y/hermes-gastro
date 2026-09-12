/**
 * ComanderaPanel — el sector que trabaja con papel (0075).
 *
 * ESTO NO ES UNA PANTALLA PARA MIRAR
 * Es la página que hay que dejar abierta en la computadora que tiene la
 * impresora del sector. Nadie la lee durante el servicio: imprime sola y
 * avisa cuando algo no salió. Por eso no se parece al KDS, que está hecho
 * para leerse a tres metros; ésta se mira una vez al abrir el local y otra
 * cuando algo falla.
 *
 * POR QUE HACE FALTA UNA COMPUTADORA IGUAL
 * Una térmica USB imprime desde la máquina donde está enchufada, y el
 * navegador sólo le puede mandar a la impresora PREDETERMINADA de ese equipo.
 * No hay forma de que la tablet del mozo imprima en la barra. Con dos
 * sectores en papel son dos equipos. Una térmica de RED saca esa restricción.
 *
 * LA IMPRESION AUTOMATICA SE ENCIENDE A MANO, UNA VEZ
 * El navegador bloquea `print()` si no viene de un gesto del usuario. El
 * botón de encender resuelve eso y además hace explícito lo que si no sería
 * un efecto invisible: esta pestaña va a mandar papel sola.
 *
 * IMPRIMIR DOS VECES ES COCINAR DOS VECES
 * La impresión se anota en la base, no acá: recargar, abrir otra pestaña o
 * cambiar de equipo no puede reimprimir el servicio. La reimpresión
 * deliberada sale marcada como REIMPRESION en el papel.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { comandaDeSector, minutosDesde } from '../../../services/platformComandera';
import { imprimirEtiqueta } from '../../../lib/impresionDePasador';

const CLAVE_ANCHO = 'dico.comandera.ancho';
const CLAVE_AUTO = 'dico.comandera.auto';

// 58 mm son 32 columnas y 80 mm son 48. No hay un tercer papel en una cocina.
const ANCHOS = [
  { mm: 58, cols: 32, label: '58 mm' },
  { mm: 80, cols: 48, label: '80 mm' },
];

const hora = (d, timezone) => (d
  ? new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone || undefined,
  }).format(new Date(d))
  : '--:--');

const haceCuanto = (min) => {
  const m = Math.floor(min);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.floor(m / 60)} h ${m % 60} min`;
};

function leer(clave, porDefecto) {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? porDefecto : v;
  } catch { return porDefecto; }
}

function guardar(clave, valor) {
  try { localStorage.setItem(clave, String(valor)); } catch { /* sin storage */ }
}

export default function ComanderaPanel({
  sector = null,
  porImprimir = [],
  abiertas = [],
  timezone,
  onImprimir,          // (ticket, texto, {reimpresion}) -> Promise<{ok}>
  onCerrar,            // (ticket) -> Promise<any>
  showToast,
  ahoraFijo = null,
}) {
  const [ancho, setAncho] = useState(() => Number(leer(CLAVE_ANCHO, 58)));
  const [auto, setAuto] = useState(() => leer(CLAVE_AUTO, '0') === '1');
  const [trabajando, setTrabajando] = useState(false);
  const [fallidas, setFallidas] = useState([]);
  const [ahora, setAhora] = useState(() => ahoraFijo || new Date());
  // Una impresion a la vez. Dos `print()` simultaneos en el mismo documento
  // se pisan y sale una sola hoja, con el agravante de que las dos quedan
  // anotadas como impresas.
  const enCurso = useRef(false);

  useEffect(() => {
    if (ahoraFijo) return undefined;
    const id = setInterval(() => setAhora(new Date()), 20000);
    return () => clearInterval(id);
  }, [ahoraFijo]);

  const cols = ANCHOS.find(a => a.mm === ancho)?.cols || 32;

  const sacar = useCallback(async (ticket, { reimpresion = false } = {}) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setTrabajando(true);
    try {
      const texto = comandaDeSector(ticket, {
        sector, anchoCols: cols, ahora: new Date(), timezone, reimpresion,
      });
      const r = await onImprimir?.(ticket, texto, { reimpresion });
      if (r?.ok === false) {
        // No se marca como impresa: queda en la cola y se reintenta. Una
        // comanda dada por impresa que nunca salio es un plato que nadie
        // cocina.
        setFallidas(f => (f.includes(ticket.id) ? f : [...f, ticket.id]));
        showToast?.('La impresora no respondió. La comanda sigue en la cola.');
      } else {
        setFallidas(f => f.filter(id => id !== ticket.id));
      }
    } finally {
      enCurso.current = false;
      setTrabajando(false);
    }
  }, [sector, cols, timezone, onImprimir, showToast]);

  // El motor: con la impresion automatica encendida, saca la primera de la
  // cola y espera al proximo refresco. De a una, para que el orden del papel
  // sea el orden en que bajaron los pedidos.
  //
  // UNA QUE FALLO NO SE REINTENTA SOLA. La impresora no falla por casualidad:
  // falla porque no hay papel o esta desenchufada, y eso no se arregla en el
  // milisegundo siguiente. Reintentando, el efecto se vuelve a disparar con
  // cada cambio de estado y queda golpeando `print()` para siempre. Se
  // reintenta a mano, que es cuando alguien ya la miro.
  useEffect(() => {
    if (!auto || enCurso.current || !porImprimir.length) return;
    const siguiente = porImprimir.find(t => !fallidas.includes(t.id));
    if (siguiente) sacar(siguiente);
  }, [auto, porImprimir, fallidas, sacar]);

  const cambiarAncho = (mm) => { setAncho(mm); guardar(CLAVE_ANCHO, mm); };
  const cambiarAuto = (v) => { setAuto(v); guardar(CLAVE_AUTO, v ? '1' : '0'); };

  return (
    <section className="ag-comandera" aria-label={`Comandera de ${sector?.name || 'producción'}`}>
      <header className="ag-comandera-head">
        <div>
          <p className="ag-comandera-sector">
            {sector?.name || 'Producción'} <span>comandera</span>
          </p>
          <p className="ag-comandera-sub">
            Dejá esta pestaña abierta en la computadora que tiene la impresora
            de {sector?.name?.toLocaleLowerCase('es-AR') || 'este sector'}.
          </p>
        </div>

        <div className="ag-comandera-ajustes">
          <fieldset className="ag-comandera-ancho">
            <legend>Papel</legend>
            {ANCHOS.map(a => (
              <label key={a.mm}>
                <input
                  type="radio" name="ancho-comandera" value={a.mm}
                  checked={ancho === a.mm}
                  onChange={() => cambiarAncho(a.mm)}
                />
                <span>{a.label}</span>
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            className={auto ? 'ag-btn-ghost' : 'ag-btn-primary'}
            aria-pressed={auto}
            onClick={() => cambiarAuto(!auto)}
          >
            {auto ? 'Apagar impresión automática' : 'Encender impresión automática'}
          </button>
        </div>
      </header>

      {/* El estado en una sola línea, que es lo único que alguien mira de
          pasada para saber si el sector está cubierto. */}
      <p className="ag-comandera-estado" data-encendida={auto ? 'true' : 'false'}>
        {auto
          ? `Imprimiendo sola · ${porImprimir.length} en cola · ${abiertas.length} sin cerrar`
          : 'Apagada. Las comandas se acumulan en la cola y no sale papel.'}
      </p>

      {!auto && porImprimir.length > 0 && (
        <p className="ag-comandera-aviso">
          Hay {porImprimir.length} {porImprimir.length === 1 ? 'comanda' : 'comandas'} esperando.
          Encendé la impresión automática o imprimilas de a una.
        </p>
      )}

      <div className="ag-comandera-cuerpo">
        <div className="ag-comandera-col">
          <h3 className="ag-comandera-titulo">
            En cola <small>bajaron a cocina y todavía no salieron</small>
          </h3>
          {porImprimir.length === 0 ? (
            <p className="ag-comandera-vacio">
              Nada esperando. Cuando un pedido baje a cocina con algo de este
              sector, la comanda sale sola.
            </p>
          ) : (
            <ul className="ag-comandera-lista">
              {porImprimir.map(t => (
                <li
                  key={t.id}
                  className="ag-comandera-item"
                  data-fallida={fallidas.includes(t.id) ? 'true' : 'false'}
                >
                  <div className="ag-comandera-item-datos">
                    <strong>{t.titulo}</strong>
                    <span>
                      {(t.order_items || []).filter(i => !i.ready_at).length} platos
                      {' · bajó '}{hora(t.kitchen_at, timezone)}
                    </span>
                    {fallidas.includes(t.id) && (
                      <em className="ag-comandera-fallo">No salió. Revisá papel y conexión.</em>
                    )}
                  </div>
                  <button
                    type="button" className="ag-btn-mini"
                    disabled={trabajando}
                    onClick={() => sacar(t)}
                  >
                    Imprimir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ag-comandera-col">
          <h3 className="ag-comandera-titulo">
            Papel en la cocina <small>salió y nadie dijo que se entregó</small>
          </h3>
          {abiertas.length === 0 ? (
            <p className="ag-comandera-vacio">
              Ninguna abierta. El mozo las cierra desde Salón cuando retira.
            </p>
          ) : (
            <ul className="ag-comandera-lista">
              {abiertas.map(t => (
                <li key={t.id} className="ag-comandera-item">
                  <div className="ag-comandera-item-datos">
                    <strong>{t.titulo}</strong>
                    <span>
                      salió {hora(t.printed_at, timezone)}
                      {' · '}{haceCuanto(minutosDesde(t.printed_at, ahora))}
                      {t.impresiones > 1 && ` · ${t.impresiones} impresiones`}
                    </span>
                  </div>
                  <div className="ag-comandera-item-acciones">
                    <button
                      type="button" className="ag-btn-mini"
                      disabled={trabajando}
                      onClick={() => sacar(t, { reimpresion: true })}
                    >
                      Reimprimir
                    </button>
                    <button
                      type="button" className="ag-btn-mini"
                      onClick={() => onCerrar?.(t)}
                    >
                      Cerrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Se lee una vez, el dia que se instala. Por eso va plegado y al final:
          durante el servicio nadie vuelve acá. */}
      <details className="ag-comandera-ayuda">
        <summary>Cómo dejar esta computadora lista</summary>
        <ol>
          <li>
            Poné la térmica del sector como <strong>impresora predeterminada</strong> de
            Windows. El navegador no puede elegir otra.
          </li>
          <li>
            Abrí Chrome con <code>--kiosk-printing</code>. Sin eso, Chrome
            muestra la ventana de vista previa en <em>cada</em> comanda y
            alguien tiene que confirmarla a mano.
          </li>
          <li>Entrá acá y encendé la impresión automática. Queda encendida.</li>
        </ol>
        <p>
          Con dos sectores en papel hacen falta dos equipos, uno por impresora.
          Con una térmica de red, un solo equipo alcanza para las dos.
        </p>
      </details>

      <p className="ag-comandera-pie">
        La reimpresión sale marcada como REIMPRESION: un papel repetido sin
        marca es un plato cocinado dos veces.
      </p>
    </section>
  );
}
