import { Composition } from 'remotion';
import { PromoDico } from './PromoDico.jsx';

// Formato reel (9:16). Los textos son props: la misma plantilla sirve para
// cada plan o cada tenant cambiando solo los datos.
export const Root = () => (
  <Composition
    id="PromoDico"
    component={PromoDico}
    durationInFrames={240}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{
      titulo: 'Tu negocio, en orden.',
      items: ['Pedidos', 'Stock', 'Ventas'],
      cierre: 'divianco.app',
    }}
  />
);
