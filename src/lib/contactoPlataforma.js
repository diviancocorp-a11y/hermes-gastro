// src/lib/contactoPlataforma.js
// Los datos de contacto de la PLATAFORMA (divianco.app), en un solo lugar:
// los usan la landing y la bienvenida despues del alta.
//
// Las marcas de analitica (marcarEvento('whatsapp' | 'agenda')) quedan en cada
// link: este modulo solo dice a donde se va.

// El telefono de Ricardo (17/oct/2026). El numero de EE.UU. ya no va.
export const WHATSAPP = '5491121829893';
export const WHATSAPP_VISIBLE = '+54 9 11 2182-9893';
// Partido en dos para que en pantallas muy angostas corte entre bloques y
// nunca adentro del numero.
export const WHATSAPP_VISIBLE_PARTES = ['+54 9 11', '2182-9893'];
export const WHATSAPP_HORARIO = 'de lunes a viernes, de 11 a 23 h';
const WHATSAPP_TEXTO = 'Hola Ricardo, quiero conocer Dico para mi negocio.';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(WHATSAPP_TEXTO)}`;

// La reunion: una hora en la oficina virtual (WorkAdventure).
export const AGENDA_URL = 'https://cal.com/ricardo.r/reunion';
export const AGENDA_HORARIO = 'de lunes a viernes, de 10 a 18 h';
