import { useEffect, useRef } from 'react';

const LADOS = [
  ['CRM y clientes', 'Pedidos', 'Stock', 'Compras'],
  ['Análisis', 'Proveedores', 'Caja', 'Equipo'],
];

export default function CircuitosHero({ onAbrir }) {
  const raizRef = useRef(null);

  useEffect(() => {
    const raiz = raizRef.current;
    let visible = false;
    const actualizar = () => raiz.classList.toggle('pl-circuitos-activos', visible && !document.hidden);
    const observador = new IntersectionObserver(([entrada]) => {
      visible = entrada.isIntersecting;
      actualizar();
    });
    observador.observe(raiz);
    document.addEventListener('visibilitychange', actualizar);
    return () => {
      observador.disconnect();
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, []);

  return (
    <div className="pl-circuitos" ref={raizRef} data-tiempo-capa="0.33" role="group" aria-label="Herramientas de Dico: encontrá cuáles necesita tu negocio">
      {LADOS.map((herramientas, lado) => (
        <div key={lado} className={`pl-circuito-lado pl-circuito-${lado ? 'derecho' : 'izquierdo'}`}>
          {herramientas.map((nombre, indice) => (
            <div className="pl-circuito-rama" key={nombre} style={{ '--circuito-demora': `${-indice * 3 - lado * 1.5}s` }}>
              <svg viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path className="pl-circuito-trazo" d="M-20 12H28L63 48H150" />
                <path className="pl-circuito-pulso" d="M-20 12H28L63 48H150" pathLength="100" />
              </svg>
              <button type="button" className="pl-circuito-nombre" onClick={onAbrir} aria-label={`${nombre}: empezar mi diagnóstico`}>{nombre}</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
