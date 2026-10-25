import '../../styles/como-empezar.css';

const PASOS = [
  ['Encontrás por dónde empezar.', 'Respondés un diagnóstico breve, sin email, y ves qué necesita tu negocio.'],
  ['Creás tu negocio.', 'Elegís tu plan y creás tu cuenta con los datos de tu negocio.'],
  ['Lo ponés en marcha.', 'Cargás tus datos y accedés al acompañamiento para empezar a usar Dico.'],
];

export default function ComoEmpezar({ onDiagnostico }) {
  return (
    <section className="ce-root" id="como-empezar" aria-labelledby="ce-titulo">
      <div className="ce-dentro">
        <h2 id="ce-titulo">Empezá a tu ritmo.</h2>
        <ol className="ce-pasos">
          {PASOS.map(([titulo, texto], indice) => (
            <li key={titulo}>
              <span className="ce-numero" aria-hidden="true">0{indice + 1}</span>
              <div><h3>{titulo}</h3><p>{texto}</p></div>
            </li>
          ))}
        </ol>
        <div className="ce-accion">
          <button className="pl-boton ce-boton" type="button" onClick={onDiagnostico}>
            <span className="ce-etiqueta">Hacer mi diagnóstico</span>
            <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span>
          </button>
          <p>Si ya empezaste, retomás donde quedaste.</p>
        </div>
      </div>
    </section>
  );
}
