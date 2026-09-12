/**
 * StockPanel — la lista deja de ser una lista de nombres (1a).
 *
 * LO QUE CAMBIA
 * Antes el edificio reusaba el componente Stock del panel legacy: una tabla de
 * nombres y numeros. Para saber si habia que salir a comprar, el operador
 * comparaba de memoria cada disponible contra cada minimo, insumo por insumo.
 * Aca esa comparacion la hace la pantalla: el nivel es una BARRA contra el
 * minimo y el numero queda como respaldo.
 *
 * LO QUE ESTA POR DEBAJO DEL MINIMO MANDA
 * El orden no es alfabetico ni por categoria: primero lo que falta, y dentro
 * de eso lo mas critico. Una lista ordenada por nombre obliga a leerla entera
 * todos los dias para encontrar las cuatro filas que importan.
 *
 * EL MINIMO QUE NO ESTA
 * Hoy NINGUN insumo del edificio tiene minimo cargado, asi que el caso normal
 * es el que no se puede medir. La fila no miente con una barra verde: muestra
 * la barra apagada y pide el numero ahi mismo, sin abrir nada. Cada vez que se
 * carga uno, esa fila empieza a funcionar.
 *
 * LA FICHA RESUELVE LA FILA
 * El panel derecho no es un visor: es donde se repone, se ajusta y se registra
 * merma del insumo seleccionado. Un modal por accion obligaria a elegir la
 * accion antes de ver el dato que decide cual accion corresponde.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  nivelContraMinimo, diasDeCobertura, reponerInsumo, ajustarInsumoContado,
  fetchConsumoDiario,
} from '../../../services/platformInventory';

const money = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
}).format(Number(n) || 0);

const num = (n, dec = 1) => {
  const v = Number(n) || 0;
  // Sin decimales cuando es redondo: "36 u" se lee mejor que "36.0 u".
  return Number.isInteger(v) ? String(v) : v.toFixed(dec);
};

const cantidad = (n, unidad) => `${num(n)} ${unidad || 'u'}`;

/** El orden de la lista: primero lo que falta. */
const PESO_ESTADO = { critico: 0, bajo: 1, 'sin-minimo': 2, ok: 3 };

function ordenar(a, b) {
  const na = nivelContraMinimo(a);
  const nb = nivelContraMinimo(b);
  const pa = PESO_ESTADO[na.estado];
  const pb = PESO_ESTADO[nb.estado];
  if (pa !== pb) return pa - pb;
  // Dentro del mismo estado, el que esta mas lejos de su minimo primero.
  if (na.nivel != null && nb.nivel != null && na.nivel !== nb.nivel) return na.nivel - nb.nivel;
  return String(a.name || '').localeCompare(String(b.name || ''), 'es-AR');
}

/* ───────────────────────────── Fila ───────────────────────────────── */

function Fila({ ing, seleccionado, onSeleccionar, onDefinirMinimo, consumo }) {
  const [editandoMinimo, setEditandoMinimo] = useState(false);
  const [borrador, setBorrador] = useState('');
  const { nivel, estado } = nivelContraMinimo(ing);
  const dias = diasDeCobertura(ing.stock, consumo?.consumoDiario);
  const valor = (Number(ing.stock) || 0) * (Number(ing.cost) || 0);

  const guardarMinimo = async (e) => {
    e.stopPropagation();
    const n = Number(borrador);
    if (!Number.isFinite(n) || n <= 0) return;
    await onDefinirMinimo(ing, n);
    setEditandoMinimo(false);
    setBorrador('');
  };

  return (
    <div
      className="ag-stock-fila"
      role="row"
      tabIndex={0}
      aria-selected={seleccionado}
      data-estado={estado}
      onClick={() => onSeleccionar(ing)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleccionar(ing); }
      }}
    >
      <div className="ag-stock-fila-nombre">
        <strong>{ing.name}</strong>
        {ing.category && <span className="ag-stock-fila-categoria">{ing.category}</span>}
      </div>

      <div className="ag-stock-fila-cantidad">
        <span className="ag-stock-fila-disponible">{cantidad(ing.stock, ing.unit)}</span>
        {Number(ing.min_stock) > 0 && (
          <span className="ag-stock-fila-minimo">min. {cantidad(ing.min_stock, ing.unit)}</span>
        )}
      </div>

      <div className="ag-stock-nivel">
        <div className="ag-stock-barra" data-sin-minimo={nivel == null}>
          {nivel != null && <i style={{ width: `${Math.round(nivel * 100)}%` }} />}
        </div>
        {nivel != null ? (
          <span className="ag-stock-nivel-pie">
            {/* Topeado igual que la barra. Sin tope decia "180% del minimo",
                que suena a problema cuando en realidad sobra: lo que importa
                es que llego, no cuanto se paso. */}
            {Math.round(nivel * 100)}% del mínimo
            {dias != null && ` · ${num(dias)} días`}
          </span>
        ) : editandoMinimo ? (
          <span className="ag-stock-minimo-campo" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              min="0"
              step="any"
              autoFocus
              value={borrador}
              aria-label={`Mínimo de ${ing.name}`}
              placeholder={ing.unit || 'u'}
              onChange={(e) => setBorrador(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') guardarMinimo(e);
                if (e.key === 'Escape') { setEditandoMinimo(false); setBorrador(''); }
              }}
            />
            <button type="button" className="ag-btn-mini" onClick={guardarMinimo}>Listo</button>
          </span>
        ) : (
          <button
            type="button"
            className="ag-stock-pedir-minimo"
            onClick={(e) => { e.stopPropagation(); setEditandoMinimo(true); }}
          >
            definir mínimo
          </button>
        )}
      </div>

      <div className="ag-stock-fila-valor">{money(valor)}</div>
    </div>
  );
}

/* ───────────────────────────── Ficha ──────────────────────────────── */

const MOTIVOS_MERMA = [
  ['vencido', 'Se venció'],
  ['roto', 'Se rompió'],
  ['mal_estado', 'Mal estado'],
  ['error', 'Error de preparación'],
  ['otro', 'Otro'],
];

function Ficha({ ing, consumo, proveedor, onReponer, onAjustar, onMerma, onEditar }) {
  const [modo, setModo] = useState(null); // 'reponer' | 'ajustar' | 'merma'
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('vencido');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Cambiar de insumo tiene que dejar el formulario limpio: dejarlo abierto
  // con el numero del anterior es la forma mas facil de reponer el insumo
  // equivocado. Se resuelve con `key` en el padre, que remonta la ficha, y no
  // con un efecto que resetee: eso dispara un render en cascada por cada
  // click en la lista.

  if (!ing) {
    return (
      <aside className="ag-stock-ficha">
        <div className="ag-stock-ficha-vacia">
          <strong>Elegí un insumo</strong>
          <span>La ficha muestra su nivel y resuelve la acción que toca.</span>
        </div>
      </aside>
    );
  }

  const { estado } = nivelContraMinimo(ing);
  const dias = diasDeCobertura(ing.stock, consumo?.consumoDiario);
  const faltante = Math.max(0, (Number(ing.min_stock) || 0) - (Number(ing.stock) || 0));

  const enviar = async (e) => {
    e.preventDefault();
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0 || (modo !== 'ajustar' && n === 0)) {
      setError('Poné una cantidad válida.');
      return;
    }
    // La merma no puede sacar mas de lo que hay: el stock se frenaria en 0 y
    // el libro quedaria diciendo que se tiro una cantidad que nunca existio.
    if (modo === 'merma' && n > Number(ing.stock || 0)) {
      setError(`No podés dar de baja más de lo que hay (${cantidad(ing.stock, ing.unit)}).`);
      return;
    }
    setGuardando(true);
    setError(null);
    const r = modo === 'reponer' ? await onReponer(ing, n)
      : modo === 'merma' ? await onMerma(ing, n, motivo)
      : await onAjustar(ing, n);
    setGuardando(false);
    if (r?.__error) { setError(r.message || 'No se pudo guardar.'); return; }
    setModo(null);
    setValor('');
  };

  const tono = estado === 'ok' ? 'ok' : estado === 'bajo' ? 'warn' : 'bad';

  return (
    <aside className="ag-stock-ficha" data-estado={estado}>
      <div className="ag-stock-ficha-estado">
        <i aria-hidden="true" />
        {estado === 'critico' || estado === 'bajo' ? 'Bajo mínimo'
          : estado === 'sin-minimo' ? 'Sin mínimo definido' : 'En nivel'}
      </div>

      <h2>{ing.name}</h2>
      <p className="ag-stock-ficha-sub">
        {ing.category || 'Sin categoría'}
        {proveedor ? ` · ${proveedor.name}` : ''}
      </p>

      <div className="ag-stock-ficha-datos">
        <div className="ag-stock-ficha-dato">
          <span>Disponible</span><strong>{cantidad(ing.stock, ing.unit)}</strong>
        </div>
        {Number(ing.min_stock) > 0 && (
          <div className="ag-stock-ficha-dato">
            <span>Mínimo operativo</span><strong>{cantidad(ing.min_stock, ing.unit)}</strong>
          </div>
        )}
        {/* Sin movimientos medidos la linea no sale: un "0 por dia" se leeria
            como "no se consume", que es una afirmacion que no tenemos. */}
        {consumo?.consumoDiario > 0 && (
          <div className="ag-stock-ficha-dato">
            <span>Consumo diario</span>
            <strong>{cantidad(consumo.consumoDiario, ing.unit)} por día</strong>
          </div>
        )}
        {proveedor && (
          <div className="ag-stock-ficha-dato">
            <span>Proveedor</span><strong>{proveedor.name}</strong>
          </div>
        )}
        <div className="ag-stock-ficha-dato" data-fuerte="true">
          <span>Valor en depósito</span>
          <strong>{money((Number(ing.stock) || 0) * (Number(ing.cost) || 0))}</strong>
        </div>
      </div>

      {dias != null && (
        <div className="ag-stock-aviso" data-tono={dias >= 3 ? 'ok' : dias >= 1 ? 'warn' : 'bad'}>
          <span className="ag-stock-aviso-rotulo">Alcanza para</span>
          <span>
            {num(dias)} días al ritmo actual.
            {faltante > 0 && ` Pedí ${cantidad(faltante, ing.unit)} para volver al nivel de trabajo.`}
          </span>
        </div>
      )}
      {dias == null && estado !== 'sin-minimo' && (
        <div className="ag-stock-aviso" data-tono={tono}>
          <span className="ag-stock-aviso-rotulo">Sin consumo medido</span>
          <span>Todavía no hay salidas registradas de este insumo, así que no se puede decir cuántos días alcanza.</span>
        </div>
      )}

      {modo ? (
        <form className="ag-stock-form" onSubmit={enviar}>
          <label htmlFor="ag-stock-cantidad">
            {modo === 'reponer' ? `Cuánto entró (${ing.unit || 'u'})`
              : modo === 'merma' ? `Cuánto se perdió (${ing.unit || 'u'})`
              : `Cuánto hay contado (${ing.unit || 'u'})`}
          </label>
          <input
            id="ag-stock-cantidad"
            type="number"
            min="0"
            step="any"
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={modo === 'ajustar' ? num(ing.stock) : ''}
          />
          {/* El ajuste se carga como "cuanto hay", no como "cuanto cambia":
              quien vuelve del deposito trae el numero que conto, no la resta. */}
          {modo === 'ajustar' && valor !== '' && Number.isFinite(Number(valor)) && (
            <span className="ag-stock-form-resultado">
              Diferencia contra lo registrado: {Number(valor) - Number(ing.stock) > 0 ? '+' : ''}
              {num(Number(valor) - Number(ing.stock))} {ing.unit || 'u'}
            </span>
          )}
          {/* El motivo no es opcional ni tiene default vacio: una merma sin
              motivo es una merma que nadie va a poder explicar en el P&L. */}
          {modo === 'merma' && (
            <>
              <label htmlFor="ag-stock-motivo">Motivo</label>
              <select
                id="ag-stock-motivo" value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              >
                {MOTIVOS_MERMA.map(([v, etiqueta]) => (
                  <option key={v} value={v}>{etiqueta}</option>
                ))}
              </select>
            </>
          )}
          {error && <span className="ag-stock-error">{error}</span>}
          <div className="ag-stock-form-botones">
            <button type="submit" className="ag-btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…'
                : modo === 'reponer' ? 'Registrar entrada'
                : modo === 'merma' ? 'Dar de baja'
                : 'Guardar conteo'}
            </button>
            <button type="button" className="ag-btn-ghost" onClick={() => { setModo(null); setError(null); }}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="ag-stock-ficha-acciones">
          <button type="button" className="ag-btn-primary" onClick={() => setModo('reponer')}>
            Reponer ahora
          </button>
          <div className="ag-stock-ficha-secundarias">
            <button type="button" className="ag-btn-ghost" onClick={() => setModo('ajustar')}>Ajustar</button>
            <button type="button" className="ag-btn-ghost" onClick={() => setModo('merma')}>Merma</button>
          </div>
          {/* Editar abre el formulario completo —nombre, unidad, costo,
              categoria, proveedor—. Las tres de arriba son del dia a dia; esta
              es de mantenimiento y por eso va abajo y sin peso visual. */}
          {onEditar && (
            <button type="button" className="ag-btn-mini" onClick={() => onEditar(ing)}>
              Editar insumo
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

/* ───────────────────────────── Panel ──────────────────────────────── */

export default function StockPanel({
  tenantId,
  insumos = [],
  proveedores = [],
  onRecargar,
  onGuardarInsumo,
  onRegistrarMerma,
  onNuevoInsumo,
  onEditarInsumo,
  onContarDeposito,
  showToast,
  // Solo para la vista previa: deja la ficha abierta en un insumo. Sin esto,
  // un render estatico siempre muestra la ficha vacia y la mitad de la
  // pantalla queda sin poder revisarse.
  seleccionadoInicial = null,
}) {
  const [seleccionadoId, setSeleccionadoId] = useState(seleccionadoInicial);
  const [categoria, setCategoria] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [consumos, setConsumos] = useState(() => new Map());

  useEffect(() => {
    let vivo = true;
    if (!tenantId) return undefined;
    fetchConsumoDiario(tenantId).then((m) => { if (vivo) setConsumos(m); });
    return () => { vivo = false; };
  }, [tenantId, insumos]);

  const categorias = useMemo(() => {
    const vistas = new Set();
    for (const i of insumos) if (i.category) vistas.add(i.category);
    return [...vistas].sort((a, b) => a.localeCompare(b, 'es-AR'));
  }, [insumos]);

  const ordenados = useMemo(() => [...insumos].sort(ordenar), [insumos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es-AR');
    return ordenados.filter((i) => {
      if (categoria === 'bajo') {
        const { estado } = nivelContraMinimo(i);
        if (estado !== 'critico' && estado !== 'bajo') return false;
      } else if (categoria !== 'todos' && i.category !== categoria) return false;
      if (q && !String(i.name || '').toLocaleLowerCase('es-AR').includes(q)) return false;
      return true;
    });
  }, [ordenados, categoria, busqueda]);

  const seleccionado = insumos.find(i => i.id === seleccionadoId) || null;

  // Las cintas cuentan sobre TODOS los insumos, no sobre los filtrados: si el
  // resumen cambiara al filtrar, dejaria de ser el estado del deposito.
  const resumen = useMemo(() => {
    let invertido = 0;
    let bajos = 0;
    let conMinimo = 0;
    let sumaNivel = 0;
    for (const i of insumos) {
      invertido += (Number(i.stock) || 0) * (Number(i.cost) || 0);
      const { nivel, estado } = nivelContraMinimo(i);
      if (nivel != null) { conMinimo += 1; sumaNivel += nivel; }
      if (estado === 'critico' || estado === 'bajo') bajos += 1;
    }
    return {
      invertido,
      bajos,
      conMinimo,
      sinMinimo: insumos.length - conMinimo,
      cobertura: conMinimo ? Math.round((sumaNivel / conMinimo) * 100) : null,
    };
  }, [insumos]);

  const definirMinimo = useCallback(async (ing, minimo) => {
    const r = await onGuardarInsumo({ ...ing, min_stock: minimo });
    if (r && !r.__error) showToast?.(`Mínimo de ${ing.name}: ${cantidad(minimo, ing.unit)}`);
    return r;
  }, [onGuardarInsumo, showToast]);

  const reponer = useCallback(async (ing, qty) => {
    const r = await reponerInsumo({ tenantId, ingredientId: ing.id, qty });
    if (r?.__error) return r;
    showToast?.(`Entraron ${cantidad(qty, ing.unit)} de ${ing.name}`);
    await onRecargar?.();
    return r;
  }, [tenantId, onRecargar, showToast]);

  const ajustar = useCallback(async (ing, contado) => {
    const r = await ajustarInsumoContado({ tenantId, ingrediente: ing, contado });
    if (r?.__error) return r;
    showToast?.(`${ing.name} quedó en ${cantidad(contado, ing.unit)}`);
    await onRecargar?.();
    return r;
  }, [tenantId, onRecargar, showToast]);

  const merma = useCallback(async (ing, qty, motivo) => {
    const ok = await onRegistrarMerma?.(ing, qty, motivo);
    // registrarMerma devuelve un booleano, no la fila: un false hay que
    // convertirlo en el `__error` que la ficha sabe mostrar, o el formulario
    // se cerraria como si hubiera guardado.
    if (ok === false) return { __error: 'db', message: 'No se pudo registrar la merma.' };
    showToast?.(`Merma de ${cantidad(qty, ing.unit)} en ${ing.name}`);
    await onRecargar?.();
    return ok;
  }, [onRegistrarMerma, onRecargar, showToast]);

  const porProveedor = useMemo(
    () => new Map(proveedores.map(p => [p.id, p])), [proveedores]);

  return (
    <section className="ag-stock">
      <header className="ag-stock-head">
        {/* Sin titulo propio: el chrome del panel ya escribe el nombre de la
            seccion (`ag-section-title`). Repetirlo dejaba "Stock" dos veces
            en pantalla y dos <h1> en el documento. */}
        <div className="ag-stock-titulo">
          <span className="ag-stock-resumen">
            {insumos.length} insumos
            {resumen.bajos > 0 && <> · <b>{resumen.bajos} bajo mínimo</b></>}
          </span>
        </div>
        {/* La merma NO esta aca: sin insumo elegido el boton no sabe sobre
            cual actuar. Vive en la ficha, que es donde se sabe. */}
        <div className="ag-stock-acciones">
          {onContarDeposito && (
            <button type="button" className="ag-btn-ghost" onClick={onContarDeposito}>
              Conteo de depósito
            </button>
          )}
          {onNuevoInsumo && (
            <button type="button" className="ag-btn-primary" onClick={onNuevoInsumo}>
              Agregar insumo
            </button>
          )}
        </div>
      </header>

      <div className="ag-stock-cintas">
        <div className="ag-stock-cinta">
          <span className="ag-stock-cinta-rotulo">Invertido en depósito</span>
          <span className="ag-stock-cinta-valor">{money(resumen.invertido)}</span>
          <span className="ag-stock-cinta-pie">{insumos.length} insumos activos</span>
        </div>

        <div className="ag-stock-cinta">
          <span className="ag-stock-cinta-rotulo">Cobertura promedio</span>
          <span className="ag-stock-cinta-valor">
            {resumen.cobertura != null ? `${resumen.cobertura}%` : '—'}
            <small>{resumen.cobertura != null ? 'sobre el mínimo' : 'sin mínimos cargados'}</small>
          </span>
          {/* Sin un solo minimo cargado la barra no se dibuja: una barra en
              cero se leeria como "no hay stock" y lo que falta es el dato. */}
          {resumen.cobertura != null && (
            <div className="ag-stock-barra">
              <i style={{ width: `${resumen.cobertura}%` }} />
            </div>
          )}
        </div>

        <div className="ag-stock-cinta" data-atencion={resumen.sinMinimo > 0}>
          <span className="ag-stock-cinta-rotulo">Sin mínimo definido</span>
          <span className="ag-stock-cinta-valor">{resumen.sinMinimo}</span>
          <span className="ag-stock-cinta-pie">
            {resumen.sinMinimo > 0
              ? 'Hasta que tengan mínimo no se puede avisar que faltan'
              : 'Todos los insumos se pueden medir'}
          </span>
        </div>

        <div className="ag-stock-cinta" data-atencion={resumen.bajos > 0}>
          <span className="ag-stock-cinta-rotulo">Bajo mínimo</span>
          <span className="ag-stock-cinta-valor">{resumen.bajos}</span>
          <span className="ag-stock-cinta-pie">
            {resumen.bajos > 0 ? 'Ordenados arriba de todo' : 'Nada por reponer'}
          </span>
        </div>
      </div>

      <div className="ag-stock-cuerpo">
        <div className="ag-stock-lista">
          <div className="ag-stock-filtros">
            <button
              type="button" className="ag-stock-filtro"
              aria-pressed={categoria === 'todos'} onClick={() => setCategoria('todos')}
            >Todos</button>
            <button
              type="button" className="ag-stock-filtro"
              aria-pressed={categoria === 'bajo'} onClick={() => setCategoria('bajo')}
            >Bajo</button>
            {categorias.map(c => (
              <button
                key={c} type="button" className="ag-stock-filtro"
                aria-pressed={categoria === c} onClick={() => setCategoria(c)}
              >{c}</button>
            ))}
            {/* El nombre accesible va en aria-label y no en un <span> oculto:
                este sistema no tiene clase de solo-lectores, asi que el span
                se veia como un titulo gigante al lado del campo. */}
            <div className="ag-stock-buscador">
              <input
                type="search"
                value={busqueda}
                aria-label="Buscar insumo"
                placeholder="Buscar insumo..."
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          <div className="ag-stock-tabla" role="table" aria-label="Insumos">
            <div className="ag-stock-encabezado" role="row">
              <span>Insumo</span>
              <span>Disponible</span>
              <span>Nivel vs mínimo</span>
              <span>Valor</span>
            </div>

            {visibles.length === 0 ? (
              <p className="ag-stock-vacio">
                {insumos.length === 0
                  ? 'Todavía no hay insumos cargados.'
                  : 'Ningún insumo coincide con este filtro.'}
              </p>
            ) : visibles.map(ing => (
              <Fila
                key={ing.id}
                ing={ing}
                consumo={consumos.get(ing.id)}
                seleccionado={ing.id === seleccionadoId}
                onSeleccionar={(i) => setSeleccionadoId(i.id)}
                onDefinirMinimo={definirMinimo}
              />
            ))}
          </div>

          {visibles.length > 0 && (
            <div className="ag-stock-pie">
              <span>Mostrando {visibles.length} de {insumos.length} insumos</span>
            </div>
          )}
        </div>

        <Ficha
          key={seleccionado?.id || 'sin-seleccion'}
          ing={seleccionado}
          consumo={seleccionado ? consumos.get(seleccionado.id) : null}
          proveedor={seleccionado?.supplier_id ? porProveedor.get(seleccionado.supplier_id) : null}
          onReponer={reponer}
          onAjustar={ajustar}
          onMerma={merma}
          onEditar={onEditarInsumo}
        />
      </div>
    </section>
  );
}
