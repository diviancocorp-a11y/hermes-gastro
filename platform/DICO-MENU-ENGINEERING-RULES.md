# Dico Menu Engineering — reglas funcionales v0.1

Fecha: 8/sep/2026  
Estado: contrato para validar antes de implementar

## Objetivo

`DICO ANALIZA` convierte ventas, costos y disponibilidad en decisiones por
producto. La meta es aumentar la contribucion total de cada categoria:

- proteger Estrellas;
- mejorar el margen de Caballos;
- aumentar la salida de Enigmas;
- reformular o retirar Perros sostenidos.

Kasavana compara sustitutos dentro de su categoria comercial: principales con
principales, bebidas con bebidas y postres con postres.

## La misma card tiene dos vistas

La card no abre otra ruta. Tiene cuatro estados internos:

1. `panorama`: cuatro divisiones, una por cuadrante;
2. `cuadrante`: resumen y rankings separados por categoria comercial;
3. `producto`: perfil estadistico del producto elegido;
4. `resumen-dico`: lectura humana y accesos a las prioridades.

Al tocar un producto, el cuerpo de la misma card cambia a su perfil. La
cabecera muestra volver, nombre, cuadrante y ranking. Volver restaura el
cuadrante abierto, el scroll interno y las acciones ya programadas.

Desktop conserva la card sticky con scroll interno. Mobile abre la card por
decision del usuario y el perfil reemplaza su contenido. Escape vuelve al
ranking en desktop. El boton atras del navegador no interviene porque no hay
una ruta nueva.

## Resumen

La cabecera no ofrece filtros de fecha. Muestra productos activos,
clasificados, en observacion, sin costo y ocultos. La fecha tecnica del ultimo
calculo vive dentro del control de informacion.

El panorama divide la card en Estrellas, Caballos, Enigmas y Perros. Cada bloque
explica el comportamiento y muestra su cantidad. Al elegir uno, la misma card
abre su resumen y separa los productos por categoria comercial; el numero de
ranking se reinicia dentro de cada categoria. `En observacion` y `Sin costo`
entran como estados de calidad de datos en una iteracion posterior.

## Ventana vigente e historial

- Ranking vigente: ultimos 28 dias operativos.
- Pulso reciente: ultimos 7 dias operativos.
- Recalculo oficial: al cerrar cada turno.
- Historial: un snapshot permanente por cierre.

El pulso muestra unidades, aceleracion y tendencia, pero no decide solo el
cuadrante. `DICO RECOMIENDA` puede leer ventas parciales durante el servicio;
no modifica el ranking oficial hasta el cierre.

Los snapshots conservan cuadrante, posicion, precio, costo, recomendacion,
accion elegida y resultado. Asi puede mostrarse una trayectoria como
`Enigma → Enigma → Estrella`.

## Productos nuevos

Un producto nuevo entra como `En observacion`. No modifica umbrales ni ocupa
ranking hasta cumplir ambas condiciones:

- 7 dias operativos disponible;
- 30 oportunidades de su categoria.

Una oportunidad es un ticket que contiene al menos un producto de esa
categoria mientras el producto evaluado estaba visible y disponible. No se
exigen ventas minimas: despues de suficiente exposicion, cero ventas tambien
es informacion.

Cambiar de categoria conserva la historia e inicia tres turnos de observacion
en el nuevo grupo. Un cambio importante de precio o receta crea un hito y
marca la lectura como provisional durante tres turnos.

## Disponibilidad y exclusiones

- Oculto: fuera del ranking vigente; conserva historial.
- Sin stock: el tiempo agotado no cuenta como exposicion.
- Disponible menos del 50% de la ventana: conserva clase anterior con
  `confianza baja`.
- Sin receta o costo confiable: aparece en `Sin costo`, fuera de Kasavana.
- Categoria con menos de tres elegibles: muestra datos sin confirmar clase.
- Eliminado: fuera de la vista vigente; conserva snapshots.

Estas reglas requieren registrar cambios de visibilidad y stock. Los periodos
anteriores a ese registro deben identificarse como estimados.

## Calculo por categoria

```text
popularidad = unidades del producto / unidades elegibles de la categoria
margen unitario = precio neto - costo variable por unidad
contribucion total = unidades vendidas x margen unitario
umbral popularidad = 70% x (1 / productos elegibles de la categoria)
umbral margen = contribucion total de categoria / unidades de categoria
```

El costo preferido es `order_items.unit_cost`, congelado al vender. Si falta,
se usa el costo actual de receta y se marca como estimado. Los descuentos se
distribuyen entre items para obtener el precio neto.

| Cuadrante | Popularidad | Margen unitario |
|---|---|---|
| Estrella | alta | alto |
| Caballo | alta | bajo |
| Enigma | baja | alto |
| Perro | baja | bajo |

## Estabilidad

El ranking puede moverse en cada cierre. El cuadrante confirmado evita saltos
por ruido:

- primer cruce: `posible cambio`;
- confirmacion: dos cierres consecutivos del otro lado del umbral;
- desvio mayor al 10%: puede confirmar en el primer cierre;
- confianza baja: nunca confirma un cambio.

La tendencia visible es `subiendo`, `estable`, `bajando` o `posible cambio a
Estrella`.

## Orden dentro del cuadrante

Todos se ordenan por contribucion total descendente. En empate: mayor
popularidad, mayor margen unitario y finalmente nombre alfabetico. El numero
visible es su posicion dentro del cuadrante; el perfil puede mostrar tambien
su posicion general en la categoria.

Cada fila muestra ranking, nombre, unidades de 7 dias, popularidad, margen por
unidad y proximidad al limite mas cercano. Antes de tener snapshots, la flecha
debe llamarse proximidad y nombrar el cuadrante posible; no afirma una tendencia
historica. Con cierres comparables se suma el cambio real de posicion.

## Resumen Dico

`Resumen Dico` reemplaza la lectura fija del pie. Al abrirlo, Dico 2D deja
temporalmente topbar o sidebar y aparece centrado dentro de la card. El rotulo
`Dico` usa Butler dorado; todo el contenido del resumen usa Overused. Al volver,
Dico recupera su lugar habitual.

La lectura empieza por las metricas del menu: productos clasificados,
categorias, unidades, contribucion estimada y cobertura de datos. Despues
interpreta los cuadrantes y propone prioridades concretas. El texto aparece con
el tipeo compartido de Dico y tocar cualquier punto de la vista lo completa;
`prefers-reduced-motion` lo muestra entero desde el inicio.

Las acciones del resumen pertenecen al producto y a la recomendacion. Por
ejemplo, `Promocionar Risotto` ofrece `Agregar al brief` y deja como directriz
`Ofrezcan Risotto durante el proximo turno`. En esta primera capa queda en un
borrador local visible y no afirma que fue distribuido. Persistencia, entrega al
equipo al abrir turno y seguimiento siguen siendo el proximo incremento.

## Perfil estadistico

La vista `producto` muestra:

- cuadrante y ranking;
- evolucion de cuadrante y posicion;
- ventas de 7 y 28 dias;
- popularidad frente a su categoria;
- margen unitario y contribucion total;
- precio y costo de referencia;
- disponibilidad y tiempo sin stock;
- confianza y motivo de la clasificacion;
- una recomendacion principal de Dico.

Dico expresa la distancia a la mejora cuando puede calcularla. Ejemplo:

> Promocionar Tiramisu. Su margen supera el promedio de Postres, pero necesita
> aproximadamente 8 unidades adicionales por semana para entrar en Estrellas.

## Recomendaciones y microacciones

- Estrella: mantener disponibilidad; evaluar precio solo si la demanda lo
  permite.
- Caballo: revisar costo, porcion o precio sin destruir su volumen.
- Enigma: mejorar exposicion, ubicacion, nombre o recomendacion del equipo.
- Perro: reformular, probar un reposicionamiento limitado o considerar retiro.

Un Perro no se retira automaticamente: puede aportar dieta, variedad, identidad
de marca o venta asociada.

Desde `DICO ANALIZA` se puede agregar al brief del proximo turno, programar una
prueba de impulso, revisar precio, receta, costo o posicion, y marcar para
reformular u ocultar. `Impulsar ahora` pertenece a `DICO RECOMIENDA` durante
un turno abierto.

## Ciclo de aprendizaje

Cada accion guarda producto, snapshot de origen, evidencia, responsable,
turno de inicio, duracion, metrica objetivo, estado y resultado. Los estados
son propuesta, programada, activa, medida y cerrada.

La evaluacion compara turnos equivalentes. Debe medir el producto y la
contribucion total de su categoria para detectar si una promocion solo desplazo
ventas de otro plato.

## Datos a persistir

1. Metricas diarias: ventas, ingreso neto, costo, contribucion, oportunidades
   y tiempo disponible por producto y categoria.
2. Snapshot por cierre: cuadrante, ranking, umbrales, confianza y tendencia.
3. Eventos: alta, categoria, precio, receta, visible, oculto y sin stock.
4. Recomendaciones y acciones con resultado.

## Orden de implementacion

1. Motor por categoria y reglas de elegibilidad.
2. Snapshot al cerrar turno.
3. Ranking desplegable y estado interno del perfil.
4. Perfil estadistico con explicacion.
5. Brief y seguimiento de microacciones.
6. Comparacion de resultados y aprendizaje de Dico.

## Referencias

- Kasavana-Smith y comparacion dentro de categorias:
  https://www.sciencedirect.com/science/article/pii/S0278431920300566
- Regularizacion para nuevos elementos y poca muestra:
  https://ojs.aaai.org/index.php/AAAI/article/download/31975/34130
