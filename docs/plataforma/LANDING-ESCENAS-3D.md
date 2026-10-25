# Prompt para adaptar la maqueta 3D al segmento 3 de Dico

Copiar el bloque siguiente junto con el código original de la maqueta. La
landing ya contiene la barra de rubros, el lateral de dolor/respuesta y los
botones de momentos. Este encargo es solo para la escena de la derecha.

---

Adaptá la maqueta 3D existente de «Salón en servicio» para una demostración
comercial de Dico, un sistema de gestión para gastronomía, comercio y servicios.
Queremos que el dueño reconozca su negocio y entienda dónde interviene el
sistema. Conservá la profundidad real, la perspectiva abierta y los personajes
simples del original; no reemplaces el 3D por una captura inclinada de una app.

## Composición y arte

- Crear un pequeño local abierto, como una maqueta sin techo, con perspectiva
  tres cuartos. Cámara inicial legible y parecida entre los tres rubros.
- Fondo negro zinc #09090b, superficies #18181b y #27272a. Blanco suave para
  etiquetas. Azul volt #3d6bff para zonas y recorridos activos; etiquetas azul
  claro #93b4ff. Dorado #e0ac3c en detalles puntuales, sin dominar la escena.
- Proporción adaptable 4:3, sin textos minúsculos ni etiquetas superpuestas.
  Ajustar cámara y tamaño al contenedor; debe funcionar desde 320 px de ancho.
- Movimiento de personas y objetos tranquilo. Evitar destellos, luces que
  bañen todo el local o una estética de videojuego con marcadores por todas partes.
- No incluir otro menú de rubros, títulos comerciales, CTA ni botones de
  momentos: esos elementos ya están construidos alrededor de tu escena.
- Quitar los controles de simulación del original: noche/hora pico, cantidad
  de camareros, velocidad y estadísticas de espera/clientes perdidos. No
  atribuir a Dico mejoras numéricas inventadas ni optimización de personal.

## Escenas y momentos exactos

1. rubro="gastronomia": salón con mesas, cocina, depósito y caja.
   - momento="pedido": iluminar salón y cocina. Mostrar el registro del pedido
     y el recorrido de la comanda hacia cocina. Texto: «El pedido queda en Dico
     y las comandas llegan al sector de cocina correspondiente».
   - momento="stock": iluminar depósito. Mostrar un pedido completado y la
     actualización de los insumos de su receta. No descontar al recibirlo.
   - momento="cobro": iluminar caja. Mostrar registro por medio de pago. Cobrar
     y completar un pedido son acciones distintas, no un automatismo único.
2. rubro="comercio": mostrador, estanterías, depósito y caja.
   - momento="pedido": iluminar mostrador; cliente elige producto y se registra
     el pedido del catálogo o mostrador.
   - momento="stock": iluminar depósito; al completar el pedido se actualizan
     los artículos. No mostrar talles/colores ni alertas de mínimo por artículo.
   - momento="cobro": iluminar caja; registro del cobro. No mostrar margen neto
     por artículo: el costo de lo vendido por artículo sigue en desarrollo.
3. rubro="servicios": recepción, puestos de atención y caja.
   - momento="turno": iluminar recepción y representar un turno organizado
     por el equipo en la agenda interna. No mostrar reserva online del cliente.
   - momento="atencion": iluminar puestos; representar la atención y registro
     de venta del servicio. No descontar automáticamente insumos por servicio.
   - momento="cobro": iluminar caja; registrar el cobro del servicio realizado.

## Interacción e integración

Entregar preferentemente un componente React 19 con JavaScript puro:

    export default function EscenaRubro({ rubro, momento }) { ... }

- rubro es "gastronomia", "comercio" o "servicios".
- momento=null significa reproducción automática: recorrer los tres momentos
  del rubro en orden, cada 5–7 segundos, en bucle suave.
- Con un momento concreto, detener el tiempo narrativo y mostrar ese estado
  de forma estable, iluminando solo sus zonas. Pausar también el movimiento
  de los personajes; permitir explorar la cámara sin avanzar la historia.
- Volver a momento=null reanuda la historia. El cambio de rubro reinicia su
  escena y elimina los objetos/efectos anteriores; el padre reinicia momento.
- Interpolar cámara/luz en 280–480 ms sin un fundido largo ni mareos.
- Respetar prefers-reduced-motion: escena estática, cambio manual inmediato.
  Pausar animación fuera de pantalla y con la pestaña oculta.
- Arrastrar para girar con límites suaves; no secuestrar la rueda ni impedir
  el scroll vertical en móvil. No hace falta zoom para entender la escena.
- Canvas decorativo para lectores de pantalla: el texto y los controles
  accesibles ya existen en el padre. No depender del hover para comprender.
- No llamar APIs, no usar datos de clientes, ni Supabase. Datos ficticios.
- Encapsular CSS, ajustar DPR para móvil y liberar listeners, RAF, geometrías,
  materiales y texturas al desmontar/cambiar escena. No cargar tres motores.
- Si el original solo funciona en HTML, entregar el HTML completo y exponer
  window.setDicoScene({ rubro, momento }) con la misma semántica. No es
  suficiente entregar un video o una imagen; necesitamos código integrable.
- Declarar motor, versión y dependencias utilizadas. No añadir instalaciones
  ni cambiar la arquitectura de la landing como parte de esta maqueta.

Primero terminá gastronomía para validar la calidad; las otras dos deben
usar el mismo lenguaje visual. Entregar código y assets necesarios con sus
licencias y rutas relativas, sin depender de archivos privados ni credenciales.

## Contexto del lateral ya construido

- Gastronomía: «Entre el salón y la cocina, todo pasa por vos».
  Dico conecta pedidos, mesas y cocina y reúne información del negocio.
- Comercio: «Vendés por un lado. Controlás lo que queda por otro».
  Dico reúne catálogo, pedidos, stock por artículo y cobros.
- Servicios: «Atender bien requiere tiempo. Organizar todo, también».
  Dico reúne agenda interna, servicios y cobros; reserva online en desarrollo.

---

## Punto de integración en el repo

src/components/landing/RubrosNegocio.jsx: reemplazar el interior de .rn-escena
por EscenaRubro con rubro=enfoque.id y momento=momento. El padre ya permite
seleccionar y deseleccionar un momento (null) y reinicia al cambiar de rubro.
No duplicar botones, texto explicativo, alcance ni navegación en la escena.
Cuando haya reproducción real, agregar indicación de pausa y acción visible
«Reanudar recorrido» que establezca momento=null. Hoy no se muestra un control
de reproducción porque el artefacto todavía no está integrado.
