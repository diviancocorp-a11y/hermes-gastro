# La comandera — el sector que despacha en papel

> Migración `0075_la_comanda_sale_por_papel.sql`. La otra mitad del KDS: lo
> que pasa cuando un sector **no tiene pantalla**.

## La pregunta que originó esto

*"Con esto del KDS obligamos a la persona al uso de pantallas, y si no tienen,
¿hay forma de darles una opción de comandera clásica?"*

Sí, y el modo vive en el sector, no en el negocio: **cocina con monitor y barra
con comandera es una configuración normal**. Se elige en Producción.

## La restricción que define todo el diseño

Una térmica **USB** imprime desde la máquina en la que está enchufada, y el
navegador sólo puede mandarle a la impresora **predeterminada** de ese equipo.
No hay forma de que la tablet del mozo imprima en la barra.

De ahí sale que la comandera sea una pantalla. **No es una pantalla para
mirar**: es la página que hay que dejar abierta en la computadora que tiene la
impresora del sector. Nadie la lee durante el servicio.

Con dos sectores en papel hacen falta dos equipos, uno por impresora. Con una
térmica de **red**, un solo equipo alcanza para varias y esta restricción
desaparece sin tocar el modelo.

## Cómo se deja lista una computadora

1. La térmica del sector queda como **impresora predeterminada** de Windows.
2. Chrome se abre con **`--kiosk-printing`**:

```bash
chrome.exe --kiosk-printing https://<slug>.divianco.app/admin
```

Sin ese flag, Chrome muestra la ventana de vista previa **en cada comanda** y
alguien tiene que confirmarla a mano. Con el flag, `print()` sale directo a la
predeterminada y nadie toca nada.

3. Entrar al panel, ir a Cocina, elegir el sector y **encender la impresión
   automática**. Queda encendida entre recargas: se guarda en ese navegador.

El ancho del papel se elige en la misma pantalla. 58 mm son 32 columnas y
80 mm son 48.

## El circuito

```
Pedidos  ──bajar a cocina──>  ┌─ sector PANTALLA  →  KDS, el cocinero marca
                              └─ sector PAPEL     →  sale la comanda impresa
                                                     el mozo cierra en Salón
```

En Salón, la ficha de cada mesa muestra qué le debe cada sector. El sector de
papel trae el botón **Entregado**; el de pantalla se muestra y no se toca,
porque ahí marca quien cocina. Dos lugares para marcar lo mismo es la forma más
fácil de que un plato se dé por entregado sin que nadie lo haya visto.

El pedido se sella (`orders.ready_at`) recién cuando **no queda ningún plato
pendiente**, lo haya cerrado la cocina desde su pantalla o el mozo desde el
salón.

## Las tres reglas que no se negocian

**Imprimir dos veces es cocinar dos veces.** La impresión se anota en la base
(`production_dispatches`), no en el navegador: recargar la página, abrirla en
otra pestaña o cambiar de equipo no reimprime el servicio.

**Una reimpresión sale marcada.** El papel dice `*** REIMPRESION ***` arriba
de todo. Un papel repetido sin marca es un plato cocinado de nuevo.

**Una que falló no se reintenta sola.** La impresora no falla por casualidad:
falla porque no hay papel o está desenchufada, y eso no se arregla en el
milisegundo siguiente. Queda en la cola marcada en rojo y se reintenta a mano,
que es cuando alguien ya la miró.

## Lo que no está

- **Corte automático de papel y cajón de dinero.** Son comandos ESC/POS y el
  navegador manda una página, no bytes. Cuando haga falta, el único lugar que
  cambia es `imprimirEtiqueta` en `src/lib/impresionDePasador.js`: recibe texto
  plano, que es lo que ESC/POS también manda.
- **Impresoras de red elegidas desde el panel.** Hoy siempre va a la
  predeterminada del equipo.
- **Expedición.** El armado de bandejas y el pasador son otra pantalla.
