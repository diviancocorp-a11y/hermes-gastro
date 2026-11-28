// src/components/admin/platform/PlantillaEditor.jsx
// Editor de marca de la plantilla del catalogo, para el DUENIO. El borrador es
// la misma forma que `catalog_template_config`; la logica (limpiar, validar,
// contraste, rechazo del servidor) vive en lib/plantillaEditor.js.
// La vista previa renderiza la plantilla real fuera del admin (cp-root esta
// prohibido aca): ver catalog-pro/plantillas/VistaPreviaPlantilla.jsx.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PLANTILLAS, PLANTILLAS_EXCLUSIVAS, SECCION_IDS, FUENTES, RADIOS, TEXTO_KEYS,
} from '../../../lib/plantillaListas';
import {
  avisosDeContraste, borradorAConfig, configsIguales, mensajeDeServidor, validarBorrador,
} from '../../../lib/plantillaEditor';
import { TEMAS_BASE } from '../../../catalog-pro/plantillas/marcaATokens';
import ImagePicker from './ImagePicker';
import './plantilla-editor.css';


const PLANTILLA_INFO = {
  default: { nombre: 'Clásica', texto: 'El catálogo de siempre, con los colores de tu tema.' },
  pop: { nombre: 'Pop', texto: 'Portada con héroe, cinta, favoritos y banda. Usa toda tu marca.' },
  cochi: { nombre: 'Cochi (exclusiva)', texto: 'La portada hecha a medida para Cochi.' },
};
const SECCION_NOMBRE = {
  hero: 'Portada', cinta: 'Cinta de frases', favoritos: 'Favoritos', flyers: 'Flyers y promos', menu: 'Menú',
  submarca: 'Submarca', banda: 'Banda', testimonios: 'Testimonios', historia: 'Historia',
};
const COLORES = [
  ['primario', 'Color principal', 'Botones, precios y detalles.'],
  ['fondo', 'Fondo', 'Color de fondo del catálogo.'],
  ['texto', 'Texto', 'Color de los títulos y párrafos.'],
  ['acento2', 'Acento secundario', 'Bandas y etiquetas de apoyo.'],
];
const RADIO_NOMBRE = { recto: 'Recto', suave: 'Suave', pildora: 'Píldora' };
const GRUPOS_TEXTO = [
  ['hero', 'Portada'], ['intro', 'Entrada'], ['favoritos', 'Favoritos'], ['flyers', 'Flyers'], ['menu', 'Menú'],
  ['banda', 'Banda'], ['testimonios', 'Testimonios'], ['historia', 'Historia'],
];
const TEXTO_NOMBRE = {
  eyebrow: 'Antetítulo', titulo: 'Título', lead: 'Bajada', cta: 'Texto del botón', nota: 'Nota', sello: 'Sello',
  caption: 'Leyenda', aside: 'Texto aparte', texto: 'Texto',
};
const LARGOS = new Set(['hero_lead', 'menu_lead', 'banda_texto', 'historia_texto']);
const MAX_TEXTO = 400;
const MAX_FRASE = 80;
const HEX = /^#[0-9a-fA-F]{6}$/;

const etiquetaTexto = (k) => TEXTO_NOMBRE[k.split('_').slice(1).join('_')] || k;
const setIn = (obj, ruta, valor) => {
  const [k, ...resto] = ruta;
  const copia = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  copia[k] = resto.length ? setIn(copia[k], resto, valor) : valor;
  return copia;
};

/** Solo los colores bien formados entran al calculo de contraste. */
function soloHexValidos(marca) {
  const m = { ...(marca || {}) };
  for (const k of ['primario', 'fondo', 'texto', 'acento2']) if (m[k] && !HEX.test(m[k])) delete m[k];
  return m;
}

/** Campo con etiqueta, contador, ayuda y error enlazados por aria-describedby. */
function Campo({ id, label, value, onChange, error, max, area, type = 'text', ayuda, placeholder, list }) {
  const ids = [error && `${id}-err`, ayuda && `${id}-ayuda`].filter(Boolean).join(' ') || undefined;
  const Tag = area ? 'textarea' : 'input';
  const largo = (value || '').length;
  return (
    <div className="pe-campo">
      <label htmlFor={id} className="pe-label">{label}</label>
      <Tag
        id={id} className={`pe-input ${area ? 'pe-area' : ''} ${error ? 'is-error' : ''}`}
        type={area ? undefined : type} value={value || ''} placeholder={placeholder} list={list}
        rows={area ? 3 : undefined} aria-invalid={error ? 'true' : undefined} aria-describedby={ids}
        onChange={(e) => onChange(e.target.value)}
      />
      {max && <span className={`pe-contador ${largo > max ? 'is-error' : ''}`} aria-hidden="true">{largo}/{max}</span>}
      {ayuda && <span id={`${id}-ayuda`} className="pe-ayuda">{ayuda}</span>}
      {error && <span id={`${id}-err`} className="pe-error"><span className="pe-sr">Error: </span>{error}</span>}
    </div>
  );
}

function CampoColor({ id, label, ayuda, value, onChange, error, avisos, vacio, sinValor }) {
  const ok = HEX.test(value || '');
  const ids = [error && `${id}-err`, avisos.length > 0 && `${id}-aviso`, `${id}-ayuda`].filter(Boolean).join(' ');
  return (
    <div className="pe-campo">
      <label htmlFor={id} className="pe-label">{label}</label>
      <div className="pe-color">
        <input
          type="color" className="pe-color__muestra" aria-label={`${label}: elegir color, ahora ${ok ? value : sinValor || vacio}`}
          value={ok ? value.toLowerCase() : vacio.toLowerCase()} onChange={(e) => onChange(e.target.value)}
        />
        <input
          id={id} className={`pe-input pe-input--mono ${error ? 'is-error' : ''}`} value={value || ''} maxLength={7}
          placeholder={sinValor || `${vacio} (del tema)`} spellCheck="false" autoCapitalize="none"
          aria-invalid={error ? 'true' : undefined} aria-describedby={ids}
          onChange={(e) => onChange(e.target.value.trim())}
        />
      </div>
      <span id={`${id}-ayuda`} className="pe-ayuda">{ayuda}</span>
      {error && <span id={`${id}-err`} className="pe-error"><span className="pe-sr">Error: </span>{error}</span>}
      {avisos.length > 0 && (
        <ul id={`${id}-aviso`} className="pe-avisos">
          {avisos.map((a) => <li key={a.mensaje}><strong>Contraste bajo.</strong> {a.mensaje}</li>)}
        </ul>
      )}
    </div>
  );
}

function Selector({ id, label, value, onChange, opciones, nombres = {}, vacio }) {
  return (
    <div className="pe-campo">
      <label htmlFor={id} className="pe-label">{label}</label>
      <select id={id} className="pe-input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{vacio}</option>
        {opciones.map((o) => <option key={o} value={o}>{nombres[o] || o}</option>)}
      </select>
    </div>
  );
}

function Seccion({ titulo, ayuda, children, id }) {
  return (
    <section className="pe-seccion" aria-labelledby={id}>
      <h3 id={id} className="pe-seccion__titulo">{titulo}</h3>
      {ayuda && <p className="pe-seccion__ayuda">{ayuda}</p>}
      {children}
    </section>
  );
}

// Una plantilla exclusiva solo se ofrece (y se respeta) en el tenant al que pertenece.
const disponibleEn = (p, slug) => !PLANTILLAS_EXCLUSIVAS[p] || PLANTILLAS_EXCLUSIVAS[p] === slug;

const baseDe = (settings, slug) => ({
  plantilla: PLANTILLAS.includes(settings?.catalog_template) && disponibleEn(settings.catalog_template, slug) ? settings.catalog_template : 'default',
  config: borradorAConfig(settings?.catalog_template_config || {}),
});

export default function PlantillaEditor({
  settings, onSave, onSubirImagen, showToast, onBack, productos = [], cargando = false, tenantSlug = null,
}) {
  const uid = useId().replace(/:/g, '');
  const [base, setBase] = useState(() => baseDe(settings, tenantSlug));
  const [plantilla, setPlantilla] = useState(base.plantilla);
  const [borrador, setBorrador] = useState(base.config);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');
  const [vistaAbierta, setVistaAbierta] = useState(false);
  const [ultimaValida, setUltimaValida] = useState(base.config);
  const [claseModal, setClaseModal] = useState('ag-root');
  const botonVista = useRef(null);
  const botonCerrar = useRef(null);
  const raiz = useRef(null);
  const [anchoDesktop, setAnchoDesktop] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 1024px)').matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-width: 1024px)');
    const alCambiar = (ev) => setAnchoDesktop(ev.matches);
    mq.addEventListener?.('change', alCambiar);
    return () => mq.removeEventListener?.('change', alCambiar);
  }, []);
  // Modal: foco al boton de cerrar, Escape cierra y el foco vuelve al boton que lo abrio.
  useEffect(() => {
    if (!vistaAbierta) return undefined;
    botonCerrar.current?.focus();
    const tecla = (ev) => { if (ev.key === 'Escape') setVistaAbierta(false); };
    document.addEventListener('keydown', tecla);
    const volver = botonVista.current;
    return () => { document.removeEventListener('keydown', tecla); volver?.focus(); };
  }, [vistaAbierta]);
  // El portal sale del arbol del panel (el transform de .ag-subpage rompe position:fixed): hereda los tokens por clase.
  const claseTema = () => {
    const ancestro = raiz.current?.closest('.ag-root');
    const temas = (ancestro?.className || '').split(/s+/).filter((c) => c.startsWith('ag-theme'));
    return ['ag-root', ...temas].join(' ');
  };

  const tema = TEMAS_BASE[settings?.catalog_theme] ? settings.catalog_theme : 'ambar';
  const validacion = useMemo(() => validarBorrador(borrador), [borrador]);
  const { errores } = validacion;
  const avisos = useMemo(() => avisosDeContraste(soloHexValidos(borrador.marca), tema), [borrador.marca, tema]);
  const hayCambios = plantilla !== base.plantilla || !configsIguales(borrador, base.config);
  const cantidadErrores = Object.keys(errores).length;

  // Cada edicion limpia el rechazo anterior y, si el borrador sigue valido, lo recuerda para la vista previa.
  const poner = useCallback((ruta, valor) => {
    setErrorServidor('');
    setBorrador((b) => {
      const sig = setIn(b, ruta, valor);
      const v = validarBorrador(sig);
      if (v.ok) setUltimaValida(v.config);
      return sig;
    });
  }, []);
  const subir = (tipo) => (file) => onSubirImagen?.(file, tipo);
  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.catalog_attributes?.category || p.category).filter(Boolean))],
    [productos],
  );

  // Secciones: lo guardado y, al final, lo que falta (el catalogo las trata como encendidas).
  const secciones = useMemo(() => {
    const guardadas = (borrador.secciones || []).filter((s) => SECCION_IDS.includes(s.id));
    const vistos = new Set(guardadas.map((s) => s.id));
    return [...guardadas, ...SECCION_IDS.filter((id) => !vistos.has(id)).map((id) => ({ id, on: true }))];
  }, [borrador.secciones]);
  const moverSeccion = (i, d) => {
    const copia = [...secciones];
    const j = i + d;
    if (j < 0 || j >= copia.length) return;
    [copia[i], copia[j]] = [copia[j], copia[i]];
    poner(['secciones'], copia);
  };
  const alternarSeccion = (i) => poner(['secciones'], secciones.map((s, k) => (k === i ? { ...s, on: s.on === false } : s)));

  const lista = (clave) => borrador[clave] || [];
  const editarLista = (clave, i, v) => poner([clave], lista(clave).map((x, k) => (k === i ? v : x)));
  const quitarDeLista = (clave, i) => poner([clave], lista(clave).filter((_, k) => k !== i));

  const guardar = async () => {
    if (!validacion.ok || guardando || !hayCambios) return;
    setGuardando(true);
    setErrorServidor('');
    let r = null;
    try {
      r = await onSave({ catalog_template: plantilla, catalog_template_config: borradorAConfig(borrador) });
    } catch (err) { r = { __error: err?.message || '' }; }
    setGuardando(false);
    if (!r || r.__error) {
      setErrorServidor(mensajeDeServidor(r?.__error || r?.message || ''));
      return;
    }
    setBase({ plantilla, config: borradorAConfig(borrador) });
    showToast?.('Plantilla guardada');
  };

  const configVista = ultimaValida;
  const settingsVista = useMemo(
    () => ({ ...settings, catalog_template: plantilla, catalog_template_config: configVista }),
    [settings, plantilla, configVista],
  );
  // Iframe del mismo origen: los @media y vw de la plantilla miden 390 px reales.
  const iframeRef = useRef(null);
  const estadoVista = useMemo(
    () => ({ tipo: 'plantilla-vista', settings: settingsVista, config: configVista, products: productos }),
    [settingsVista, configVista, productos],
  );
  const enviarEstado = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(estadoVista, window.location.origin);
  }, [estadoVista]);
  useEffect(() => { enviarEstado(); }, [enviarEstado, vistaAbierta, anchoDesktop]);
  useEffect(() => {
    const alRecibir = (ev) => {
      if (ev.origin !== window.location.origin || ev.data?.tipo !== 'plantilla-vista-lista') return;
      if (ev.source && ev.source !== iframeRef.current?.contentWindow) return;
      enviarEstado();
    };
    window.addEventListener('message', alRecibir);
    return () => window.removeEventListener('message', alRecibir);
  }, [enviarEstado]);
  const vista = (
    <iframe
      ref={iframeRef} className="vp-iframe" title="Vista previa a 390 px" src="/admin/vista-previa-plantilla"
      width="390" sandbox="allow-same-origin allow-scripts" onLoad={enviarEstado}
    />
  );
  const avisoVista = !validacion.ok && (
    <p className="pe-vista__aviso" role="status">
      Hay campos con errores: la vista previa muestra la última versión válida.
    </p>
  );
  const err = (ruta) => errores[ruta];
  const idc = (s) => `${uid}-${s}`;

  if (cargando) return <div className="pe-root pe-estado" role="status">Cargando plantilla…</div>;

  return (
    <div className="pe-root" ref={raiz}>
      <header className="pe-cabecera">
        {onBack && (
          <button type="button" className="pe-volver" onClick={onBack} aria-label="Volver">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        <h2 className="pe-titulo">Plantilla del catálogo</h2>
        <button type="button" className="pe-btn pe-btn--suave pe-ver-vista" ref={botonVista} onClick={() => { setClaseModal(claseTema()); setVistaAbierta(true); }}>Ver vista previa</button>
      </header>

      <div className="pe-layout">
        <form className="pe-form" inert={vistaAbierta || undefined} onSubmit={(ev) => { ev.preventDefault(); guardar(); }} noValidate>
          <Seccion id={idc('pl')} titulo="Plantilla" ayuda="Podés cambiar de plantilla sin perder lo que cargaste: la marca queda guardada.">
            <div role="radiogroup" aria-labelledby={idc('pl')} className="pe-tarjetas">
              {PLANTILLAS.filter((p) => disponibleEn(p, tenantSlug)).map((p) => (
                <label key={p} className={`pe-tarjeta ${plantilla === p ? 'is-activa' : ''}`}>
                  <input type="radio" name={idc('plantilla')} value={p} checked={plantilla === p} onChange={() => { setErrorServidor(''); setPlantilla(p); }} />
                  <span className="pe-tarjeta__nombre">{PLANTILLA_INFO[p].nombre}</span>
                  <span className="pe-tarjeta__texto">{PLANTILLA_INFO[p].texto}</span>
                  <span className="pe-tarjeta__estado">{plantilla === p ? 'Elegida' : 'Elegir'}</span>
                </label>
              ))}
            </div>
          </Seccion>

          <Seccion id={idc('ma')} titulo="Marca">
            {COLORES.map(([k, label, ayuda]) => (
              <CampoColor
                key={k} id={idc(`c-${k}`)} label={label} ayuda={ayuda} value={borrador.marca?.[k]}
                vacio={{ primario: TEMAS_BASE[tema].ac, fondo: TEMAS_BASE[tema].bg, texto: TEMAS_BASE[tema].tx, acento2: TEMAS_BASE[tema].bg }[k]}
                sinValor={k === 'acento2' ? 'Sin acento' : undefined}
                onChange={(v) => poner(['marca', k], v)} error={err(`marca.${k}`)}
                avisos={avisos.filter((a) => a.campo === `marca.${k}`)}
              />
            ))}
            <div className="pe-fila">
              <Selector id={idc('ft')} label="Fuente de los títulos" value={borrador.marca?.fuente_titulo} opciones={FUENTES} vacio="La del tema" onChange={(v) => poner(['marca', 'fuente_titulo'], v)} />
              <Selector id={idc('fx')} label="Fuente de los textos" value={borrador.marca?.fuente_texto} opciones={FUENTES} vacio="La del tema" onChange={(v) => poner(['marca', 'fuente_texto'], v)} />
              <Selector id={idc('rd')} label="Bordes" value={borrador.marca?.radio} opciones={RADIOS} nombres={RADIO_NOMBRE} vacio="Los del tema" onChange={(v) => poner(['marca', 'radio'], v)} />
            </div>
            {[['logo_header', 'Logo del encabezado', 'logo'], ['logo_footer', 'Logo del pie', 'logo'], ['isotipo', 'Isotipo (entrada animada)', 'isotipo']].map(([k, label, tipo]) => (
              <div key={k}>
                <ImagePicker label={label} value={borrador.marca?.[k]} onChange={(v) => poner(['marca', k], v)} onSubir={subir(tipo)} />
                {err(`marca.${k}`) && <span className="pe-error"><span className="pe-sr">Error: </span>{err(`marca.${k}`)}</span>}
              </div>
            ))}
          </Seccion>

          <Seccion id={idc('tx')} titulo="Textos" ayuda={`Cada texto admite hasta ${MAX_TEXTO} caracteres. Lo que dejes vacío usa el texto neutro de la plantilla.`}>
            {GRUPOS_TEXTO.map(([g, nombre]) => {
              const claves = TEXTO_KEYS.filter((k) => k.startsWith(`${g}_`) && k !== 'banda_imagen');
              if (!claves.length) return null;
              return (
                <fieldset key={g} className="pe-grupo">
                  <legend className="pe-grupo__titulo">{nombre}</legend>
                  {claves.map((k) => (
                    <Campo
                      key={k} id={idc(k)} label={etiquetaTexto(k)} area={LARGOS.has(k)} max={MAX_TEXTO}
                      value={borrador.textos?.[k]} error={err(`textos.${k}`)} onChange={(v) => poner(['textos', k], v)}
                    />
                  ))}
                </fieldset>
              );
            })}
            {[['anuncios', 'Anuncios de la barra superior'], ['cinta', 'Frases de la cinta']].map(([clave, nombre]) => (
              <fieldset key={clave} className="pe-grupo">
                <legend className="pe-grupo__titulo">{nombre}</legend>
                {lista(clave).map((f, i) => (
                  <div key={i} className="pe-item">
                    <Campo
                      id={idc(`${clave}${i}`)} label={`Frase ${i + 1}`} value={f} max={MAX_FRASE}
                      error={err(`${clave}.${i}`)} onChange={(v) => editarLista(clave, i, v)}
                    />
                    <button type="button" className="pe-btn pe-btn--suave" onClick={() => quitarDeLista(clave, i)} aria-label={`Quitar frase ${i + 1} de ${nombre.toLowerCase()}`}>Quitar</button>
                  </div>
                ))}
                <button type="button" className="pe-btn pe-btn--suave" disabled={lista(clave).length >= 12} onClick={() => poner([clave], [...lista(clave), ''])}>
                  Agregar frase{lista(clave).length >= 12 ? ' (máximo 12)' : ''}
                </button>
              </fieldset>
            ))}
          </Seccion>

          <Seccion id={idc('im')} titulo="Imágenes" ayuda="Se suben a tu espacio. Hasta 8 flyers; los vencidos o apagados no se muestran.">
            <div>
              <ImagePicker label="Imagen de la banda" value={borrador.textos?.banda_imagen} onChange={(v) => poner(['textos', 'banda_imagen'], v)} onSubir={subir('banda')} />
              {err('textos.banda_imagen') && <span className="pe-error"><span className="pe-sr">Error: </span>{err('textos.banda_imagen')}</span>}
            </div>
            {lista('flyers').map((f, i) => (
              <fieldset key={i} className="pe-grupo">
                <legend className="pe-grupo__titulo">Flyer {i + 1}</legend>
                <Campo id={idc(`f${i}t`)} label="Título" value={f.titulo} max={MAX_TEXTO} error={err(`flyers.${i}.titulo`)} onChange={(v) => poner(['flyers', i, 'titulo'], v)} />
                <Campo id={idc(`f${i}x`)} label="Texto" area value={f.texto} max={MAX_TEXTO} error={err(`flyers.${i}.texto`)} onChange={(v) => poner(['flyers', i, 'texto'], v)} />
                <ImagePicker label="Imagen" value={f.imagen} onChange={(v) => poner(['flyers', i, 'imagen'], v)} onSubir={subir('flyer')} />
                {err(`flyers.${i}.imagen`) && <span className="pe-error"><span className="pe-sr">Error: </span>{err(`flyers.${i}.imagen`)}</span>}
                <div className="pe-fila">
                  <Campo id={idc(`f${i}b`)} label="Etiqueta" value={f.badge} error={err(`flyers.${i}.badge`)} onChange={(v) => poner(['flyers', i, 'badge'], v)} />
                  <Campo id={idc(`f${i}l`)} label="Enlace" value={f.link} error={err(`flyers.${i}.link`)} onChange={(v) => poner(['flyers', i, 'link'], v)} />
                </div>
                <div className="pe-fila">
                  <Campo id={idc(`f${i}d`)} label="Desde" type="date" value={f.desde} error={err(`flyers.${i}.desde`)} onChange={(v) => poner(['flyers', i, 'desde'], v)} />
                  <Campo id={idc(`f${i}h`)} label="Hasta" type="date" value={f.hasta} error={err(`flyers.${i}.hasta`)} onChange={(v) => poner(['flyers', i, 'hasta'], v)} />
                </div>
                <label className="pe-check">
                  <input type="checkbox" checked={f.activo !== false} onChange={(ev) => poner(['flyers', i, 'activo'], ev.target.checked)} />
                  <span>Mostrar este flyer</span>
                </label>
                <button type="button" className="pe-btn pe-btn--suave" onClick={() => quitarDeLista('flyers', i)}>Quitar flyer {i + 1}</button>
              </fieldset>
            ))}
            <button type="button" className="pe-btn pe-btn--suave" disabled={lista('flyers').length >= 8} onClick={() => poner(['flyers'], [...lista('flyers'), { activo: true }])}>
              Agregar flyer{lista('flyers').length >= 8 ? ' (máximo 8)' : ''}
            </button>
          </Seccion>

          <Seccion id={idc('se')} titulo="Secciones" ayuda="El orden de esta lista es el de la pantalla. El menú no se puede apagar.">
            <ol className="pe-secciones">
              {secciones.map((s, i) => {
                const nombre = SECCION_NOMBRE[s.id] || s.id;
                return (
                  <li key={s.id} className="pe-seccion-item">
                    <label className="pe-check pe-check--sec">
                      <input type="checkbox" role="switch" checked={s.on !== false} disabled={s.id === 'menu'} onChange={() => alternarSeccion(i)} aria-label={`Mostrar ${nombre}`} />
                      <span>{nombre}</span>
                    </label>
                    <button type="button" className="pe-icono" disabled={i === 0} onClick={() => moverSeccion(i, -1)} aria-label={`Subir ${nombre}`}>↑</button>
                    <button type="button" className="pe-icono" disabled={i === secciones.length - 1} onClick={() => moverSeccion(i, 1)} aria-label={`Bajar ${nombre}`}>↓</button>
                  </li>
                );
              })}
            </ol>
          </Seccion>

          <details className="pe-mas">
            <summary className="pe-mas__titulo">Más: entrada, submarca y testimonios</summary>
            <label className="pe-check">
              <input type="checkbox" checked={borrador.intro !== false} onChange={(ev) => poner(['intro'], ev.target.checked)} />
              <span>Entrada animada con el isotipo</span>
            </label>
            <fieldset className="pe-grupo">
              <legend className="pe-grupo__titulo">Submarca</legend>
              {[['nombre', 'Nombre'], ['categoria', 'Categoría de productos'], ['eyebrow', 'Antetítulo'], ['titulo', 'Título'], ['texto', 'Texto']].map(([k, label]) => (
                <Campo
                  key={k} id={idc(`s-${k}`)} label={label} area={k === 'texto'} list={k === 'categoria' ? idc('cats') : undefined}
                  value={borrador.submarca?.[k]} error={err(`submarca.${k}`)} onChange={(v) => poner(['submarca', k], v)}
                />
              ))}
              <datalist id={idc('cats')}>{categorias.map((c) => <option key={c} value={c} />)}</datalist>
              <div className="pe-fila">
                <Campo id={idc('s-fondo')} label="Color de fondo" value={borrador.submarca?.fondo} placeholder="#RRGGBB" error={err('submarca.fondo')} onChange={(v) => poner(['submarca', 'fondo'], v.trim())} />
                <Campo id={idc('s-color')} label="Color del texto" value={borrador.submarca?.color} placeholder="#RRGGBB" error={err('submarca.color')} onChange={(v) => poner(['submarca', 'color'], v.trim())} />
              </div>
              <ImagePicker label="Logo de la submarca" value={borrador.submarca?.logo} onChange={(v) => poner(['submarca', 'logo'], v)} onSubir={subir('logo')} />
              <ImagePicker label="Isotipo de la submarca" value={borrador.submarca?.isotipo} onChange={(v) => poner(['submarca', 'isotipo'], v)} onSubir={subir('isotipo')} />
            </fieldset>
            <fieldset className="pe-grupo">
              <legend className="pe-grupo__titulo">Testimonios</legend>
              {lista('testimonios').map((q, i) => (
                <div key={i} className="pe-item pe-item--col">
                  <Campo id={idc(`q${i}t`)} label={`Testimonio ${i + 1}`} area value={q.texto} max={MAX_TEXTO} error={err(`testimonios.${i}.texto`)} onChange={(v) => poner(['testimonios', i, 'texto'], v)} />
                  <Campo id={idc(`q${i}n`)} label="Nombre" value={q.nombre} error={err(`testimonios.${i}.nombre`)} onChange={(v) => poner(['testimonios', i, 'nombre'], v)} />
                  <button type="button" className="pe-btn pe-btn--suave" onClick={() => quitarDeLista('testimonios', i)}>Quitar testimonio {i + 1}</button>
                </div>
              ))}
              <button type="button" className="pe-btn pe-btn--suave" disabled={lista('testimonios').length >= 8} onClick={() => poner(['testimonios'], [...lista('testimonios'), {}])}>
                Agregar testimonio{lista('testimonios').length >= 8 ? ' (máximo 8)' : ''}
              </button>
            </fieldset>
          </details>

          <div className="pe-barra">
            {errorServidor && <p className="pe-error pe-error--servidor" role="alert"><span className="pe-sr">Error: </span>{errorServidor}</p>}
            {cantidadErrores > 0 && <p className="pe-error" role="status"><span className="pe-sr">Error: </span>Corregí {cantidadErrores} {cantidadErrores === 1 ? 'campo' : 'campos'} para poder guardar.</p>}
            <button type="submit" className="ag-btn-primary pe-guardar" disabled={!hayCambios || cantidadErrores > 0 || guardando}>
              {guardando ? 'Guardando…' : hayCambios ? 'Guardar cambios' : 'Sin cambios'}
            </button>
          </div>
        </form>

        {anchoDesktop && (
          <aside className="pe-vista" aria-label="Vista previa">
            <h3 className="pe-vista__titulo">Vista previa</h3>
            {avisoVista}
            {vista}
          </aside>
        )}
      </div>

      {vistaAbierta && !anchoDesktop && createPortal(
        <div className={claseModal}>
          <div className="pe-modal" role="dialog" aria-modal="true" aria-label="Vista previa del catálogo">
            <button type="button" ref={botonCerrar} className="pe-btn pe-btn--suave" onClick={() => setVistaAbierta(false)}>Cerrar vista previa</button>
            {avisoVista}
            {vista}
          </div>
        </div>,
        document.body,
      )}

    </div>
  );
}
