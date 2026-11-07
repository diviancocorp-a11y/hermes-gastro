import { useEffect, useRef, useState } from 'react';
import ShaderBackground from './ShaderBackground';
import '../../styles/transicion-volt.css';

// El shader compila WebGL al montarse, y esta seccion queda varias pantallas
// abajo: se monta cuando esta a una pantalla y media, con tiempo para compilar
// antes de que se vea aunque el scroll sea rapido.
const MARGEN_SHADER = '1200px';

export default function TransicionVolt() {
  const raiz = useRef(null);
  // Sin IntersectionObserver (navegador viejo) se monta como antes; en el
  // prerender del build no hay window y la seccion sale sin canvas.
  const [encendido, setEncendido] = useState(() => typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento || encendido) return undefined;
    const cerca = new IntersectionObserver(([entrada]) => {
      if (!entrada?.isIntersecting) return;
      cerca.disconnect();
      setEncendido(true);
    }, { rootMargin: MARGEN_SHADER });
    cerca.observe(elemento);
    return () => cerca.disconnect();
  }, [encendido]);
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
    <div className="hv-efecto" aria-hidden="true">{encendido && <ShaderBackground />}</div>
    {/* Linea del ovalo: mismo path que la mascara de .hv-efecto. */}
    {/* El trazo se enciende hacia el centro de cada arco y se apaga en las puntas. */}
    <svg className="hv-ovalo" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id="hv-ovalo-trazo" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0"><stop offset="0" stopOpacity=".15" /><stop offset=".5" stopOpacity="1" /><stop offset="1" stopOpacity=".15" /></linearGradient></defs>
      <path d="M0 50Q50 -50 100 50Q50 150 0 50Z" vectorEffect="non-scaling-stroke" />
    </svg>
    <p className="hv-promesa"><span className="hv-linea"><span className="hv-flota">Pusiste el <em>alma</em> en tu negocio.</span></span><span className="hv-linea"><span className="hv-flota">Que también te deje tiempo para vivir.</span></span></p>
  </section>;
}
