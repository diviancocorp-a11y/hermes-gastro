/**
 * DicoCuadro — burbuja, personaje y una accion. La composicion grande.
 *
 * Reemplaza a `DicoEscena` y `DicoCoreEscena`, que eran lo mismo con dos
 * personajes distintos: uno cargaba siete renders narrativos con galera y
 * bigote, el otro montaba el cuerpo Core con la cara en tinta. Los dos eran
 * pruebas de identidad que quedaron vivas. Ahora hay un solo Dico 3D y esta
 * composicion usa ese.
 *
 * NO ES UN ESTADO VACIO GENERICO. Se usa donde hace falta que Dico pida algo
 * concreto: la pantalla sin productos, el alta sin terminar. Un cartel de
 * "no hay nada" no necesita un personaje de 188px.
 *
 * EL PERSONAJE NO RESPIRA ACA. El pet ya se anima solo dentro de su celda;
 * sumarle el balanceo del contenedor daba dos movimientos encimados a ritmos
 * distintos, que se lee como un error de sincronizacion.
 */
import BurbujaDico from './BurbujaDico';
import DicoPhysical from './DicoPhysical';
import './escena.css';

export default function DicoCuadro({
  pose = 'idle',
  texto,
  accion,
  onAccion,
  nivel = 'sugerencia',
  size = 170,
  title = 'Dico',
}) {
  return (
    <section className={`dico-cuadro dico-cuadro--pet dico-cuadro--${pose}`}>
      {texto && <BurbujaDico texto={texto} nivel={nivel} cola="centro" />}

      <div className="dico-cuadro-personaje" style={{ '--dico-cuadro-size': `${size}px` }}>
        <DicoPhysical pose={pose} title={title} />
      </div>

      {accion && (
        <button type="button" className="ag-cta dico-cuadro-accion" onClick={onAccion}>
          {accion}
        </button>
      )}
    </section>
  );
}
