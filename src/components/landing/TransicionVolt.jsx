import ShaderBackground from './ShaderBackground';
import '../../styles/transicion-volt.css';

export default function TransicionVolt() {
  return <section className="hv-root" aria-label="Machine Soul">
    <div className="hv-efecto" aria-hidden="true"><ShaderBackground /></div>
    <p className="hv-promesa"><span>Que la máquina se ocupe del trabajo.</span><span>Y vos, de lo que te mueve el <em>alma.</em></span></p>
  </section>;
}
