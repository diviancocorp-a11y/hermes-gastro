> Fuente: EscenaRubro-comercio.zip entregado por Ricky, 26/oct/2026.
> El apartado Verificado reproduce las comprobaciones declaradas por el creador;
> las verificaciones dentro de esta landing se documentan en LANDING.md.

# EscenaComercio · Dico

Escena 3D del rubro **Comercio** para la landing de Dico, lista para integrar. Es la versión aprobada, sin rediseños ni simplificaciones. Se conservan los personajes, los recorridos, la cámara dirigida, la iluminación, las líneas y los pulsos de Dico, las etiquetas, las fichas y las dos historias completas. Solo se quitó lo que era de la página de demostración: el título, la leyenda, los botones y el texto descriptivo de cada momento.

## Contenido

```
EscenaComercio/
  EscenaComercio.jsx              componente React 19 (export default)
  EscenaComercio.css              CSS plano encapsulado bajo .dse-comercio
  motor/escenaComercio.js         motor three.js: historias, cámara, efectos, calidad, alternativa estática
  assets/comercio-estatica.webp   imagen fija tomada de la versión aprobada (960 × 720, 32 KB)
ejemplo/
  EjemploComercio.jsx             referencia: controles y textos externos conectados a la escena
README.md
```

Todo el código está completo y es editable. No hay archivos generados, código minificado ni referencias a rutas privadas.

## Instalación

1. Copiá la carpeta `EscenaComercio/` dentro de tu proyecto, por ejemplo en `src/components/landing/EscenaComercio/`.
2. No hace falta instalar nada: la escena usa el `three` que ya tenés en el proyecto (0.186.1) y lo importa con `import * as THREE from 'three'`.
3. Vite importa el `.css` y el `.webp` sin configuración extra. La imagen se resuelve con una ruta relativa desde el componente.

| Paquete | Versión | Rol |
|---|---|---|
| `three` | 0.186.1, ya instalado | motor 3D |
| `react`, `react-dom` | 19.x, ya instalados | componente |

No agrega frameworks, dependencias, fuentes, servicios externos ni llamadas a APIs. La tipografía se hereda de la landing.

## Uso

```jsx
import EscenaComercio from './EscenaComercio/EscenaComercio.jsx';

<EscenaComercio
  momento={momento}                       // null = recorrido completo automático
  onMomento={(id) => setTexto(id)}        // momento que se está viendo
  onDisponibilidad={(estado) => {}}       // 'animada' | 'estatica' | 'sin-webgl' | 'contexto-perdido'
/>
```

### Props

| Prop | Tipo | Qué hace |
|---|---|---|
| `momento` | `null` o un ID de la tabla de momentos | `null` reproduce el recorrido completo en bucle: primero la compra presencial y después la compra online. Con un ID, la escena va en unos 0,4 s a ese instante y congela personajes, cámara y efectos. Si se vuelve a `null`, la historia continúa desde ese mismo instante, sin reiniciarse. Un ID desconocido se trata como `null`. |
| `onMomento(id)` | función | Avisa cuál es el momento visible. Se llama al entrar en cada momento del recorrido, al congelar uno y también con movimiento reducido. No se repite si el momento no cambia. |
| `onDisponibilidad(estado)` | función | Avisa en qué estado quedó la escena. `'animada'` es el funcionamiento normal. `'estatica'` significa que el usuario pidió movimiento reducido. `'sin-webgl'` significa que se muestra la imagen fija. `'contexto-perdido'` indica que el navegador pausó el gráfico y la escena vuelve sola cuando lo recupera. |

Los callbacks pueden cambiar en cada render sin que la escena se vuelva a crear.

### Momentos

Cada ID es único entre las dos historias. Los dos cobros tienen IDs distintos.

| ID | Historia | Rango en el ciclo | Instante congelado | Qué se ve |
|---|---|---|---|---|
| `p-eleccion` | Presencial | 0,0 – 16,1 s | 15,1 s | El cliente recorre las estanterías y toma el producto con la mano. Todavía no hay pedido. |
| `p-venta` | Presencial | 16,1 – 27,0 s | 26,0 s | En caja se registra y se completa la venta. La línea viaja al depósito y el Paquete A baja de 18 a 17. |
| `p-cobro` | Presencial | 27,0 – 33,8 s | 27,0 s | El cobro se registra aparte, con su medio de pago (efectivo, $ 4.800). Caja responde con su pulso. |
| `o-pedido` | Online | 33,8 – 41,5 s | 40,2 s | Desde su casa, la clienta envía el pedido #31. Llega al mostrador y el stock no cambia. |
| `o-preparacion` | Online | 41,5 – 59,3 s | 53,7 s | Mientras la clienta camina por la vereda, un empleado prepara la compra. Preparar no descuenta stock. |
| `o-completar` | Online | 59,3 – 67,8 s | 66,9 s | La clienta llega y retira la compra. Al completar el pedido se descuenta el stock (Paquete A 17 → 16, Frasco C 9 → 8). |
| `o-cobro` | Online | 67,8 – 82,2 s | 72,9 s | En caja se registra el pago aparte (tarjeta, $ 7.300) y la clienta sale con su bolsa. |

- **Duración del ciclo completo:** 82,2 s. Al final hay un fundido corto que lo une con el comienzo.
- La historia presencial ocupa de 0 a 36,9 s. La online va de 33,8 a 82,2 s y empieza mientras el primer cliente se está yendo.
- Todos los datos (productos, montos, números de pedido y cantidades) son ficticios.

### Motor sin React (opcional)

```js
import { createDicoScene, MOMENTOS, HISTORIAS } from './EscenaComercio/motor/escenaComercio.js';

const escena = createDicoScene(contenedor, { imagenAlternativa, onMomento, onDisponibilidad });
escena.set({ rubro: 'comercio', momento: null });
escena.stats();    // { fps, calidad }  calidad: 'alta' | 'media' | 'baja' | 'sin-webgl'
escena.dispose();
```

- `createDicoScene` admite además las opciones `calidad` (`'auto'` por defecto, o `'alta'`, `'media'` o `'baja'`) y `proporcion` (`'4 / 3'` por defecto; con `null` la escena llena el contenedor).
- `MOMENTOS.comercio` exporta los siete IDs en orden. `HISTORIAS` los exporta agrupados por historia.
- `set` también acepta `historia: 'presencial' | 'online'` para reproducir una sola historia en bucle. La landing no lo necesita: con `historia` sin definir se reproducen las dos.

## Comportamiento

1. **Tamaño.** La escena ocupa todo el ancho del contenedor con proporción 4:3 y funciona desde 320 px de ancho. Con menos de 440 px muestra solo la ficha más reciente, en versión corta, y oculta las etiquetas de los sectores inactivos. Ninguna ficha ni etiqueta sale de los bordes.
2. **Scroll.** La escena no escucha la rueda, así que la rueda siempre desplaza la página. No hay zoom. En pantallas táctiles el gesto vertical desplaza la página (`touch-action: pan-y`) y el arrastre horizontal gira apenas la cámara, con límites. Al reanudar, la cámara vuelve sola a su recorrido.
3. **Pausa.** La animación se detiene cuando la escena sale de la pantalla y cuando la pestaña queda oculta. Si no hay nada que animar, tampoco redibuja.
4. **Movimiento reducido.** Con `prefers-reduced-motion`, la escena queda estática en un instante representativo y los cambios de `momento` son inmediatos, sin animar la cámara.
5. **Sin WebGL.** Si WebGL no está disponible, se muestra `comercio-estatica.webp` con `role="img"`, una descripción accesible y un aviso visible. En ese caso three.js escribe en la consola «Error creating WebGL context». Ese mensaje es de three, no de la escena.
6. **Calidad adaptable.**
   - La calidad inicial depende del equipo: alta, media o baja.
   - En celulares y tabletas (puntero táctil o pantalla chica) nunca es alta. Ahí la resolución queda en 1,35× como máximo y las sombras usan un mapa de 512 px sin suavizado.
   - Si el equipo no sostiene unos 38 fps, la calidad baja sola. Nunca sube sola.
7. **Al desmontar.** `dispose()` libera la animación (RAF), los listeners, los observadores, las geometrías, los materiales, las texturas, el mapa de sombras y el renderer, y suelta el contexto WebGL. Funciona con React StrictMode.
8. **Accesibilidad.** Mientras está animada, la escena es decorativa (`aria-hidden`): los textos accesibles los pone la landing.

## CSS

- Todas las reglas cuelgan de `.dse-comercio-host` o `.dse-comercio`. No tocan `html`, `body` ni estilos globales.
- Si la landing también usa el paquete de Gastronomía, las reglas de Comercio ganan por especificidad dentro de esta escena y no alteran la de Gastronomía.
- Para otro alto, ajustá `aspect-ratio` en `.dse-comercio .dse-stage` desde la landing, o creá el motor con `proporcion: null` dentro de un contenedor con alto fijo.

## Cambios respecto del motor aprobado

La construcción de la escena (local, personajes, guiones, efectos, fichas, luces y planos de cámara) es la misma de la versión aprobada. Lo único que cambió en esa parte es que las geometrías de los productos ahora se crean por escena, para que cada montaje libere las suyas. El resto de los cambios son de integración:

1. Los estilos pasaron de inyectarse desde JavaScript a vivir en `EscenaComercio.css`, encapsulados bajo `.dse-comercio`.
2. Se quitaron el texto descriptivo dentro de la escena (`mostrarTexto`) y las funciones de revisión `debug` y `seek`.
3. Se agregaron la alternativa estática sin WebGL, `onDisponibilidad` y la recuperación cuando el navegador pierde el contexto gráfico.
4. `onMomento` ahora también informa cuando el momento está congelado o con movimiento reducido, no solo durante el recorrido.
5. En celulares y tabletas la calidad inicial nunca es alta.
6. Sombras con three r180 o posterior. En esas versiones three retiró `PCFSoftShadowMap`: lo reemplaza por `PCFShadowMap` y avisa en consola. Por eso el motor elige `PCFShadowMap` directamente, sin generar el aviso. Con versiones anteriores sigue usando `PCFSoftShadowMap`, como la versión aprobada.

## Verificado

Se armó un proyecto nuevo con Vite 6, React 19.3.1, three 0.186.1 y StrictMode, usando solo el contenido de este ZIP. Las pruebas se hicieron en Chromium con WebGL por software.

1. **Reconstrucción exacta.**
   - Con el mismo código compilado contra three 0.158.0 (la versión del artifact aprobado), los siete momentos congelados salen idénticos píxel por píxel a los de la versión aprobada. La excepción es `o-completar`, que difiere en el 0,1 % de los píxeles.
   - Con three 0.186.1, ningún píxel difiere en más de 24 niveles sobre 255. La diferencia media es de 0,2 a 0,6 niveles y viene del cambio de filtrado de sombras de three.
2. **Montaje.** Hay un solo canvas después del doble montaje de StrictMode. Seis ciclos de montar y desmontar terminan sin errores. Después de desmontar quedan cero nodos y no se pide ningún cuadro más.
3. **Recorrido automático.** Recorre los siete momentos en orden y vuelve a `p-eleccion`. Al congelar `o-preparacion` y reanudar, sigue con `o-completar` y `o-cobro`, sin volver al comienzo.
4. **Pausa.** En pausa, fuera de pantalla y con la pestaña oculta no se pide ningún cuadro. Al volver a la pantalla, retoma.
5. **Rueda.** Sobre la escena desplaza la página (500 px en la prueba) y no hace zoom.
6. **Movimiento reducido.** La imagen queda quieta y la selección manual de momentos funciona.
7. **Sin WebGL.** Se ve la imagen fija, que carga correctamente, con `role="img"`. Avisa `'sin-webgl'` y se desmonta sin dejar restos.
8. **320 px.** La escena mide 320 × 240, no aparece scroll horizontal y ninguna ficha ni etiqueta sale de los bordes en los siete momentos.
9. **Celular simulado (iPhone 13).** La calidad queda en media y la resolución en 1,35×. En escritorio, la calidad es alta.
10. **Consola.** Queda limpia con three 0.186.1, sin advertencias ni errores. La única excepción es el mensaje de three en la prueba forzada sin WebGL.

## Sin verificar

- **Celular real.** No se midieron fps, temperatura ni batería en un teléfono. La escena tiene 10 luces puntuales, que es lo más exigente para un equipo de gama baja.
- **Otros navegadores.** No se probó en Safari (iOS y macOS) ni en Firefox.
- **Tu landing.** No se probó dentro de tu sección de rubros ni con tu configuración de Vite.

## Licencias

- El código, la geometría y la imagen `comercio-estatica.webp` se generaron para Divianco en este trabajo. No hay assets de terceros.
- `three` se distribuye con licencia MIT (© three.js authors). `react` y `react-dom` tienen licencia MIT (© Meta Platforms, Inc.). No se incluye copia de ninguno de los dos: se usan los que ya tiene el proyecto.
