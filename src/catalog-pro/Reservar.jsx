// src/catalog-pro/Reservar.jsx
// Reserva online de turnos: lo que ve una clienta (sin cuenta) en /reservar.
//
// Una sola pagina con pasos visibles. Cada paso aparece cuando el anterior
// esta resuelto, pero los de arriba siguen ahi y se pueden cambiar sin perder
// lo cargado (todo vive en el estado de esta pantalla).
//
// El servidor decide el monto de la sena, el traslado y si el horario sigue
// libre: aca solo se muestra lo que devuelve, nunca se calcula.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBookingInfo, fetchPublicSlots, createBooking } from '../services/publicBooking';
import { quienHace, linkWhatsApp } from '../modules/agenda';
import { fmtAR } from './format';
import Icon from './Icon';
import ReservarMarco from './ReservarMarco';
import ReservarHorarios from './ReservarHorarios';
import {
  hoyEnZona, paginaDeDias, listaDeDias, horariosDelDia, diasConLugar, partesEnZona,
  formatearDuracion, etiquetaLarga, telefonoValido, correoValido,
} from './reservarHelpers';

const TEXTO_WA = 'Hola! Quiero reservar un turno.';

function Aviso({ icono = 'clock', tono, children, rol }) {
  return (
    <div className={`rv-note${tono ? ` rv-note--${tono}` : ''}`} role={rol}>
      <Icon name={icono} size={18} />
      <div>{children}</div>
    </div>
  );
}

function BotonWhatsApp({ telefono }) {
  const href = linkWhatsApp(telefono, TEXTO_WA);
  if (!href) return null;
  return (
    <a className="rv-btn rv-btn--ghost" href={href} target="_blank" rel="noopener noreferrer">
      Escribir por WhatsApp
    </a>
  );
}

function Opcion({ tipo = 'radio', name, checked, onChange, children, value }) {
  return (
    <label className="rv-opt">
      <input type={tipo} name={name} value={value} checked={checked} onChange={onChange} />
      <span className="rv-opt-body">{children}</span>
      <span className="rv-tick" aria-hidden="true"><Icon name="check" size={14} stroke={2.2} /></span>
    </label>
  );
}

function Campo({ id, etiqueta, nota, error, children }) {
  return (
    <div className="rv-field">
      <label className="rv-label" htmlFor={id}>{etiqueta} {nota && <small>({nota})</small>}</label>
      {children}
      {error && (
        <p className="rv-error" id={`${id}-err`} role="alert">
          <Icon name="x" size={14} /> {error}
        </p>
      )}
    </div>
  );
}

export default function Reservar() {
  const navigate = useNavigate();

  // ── Datos del negocio ──
  const [info, setInfo] = useState(null);
  const [infoError, setInfoError] = useState(null);
  const [cargandoInfo, setCargandoInfo] = useState(true);
  const [reintentoInfo, setReintentoInfo] = useState(0);

  useEffect(() => {
    let vivo = true;
    fetchBookingInfo().then(r => {
      if (!vivo) return;
      if (r?.ok) { setInfo(r); setInfoError(null); } else setInfoError(r?.error || 'No pudimos cargar el negocio.');
      setCargandoInfo(false);
    });
    return () => { vivo = false; };
  }, [reintentoInfo]);

  // ── Lo que la clienta eligio ──
  const [servicioId, setServicioId] = useState(null);
  const [kindElegido, setKindElegido] = useState(null);
  const [zoneId, setZoneId] = useState('');
  const [direccion, setDireccion] = useState('');
  const [staffId, setStaffId] = useState('');
  const [diaElegido, setDia] = useState(null);
  const [slot, setSlot] = useState(null);
  const [datos, setDatos] = useState({ nombre: '', telefono: '', email: '', notas: '' });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [aviso, setAviso] = useState(null);
  const enviandoRef = useRef(false);
  const datosRef = useRef(null);
  const avisoRef = useRef(null);

  // ── Derivados ──
  const negocio = info?.negocio || {};
  const reglas = info?.reglas || {};
  const zonas = info?.zonas || [];
  const staff = useMemo(() => info?.staff || [], [info]);
  const tz = negocio.timezone;
  const servicios = useMemo(() => info?.servicios || [], [info]);
  const servicio = servicios.find(s => s.id === servicioId) || null;
  const kinds = [reglas.offers_local && 'local', reglas.offers_home && 'home'].filter(Boolean);
  const kind = kinds.length === 1 ? kinds[0] : kindElegido;
  const requiereZona = kind === 'home' && zonas.length > 0;
  const dondeListo = !!kind && (!requiereZona || !!zoneId);
  const opcionesStaff = useMemo(
    () => (servicio ? quienHace(servicio.id, staff, info?.relaciones || []) : []),
    [servicio, staff, info],
  );
  const staffFijo = opcionesStaff.length === 1 ? opcionesStaff[0].id : null;
  const staffPedido = staffFijo || staffId || null;
  const hoy = useMemo(() => hoyEnZona(tz), [tz]);
  const maxDias = Number(reglas.max_advance_days) || 30;
  const deposito = Number(servicio?.deposit_amount) || 0;
  const senaBloqueada = !!(info?.sena?.activa && !info?.sena?.disponible);
  const listoParaHorarios = !!(servicio && dondeListo && opcionesStaff.length > 0);
  const zonaDelPedido = kind === 'home' ? (zoneId || null) : null;
  const ctx = [servicioId, staffPedido || 'any', kind, zonaDelPedido || ''].join('|');

  // ── Horarios: de a 14 dias, con cache por contexto ──
  const [cache, setCache] = useState({});
  const [paginas, setPaginas] = useState(1);
  const [version, setVersion] = useState(0);
  const pedidos = useRef(new Set());

  useEffect(() => {
    if (!listoParaHorarios) return;
    for (let p = 0; p < paginas; p += 1) {
      const rango = paginaDeDias(hoy, p, maxDias);
      if (!rango) break;
      const clave = `${ctx}|${p}|${version}`;
      if (pedidos.current.has(clave)) continue;
      pedidos.current.add(clave);
      setCache(c => ({ ...c, [clave]: { estado: 'cargando' } }));
      fetchPublicSlots({
        serviceId: servicioId, desde: rango.desde, hasta: rango.hasta,
        staffId: staffPedido, locationKind: kind, zoneId: zonaDelPedido,
      }).then(r => {
        if (!r?.ok) pedidos.current.delete(clave);
        setCache(c => ({
          ...c,
          [clave]: r?.ok ? { estado: 'ok', slots: r.slots || [] } : { estado: 'error', error: r?.error },
        }));
      });
    }
  }, [listoParaHorarios, paginas, ctx, version, hoy, maxDias, servicioId, staffPedido, kind, zonaDelPedido]);

  const paginasVistas = useMemo(() => {
    const out = [];
    for (let p = 0; p < paginas; p += 1) {
      const rango = paginaDeDias(hoy, p, maxDias);
      if (!rango) break;
      out.push({ p, rango, entrada: cache[`${ctx}|${p}|${version}`] || { estado: 'cargando' } });
    }
    return out;
  }, [paginas, hoy, maxDias, cache, ctx, version]);

  const todosLosSlots = useMemo(
    () => paginasVistas.flatMap(x => (x.entrada.estado === 'ok' ? x.entrada.slots : [])),
    [paginasVistas],
  );
  const diasLugar = useMemo(() => diasConLugar(todosLosSlots, tz), [todosLosSlots, tz]);

  const dias = useMemo(() => paginasVistas.flatMap(({ rango, entrada }) =>
    listaDeDias(rango.desde, rango.hasta).map(d => ({
      dia: d,
      estado: entrada.estado === 'ok' ? (diasLugar.has(d) ? 'lugar' : 'sin') : 'cargando',
    }))), [paginasVistas, diasLugar]);

  // Mientras no elija un dia, se muestra el primero que tenga lugar.
  const primerDiaConLugar = dias.find(d => d.estado === 'lugar')?.dia || null;
  const dia = diaElegido || (listoParaHorarios ? primerDiaConLugar : null);
  const hayError = paginasVistas.some(x => x.entrada.estado === 'error');
  const paginaDelDia = dia ? paginasVistas.find(x => dia >= x.rango.desde && dia <= x.rango.hasta) : null;
  const estadoHorarios = hayError ? 'error'
    : (dia ? (paginaDelDia?.entrada.estado === 'ok' ? 'ok' : 'cargando')
      : (paginasVistas.every(x => x.entrada.estado === 'ok') ? 'ok' : 'cargando'));
  const horarios = useMemo(
    () => (dia ? horariosDelDia(todosLosSlots, dia, tz) : []),
    [todosLosSlots, dia, tz],
  );
  const proximoDia = dia ? (dias.find(d => d.dia > dia && d.estado === 'lugar')?.dia || null) : null;
  const hayMasDias = !!paginaDeDias(hoy, paginas, maxDias);
  const cargandoMas = paginas > 1 && paginasVistas[paginasVistas.length - 1]?.entrada.estado === 'cargando';

  const reintentarHorarios = () => {
    pedidos.current.clear();
    setCache({});
    setVersion(v => v + 1);
  };

  // ── Handlers ──
  const reiniciarHorario = () => { setDia(null); setSlot(null); setPaginas(1); setAviso(null); };
  const elegirServicio = (id) => { setServicioId(id); setStaffId(''); reiniciarHorario(); };
  const elegirKind = (k) => { setKindElegido(k); reiniciarHorario(); };
  const elegirZona = (z) => { setZoneId(z); reiniciarHorario(); };
  const elegirStaff = (id) => { setStaffId(id); reiniciarHorario(); };
  const elegirDia = (d) => { setDia(d); setSlot(null); setAviso(null); };
  const elegirSlot = (opcion, hora) => {
    setSlot({ ...opcion, hora });
    setAviso(null);
    // Lleva a "Tus datos" y deja el foco ahi (sin animacion si la pidio asi).
    setTimeout(() => {
      try {
        const quieta = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        datosRef.current?.scrollIntoView?.({ behavior: quieta ? 'auto' : 'smooth', block: 'start' });
        datosRef.current?.querySelector('h2')?.focus({ preventScroll: true });
      } catch { /* sin scroll */ }
    }, 60);
  };
  const cambiarDato = (campo) => (e) => {
    setDatos(d => ({ ...d, [campo]: e.target.value }));
    setErrores(er => (er[campo] ? { ...er, [campo]: null } : er));
  };

  const validar = () => {
    const er = {};
    if (kind === 'home') {
      if (requiereZona && !zoneId) er.zona = 'Elegí tu zona.';
      if (direccion.trim().length < 5) er.direccion = 'Escribí la dirección completa donde te atendemos.';
    }
    if (datos.nombre.trim().length < 2) er.nombre = 'Escribí tu nombre.';
    if (!telefonoValido(datos.telefono)) er.telefono = 'Escribí un teléfono con código de área, por ejemplo 11 5555 1234.';
    if (!correoValido(datos.email)) er.email = 'Revisá el correo: parece que le falta algo.';
    return er;
  };

  const reservar = async (e) => {
    e.preventDefault();
    if (enviandoRef.current || !slot) return;
    const er = validar();
    setErrores(er);
    const primero = ['zona', 'direccion', 'nombre', 'telefono', 'email'].find(k => er[k]);
    if (primero) {
      const idCampo = { zona: 'rv-zona', direccion: 'rv-direccion', nombre: 'rv-nombre', telefono: 'rv-telefono', email: 'rv-email' }[primero];
      document.getElementById(idCampo)?.focus();
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    setErrorEnvio(null);
    const r = await createBooking({
      serviceId: servicioId,
      staffId: slot.staff_id,
      startsAt: slot.starts_at,
      locationKind: kind,
      zoneId: zonaDelPedido,
      address: kind === 'home' ? direccion.trim() : null,
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim(),
      email: datos.email.trim() || null,
      notas: datos.notas.trim() || null,
    });
    enviandoRef.current = false;
    setEnviando(false);

    if (!r?.ok) {
      if (r?.code === 'slot_taken') {
        // Se queda en el dia que miraba: si ya no tiene lugar, se le ofrece el proximo.
        setDia(partesEnZona(slot.starts_at, tz).dia);
        setSlot(null);
        setAviso('Ese horario se ocupó justo recién. Mirá los que quedan y elegí otro.');
        reintentarHorarios();
      } else {
        setErrorEnvio(r?.error || 'No pudimos reservar. Probá de nuevo.');
      }
      return;
    }
    const turno = r.turno;
    // Con o sin seña va a la pagina del turno: ahi esta el boton de pagar y la
    // cuenta regresiva (una sola pantalla de pago, sin redireccion automatica).
    navigate(`/reservar/turno/${turno.token}`);
  };

  // El aviso de "horario ocupado" recibe el foco: al perder "Tus datos" la pagina se acorta.
  useEffect(() => {
    if (!aviso) return;
    try {
      avisoRef.current?.focus();
      avisoRef.current?.scrollIntoView?.({ block: 'center' });
    } catch { /* sin scroll */ }
  }, [aviso]);

  // ── Render ──

  if (cargandoInfo && !info) {
    return (
      <ReservarMarco titulo="Reservá tu turno">
        <div className="rv-step" role="status">
          <div className="rv-skel" />
          <div className="rv-skel" />
          <div className="rv-skel" />
          <span className="rv-vh">Cargando…</span>
        </div>
      </ReservarMarco>
    );
  }

  if (infoError || !info) {
    return (
      <ReservarMarco titulo="Reservá tu turno">
        <Aviso icono="x" tono="err" rol="alert">
          <p>{infoError || 'No pudimos cargar los turnos.'}</p>
          <button type="button" className="rv-link" onClick={() => { setCargandoInfo(true); setReintentoInfo(n => n + 1); }}>Probar de nuevo</button>
        </Aviso>
      </ReservarMarco>
    );
  }

  if (senaBloqueada || kinds.length === 0 || servicios.length === 0) {
    return (
      <ReservarMarco titulo="Reservá tu turno" nombreNegocio={negocio.name}>
        <Aviso icono="clock">
          <p>
            {senaBloqueada
              ? 'Este negocio todavía no habilita reservas con seña. Escribile por WhatsApp y te damos el turno.'
              : 'Por ahora no se pueden reservar turnos desde acá. Escribile al negocio y lo coordinan.'}
          </p>
        </Aviso>
        <div className="rv-actions"><BotonWhatsApp telefono={negocio.whatsapp} /></div>
      </ReservarMarco>
    );
  }

  const profesional = staff.find(s => s.id === slot?.staff_id);
  const mostrarDonde = !!servicio && (kinds.length > 1 || kind === 'home');
  const mostrarStaff = !!servicio && dondeListo && opcionesStaff.length > 1;
  const zonaNombre = zonas.find(z => z.id === zoneId)?.name;
  const tzDelCelular = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } })();
  const notaZona = tz && tzDelCelular && tz !== tzDelCelular
    ? `Los horarios son en hora de ${tz.split('/').pop().replace(/_/g, ' ')}.` : null;
  const adicionales = info.adicionales || [];
  const orden = ['servicio', mostrarDonde && 'donde', mostrarStaff && 'staff', listoParaHorarios && 'hora', slot && 'datos'].filter(Boolean);
  const num = (paso) => orden.indexOf(paso) + 1;

  return (
    <ReservarMarco
      titulo="Reservá tu turno"
      bajada={negocio.name ? `Elegí qué te querés hacer y cuándo. Te esperamos en ${negocio.name}.` : 'Elegí qué te querés hacer y cuándo.'}
      nombreNegocio={negocio.name}
    >
      {/* 1 · Servicio */}
      <section className="rv-step" aria-labelledby="rv-h-serv">
        <div className="rv-step-head">
          <span className="rv-step-num" aria-hidden="true">{num('servicio')}</span>
          <h2 className="rv-step-title" id="rv-h-serv">Servicio</h2>
        </div>
        <fieldset className="rv-opts">
          <legend className="rv-vh">Elegí un servicio</legend>
          {servicios.map(s => (
            <Opcion key={s.id} name="rv-servicio" value={s.id} checked={servicioId === s.id} onChange={() => elegirServicio(s.id)}>
              <span className="rv-opt-name">{s.name}</span>
              <span className="rv-opt-meta">{formatearDuracion(s.duration_min)} · {fmtAR(s.price)}</span>
              {Number(s.deposit_amount) > 0 && (
                <span className="rv-opt-sena">Seña {fmtAR(s.deposit_amount)} para confirmar</span>
              )}
            </Opcion>
          ))}
        </fieldset>
        {adicionales.length > 0 && (
          <p className="rv-hint">
            Adicionales que se suman a tu servicio y se coordinan en el turno:{' '}
            {adicionales.map(a => `${a.name} ${fmtAR(a.price)}`).join(', ')}.
          </p>
        )}
      </section>

      {/* 2 · Donde */}
      {mostrarDonde && (
        <section className="rv-step" aria-labelledby="rv-h-donde">
          <div className="rv-step-head">
            <span className="rv-step-num" aria-hidden="true">{num('donde')}</span>
            <h2 className="rv-step-title" id="rv-h-donde">{kinds.length > 1 ? 'Dónde' : 'Dónde te atendemos'}</h2>
          </div>
          {kinds.length > 1 && (
            <fieldset className="rv-opts rv-opts--2">
              <legend className="rv-vh">Dónde querés el turno</legend>
              {reglas.offers_local && (
                <Opcion name="rv-donde" value="local" checked={kind === 'local'} onChange={() => elegirKind('local')}>
                  <span className="rv-opt-name">En el local</span>
                  {negocio.address && <span className="rv-opt-meta">{negocio.address}</span>}
                </Opcion>
              )}
              {reglas.offers_home && (
                <Opcion name="rv-donde" value="home" checked={kind === 'home'} onChange={() => elegirKind('home')}>
                  <span className="rv-opt-name">A domicilio</span>
                  <span className="rv-opt-meta">Vamos a tu casa</span>
                </Opcion>
              )}
            </fieldset>
          )}
          {kind === 'home' && (
            <div>
              {zonas.length > 0 && (
                <Campo id="rv-zona" etiqueta="Zona" error={errores.zona}>
                  <select
                    id="rv-zona" className="rv-select" value={zoneId}
                    onChange={e => elegirZona(e.target.value)}
                    aria-invalid={errores.zona ? 'true' : undefined}
                    aria-describedby={errores.zona ? 'rv-zona-err' : undefined}
                  >
                    <option value="">Elegí tu zona</option>
                    {zonas.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </Campo>
              )}
              <Campo id="rv-direccion" etiqueta="Dirección" nota="calle, número, piso o depto" error={errores.direccion}>
                <input
                  id="rv-direccion" className="rv-input" type="text" autoComplete="street-address"
                  value={direccion} onChange={e => { setDireccion(e.target.value); setErrores(er => ({ ...er, direccion: null })); }}
                  aria-invalid={errores.direccion ? 'true' : undefined}
                  aria-describedby={errores.direccion ? 'rv-direccion-err' : undefined}
                />
              </Campo>
            </div>
          )}
          {kind === 'local' && negocio.address && kinds.length > 1 && (
            <p className="rv-hint">Te esperamos en {negocio.address}.</p>
          )}
        </section>
      )}
      {!mostrarDonde && servicio && kind === 'local' && negocio.address && (
        <p className="rv-hint rv-hint--suelto">Te esperamos en {negocio.address}.</p>
      )}

      {/* 3 · Profesional (solo si hay de donde elegir) */}
      {mostrarStaff && (
        <section className="rv-step" aria-labelledby="rv-h-prof">
          <div className="rv-step-head">
            <span className="rv-step-num" aria-hidden="true">{num('staff')}</span>
            <h2 className="rv-step-title" id="rv-h-prof">Con quién</h2>
          </div>
          <fieldset className="rv-opts">
            <legend className="rv-vh">Elegí una profesional</legend>
            <Opcion name="rv-staff" value="" checked={staffId === ''} onChange={() => elegirStaff('')}>
              <span className="rv-opt-name">Cualquiera</span>
              <span className="rv-opt-meta">Más horarios para elegir</span>
            </Opcion>
            {opcionesStaff.map(s => (
              <Opcion key={s.id} name="rv-staff" value={s.id} checked={staffId === s.id} onChange={() => elegirStaff(s.id)}>
                <span className="rv-opt-name">{s.name}</span>
              </Opcion>
            ))}
          </fieldset>
        </section>
      )}

      {servicio && dondeListo && opcionesStaff.length === 0 && (
        <Aviso icono="x" tono="err" rol="alert"><p>Este servicio todavía no tiene quién lo haga. Escribile al negocio.</p></Aviso>
      )}

      {/* 4 · Dia y horario */}
      {listoParaHorarios && (
        <section className="rv-step" aria-labelledby="rv-h-hora">
          <div className="rv-step-head">
            <span className="rv-step-num" aria-hidden="true">{num('hora')}</span>
            <h2 className="rv-step-title" id="rv-h-hora">Día y horario</h2>
          </div>
          {aviso && (
            <div className="rv-note rv-note--err" role="alert" tabIndex={-1} ref={avisoRef}>
              <Icon name="clock" size={18} />
              <div><p>{aviso}</p></div>
            </div>
          )}
          <ReservarHorarios
            dias={dias} dia={dia} onDia={elegirDia}
            horarios={horarios} slotElegido={slot?.starts_at || null} onSlot={elegirSlot}
            estado={estadoHorarios}
            mensajeError={paginasVistas.find(x => x.entrada.estado === 'error')?.entrada.error}
            onReintentar={reintentarHorarios}
            hayMasDias={hayMasDias} cargandoMas={cargandoMas} onMas={() => setPaginas(p => p + 1)}
            proximoDia={proximoDia} onProximo={() => elegirDia(proximoDia)}
            notaZona={notaZona}
          />
        </section>
      )}

      {/* 5 · Datos y resumen */}
      {slot && (
        <section className="rv-step" aria-labelledby="rv-h-datos" ref={datosRef}>
          <div className="rv-step-head">
            <span className="rv-step-num" aria-hidden="true">{num('datos')}</span>
            <h2 className="rv-step-title" id="rv-h-datos" tabIndex={-1}>Tus datos</h2>
          </div>
          <form onSubmit={reservar} noValidate>
            <Campo id="rv-nombre" etiqueta="Nombre" error={errores.nombre}>
              <input
                id="rv-nombre" className="rv-input" type="text" autoComplete="name"
                value={datos.nombre} onChange={cambiarDato('nombre')}
                aria-invalid={errores.nombre ? 'true' : undefined}
                aria-describedby={errores.nombre ? 'rv-nombre-err' : undefined}
              />
            </Campo>
            <Campo id="rv-telefono" etiqueta="Teléfono" nota="para avisarte por cualquier cambio" error={errores.telefono}>
              <input
                id="rv-telefono" className="rv-input" type="tel" inputMode="tel" autoComplete="tel"
                value={datos.telefono} onChange={cambiarDato('telefono')}
                aria-invalid={errores.telefono ? 'true' : undefined}
                aria-describedby={errores.telefono ? 'rv-telefono-err' : undefined}
              />
            </Campo>
            <Campo id="rv-email" etiqueta="Correo" nota="opcional, para recordatorios" error={errores.email}>
              <input
                id="rv-email" className="rv-input" type="email" inputMode="email" autoComplete="email"
                value={datos.email} onChange={cambiarDato('email')}
                aria-invalid={errores.email ? 'true' : undefined}
                aria-describedby={errores.email ? 'rv-email-err' : undefined}
              />
            </Campo>
            <Campo id="rv-notas" etiqueta="Notas" nota="opcional">
              <textarea id="rv-notas" className="rv-textarea" value={datos.notas} onChange={cambiarDato('notas')} maxLength={500} />
            </Campo>

            <div className="rv-summary">
              <dl>
                <dt>Servicio</dt><dd>{servicio.name}</dd>
                <dt>Cuándo</dt><dd>{etiquetaLarga(partesEnZona(slot.starts_at, tz).dia)}, {slot.hora}</dd>
                <dt>Dónde</dt>
                <dd>
                  {kind === 'home'
                    ? `A domicilio${zonaNombre ? ` · ${zonaNombre}` : ''}`
                    : `En el local${negocio.address ? ` · ${negocio.address}` : ''}`}
                </dd>
                {profesional && (<><dt>Con</dt><dd>{profesional.name}</dd></>)}
                <dt>Duración</dt><dd>{formatearDuracion(servicio.duration_min)}</dd>
                <div className="rv-summary-total">
                  <dt>Precio</dt><dd>{fmtAR(servicio.price)}</dd>
                </div>
                {deposito > 0 && (
                  <div className="rv-summary-total rv-summary-total--plano">
                    <dt>Seña para confirmar</dt><dd>{fmtAR(deposito)}</dd>
                  </div>
                )}
              </dl>
            </div>

            {deposito > 0 && (
              <Aviso icono="clock">
                <p>
                  Después de reservar te llevamos a MercadoPago a pagar la seña.
                  {info.sena?.retencion_min ? ` Tenés ${info.sena.retencion_min} minutos; si no se paga, el horario se libera.` : ''}
                </p>
              </Aviso>
            )}

            {errorEnvio && (
              <Aviso icono="x" tono="err" rol="alert"><p>{errorEnvio}</p></Aviso>
            )}

            <div className="rv-actions">
              <button type="submit" className="rv-btn" disabled={enviando} aria-busy={enviando ? 'true' : undefined}>
                {enviando
                  ? <><span className="rv-spin" aria-hidden="true" /> Reservando…</>
                  : (deposito > 0 ? `Reservar y pagar seña ${fmtAR(deposito)}` : 'Reservar')}
              </button>
            </div>
          </form>
        </section>
      )}
    </ReservarMarco>
  );
}
