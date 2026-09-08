/**
 * El pulso que recorre las venas del sistema.
 *
 * Vive aparte del canvas —y no adentro de `FlowFieldBackground`— por una
 * razón práctica: el navegador congela `requestAnimationFrame` cuando la
 * pestaña no se está dibujando, así que un pulso escondido en el loop de
 * render no se puede medir. Acá el movimiento es una función de estado a
 * estado, sin canvas y sin tiempo real: se le pueden pedir cuatrocientos
 * cuadros de corrido y comprobar que el grupo sigue junto.
 *
 * ───────────────────────── QUÉ ES, Y QUÉ NO ES ─────────────────────────
 *
 * NO es un puñado de partículas doradas repartidas entre las azules. Eso se
 * probó: de lejos no dice nada, es ruido de dos colores. Esto es UN cuerpo
 * —un grupo que viaja junto— que nace, atraviesa el campo y se apaga; después
 * de un silencio vuelve. El silencio es parte del latido: sin él sería una
 * mancha permanente.
 *
 * LAS DOS FUERZAS
 *
 *  1. EL CAMPO, el mismo que mueve a las venas. Es lo que hace que el pulso
 *     vaya POR las venas y no en línea recta por encima de ellas.
 *  2. LA COHESIÓN, hacia el centro del propio grupo, recalculado en cada
 *     cuadro. Sin esto el campo lo deshace: dos partículas que arrancan a
 *     diez píxeles una de otra caen en ramas distintas del flujo y a los 200
 *     cuadros el grupo ocupa 571x470 (medido en `pulsoDeFlujo.test.js`).
 *
 * LA COHESIÓN NO TIRA AL CENTRO: TIRA A SU SITIO. Una fuerza hacia el punto
 * medio parece lo obvio y está mal — medido: a los 200 cuadros el grupo
 * colapsaba a 0x0, o sea a un punto. El latido se volvía una chispa, que es
 * justo lo contrario de lo que tiene que pasar. Cada partícula guarda al
 * nacer a qué distancia del centro está, y el resorte la lleva a ESA
 * distancia: si se aleja la trae, si se acerca de más la empuja. Así el
 * cuerpo conserva su volumen mientras viaja.
 */

/** El campo. Es la MISMA fórmula que usa cada partícula de fondo. */
export function anguloDelCampo(x, y) {
  return (Math.cos(x * 0.005) + Math.sin(y * 0.005)) * Math.PI;
}

export const PULSO_POR_DEFECTO = {
  /* El tamanio es lo que lo vuelve un HECHO y no un detalle. Con 46
     particulas en 28px de radio era una chispa que pasaba: se veia, pero no
     pesaba. 130 en 70px ocupan lo que ocupa un puño en la pantalla — sigue
     siendo una minoria del flujo (500 particulas de fondo) y ahora se siente
     pasar. */
  tamanio: 130,     // cuántas partículas lo forman
  vida: 300,        // cuadros que dura encendido
  silencio: 140,    // cuadros entre un pulso y el siguiente
  radio: 70,        // cuán apretado nace
  /* La fuerza del resorte que lleva a cada particula a SU distancia del
     centro (ver la cabecera). Mas alta, el cuerpo queda rigido y se lee como
     un disco; mas baja, el campo lo estira antes de que el resorte reaccione. */
  cohesion: 0.02,
  friccion: 0.94,
  velocidad: 0.7,
};

/**
 * Crea el pulso. Devuelve un objeto con `mover()` y el estado a dibujar.
 *
 * `azar` se inyecta para poder fijar el nacimiento en los tests: un latido
 * que aparece en un lugar distinto cada corrida no se puede medir.
 */
export function crearPulso({ ancho, alto, azar = Math.random, ...opciones } = {}) {
  const cfg = { ...PULSO_POR_DEFECTO, ...opciones };
  const estado = {
    vivo: false,
    // El primero no arranca de golpe: la pantalla entra con las venas solas.
    espera: Math.round(cfg.silencio / 2),
    edad: 0,
    puntos: [],
  };

  const nacer = () => {
    // Entra por un borde y no desde el medio: un latido llega de algún lado.
    const porArriba = azar() < 0.5;
    const x0 = porArriba ? azar() * ancho : (azar() < 0.5 ? 0 : ancho);
    const y0 = porArriba ? (azar() < 0.5 ? 0 : alto) : azar() * alto;
    estado.puntos = Array.from({ length: cfg.tamanio }, () => {
      const x = x0 + (azar() - 0.5) * cfg.radio;
      const y = y0 + (azar() - 0.5) * cfg.radio;
      return {
        x,
        y,
        vx: 0,
        vy: 0,
        // A qué distancia del centro le toca vivir. Es lo que le da volumen
        // al cuerpo: ver la cabecera.
        r0: Math.hypot(x - x0, y - y0),
      };
    });
    estado.vivo = true;
    estado.edad = 0;
  };

  const mover = () => {
    if (!estado.vivo) {
      estado.espera -= 1;
      if (estado.espera <= 0) nacer();
      return estado;
    }

    estado.edad += 1;
    if (estado.edad > cfg.vida) {
      estado.vivo = false;
      estado.espera = cfg.silencio;
      estado.puntos = [];
      return estado;
    }

    // El centro del grupo, recalculado cada cuadro: es el ancla de la
    // cohesión y tiene que seguir al grupo, no a donde nació.
    let cx = 0;
    let cy = 0;
    for (const p of estado.puntos) { cx += p.x; cy += p.y; }
    cx /= estado.puntos.length;
    cy /= estado.puntos.length;

    for (const p of estado.puntos) {
      const angulo = anguloDelCampo(p.x, p.y);
      p.vx += Math.cos(angulo) * 0.2 * cfg.velocidad;
      p.vy += Math.sin(angulo) * 0.2 * cfg.velocidad;
      // El resorte a SU distancia, no al centro. `desvio` es positivo cuando
      // se fue lejos —y la trae— y negativo cuando se metió adentro, que es
      // cuando la empuja para afuera. Eso es lo que evita el colapso.
      const dx = cx - p.x;
      const dy = cy - p.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const desvio = dist - p.r0;
      p.vx += (dx / dist) * desvio * cfg.cohesion;
      p.vy += (dy / dist) * desvio * cfg.cohesion;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= cfg.friccion;
      p.vy *= cfg.friccion;
    }
    return estado;
  };

  /**
   * Cuánto se ve, de 0 a 1. Entra y sale con el borde suave: aparecer de
   * golpe se lee como un parpadeo, no como un latido.
   */
  const opacidad = () => {
    if (!estado.vivo) return 0;
    const t = estado.edad / cfg.vida;
    return Math.max(0, Math.min(1, Math.min(t / 0.18, (1 - t) / 0.28)));
  };

  /** El centro y el tamaño del grupo. Para medirlo, y para los tests. */
  const caja = () => {
    if (!estado.puntos.length) return null;
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    let sx = 0; let sy = 0;
    for (const p of estado.puntos) {
      sx += p.x; sy += p.y;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const n = estado.puntos.length;
    return { centro: [sx / n, sy / n], ancho: maxX - minX, alto: maxY - minY };
  };

  return { estado, mover, opacidad, caja };
}
