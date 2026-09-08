// El pulso dorado que recorre las venas del login.
//
// Lo que importa que sea cierto —y que mirando la pantalla no se puede
// afirmar, porque el navegador congela las animaciones cuando la pestaña no
// se está dibujando—:
//
//   - que VIAJE EN BLOQUE. Es lo único que lo distingue de unas partículas
//     doradas sueltas: si el grupo se desarma, deja de ser un latido;
//   - que RECORRA, o sea que llegue a otro lado y no tiemble en su lugar;
//   - que LATA: nace, se apaga, y hay silencio entre uno y el siguiente;
//   - que entre y salga con el borde suave, no de golpe.
//
// Ningún test cuenta cuadros a mano para saber cuándo nació: se avanza HASTA
// que nazca. La primera versión de este archivo daba por sentado el momento
// del nacimiento y fallaba por eso, no por el pulso.

import { describe, it, expect } from 'vitest';
import { crearPulso, PULSO_POR_DEFECTO } from '../components/admin/pulsoDeFlujo';

/** Azar fijo: un latido que nace en otro lado cada corrida no se puede medir. */
const azarFijo = () => {
  let n = 0;
  const valores = [0.3, 0.42, 0.61, 0.18, 0.77, 0.05, 0.93, 0.5];
  return () => valores[n++ % valores.length];
};

const nuevo = (opciones = {}) => crearPulso({
  ancho: 1280, alto: 800, azar: azarFijo(), ...opciones,
});

const avanzar = (pulso, cuadros) => { for (let i = 0; i < cuadros; i++) pulso.mover(); };

/** Avanza hasta que nazca. Devuelve cuántos cuadros hizo falta. */
const hastaQueNazca = (pulso, tope = 2000) => {
  for (let i = 1; i <= tope; i++) {
    pulso.mover();
    if (pulso.estado.vivo) return i;
  }
  throw new Error('el pulso nunca nacio');
};

describe('el pulso viaja en BLOQUE', () => {
  it('a los 200 cuadros el grupo sigue junto', () => {
    const pulso = nuevo({ vida: 1000 });
    hastaQueNazca(pulso);
    const alNacer = pulso.caja();
    avanzar(pulso, 200);
    const despues = pulso.caja();

    expect(pulso.estado.vivo).toBe(true);
    expect(alNacer.ancho).toBeLessThanOrEqual(PULSO_POR_DEFECTO.radio);
    // TECHO: no se desarma.
    expect(despues.ancho).toBeLessThan(260);
    expect(despues.alto).toBeLessThan(260);
    // Y PISO, que es la mitad que faltaba. La primera version solo miraba el
    // techo y dejo pasar el defecto contrario: con la fuerza apuntando al
    // centro, a los 200 cuadros el grupo colapsaba a 0x0 —un punto—. Un
    // latido que se convierte en una chispa es exactamente lo que no se
    // quiere. Ver el resorte en `pulsoDeFlujo.js`.
    expect(despues.ancho).toBeGreaterThan(PULSO_POR_DEFECTO.radio * 0.4);
    expect(despues.alto).toBeGreaterThan(PULSO_POR_DEFECTO.radio * 0.4);
  });

  it('conserva su volumen a lo largo de todo el viaje', () => {
    // No alcanza con mirar un instante: el colapso tardaba en llegar. Se mira
    // el cuerpo en cuatro momentos del recorrido.
    const pulso = nuevo({ vida: 1000 });
    hastaQueNazca(pulso);
    const medidas = [];
    for (let i = 0; i < 4; i++) { avanzar(pulso, 100); medidas.push(pulso.caja()); }
    for (const [i, m] of medidas.entries()) {
      const diagonal = Math.hypot(m.ancho, m.alto);
      expect(diagonal, `en el cuadro ${(i + 1) * 100} el cuerpo mide ${Math.round(m.ancho)}x${Math.round(m.alto)}`)
        .toBeGreaterThan(PULSO_POR_DEFECTO.radio * 0.5);
      expect(diagonal).toBeLessThan(PULSO_POR_DEFECTO.radio * 5);
    }
  });

  it('SIN el resorte el cuerpo deja de tener tamanio propio', () => {
    // PRIMERA VERSION EQUIVOCADA, y la medicion lo mostro: esto exigia que
    // sin cohesion el grupo se DISPERSARA. Es falso. El campo tiene embudos:
    // segun donde caiga, un grupo suelto puede terminar desparramado (571x470
    // medido) o embudonado hasta casi un punto (15px). Las dos cosas son el
    // mismo defecto —deja de ser un cuerpo— pero una sola de las dos entra en
    // "se dispersa".
    //
    // La propiedad de verdad es que el pulso CONSERVA SU TAMANIO. Con
    // resorte se queda en una banda alrededor del tamanio con que nacio; sin
    // resorte se sale de esa banda en algun momento del viaje.
    const banda = (pulso) => {
      hastaQueNazca(pulso);
      const inicial = Math.hypot(pulso.caja().ancho, pulso.caja().alto);
      let seSalio = false;
      for (let i = 0; i < 6; i++) {
        avanzar(pulso, 60);
        const d = Math.hypot(pulso.caja().ancho, pulso.caja().alto);
        if (d < inicial * 0.5 || d > inicial * 3) seSalio = true;
      }
      return seSalio;
    };

    expect(banda(nuevo({ vida: 1000 })), 'el pulso perdio su tamanio').toBe(false);
    expect(banda(nuevo({ vida: 1000, cohesion: 0 })), 'sin resorte se mantuvo igual: entonces el resorte no hace nada').toBe(true);
  });

  it('RECORRE: el centro llega a otro lado, no tiembla en su lugar', () => {
    const pulso = nuevo({ vida: 1000 });
    hastaQueNazca(pulso);
    const [x0, y0] = pulso.caja().centro;
    avanzar(pulso, 200);
    const [x1, y1] = pulso.caja().centro;
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(60);
  });
});

describe('el pulso LATE', () => {
  it('nace, dura lo que dice durar, y despues hay silencio', () => {
    const pulso = nuevo({ vida: 60, silencio: 20 });

    expect(pulso.estado.vivo).toBe(false);           // arranca callado
    const primero = hastaQueNazca(pulso);
    expect(primero).toBe(10);                        // silencio/2

    avanzar(pulso, 61);                              // agota la vida
    expect(pulso.estado.vivo).toBe(false);
    expect(pulso.estado.puntos).toHaveLength(0);

    const segundo = hastaQueNazca(pulso);
    expect(segundo).toBe(20);                        // el silencio completo
  });

  it('entra y sale con el borde suave', () => {
    const pulso = nuevo({ vida: 100, silencio: 2 });
    hastaQueNazca(pulso);
    expect(pulso.opacidad()).toBeLessThan(0.1);      // recien nacido, casi nada
    avanzar(pulso, 25);
    expect(pulso.opacidad()).toBe(1);                // pleno
    avanzar(pulso, 65);
    expect(pulso.opacidad()).toBeLessThan(0.6);      // se esta yendo
    expect(pulso.opacidad()).toBeGreaterThan(0);
  });

  it('nace en un BORDE, no en el medio de la pantalla', () => {
    const pulso = nuevo();
    hastaQueNazca(pulso);
    const [x, y] = pulso.caja().centro;
    const pegado = x < 90 || x > 1190 || y < 90 || y > 710;
    expect(pegado, `nacio en el medio: ${Math.round(x)},${Math.round(y)}`).toBe(true);
  });

  it('el tamanio del grupo es el que se le pide', () => {
    const pulso = nuevo({ tamanio: 4 });
    hastaQueNazca(pulso);
    expect(pulso.estado.puntos).toHaveLength(4);
  });

  it('es una MINORIA del flujo: el fondo sigue siendo las venas', () => {
    // 500 particulas de fondo contra las del pulso. Si alguna vez el pulso
    // pesara mas que las venas, el fondo dejaria de ser el sistema trabajando
    // y pasaria a ser el latido con algo de ruido azul atras.
    expect(PULSO_POR_DEFECTO.tamanio).toBeLessThan(500 / 2);
  });
});
