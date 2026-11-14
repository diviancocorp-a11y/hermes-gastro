// src/catalog-pro/plantillas/PopTestimonios.jsx
// Citas de clientes que cargo el negocio. Sin citas, la seccion no existe.
export default function PopTestimonios({ textos = {}, citas = [] }) {
  return (
    <section className="pop-seccion pop-testimonios" id="pop-testimonios" aria-labelledby="pop-test-t">
      <div className="pop-seccion__cabeza" data-revelar>
        {textos.testimonios_eyebrow && <p className="pop-kicker">{textos.testimonios_eyebrow}</p>}
        <h2 id="pop-test-t" className="pop-titulo">{textos.testimonios_titulo || "Lo que dicen de nosotros"}</h2>
      </div>
      <ul className="pop-testimonios__lista">
        {citas.map((q, i) => (
          <li key={i} className="pop-cita" data-revelar>
            <blockquote>
              <p>{q.texto}</p>
              {q.nombre && <footer>{q.nombre}</footer>}
            </blockquote>
          </li>
        ))}
      </ul>
    </section>
  );
}
