import { PLANES_DIAGNOSTICO } from '../../lib/planesPlataforma';
import { WHATSAPP_URL, WHATSAPP_HORARIO } from '../../lib/contactoPlataforma';
import { marcarEvento } from '../../lib/analiticaPlataforma';
import '../../styles/preguntas-negocio.css';

const PREGUNTAS = [
  ['¿Qué es el diagnóstico?', 'Son unas pocas preguntas sobre tu rubro, tu operación y lo que más te preocupa. Al final ves por dónde empezar y qué plan puede servirte. No requiere email ni tarjeta.'],
  ['¿Cuánto cuesta Dico?', `Digital cuesta ${PLANES_DIAGNOSTICO.digital.precio}, solo con pago mensual. Local y Cadena permiten pago mensual o anual. Los importes son por local y sin IVA.`, 'precios'],
  ['¿Necesito una reunión antes de crear mi cuenta?', 'No. Podés crear tu cuenta primero y después acceder al acompañamiento para la puesta en marcha. La reunión no es un requisito previo.'],
  ['¿Cuánto tarda la puesta en marcha?', 'Depende del catálogo, del equipo y de los datos que tengas preparados. Crear la cuenta y cargar tu operación son pasos distintos; coordinamos el alcance con vos.'],
  ['¿Puedo traer datos del sistema que uso hoy?', 'Si ya tenés catálogo, stock o clientes digitalizados, revisamos su formato para organizar la carga. Las recetas, el equipo y la configuración se preparan según tu negocio.'],
  ['No tengo experiencia con sistemas. ¿Puedo empezar igual?', 'Podés empezar con el diagnóstico y avanzar paso a paso. Para la puesta en marcha tenés acceso al acompañamiento y un canal de contacto por WhatsApp.'],
  ['¿Dico funciona sin internet?', 'Hoy necesita conexión y no tiene modo offline. Si se corta internet o el servicio, no vas a poder registrar operaciones hasta que se restablezca.'],
  ['¿Cómo sé qué está disponible para mi rubro?', 'En el apartado de rubros distinguimos las funciones disponibles de las que están en desarrollo. La agenda interna y la reserva online son funciones distintas: la reserva online, los talles y colores y la facturación ARCA siguen en desarrollo.', 'rubros'],
  ['¿Qué pasa si sumo otra sucursal?', 'El plan Cadena contempla varias sucursales, consolidado, comparativas y roles por local. Su precio se calcula por local.'],
  ['¿Se conecta con mi caja registradora vieja?', 'Dico tiene su propia caja y arqueo. Una caja registradora mecánica no se conecta al sistema.'],
  ['¿Quién puede ver los datos de mi negocio?', 'El acceso se organiza por roles. Cada negocio tiene su propio espacio; un vendedor o un mozo no ve finanzas o sueldos si su rol no lo permite.'],
  ['¿Cómo consulto las condiciones del servicio y la privacidad?', 'Escribinos a hola@divianco.app para conocer las condiciones aplicables y resolver dudas sobre privacidad antes de contratar.', 'legales'],
];

export default function PreguntasNegocio() {
  return (
    <section className="pn-root" id="preguntas" aria-labelledby="pn-titulo">
      <span className="pl-ancla" id="seguridad" aria-hidden="true" />
      <div className="pn-dentro">
        <h2 id="pn-titulo">Antes de empezar.</h2>
        <p className="pn-intro">Las preguntas que vale la pena hacer.</p>
        <div className="pn-lista">
          {PREGUNTAS.map(([pregunta, respuesta, enlace]) => (
            <details className="pn-pregunta" key={pregunta}>
              <summary><span>{pregunta}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg></summary>
              <div className="pn-respuesta">
                <p>{respuesta}</p>
                {enlace === 'precios' && <a className="pl-enlace" href="#precios">Comparar planes</a>}
                {enlace === 'rubros' && <a className="pl-enlace" href="#rubros">Ver el alcance por rubro</a>}
                {enlace === 'legales' && <a className="pl-enlace" href="mailto:hola@divianco.app?subject=Condiciones%20y%20privacidad%20de%20Dico">Consultar por email</a>}
              </div>
            </details>
          ))}
        </div>
        <div className="pn-contacto"><p>¿Te quedó alguna duda?</p><a className="pl-enlace" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => marcarEvento('whatsapp')}>Hablemos por WhatsApp</a><span>{WHATSAPP_HORARIO}.</span></div>
      </div>
    </section>
  );
}
