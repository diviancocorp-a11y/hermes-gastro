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
    <p className="hv-promesa"><span className="hv-linea"><span className="hv-flota">Pusiste el <em>alma</em> en tu negocio.</span></span><span className="hv-linea"><span className="hv-flota">Que también te deje tiempo para vivir.</span></span></p>
  </section>;
}
