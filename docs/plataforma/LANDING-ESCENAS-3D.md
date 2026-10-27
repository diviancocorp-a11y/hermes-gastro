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

## Integracion realizada — 26/oct/2026

La escena aprobada se integro en src/components/landing/EscenaRubro/.
RubrosNegocio.jsx monta el componente solo para gastronomia, mediante import
diferido al acercarse al segmento. Three.js 0.186.1 es la unica dependencia
nueva, fijada en package.json y lockfile. Licencia MIT de mrdoob/three.js.
La geometria y el WebP fueron generados para Divianco por el creador del paquete.

El componente conserva rubro y momento y agrega callbacks onMomento para
sincronizar el texto externo con la historia y onDisponibilidad para distinguir
la alternativa estatica sin WebGL. El padre ofrece Pausar/Reanudar; no hay
controles, leyendas ni contador de rendimiento dentro de la escena.

Fuente recibida: EscenaRubro-gastronomia.zip. El archivo escenaGastronomia.js
suelto era identico al motor incluido. Se preservo el motor visual aprobado;
adaptaciones locales: comentario de version, catch sin variable inutilizada,
callbacks del wrapper, composicion en la landing y seleccion explicita de
PCFShadowMap (Three 0.186.1 ya convierte PCFSoftShadowMap a ese modo y avisa). La imagen alternativa y
los estilos del motor estan incluidos en el repo, sin requerir el ZIP externo.

Comprobado en Chrome a 390/1280, movimiento reducido y navegador sin WebGL.
Pendientes: telefono real (tacto, fps, bateria), Safari y Firefox. No se
reproduce la escena de Gastronomia en los rubros todavia no construidos.

## Comercio integrado — 26/oct/2026

EscenaRubro-comercio.zip entregado por Ricky se incorporo sin dependencias
nuevas en src/components/landing/EscenaComercio/. Usa el Three 0.186.1 ya
instalado. Wrapper y motor separados del de Gastronomia, carga diferida por
rubro y CSS encapsulado. Contrato y fuentes en LANDING-COMERCIO-3D.md.
El padre adapta onDisponibilidad (estados de texto) al control de vista
estatica, conserva los siete IDs originales y sincroniza sus explicaciones.
El cambio de pestana desmonta el motor anterior. La escena de Servicios aun
no esta integrada. Comprobaciones locales y pendientes en LANDING.md, seccion 1.

## Servicios integrado en preview — 26/oct/2026

EscenaRubro-servicios.zip entregado por Ricky se incorporo en
src/components/landing/EscenaServicios/, con Three 0.186.1 ya instalado.
Carga diferida por rubro, CSS encapsulado y alternativa propia; contrato y
fuente en LANDING-SERVICIOS-3D.md. El padre comparte montaje para las tres
escenas y conserva los cuatro IDs llegada/reserva/cancelacion/recuperado.
QR, reservas/cancelaciones online y avisos se identifican como simulacion de
funciones en desarrollo. No pasar esta escena a produccion antes de validar
las capacidades representadas. Verificaciones locales y pendientes en LANDING.md.

## Control guiado opcional — 27/oct/2026

Los tres wrappers aceptan guia, revision y onFinMomento ademas del contrato
anterior. El motor recibe set({ rubro, momento, guia }); guia admite preparar,
reproducir, pausar o continuar. Sin guia mantiene su comportamiento anterior.
revision fuerza una nueva orden para repetir el mismo momento. onFinMomento
se pasa al crear el motor y avisa una sola vez al alcanzar el final del tramo.

Cada momento define guideStart/guideEnd mediante marcas de la historia, para
preparar antes de la accion real (no solo usar el inicio del bloque narrativo).
El helper src/lib/recorridoGuiado.js limita el tiempo y controla la pausa sin
reloj de pared. El frame congela el resultado antes de avanzar al proximo
tramo. En modo guiado no se aplica el resplandor forzado de los antiguos
encuadres fijos. Con movimiento reducido se usa la vista representativa;
cambiar esa preferencia durante reproduccion tambien detiene la guia.

Herramientas agrupadas y explicaciones en herramientasRubros.js; sus filas
apuntan al alcance vigente de RubrosNegocio.jsx. Mantener cobertura de todas
las filas al agregar una herramienta: hoy 10/9/12 por rubro. LecturaRubro.jsx
maneja foco, Escape y clic fuera; respeta el modal del diagnostico y conserva
la lectura al volver. Servicios permanece solo en preview.
