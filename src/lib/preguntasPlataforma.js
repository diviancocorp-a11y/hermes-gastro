import { PLANES_DIAGNOSTICO } from './planesPlataforma';

const RESPUESTAS = [
  ['¿Cómo empiezo?', 'Empezás por un diagnóstico breve sobre tu rubro, tu operación y lo que más te preocupa. Al final ves por dónde empezar y qué plan puede servirte. No requiere email ni tarjeta.'],
  ['¿Cuánto cuesta Dico?', `Digital cuesta ${PLANES_DIAGNOSTICO.digital.precio}, solo con pago mensual. Local y Cadena permiten pago mensual o anual. Los importes son por local y sin IVA.`, 'precios'],
  ['¿Necesito una reunión?', 'No. Podés crear tu cuenta primero y después acceder al acompañamiento para la puesta en marcha. La reunión no es un requisito previo.'],
  ['¿Cuánto tarda la puesta en marcha?', 'Depende del catálogo, del equipo y de los datos que tengas preparados. Crear la cuenta y cargar tu operación son pasos distintos; coordinamos el alcance con vos.'],
  ['¿Puedo traer datos del sistema que uso hoy?', 'Si ya tenés catálogo, stock o clientes digitalizados, revisamos su formato para organizar la carga. Las recetas, el equipo y la configuración se preparan según tu negocio.'],
  ['¿Me ayudan a configurar Dico?', 'Sí. Te ayudamos a crear tu cuenta, configurar Dico y cargar la información de tu negocio. Después seguimos con vos para revisar cómo lo estás usando y proponerte mejoras para tu operación.'],
  ['¿Dico funciona sin internet?', 'Hoy necesita conexión y no tiene modo offline. Si se corta internet o el servicio, no vas a poder registrar operaciones hasta que se restablezca.'],
  ['¿Cómo sé qué está disponible para mi rubro?', 'En el apartado de rubros distinguimos las funciones disponibles de las que están en desarrollo. La agenda interna y la reserva online son funciones distintas: la reserva online, los talles y colores y la facturación ARCA siguen en desarrollo.', 'rubros'],
  ['¿Qué pasa si sumo otra sucursal?', 'El plan Cadena contempla varias sucursales, consolidado, comparativas y roles por local. Su precio se calcula por local.'],
  ['¿Se conecta con mi caja registradora vieja?', 'Dico tiene su propia caja y arqueo. Una caja registradora mecánica no se conecta al sistema.'],
  ['¿Quién puede ver los datos de mi negocio?', 'El acceso se organiza por roles. Cada negocio tiene su propio espacio; un vendedor o un mozo no ve finanzas o sueldos si su rol no lo permite.'],
  ['¿Cómo consulto las condiciones del servicio y la privacidad?', 'Escribinos a hola@divianco.app para conocer las condiciones aplicables y resolver dudas sobre privacidad antes de contratar.', 'legales'],
];

const METADATOS = [
  ['diagnostico', 'inicio', 'diagnostico preguntas embudo empezar registro cuenta'],
  ['precio', 'planes', 'precio precios costo cuesta planes mensual anual pagar pago descuento digital local cadena'],
  ['reunion', 'inicio', 'reunion llamada cita empezar alta registro'],
  ['puesta', 'inicio', 'tiempo demora tarda implementacion configurar cargar puesta marcha'],
  ['importar', 'datos', 'migrar migracion importar excel csv planilla catalogo productos clientes traer datos'],
  ['experiencia', 'inicio', 'experiencia ayuda soporte acompanamiento aprender dificil facil'],
  ['internet', 'datos', 'internet offline conexion wifi desconectado corte'],
  ['rubro', 'rubro', 'rubro gastronomia restaurante comercio tienda barberia peluqueria estetica servicios agenda turnos reservas arca talles colores'],
  ['sucursales', 'planes', 'sucursal sucursales locales cadena consolidado comparativa'],
  ['caja', 'rubro', 'caja registradora mecanica conectar vieja hardware'],
  ['acceso', 'datos', 'seguridad acceso permisos privacidad roles vendedor mozo sueldos finanzas'],
  ['legales', 'datos', 'terminos condiciones legales contrato privacidad servicio contratar'],
];

export const TEMAS_DICO = [
  { id: 'planes', nombre: 'Planes y pagos' },
  { id: 'inicio', nombre: 'Empezar' },
  { id: 'datos', nombre: 'Mis datos' },
  { id: 'rubro', nombre: 'Mi rubro' },
];

export const PREGUNTAS_DICO = RESPUESTAS.map(([pregunta, respuesta, enlace], indice) => {
  const [id, tema, palabras] = METADATOS[indice];
  return { id, tema, palabras, pregunta, respuesta, enlace: enlace || (['diagnostico', 'reunion', 'experiencia'].includes(id) ? 'diagnostico' : null) };
});

const VACIAS = new Set('a al algo como con cual cuando cuanto de del dico el en es esta este esto funciona hay la las lo los me mi mis muy necesito negocio no o para por puedo que se si sin sobre su sus te tengo tu tus un una usar y yo'.split(' '));
export const normalizarDuda = texto => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Solo propone preguntas existentes: no genera respuestas ni envia la consulta.
export function buscarPreguntas(texto) {
  const palabras = [...new Set(normalizarDuda(texto).split(' ').filter(p => p.length > 1 && !VACIAS.has(p)))];
  if (!palabras.length) return [];
  return PREGUNTAS_DICO.map(p => {
    const campos = [normalizarDuda(p.pregunta), normalizarDuda(p.palabras), normalizarDuda(p.respuesta)].map(campo => campo.split(' '));
    const coincide = (campo, palabra) => campo.some(termino => termino === palabra || (palabra.length >= 4 && termino.startsWith(palabra)));
    const puntos = palabras.reduce((total, palabra) => total + (coincide(campos[0], palabra) ? 4 : coincide(campos[1], palabra) ? 3 : coincide(campos[2], palabra) ? 1 : 0), 0);
    return { pregunta: p, puntos };
  }).filter(p => p.puntos > 0).sort((a, b) => b.puntos - a.puntos).slice(0, 5).map(p => p.pregunta);
}
