import { useEffect, useRef } from 'react';
import ShaderBackground from './ShaderBackground';
import '../../styles/transicion-volt.css';

export default function TransicionVolt() {
  const raiz = useRef(null);
  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento || typeof IntersectionObserver === 'undefined') return undefined;
    elemento.classList.add('hv-anim');
    const observador = new IntersectionObserver(([entrada]) => {
      elemento.classList.toggle('hv-visible', entrada.isIntersecting);
      if (entrada.isIntersecting) elemento.classList.add('hv-in');
    }, { threshold: .2 });
    observador.observe(elemento);
    return () => { observador.disconnect(); elemento.classList.remove('hv-anim', 'hv-in', 'hv-visible'); };
  }, []);
  return <section className="hv-root" id="machine-soul" aria-label="Machine Soul" ref={raiz}>
    <div className="hv-efecto" aria-hidden="true"><ShaderBackground /></div>
    {/* Linea del ovalo: mismo path que la mascara de .hv-efecto. */}
    {/* El trazo se enciende hacia el centro de cada arco y se apaga en las puntas. */}
    <svg className="hv-ovalo" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id="hv-ovalo-trazo" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0"><stop offset="0" stopOpacity=".15" /><stop offset=".5" stopOpacity="1" /><stop offset="1" stopOpacity=".15" /></linearGradient></defs>
      <path d="M0 50Q50 -50 100 50Q50 150 0 50Z" vectorEffect="non-scaling-stroke" />
    </svg>
    <p className="hv-promesa"><span className="hv-linea"><span className="hv-flota">Pusiste el <em>alma</em> en tu negocio.</span></span><span className="hv-linea"><span className="hv-flota">Que también te deje tiempo para vivir.</span></span></p>
  </section>;
}
