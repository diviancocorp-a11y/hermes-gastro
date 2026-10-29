> Fuente: EscenaRubro-servicios.zip entregado por Ricky, 26/oct/2026.
> Las pruebas declaradas por el creador se distinguen de las comprobaciones
> dentro de esta landing, documentadas en LANDING.md. Solo preview; no produccion.

# EscenaServicios · Dico

> **NO PUBLICAR hasta validar las funciones representadas.**
>
> La escena muestra funciones objetivo de Dico para servicios que todavía están pendientes de desarrollo: reserva online, cancelación online, llegada con QR, avisos en el teléfono de los profesionales, agenda compartida y resumen del día. Es solo una simulación visual con datos ficticios. No hace reservas reales, el QR no es operativo, no envía notificaciones y no se conecta a ningún servicio, API ni backend.

Escena 3D del rubro **Servicios** (barbería) para la landing de Dico, lista para integrar. Es la versión aprobada, con su distribución:

- oficina del dueño en la esquina inferior izquierda;
- casa con televisor;
- entrada con QR;
- sillón de espera;
- café;
- estantería;
- caja;
- dos puestos.

Se conservan los personajes, los recorridos, la narrativa, la cámara, la iluminación, las líneas volt y los pulsos dorados y rojos, el reloj con sus saltos de tiempo, la agenda, las etiquetas y las fichas. Solo se quitó lo que pertenecía a la página de revisión: el título, la leyenda, los botones, el texto de cada momento y la vista general estática previa.

## Contenido

```
EscenaServicios/
  EscenaServicios.jsx              componente React 19 (export default)
  EscenaServicios.css              CSS plano encapsulado bajo .dse-servicios
  motor/escenaServicios.js         motor three.js completo: historia, reloj, agenda, cámara, efectos, calidad, alternativa
  assets/servicios-estatica.webp   imagen fija tomada de la versión aprobada (960 × 720, 22 KB)
ejemplo/
  EjemploServicios.jsx             referencia: controles accesibles y textos externos conectados a la escena
README.md
```

Todos los archivos están completos y son editables. No hay código minificado, archivos generados ni referencias a rutas privadas. Las texturas del QR, el televisor y los brillos se dibujan por código, así que no hay otros assets que copiar.

## Instalación

1. Copiá la carpeta `EscenaServicios/` dentro de tu proyecto, por ejemplo en `src/components/landing/EscenaServicios/`.
2. No hace falta instalar nada. La escena usa el `three` que ya tenés (0.186.1) y lo importa con `import * as THREE from 'three'`.
3. Vite importa el `.css` y el `.webp` sin configuración extra. La imagen se resuelve con una ruta relativa desde el componente.

| Paquete | Versión | Rol |
|---|---|---|
| `three` | 0.186.1, ya instalado | motor 3D |
| `react`, `react-dom` | 19.x, ya instalados | componente |

No agrega frameworks, dependencias, fuentes, CDN, APIs, backend ni servicios externos. La tipografía se hereda de la landing; la versión aprobada se revisó con Geist o, si no carga, con la fuente del sistema.

## Uso

```jsx
import EscenaServicios from './EscenaServicios/EscenaServicios.jsx';

<EscenaServicios
  momento={momento}                     // null = historia automática
  onMomento={(id) => setEtapa(id)}      // etapa que se está viendo
  onDisponibilidad={(estado) => {}}     // 'animada' | 'estatica' | 'sin-webgl' | 'contexto-perdido'
/>
```

### Props

| Prop | Tipo | Qué hace |
|---|---|---|
| `momento` | `null`, `'llegada'`, `'reserva'`, `'cancelacion'` o `'recuperado'` | Con `null` la historia se reproduce sola, en bucle. Con un momento, la escena va en unos 0,4 s a su instante representativo y congela el reloj, los personajes, la cámara y los efectos. Al volver a `null` la historia continúa desde ese instante, sin reiniciarse. Cualquier otro valor se trata como `null`. |
| `onMomento(id)` | función | Avisa la etapa activa: al entrar en cada etapa durante la historia, al congelar una y también con movimiento reducido. Si la etapa no cambia, no repite el aviso. |
| `onDisponibilidad(estado)` | función | Avisa en qué estado quedó la escena. `'animada'` es el funcionamiento normal. `'estatica'` aparece cuando el usuario pidió movimiento reducido. `'sin-webgl'` significa que se muestra la imagen fija. `'contexto-perdido'` indica que el navegador pausó el gráfico; la escena se recupera sola. |

Los callbacks pueden cambiar en cada render sin que la escena se vuelva a crear.

### Momentos

| ID | Rango en el ciclo | Instante congelado | Reloj | Qué se ve |
|---|---|---|---|---|
| `llegada` | 0,0 – 26,6 s | 8,1 s | 16:01 | Tomás llega a su turno de las 16:00 y escanea el QR. El aviso llega a la vez a la caja y al teléfono de su barbero, y la agenda pasa a «Llegó». Tomás espera en el sillón. Lucas termina su corte, toma un producto de la estantería y paga en caja (corte + producto, $ 18.500). El resumen del día llega a la oficina del dueño. |
| `reserva` | 26,6 – 49,8 s | 45,6 s | 16:05 | El barbero empieza con Tomás. Desde su casa, Martín reserva las 17:00 en el teléfono, sentado frente al televisor. La línea volt llega a la agenda y después, uno por uno, a los teléfonos de los dos barberos, cada uno con su pulso dorado. Es la única reserva de la historia. |
| `cancelacion` | 49,8 – 63,9 s | 59,7 s | 16:20 | Primero hay un salto de tiempo: «+15 min · 16:20». Juan cancela desde la vereda su turno de las 16:30. La señal roja llega a la vez a la agenda y a los dos teléfonos. La fila de las 16:30 pasa a «Cancelado» y después a «Disponible». |
| `recuperado` | 63,9 – 93,1 s | 79,6 s | 16:31 | Hay otro salto de tiempo: «+10 min · 16:30». Llega Bruno sin turno. En caja le asignan esa misma fila de las 16:30 («Asignado») y pasa al puesto que quedó libre. |

- **Duración del ciclo completo:** 93,1 s. Al final hay un fundido corto que lo une con el comienzo.
- **Reloj:** avanza un minuto cada 8 s de historia y tiene dos saltos marcados con un oscurecimiento. El primero va de 49,8 a 51,8 s y lleva el reloj a las 16:20. El segundo va de 63,9 a 65,9 s y lo lleva a las 16:30.
- **Datos:** todos son ficticios: nombres, horarios, montos y cantidades.

### Motor sin React (opcional)

```js
import { createDicoScene, MOMENTOS } from './EscenaServicios/motor/escenaServicios.js';

const escena = createDicoScene(contenedor, { imagenAlternativa, onMomento, onDisponibilidad });
escena.set({ rubro: 'servicios', momento: null });
escena.stats();    // { fps, calidad }  calidad: 'alta' | 'media' | 'baja' | 'sin-webgl'
escena.dispose();
```

`createDicoScene` admite además dos opciones:

- `calidad`: `'auto'` por defecto, o `'alta'`, `'media'` o `'baja'`.
- `proporcion`: `'4 / 3'` por defecto. Con `null`, la escena llena el contenedor.

`MOMENTOS.servicios` exporta los cuatro IDs en orden.

## Comportamiento

1. **Tamaño.** La escena ocupa todo el ancho del contenedor con proporción 4:3 y funciona desde 320 px.
   - Con menos de 440 px de ancho, el reloj se reduce a una línea y la agenda muestra solo la fila que acaba de cambiar (o la última que cambió).
   - Las fichas pasan a su versión corta y se ocultan las etiquetas inactivas.
   - Así la casa, la caja, los puestos y la vereda siguen visibles en cada encuadre, y nada sale de los bordes.
2. **Scroll.** La escena no escucha la rueda: la rueda siempre desplaza la página y no hay zoom.
   - En pantallas táctiles el gesto vertical desplaza la página (`touch-action: pan-y`).
   - El arrastre horizontal gira apenas la cámara, con límites. Al reanudar, la cámara vuelve sola a su recorrido.
3. **Pausa.** La animación se detiene fuera de pantalla y con la pestaña oculta. Si no hay nada que animar, tampoco redibuja.
4. **Movimiento reducido.** Con `prefers-reduced-motion`, la escena queda estática en el instante de `llegada` y la selección manual de momentos es inmediata, sin animar la cámara.
5. **Sin WebGL.** Si WebGL falta o falla, se muestra `servicios-estatica.webp` con `role="img"`, una descripción accesible y un aviso visible. En ese caso three.js escribe en la consola «Error creating WebGL context». Ese mensaje es de three, no de la escena.
6. **Calidad adaptable.**
   - La calidad inicial depende del equipo: alta, media o baja.
   - En celulares y tabletas (puntero táctil o pantalla chica) nunca es alta: la resolución queda en 1,35× como máximo y las sombras usan un mapa de 512 px.
   - Si el equipo no sostiene unos 38 fps, la calidad baja sola. Nunca sube sola.
7. **Al desmontar.** `dispose()` libera la animación (RAF), los listeners, los observers, las geometrías, los materiales, las texturas, el mapa de sombras y el renderer, y suelta el contexto WebGL. Funciona con React StrictMode, sin duplicar el canvas ni los listeners.
8. **Accesibilidad.** Mientras está animada, la escena es decorativa (`aria-hidden`). Los controles y textos accesibles los pone la landing.

## CSS

- Todas las reglas cuelgan de `.dse-servicios-host` o `.dse-servicios`. No tocan `html`, `body` ni estilos globales.
- Puede convivir con los paquetes de Gastronomía y Comercio en la misma landing.
- Para otro alto, ajustá `aspect-ratio` en `.dse-servicios .dse-stage` desde la landing, o creá el motor con `proporcion: null` dentro de un contenedor con alto fijo.

## Cambios respecto de la versión aprobada

La construcción de la escena (local, casa, personajes, guiones, efectos, fichas, agenda, reloj, luces y planos de cámara) es la de la versión aprobada, con estas excepciones:

1. **Sin teletransportes.** En la versión aprobada, durante el salto a las 16:30 Martín cambiaba de lugar de golpe, aunque la pantalla estaba oscurecida. Ahora camina 1,5 m hasta ese mismo lugar. Los cuatro instantes congelados no cambian.
2. **Vista general estática.** La versión aprobada abría con una vista estática previa, que era un control de la página de revisión. Se quitó, porque la landing usa solo los cuatro momentos pedidos.
3. **Pantallas de menos de 440 px.** Se agregó la versión compacta del reloj y de la agenda. Sin ella, a 320 px la agenda tapaba la caja y los puestos.
4. **Interlineado de la agenda.** Ahora es fijo (1,5). Antes lo heredaba de la página de revisión y, sin fijarlo, cambiaría según la landing.
5. **Integración.**
   - Los estilos pasaron de inyectarse desde JavaScript a vivir en `EscenaServicios.css`.
   - Se quitaron el texto descriptivo dentro de la escena y las funciones de revisión `debug` y `seek`.
   - Se agregaron la alternativa sin WebGL, `onDisponibilidad` y la recuperación cuando el navegador pierde el contexto gráfico.
   - `onMomento` ahora también informa en pausa y con movimiento reducido.
   - En celulares y tabletas la calidad nunca es alta.
6. **Sombras con three r180 o posterior.** En esas versiones three retiró `PCFSoftShadowMap`: lo reemplaza por `PCFShadowMap` y avisa en la consola. El motor elige `PCFShadowMap` directamente, así no aparece el aviso. Con versiones anteriores sigue usando `PCFSoftShadowMap`, como la versión aprobada.

## Verificado

Se armó un proyecto nuevo con Vite 6, React 19.3.1, three 0.186.1 y StrictMode, usando solo el contenido de este ZIP. Las pruebas se hicieron en Chromium con WebGL por software.

1. **Reconstrucción.**
   - Con el mismo código compilado contra three 0.158.0 (la versión del artifact aprobado), los cuatro instantes congelados salen idénticos píxel por píxel a los de la versión aprobada, incluidos el reloj y la agenda.
   - Con three 0.186.1, ningún píxel difiere en más de 24 niveles sobre 255. La diferencia media es de 0,3 niveles y viene del cambio de filtrado de sombras de three.
2. **Continuidad.** Recorriendo todo el ciclo cada 0,05 s, ningún personaje visible cambia de posición más de 20 cm entre muestras, ningún par de personajes se superpone y nadie atraviesa muebles ni paredes. Los únicos contactos con muebles son el dueño sentado en su silla y Tomás sentado en el sillón de espera.
3. **Historia automática.** Pasa por `llegada`, `reserva`, `cancelacion` y `recuperado` y vuelve a `llegada`. Al congelar `cancelacion` (reloj 16:20) y reanudar, sigue con `recuperado` (16:31), sin volver al comienzo.
4. **Momentos congelados.** El reloj queda quieto: 16:01, 16:05, 16:20 y 16:31. En pausa no se pide ningún cuadro.
5. **StrictMode.** Queda un solo canvas tras el doble montaje y tras seis ciclos de montar y desmontar.
   - Después de cada desmontaje, los listeners propios de la escena (visibilidad, puntero, contexto WebGL y preferencia de movimiento) y los observers vuelven a cero.
   - No quedan nodos y no se piden más cuadros.
6. **Pausa.** Fuera de pantalla y con la pestaña oculta no se pide ningún cuadro. Al volver, retoma.
7. **Rueda.** Sobre la escena desplaza la página (500 px en la prueba), sin zoom.
8. **Movimiento reducido.** La escena queda estática y la selección manual funciona.
9. **Sin WebGL.** Se ve la imagen fija, que carga correctamente, con `role="img"`. Avisa `'sin-webgl'` y se desmonta sin dejar restos.
10. **320 px.** La escena mide 320 × 240 y no aparece scroll horizontal. En los cuatro momentos, ninguna ficha, etiqueta, reloj ni agenda sale de los bordes.
11. **Celular simulado (iPhone 13).** La calidad queda en media y la resolución en 1,35×. En escritorio, la calidad es alta.
12. **Consola.** Queda limpia con three 0.186.1. La única excepción es el mensaje de three en la prueba forzada sin WebGL.

## Sin verificar

- **Celular real.** No se midieron fps, temperatura ni batería en un teléfono. La escena tiene 11 luces puntuales, que es lo más exigente para un equipo de gama baja.
- **Otros navegadores.** No se probó en Safari (iOS y macOS) ni en Firefox.
- **Tu landing.** No se probó dentro de tu sección de rubros ni con tu configuración de Vite.

## Licencias

- El código, la geometría, las texturas dibujadas por código y la imagen `servicios-estatica.webp` se generaron para Divianco en este trabajo. No hay assets de terceros.
- `three` se distribuye con licencia MIT (© three.js authors). `react` y `react-dom` tienen licencia MIT (© Meta Platforms, Inc.). No se incluye copia de ninguno de los dos: se usan los del proyecto.
