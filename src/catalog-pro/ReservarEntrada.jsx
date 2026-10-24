// src/catalog-pro/ReservarEntrada.jsx
// Acceso a la reserva online desde la home del catalogo. Solo se pinta cuando
// el negocio tiene el canal `online_booking` (settings.online_booking).

import { useInRouterContext, Link } from 'react-router-dom';
import Icon from './Icon';
import './tokens.css';
import './reservar.css';

export default function ReservarEntrada({ settings }) {
  const enRouter = useInRouterContext();
  if (!settings?.online_booking) return null;
  const contenido = (
    <>
      <span className="rv-entrada-txt">
        <span className="rv-entrada-t">Reservar turno</span>
        <span className="rv-entrada-s">Elegí servicio, día y horario</span>
      </span>
      <Icon name="arrow-right" size={22} />
    </>
  );
  return enRouter
    ? <Link to="/reservar" className="rv-entrada">{contenido}</Link>
    : <a href="/reservar" className="rv-entrada">{contenido}</a>;
}
