// src/catalog-pro/ReservarTurno.jsx
// El turno de una clienta, por el token de su link: /reservar/turno/:token.
// Confirmacion, seña pendiente con cuenta regresiva, cancelacion y el retorno
// de MercadoPago (?pago=ok | pendiente | error).
//
// El estado se dice con texto e icono, nunca solo con color. El plazo para
// cancelar y el vencimiento de la seña los fija el servidor: aca se muestran.
// Si todavia se puede pagar lo dice el servidor (omite el link al vencer); el
// reloj del celular solo dibuja la cuenta regresiva, corregido con el
// `server_now` de la respuesta.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchBooking, cancelBooking, fetchBookingInfo } from '../services/publicBooking';
import { linkWhatsApp } from '../modules/agenda';
import { fmtAR } from './format';
import Icon from './Icon';
import ReservarMarco from './ReservarMarco';
import { etiquetaLarga, partesEnZona, cuentaRegresiva, formatearDuracion } from './reservarHelpers';

const INTENTOS_PAGO = 8;
const ESPERA_PAGO_MS = 3000;

function Estado({ icono, mala, children }) {
  return (
    <span className={`rv-status${mala ? ' rv-status--bad' : ''}`}>
      <Icon name={icono} size={16} stroke={2} /> {children}
    </span>
  );
}

function Aviso({ icono = 'clock', tono, rol, children }) {
  return (
    <div className={`rv-note${tono ? ` rv-note--${tono}` : ''}`} role={rol}>
      <Icon name={icono} size={18} />
      <div>{children}</div>
    </div>
  );
}

export default function ReservarTurno() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const retorno = params.get('pago');

  const [turno, setTurno] = useState(null);
  const [carga, setCarga] = useState('cargando'); // cargando | ok | noencontrado | error
  const [errorCarga, setErrorCarga] = useState(null);
  const [negocio, setNegocio] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());
  // Desfase entre el reloj del servidor y el del celular, medido al recibir
  // cada respuesta. Solo sirve para dibujar la cuenta regresiva.
  const [desfase, setDesfase] = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState(null);
  const [recienCancelado, setRecienCancelado] = useState(null); // { senaPagada }
  const [intentosPago, setIntentosPago] = useState(0);
  const [reintento, setReintento] = useState(0);
  const cancelandoRef = useRef(false);
  const turnoRef = useRef(null);
  const refrescoRef = useRef(null);
  const btnCancelarRef = useRef(null);
  const btnMantenerRef = useRef(null);
  const abrioDialogoRef = useRef(false);

  const aplicar = useCallback((r) => {
    if (r?.ok) {
      turnoRef.current = r.turno;
      setTurno(r.turno);
      if (r.turno?.server_now) {
        const sn = Date.parse(r.turno.server_now);
        if (!Number.isNaN(sn)) setDesfase(sn - Date.now());
      }
      setCarga('ok');
      return;
    }
    // Con un turno ya a la vista, un fallo al refrescar (polling, tras
    // cancelar) no tira abajo la pantalla: se conserva lo que ya se sabe.
    if (turnoRef.current) return;
    if (r?.code === 'no_encontrado') {
      setCarga('noencontrado');
    } else {
      setErrorCarga(r?.error || null);
      setCarga('error');
    }
  }, []);
  const cargar = useCallback(async () => { aplicar(await fetchBooking(token)); }, [token, aplicar]);

  useEffect(() => {
    let vivo = true;
    fetchBookingInfo().then(r => { if (vivo && r?.ok) setNegocio(r.negocio); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    fetchBooking(token).then(r => { if (vivo) aplicar(r); });
    return () => { vivo = false; };
  }, [token, aplicar, reintento]);

  const tz = negocio?.timezone;
  const sena = turno?.sena || null;
  const senaPendiente = sena?.estado === 'pending' && turno?.status === 'booked';
  const vence = sena?.vence ? Date.parse(sena.vence) : null;
  const restanteMs = vence === null ? 0 : vence - (ahora + desfase);
  // Quien decide si todavia se puede pagar es el servidor: omite el link al
  // vencer. El reloj solo cuenta cuando no hay link para pagar.
  const senaVigente = senaPendiente && (!!sena?.init_point || restanteMs > 0);
  const senaVencida = senaPendiente && !senaVigente;
  const pagada = sena?.estado === 'paid';
  const cancelado = turno?.status === 'cancelled';
  // Volvio de MercadoPago diciendo que pago: mientras el webhook no lo marque
  // no se le pide pagar de nuevo ni se le dice que perdio el horario.
  const confirmandoPago = retorno === 'ok' && senaPendiente && carga === 'ok';

  // La cuenta regresiva solo corre mientras la seña esta vigente.
  useEffect(() => {
    if (!senaVigente) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [senaVigente]);

  // Al llegar la cuenta a cero se le pregunta UNA vez al servidor: pudo pagarse
  // en el ultimo segundo, asi que no se declara vencida a ciegas.
  useEffect(() => {
    if (senaVigente && vence !== null && restanteMs <= 0 && refrescoRef.current !== vence) {
      refrescoRef.current = vence;
      cargar();
    }
  }, [senaVigente, vence, restanteMs, cargar]);

  // Retorno de MercadoPago: el webhook puede tardar unos segundos en marcar el
  // pago. Se reintenta un numero acotado de veces, no para siempre.
  useEffect(() => {
    if (!confirmandoPago || intentosPago >= INTENTOS_PAGO) return undefined;
    const t = setTimeout(async () => {
      await cargar();
      setIntentosPago(i => i + 1);
    }, ESPERA_PAGO_MS);
    return () => clearTimeout(t);
  }, [confirmandoPago, intentosPago, cargar]);

  // Foco del dialogo de cancelar: entra en "No, mantenerlo" y vuelve al boton.
  useEffect(() => {
    if (confirmando) {
      btnMantenerRef.current?.focus();
    } else if (abrioDialogoRef.current) {
      abrioDialogoRef.current = false;
      btnCancelarRef.current?.focus();
    }
  }, [confirmando]);

  const abrirDialogo = () => {
    abrioDialogoRef.current = true;
    setConfirmando(true);
    setErrorCancelar(null);
  };

  const cancelar = async () => {
    if (cancelandoRef.current) return;
    cancelandoRef.current = true;
    setCancelando(true);
    setErrorCancelar(null);
    const r = await cancelBooking(token);
    cancelandoRef.current = false;
    setCancelando(false);
    if (r?.ok) {
      setRecienCancelado({ senaPagada: !!r.sena_pagada });
      setConfirmando(false);
      // Se anota ya: si el refresco falla, la pantalla igual dice la verdad.
      turnoRef.current = { ...turnoRef.current, status: 'cancelled', puede_cancelar: false };
      setTurno(turnoRef.current);
      await cargar();
    } else {
      setErrorCancelar(r?.error || 'No pudimos cancelar. Probá de nuevo.');
      if (r?.code === 'fuera_de_plazo') setConfirmando(false);
    }
  };

  const wa = (texto) => linkWhatsApp(negocio?.whatsapp, texto);

  if (carga === 'cargando' && !turno) {
    return (
      <ReservarMarco titulo="Tu turno" nombreNegocio={negocio?.name}>
        <div className="rv-step" role="status">
          <div className="rv-skel" /><div className="rv-skel" />
          <span className="rv-vh">Buscando tu turno…</span>
        </div>
      </ReservarMarco>
    );
  }

  if (carga === 'noencontrado') {
    return (
      <ReservarMarco titulo="Turno no encontrado" nombreNegocio={negocio?.name}>
        <div className="rv-center">
          <Estado icono="x" mala>No encontrado</Estado>
          <p>No encontramos ese turno. Revisá que el link esté completo o escribile al negocio.</p>
          <a className="rv-btn rv-btn--inline" href="/reservar">Reservar un turno</a>
        </div>
      </ReservarMarco>
    );
  }

  if (carga === 'error' || !turno) {
    return (
      <ReservarMarco titulo="Tu turno" nombreNegocio={negocio?.name}>
        <Aviso icono="x" tono="err" rol="alert">
          <p>{errorCarga || 'No pudimos cargar tu turno.'}</p>
          <button type="button" className="rv-link" onClick={() => { setCarga('cargando'); setReintento(n => n + 1); }}>Probar de nuevo</button>
        </Aviso>
      </ReservarMarco>
    );
  }

  const p = partesEnZona(turno.starts_at, tz);
  const activo = ['booked', 'confirmed'].includes(turno.status) && !senaVencida && !confirmandoPago;
  const dondeTexto = turno.location_kind === 'home'
    ? `A domicilio${turno.zona ? ` · ${turno.zona}` : ''}${turno.address ? ` · ${turno.address}` : ''}`
    : `En el local${negocio?.address ? ` · ${negocio.address}` : ''}`;
  const duracion = Math.round((Date.parse(turno.ends_at) - Date.parse(turno.starts_at)) / 60000);
  const seguirEsperando = confirmandoPago && intentosPago < INTENTOS_PAGO;
  const linkWa = wa('Hola! Necesito cambiar mi turno.');

  let titulo = 'Tu turno';
  let estado;
  if (cancelado) {
    titulo = 'Turno cancelado';
    estado = <Estado icono="x" mala>Cancelado</Estado>;
  } else if (confirmandoPago) {
    titulo = seguirEsperando ? 'Confirmando tu pago' : 'Todavía no vemos tu pago';
    estado = <Estado icono="clock">Confirmando pago</Estado>;
  } else if (senaVencida) {
    titulo = 'Se liberó el horario';
    estado = <Estado icono="clock" mala>Seña sin pagar</Estado>;
  } else if (senaVigente) {
    titulo = 'Falta pagar la seña';
    estado = <Estado icono="clock">Seña pendiente</Estado>;
  } else if (turno.status === 'confirmed' || pagada) {
    titulo = '¡Turno confirmado!';
    estado = <Estado icono="check">Confirmado</Estado>;
  } else if (turno.status === 'done') {
    titulo = 'Turno realizado';
    estado = <Estado icono="check">Realizado</Estado>;
  } else if (turno.status === 'no_show') {
    titulo = 'Turno perdido';
    estado = <Estado icono="x" mala>No asististe</Estado>;
  } else {
    titulo = '¡Turno reservado!';
    estado = <Estado icono="check">Reservado</Estado>;
  }

  return (
    <ReservarMarco titulo={titulo} nombreNegocio={negocio?.name}>
      <div className="rv-ticket">
        {estado}
        <p className="rv-when">{etiquetaLarga(p.dia)}</p>
        <p className="rv-when-hora">{p.hora} hs{duracion > 0 ? ` · ${formatearDuracion(duracion)}` : ''}</p>
        <div className="rv-summary">
          <dl>
            <dt>Servicio</dt><dd>{turno.servicio || '—'}</dd>
            {turno.profesional && (<><dt>Con</dt><dd>{turno.profesional}</dd></>)}
            <dt>Dónde</dt><dd>{dondeTexto}</dd>
            {sena && (<><dt>Seña</dt><dd>{fmtAR(sena.monto)}{pagada ? ' · pagada' : ''}</dd></>)}
          </dl>
        </div>
      </div>

      {/* Retorno de MercadoPago */}
      <div aria-live="polite">
        {seguirEsperando && (
          <Aviso icono="clock" tono="ok" rol="status">
            <p><span className="rv-spin" aria-hidden="true" /> Estamos confirmando tu pago. Puede tardar unos segundos.</p>
          </Aviso>
        )}
        {confirmandoPago && !seguirEsperando && (
          <Aviso icono="clock">
            <p>Todavía no vemos el pago. A veces demora unos minutos: si ya pagaste, tu turno se confirma solo. No hace falta que pagues de nuevo.</p>
            <button type="button" className="rv-link" onClick={() => setIntentosPago(0)}>Revisar de nuevo</button>
            {linkWa && (
              <p><a className="rv-link" href={linkWa} target="_blank" rel="noopener noreferrer">Escribirle al negocio por WhatsApp</a></p>
            )}
          </Aviso>
        )}
        {retorno === 'pendiente' && senaPendiente && (
          <Aviso icono="clock"><p>Tu pago quedó pendiente en MercadoPago. Cuando se acredite, el turno se confirma.</p></Aviso>
        )}
        {retorno === 'error' && senaPendiente && (
          <Aviso icono="x" tono="err" rol="alert">
            <p>No se pudo completar el pago. Todavía podés intentarlo de nuevo{senaVigente ? '' : ', pero el tiempo ya terminó'}.</p>
          </Aviso>
        )}
        {recienCancelado && (
          <Aviso icono="check" tono="ok" rol="status">
            <p>Cancelamos tu turno y avisamos al negocio.{recienCancelado.senaPagada ? ' Como habías pagado la seña, la coordinás con ellos.' : ''}</p>
          </Aviso>
        )}
      </div>

      {senaVigente && !confirmandoPago && (
        <Aviso icono="clock" tono="ok">
          {restanteMs > 0 ? (
            <p>
              Pagá la seña en los próximos <span className="rv-timer" role="timer">{cuentaRegresiva(sena.vence, ahora + desfase)}</span> para
              quedarte con este horario.
            </p>
          ) : (
            <p>Se terminó el tiempo para pagar. Estamos verificando…</p>
          )}
        </Aviso>
      )}
      {senaVigente && !confirmandoPago && !sena.init_point && (
        <Aviso icono="x" tono="err" rol="alert">
          <p>No pudimos generar el link de pago. Escribile al negocio para pagar la seña.</p>
          {linkWa && (
            <p><a className="rv-link" href={linkWa} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a></p>
          )}
        </Aviso>
      )}
      {senaVencida && !confirmandoPago && !cancelado && (
        <Aviso icono="clock">
          <p>Pasó el tiempo para pagar la seña y el horario quedó libre para otra persona. Podés pedir uno nuevo.</p>
        </Aviso>
      )}

      <div className="rv-actions">
        {senaVigente && !confirmandoPago && sena.init_point && (
          <a className="rv-btn" href={sena.init_point}>Pagar seña {fmtAR(sena.monto)}</a>
        )}
        {((senaVencida && !confirmandoPago) || cancelado) && (
          <a className="rv-btn" href="/reservar">Reservar otro turno</a>
        )}
      </div>

      {/* Cancelar */}
      {activo && turno.puede_cancelar && !confirmando && !recienCancelado && (
        <div className="rv-actions">
          <button type="button" ref={btnCancelarRef} className="rv-btn rv-btn--danger" onClick={abrirDialogo}>
            Cancelar turno
          </button>
        </div>
      )}
      {activo && turno.puede_cancelar && confirmando && (
        <div className="rv-note rv-note--err" role="alertdialog" aria-labelledby="rv-cancel-t" aria-describedby="rv-cancel-d">
          <Icon name="x" size={18} />
          <div>
            <p id="rv-cancel-t"><strong>¿Seguro que querés cancelar este turno?</strong></p>
            <p id="rv-cancel-d">
              El horario queda libre para otra persona.
              {pagada ? ' Ya pagaste la seña: la devolución la coordinás con el negocio.' : ''}
            </p>
            <div className="rv-actions rv-actions--row">
              <button type="button" ref={btnMantenerRef} className="rv-btn rv-btn--ghost" onClick={() => setConfirmando(false)} disabled={cancelando}>
                No, mantenerlo
              </button>
              <button type="button" className="rv-btn rv-btn--danger" onClick={cancelar} disabled={cancelando}>
                {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {errorCancelar && <Aviso icono="x" tono="err" rol="alert"><p>{errorCancelar}</p></Aviso>}

      {activo && !turno.puede_cancelar && (
        <Aviso icono="clock">
          <p>
            Podés cancelar por tu cuenta hasta {turno.cancel_window_hours} h antes del turno.
            Si necesitás cambiarlo o cancelarlo ahora, escribile al negocio.
          </p>
          {linkWa && (
            <p>
              <a className="rv-link" href={linkWa} target="_blank" rel="noopener noreferrer">
                Escribir por WhatsApp
              </a>
            </p>
          )}
        </Aviso>
      )}
    </ReservarMarco>
  );
}
