# La landing de divianco.app — guia para seguir (Codex o Claude)

> Unico lugar de trabajo de la landing desde el 23/oct/2026. Lo que antes
> vivia afuera (docs de Claude, artifacts, el manual RC5 en Descargas, el
> analisis de IMAN) esta resumido aca. Si algo no esta en el repo, no cuenta.
> Se lee de arriba para abajo antes de tocar una linea.

---

## 1. Estado al 29/oct/2026

### Revision visual de Ricky

**Retoque de cierre, 29/oct:** CTA usable durante la apertura parcial en la
zona ya visible; las hojas tapan tambien los clics sobre contenido oculto.
Solo foco visible de teclado abre de inmediato: el clic no fuerza la apertura.
Franja mas alta, titular y CTA proporcionados, menor separacion hasta el footer.
El resto del footer permanece igual.

**Actual — compuerta de cierre ligada al scroll, 29/oct:** dos hojas negras
cubren la franja azul conservando su alto. Junta gris al entrar y dorada al
92% del viewport; apertura progresiva entre el 86% y el 42%, sin temporizador.
Al subir se cierra en sentido inverso. Quedan bordes dorados limpios, sin pulso.
No fija ni bloquea el scroll, no empuja el footer y conserva el CTA existente.
Foco de teclado abre de inmediato y movimiento reducido muestra la franja
abierta. Footer y segmentos cerrados sin cambios.


**Actual — cierre azul de la landing, 29/oct:** franja volt uniforme de borde
a borde; promesa Butler a la izquierda y CTA dorado con nota sin email a la
derecha. Quitados subtitulo repetido, contenedor oscuro y destellos animados.
En movil, mensaje antes del boton y altura contenida. Conserva expansion del
diagnostico y relleno negro al hover. Footer expresamente sin cambios: Ricky
lo revisara despues. FAQ CERRADA visualmente por Ricky en 7bf61b6, junto a
Rubros, Acompanamiento y Planes; solo este cierre se esta trabajando.


**Actual — personalidad final de FAQ, 28/oct:** Dico en dorado en el titulo.
Gestos al 55% del ritmo habitual solo en FAQ; saludo mas pausado, pensamiento
480ms y respuesta con alternancia entre saludo, revision y miradas, seguida de
reposo. Hover/foco/clic en la mascota dispara una reaccion breve y variada,
sin interrumpir respuesta ni mover la pagina. DicoPhysical agrega prop opcional
ritmo (default 1 intacto para el resto de la app), con prueba de independencia
de cadencia. Misma instancia/tamano, movimiento reducido respetado y timers
limpios al salir. Segmentos cerrados sin cambios.


**Actual — FAQ guiada con Dico, 28/oct:** retirados buscador libre, historial
y lista duplicada. Cuatro temas con preguntas visibles; una respuesta preparada
activa, que se reemplaza al elegir otra. Mismo DicoPhysical/atlas del admin,
una sola instancia y tamano constante entre saludo/respuesta: baja al globo
con transicion 480ms, gesto de pensar breve y respuesta completa. Espacio
reservado para lectura; en movil se acerca a la vista solo si queda fuera y
el usuario no empezo a desplazarse. Borde estatico azul/dorado con enfasis
breve al interactuar. Subtitulo «Respuestas claras para empezar». Tema Empezar
y respuesta de ayuda para configurar actualizados al acompanamiento confirmado
por Ricky. Sin IA, llamadas ni dependencias nuevas; WhatsApp como salida.
Rubros, Acompanamiento y diseno de Planes cerrados; contenido de planes pendiente.


**Actual — ultimo retoque visual de Planes, 28/oct:** Local sin contorno azul
ni resplandor fijo; borde neutro como las otras cards, conservando etiqueta
«Plan destacado», fondo y boton aprobados. Brillo marfil localizado ampliado
a 420px con caida al 85% para responder tambien desde el centro; sigue
recortado al borde, sin iluminar el interior. Contenido final de planes aun
pendiente de Ricky. Rubros y Acompanamiento sin cambios.


**Actual — antetitulo de planes, 28/oct:** «PLANES» gris zinc y «DICO» dorado
encima del titulo, conservando posicion, tipo y espaciado. Resto sin cambios.

**Actual — tabla negra y borde localizado, 28/oct:** fondo negro zinc OPACO
en contenedor, tabla, cabecera y celdas para que no se filtre el azul ambiental.
Se recupera el seguimiento del cursor SOLO en el borde mediante mascara y
radial marfil; no hay capa de luz sobre el interior de la card. El brillo
aparece al acercarse a un borde, sin contorno uniforme completo. Touch no
activa el seguimiento; foco de teclado conserva indicacion. Resto de planes,
espaciado compacto y segmentos cerrados sin cambios.


**Actual — compactar espacios de Planes, 28/oct:** menor aire de entrada
(32px), antetitulo/subtitulo a 8px, selector a 16px, ahorro a 6px y cards a
32px, conservando margen para la banda elevada de Local. Pie acercado:
Comparar a 8px de las cards y sin margenes extra entre ayuda/condiciones;
salida a 48px. Sin cambios de tipo, precios, funciones, tabla o entrada con
scroll. Rubros y Acompanamiento siguen cerrados.


**Actual — matriz de planes y borde marfil, 28/oct:** «Lo mas destacado»
reemplaza Incluye. Comparativa en tabla: una fila comun por funcion y tres
columnas con check/guion; se deriva de planesPlataforma.js, incluyendo herencia
«Todo lo de Digital/Local», sin inventar un alcance nuevo. Contenido provisorio
senalado dentro del desplegable, pendiente de la informacion final de Ricky.
Tabla con cabeceras semanticas, nombres de fila fijos y scroll horizontal en
movil. El cursor ya no posiciona una linterna: borde marfil uniforme al hover
o foco en cualquiera de las cards, conservando identidad y Local destacado.
Retirada linea repetida de rubro/ARCA. Rubros y Acompanamiento sin cambios.


**Actual — planes con Local destacado, 28/oct:** se conserva entrada con scroll,
fondo volt y seguimiento del cursor en las tres cards. Digital acento marfil
con icono de pantalla; Local profundo azul, borde volt, etiqueta «Plan destacado»
y CTA solido; Cadena oro con locales conectados. Beneficios antes del boton,
acciones alineadas al pie. Cuarto CTA grande reemplazado por «¿No sabes cual
elegir? Hace el diagnostico». Precios y beneficios siguen en planesPlataforma.js,
sin inventar diferencias ni decir «mas comprado». Falta definir mejor la
diferencia de valor de Local antes del cierre comercial/produccion.
Acompanamiento CERRADO por Ricky en b68ea44; junto a Rubros, no retocar mientras
se completa el resto. Este cambio solo toca Planes y esta guia.


**Actual — encendido dorado y promesa persistente, 28/oct:** se retira el aro
exterior azul. El propio borde, numero y superficie del circulo se intensifican
en dorado al pasar el pulso, con luz suave, y vuelven a su tono habitual despues.
Al completar el recorrido «Seguimos con vos» queda dorado y encendido durante
la visita, incluso al volver hacia arriba; el pulso sigue reversible. Con
movimiento reducido no se animan circulos, pero se conserva la promesa al
alcanzar el final. Sin cambios en rubros BLOQUEADO ni en la luz de la junta.


**Actual — luz dorada organica de la junta, 28/oct:** se retira el barrido
lateral fijo. Tres focos decorativos independientes con ritmos de 13.7/19.3/
23.1s, fases diferentes y fluctuacion de intensidad, amplitud y altura;
aparecen/se disipan en varios sectores, sin avanzar en fila. La luz sigue
proyectada hacia arriba y detras del segmento. Sin JS ni nuevos servicios;
movimiento reducido con luz fija tenue. No cambia el pulso volt con scroll
ni rubros BLOQUEADO.


**Actual — acompanamiento guiado por scroll, 28/oct:** frase inicial menor y
gris; titular principal conserva protagonismo. Tres titulos blancos y tres
circulos/numeros dorados siempre. Pulso volt corto/tenue ligado al scroll,
reversible al subir; halos exteriores breves al cruzar cada paso, sin seleccion
persistente al final. En movil recorre la linea vertical. Suavizado RAF solo
hasta alcanzar el destino, listeners pasivos/ResizeObserver y limpieza al
salir; sin bloquear scroll ni agregar altura. Movimiento reducido sin pulso
ni halos. Se conserva la luz dorada de la junta y el CTA. Rubros BLOQUEADO.


**Actual — borde elevado de acompanamiento, 28/oct:** se agrega solo en
ComoEmpezar una luz dorada posterior que fluye lateralmente en 9s, proyectada
52px hacia arriba desde su junta superior. Linea de apoyo tenue para sugerir
relieve; sin halo en cards, sin modificar el segmento de rubros BLOQUEADO.
Con movimiento reducido queda iluminacion fija tenue. No cambia medidas ni
el pulso volt de una sola pasada entre los tres pasos.


**Actual — segmento 5 / acompanamiento, 28/oct:** rubros sigue BLOQUEADO;
solo se modifica ComoEmpezar. Titulo «No tenes que resolver todo de golpe.
Te acompanamos desde el primer paso». Pasos: descubris por donde empezar,
configuramos Dico con vos, seguimos con vos; textos concretos aprobados por
Ricky: ayuda para crear cuenta/cargar informacion y seguimiento de uso con
mejoras operativas. Ricky confirma este acompanamiento directo como oferta
actual, sin restringirlo a un plan; revisar la promesa cuando cambie su
capacidad. Fondo negro, menos altura/inferior, un CTA con nota sin email.
Pulso volt una sola vez al entrar; al terminar queda destacado Seguimos con
vos. Movimiento reducido muestra estado final quieto. Sin llamadas de red.


**BLOQUEADO POR RICKY — segmento 3 / rubros, 28/oct/2026.** El usuario
aprobo detener las iteraciones y pidio: «bloquealo no me dejes hacer mas
cambios hasta que termine el resto». Conservar diseno, textos, encuadre,
iluminacion, controles y efectos en el estado de `c5b1794`:
https://hermes-platform-k5ictlv6s-diviancocorp-a11ys-projects.vercel.app/landing#rubros
No proponer ni aplicar nuevos retoques en este segmento hasta terminar el
resto de la landing. Si Ricky pide otro retoque antes, recordarle este acuerdo
y continuar con lo pendiente; un pedido rutinario de cambio no levanta el
bloqueo. Solo retomarlo al completar el resto o si Ricky revoca explicitamente
este acuerdo. La auditoria integral sigue pendiente para el cierre general.


**Actual — desplegables bajo maqueta, 28/oct:** ambos enlaces viven dentro
de la columna visual, centrados como el lema, separados 24px y alineados
arriba al desplegar. Pulso volt de 7s bajo el borde dorado, detras de las
cards; se oculta con movimiento reducido. Alto de escena ajustado al viewport
por rubro (compensa filas de momentos/aviso) para ver el segmento a zoom 100%
en escritorio, sin achicar texto. Movil conserva sus alturas anteriores.


**Actual — ajuste de lectura, 28/oct:** cabecera alineada al ancho de contenido,
mas aire vertical (32px; 28 movil) y dorado extendido 24px tras la parte alta
de las cards para integrarlas, sin franja separada por espacio negro.
«Consumo de insumos por receta» reemplaza «Descuento por receta» en herramientas.
Lema a 16px, aviso de simulacion a 14px y desplegables a 15px; zinc-300 sin
opacidad reducida, aclarado al hover/foco. Sin nuevos efectos ni cambios de motor.


**Actual — prueba de jerarquia, 28/oct:** dorado limitado a cabecera de borde
a borde con corte limpio; cuerpo negro zinc, sin fundidos ni pulso decorativo.
Gastronomia prueba luz hemisferica 1.8/key 2.3 y encuadre 7.1 (antes 8.1),
aproximadamente 14% mas cercano en escritorio, conservando sombras y camara
proporcional. Bajo 520px mantiene 8.1 para no recortar la escena.
Comercio/Servicios conservan sus motores hasta aprobar esta prueba.
Lateral al 30% (320-420px), herramientas a 15px y descripciones a 14px.
Desplegables acercados a 12px del contenido y menor espacio inferior.


**Actual — dorado extendido y pulso posterior, 28/oct:** retirado el halo azul
de la card por recargar. La franja dorada cubre tambien el aire superior e
inferior y las opciones de disponibilidad, acercandose a los segmentos vecinos.
Fundidos de 80px; texto de disponibilidad oscuro para conservar contraste.
Pulso volt de 8s por debajo de la capa dorada, visible solo en los fundidos
superior/inferior; no pasa sobre las cards. Sin movimiento reducido se anima;
con esa preferencia se oculta. No cambia layout ni controles.


**Actual — luz volt tras la maqueta, 28/oct:** halo azul difuso detras de la
card 3D, sobre la franja dorada. Usa el token volt, sin cambiar fondo de la
escena, controles, texto ni medidas.


**Actual — franja dorada continua, 28/oct:** firma dorada a todo el ancho de
pantalla, sin esquinas ni recuadro. Entrada/salida con degradado vertical de
32px, color solido detras del contenido para mantener contraste. Las opciones
de disponibilidad quedan despues del fundido, sobre negro. No cambia el
ancho de contenido ni la escena.


**Actual — dorado como firma, 27/oct:** el bloque de titulo, maqueta y
herramientas queda contenido en un marco dorado Dico, separado del fondo
negro de la seccion. Escena y lista conservan sus superficies oscuras; titulo,
lema y aviso sobre dorado usan tinta oscura. Ajuste de alto del lienzo para
compensar el marco al 100%. No cambia recorrido, controles ni contenido.


**Actual — siete ajustes de rubros y densidad, 27/oct:** maqueta a la izquierda
con selector de rubro compacto dentro de su card; herramientas a la derecha
con iconos y acordeones nativos. Abrir/cerrar conserva las demas opciones;
en escritorios bajos la lista tiene scroll propio. Titulo en una linea en
escritorio y mensaje de ritmo debajo de la maqueta. Disponibles/en desarrollo
quedan centrados en dos columnas, con aclarado al hover/foco.

Se retiran descripcion duplicada y pausa externa. Clic/tap en la escena
pausa/reanuda exactamente; arrastrar no pausa, y hay control accesible por
teclado. Momentos activos en volt. Explicaciones centradas sobre maqueta
con fondo difuminado; conservan preparar, reproducir, resultado y siguiente.
Los tres motores agregan pausar(boolean) sin reiniciar la guia. Contenedor
adaptable al viewport, con proporcion de camara recalculada, sin deformar.
CTA de herramientas con relleno negro radial sobre dorado.

Toda la landing reduce separaciones verticales y alturas de piezas para
lectura al 100%, sin aplicar zoom ni reducir la escala de la pagina. Hero,
franja de logos y corte del footer conservan su estructura aprobada.
Chrome comprueba 1280x720, 1440x900 y movil 390: sin overflow, acordeon,
pausa exacta por capturas, reanudacion, teclado, arrastre, guia centrada con
blur/resultado, cambio de rubros con un canvas y sin errores JS. Movimiento
reducido y alternativa sin WebGL comprobados. Servicios sigue solo preview.
Sin dependencias ni subagentes; auditoria integral diferida por Ricky.

**Estado anterior (antes de estos siete ajustes):**

**Actual — lateral de herramientas y demostracion guiada, 27/oct:** segmento
3 reorganizado con lateral de aproximadamente 25% y maqueta ocupando el resto
(340/996 px a 1440). Alto de escena adaptable al viewport en escritorio;
camara y objetos conservan proporciones. Dolor compacto, 31 herramientas
agrupadas por problema (10 Gastronomia, 9 Comercio, 12 Servicios), estado de
alcance tomado de las filas existentes y CTA dorado. Cada herramienta abre
una lectura no modal sobre el lateral, sin tapar el centro del 3D; una sola
lectura abierta, cierre con Escape/clic fuera y retorno al disparador.
En movil primero maqueta y momentos, herramientas desplegables debajo y
lectura inferior; el encuadre deja la escena completa arriba de la tarjeta.

Entrada conserva recorrido automatico. Seleccionar un momento prepara la
escena ANTES de la accion y abre explicacion/sector a mirar. «Ver en escena»
reproduce solo ese tramo, se detiene en el resultado y ofrece Repetir,
Siguiente momento y Volver al recorrido. Incluye pausa/continuacion exacta.
Los tres motores comparten src/lib/recorridoGuiado.js: marcas simbolicas de
inicio/fin, callback onFinMomento y comandos opcionales; sin cambiar las
historias automaticas. No se fuerza el resplandor del resultado al preparar.
Movimiento reducido muestra resultado quieto; sin WebGL queda vista de
referencia con lectura. Servicios sigue identificado como simulacion de
funciones futuras y NO debe publicarse antes de validarlas.

Siete pruebas del control de tiempo pasan (inicio, limite final, aviso unico,
pausa/continuidad, repetir, movimiento reducido y salida). Chrome verifica
Gastronomia pedido/stock, Comercio cobro antes/despues y repetir, Servicios
cancelacion Reservado a Disponible, un canvas entre rubros y 31 herramientas.
Lectura movil, foco/Escape, siguiente/salida, diagnostico ida/vuelta desde la
lectura conservada, cambio de preferencia durante guia y alternativa sin
WebGL comprobados; sin errores JS ni overflow en esas pruebas. Sin nuevas
dependencias ni subagentes; auditoria integral y telefono real pendientes.

**Actual — Servicios 3D integrado solo en preview, 26/oct:** recibido
EscenaRubro-servicios.zip. Wrapper, motor, CSS y alternativa viven en
src/components/landing/EscenaServicios/; README original con procedencia en
LANDING-SERVICIOS-3D.md. Conserva distribucion, personajes, reloj, agenda,
lineas volt, pulsos dorados/rojos y ciclo de 93,1 s. Sin dependencias nuevas.
Motor adaptado solo con no-jsx-check para HTML interno y catch sin variable
no utilizada. ESLint no tiene errores; tres advertencias de helpers sin uso
heredados del paquete (shell, mirror, phone), sin alterar su escena.

Cuatro momentos del padre: llegada, reserva, cancelacion y recuperado. Texto
y controles sincronizados; seleccion congela y reanudar continua. Los tres
rubros ahora tienen escena propia diferida; se retira el placeholder ya sin
uso y se comparte el montaje/estado de disponibilidad. Servicios muestra un
aviso de simulacion: reserva/cancelacion online, QR y avisos a profesionales
son funciones objetivo en desarrollo. El alcance actual sigue separado.
NO PUBLICAR en produccion hasta validar esas funciones; esta integracion no
las implementa ni conecta APIs, QR real, reservas o notificaciones.

Chrome 1280/390 confirma cuatro momentos, reloj 16:01/16:05/16:20/16:31,
Juan cancelado y Bruno asignado en la misma fila 16:30. Pausa estable por
capturas identicas; reanudar desde cancelacion avanza a horario recuperado.
Un canvas al alternar los tres rubros, scroll vertical sobre la escena,
movimiento reducido con seleccion manual y sin overflow ni errores JS.
Sin WebGL: alternativa 960x720 cargada, descripcion y cero canvas. Telefono
real, Safari/Firefox y rendimiento pendientes. Sin subagentes ni auditoria
integral; revision visual final de Ricky pendiente.

**Actual — Comercio 3D integrado, 26/oct:** recibido EscenaRubro-comercio.zip.
Motor, wrapper, CSS encapsulado e imagen alternativa viven en
src/components/landing/EscenaComercio/. README original con procedencia en
docs/plataforma/LANDING-COMERCIO-3D.md; sus pruebas declaradas por el creador
se distinguen de las comprobaciones locales. Se conserva la escena aprobada,
las dos historias y ciclo de 82,2 s. Sin dependencias nuevas: Three 0.186.1
ya instalado. Adaptaciones del motor: marca no-jsx-check para HTML interno
y dos catch sin variable no utilizada; sin cambios narrativos o visuales.

Comercio se carga diferido al elegir su pestana, con imagen propia durante
carga o sin WebGL. Siete momentos sincronizados: eleccion/venta/cobro
presencial y pedido/preparacion/retiro/cobro online. Seleccion congela;
Reanudar continua. Textos distinguen preparar, completar y cobrar. Controles
compactos en cuatro columnas, dos en movil. Gastronomia conserva su escena;
Servicios sigue pendiente y no se muestra una escena ajena en su lugar.

Chrome 1280/390 confirma automatico avanzando, siete selecciones, pausa
estable (capturas identicas), reanudacion desde preparacion, rueda que
desplaza la pagina, un canvas al alternar rubros y cero en Servicios.
Movimiento reducido muestra vista quieta con seleccion manual. Sin WebGL:
alternativa 960x720 cargada, descripcion accesible y cero canvas. Sin errores
JS ni overflow movil en estas comprobaciones. Telefono real, Safari/Firefox
y rendimiento real pendientes; auditoria integral sigue diferida.

**Actual — logos solos y aire sobre la persona, 26/oct:** franja conserva
sus 120 px y cuatro logos reales, sin nombres ni texto al pasar cursor.
Los enlaces Instagram conservan su nombre accesible. Se elimina CSS que
queda sin uso. Primer plano del caminante a escala uniforme .8, anclado al
suelo; mantiene proporciones y parallax, separando cabeza de «Ver como
funciona» y de la aclaracion del diagnostico sin cambiar el titulo.
Chrome 1440x900, 1536x864, 1280x720, 390x844 y 390x667 confirma franja
completa al abrir, cuatro imagenes sin texto y sin overflow. Sin dependencias,
subagentes ni auditoria intermedia; revision visual de Ricky pendiente.

**Actual — hero encuadrado y circuitos, 26/oct:** hero pasa de 120svh a
100svh menos 120 px, reservados para la franja compacta de clientes reales.
En Chrome 1440x900, 1280x720, 768x1024 y 390x844 el borde inferior de la
franja coincide con el primer viewport; tambien comprobado 390x667 sin
overflow. Se conserva la persona sin deformar las capas fotograficas, el
parallax y el diagnostico oscuro con apertura/cierre desde el disparador.

Subtitulo aprobado de la referencia: «Toda la gestion de tu negocio,
conectada.» y «Para gastronomia, comercios y servicios.». Circuitos laterales
con CRM y clientes, Pedidos, Stock, Compras, Analisis, Proveedores, Caja y
Equipo. Pulsos volt recorren cada lado y destacan sucesivamente los nombres;
cada herramienta abre el mismo diagnostico, sin preseleccionar respuestas.
En movil los ocho nombres se compactan en dos filas al pie del hero, sin
invadir el centro. Los pulsos se detienen al
salir de pantalla o esconder la pestana; con movimiento reducido quedan
estaticos. Titulo, propuesta y circuitos comparten desplazamiento .33.

Chrome verifica apertura desde ambos lados y movil, CTA principal, cierre
y retorno de foco al disparador; los ocho nombres reciben el cursor. ESLint
pasa, sin errores JS en la comprobacion. Sin dependencias, subagentes ni
auditoria integral; preview para aprobacion visual. Logos, destinos Instagram,
precios, escenas 3D y funciones del producto sin cambios.

**Actual — logo de contornos y corte final, 26/oct:** footer con trazado
vectorial del logo original, solo contornos volt gruesos, incluidos los ojos,
sin relleno, sombra, degradado ni blur. El viewBox recorta la parte inferior
de letras y circulos justo debajo de ambos ojos completos. El borde inferior
del logo coincide con footer y final de pagina: sin margen o espacio posterior.
Corregido WhatsApp reutilizando el glifo completo existente en Suppliers,
sin deformarlo con stroke. Contactos y demas contenido conservados.
Chrome 1280/390 verifica ojos completos, fill none, sin overflow y final de
pagina coincidente con el corte (redondeo subpixel menor de 1 px). Sin
subagentes ni auditoria intermedia; aprobacion visual pendiente.

**Actual — cierre y footer, 26/oct:** segmento 8 con «Tu negocio mas
ordenado. Tu tiempo mas tuyo.», bajada «Descubri por donde empezar con Dico.»,
una accion «Empezar mi diagnostico» y aclaracion sin email. Card oscura con
luces volt y oro detras; movimiento ambiental suave solo sin movimiento
reducido. Boton dorado con relleno negro radial al pasar cursor, abre el
mismo diagnostico integrado.

Footer centrado con navegacion, Instagram/WhatsApp/email, contactos, agenda
y horarios existentes, copyright y logo original grande. Ricky confirma
Instagram @dico.arg y @grupodivianco: «Hecho por Grupo Divianco» es enlace
simple, sin burbuja. Autoriza dejar Terminos, Privacidad y Preferencias de
cookies como botones desactivados pendientes de sus textos/destinos. No hay
paginas legales inventadas ni gestor de consentimiento implementado.

ESLint pasa. Chrome 1280/390 verifica enlaces, tres botones desactivados,
relleno negro, diagnostico ida/vuelta, logo cargado y ausencia de overflow
movil. Movimiento reducido detiene luces. Sin dependencias, subagentes ni
auditoria integral; aprobacion visual del conjunto pendiente.

**Actual — FAQ guiada con busqueda local, 26/oct:** segmento 7 adaptado a las
dos referencias de Ricky. Inicio compacto con «Sacate la duda. Preguntale a
Dico», mascota corporal vigente del admin (DicoPhysical), saludo, cuatro
preguntas rapidas y buscador redondo dorado. Al elegir se abre conversacion,
cuatro temas, respuesta preparada, enlaces pertinentes y sugerencias. Una
sola mascota por bloque, sin microfono, adjuntos ni simulacion de tipeo.

Las 12 respuestas existentes se trasladan sin cambiar su contenido a
src/lib/preguntasPlataforma.js: fuente unica para conversacion, busqueda y
«Ver todas las preguntas» con acordeones. Precios desde planesPlataforma.
Busqueda determinista sin tildes/mayusculas, terminos habituales y ranking;
solo ofrece preguntas existentes. Sin IA, llamadas de red ni persistencia
de consultas/historial. Sin coincidencias ofrece el WhatsApp oficial sin
enviar automaticamente la consulta. Historial en memoria de tres intercambios,
respuestas accesibles y foco/scroll dentro de la conversacion. CTA de las
respuestas abre el diagnostico integrado conservando el estado de FAQ.

Cinco pruebas de busqueda pasan (incluye evitar astronomia/gastronomia).
Chrome 1280/390 confirma inicio, preguntas rapidas, temas, respuestas,
busqueda, fallback, 12 preguntas completas, diagnostico ida/vuelta y ausencia
de errores JS/overflow. Verificado teclado y movimiento reducido; foco del
buscador rodea todo el campo. No dependencias ni assets nuevos. Revision
visual del conjunto y auditoria integral siguen pendientes.

**Actual — cards de planes progresivas con scroll, 26/oct:** Ricky aprueba
la presentacion pero pide mas tiempo para leer el titulo. La entrada de las
cards deja de depender del reloj en navegadores con animation-timeline:view:
opacidad, blur y desplazamiento avanzan segun su entrada en viewport. Rangos
15-75%, 25-85%, 35-95% para Digital/Local/Cadena; al detener scroll se detiene
el progreso. En movil cada card se revela al llegar a su altura. Titulo y
selector conservan la entrada anterior. Sin soporte de scroll timeline queda
un fallback mas lento (900 ms y demoras 320/500/680 ms). Teclado revela la card
inmediatamente; movimiento reducido muestra todo sin animacion.

Chrome 1280/390 confirma progreso parcial estable al esperar un segundo,
final visible al seguir desplazando, foco accesible y ausencia de overflow.
Precios, contenido, botones y brillo del cursor conservados. Sin dependencias,
subagentes ni auditoria intermedia; aprobacion visual final pendiente.

**Actual — entrada y fondo volt de planes, 26/oct:** adaptado el recurso
pegado por Ricky a React JS/CSS del repo, sin instalar Motion, NumberFlow,
Lucide ni shadcn. Titulo y selector entran primero; cards con desplazamiento
de -20 px, blur 8 px a nitido y opacidad en 480 ms, escalonadas 160/260/360 ms.
Se reutiliza useEntradas/IntersectionObserver existente, una sola entrada por
elemento, contenido visible sin movimiento reducido. Luz volt radial detras
del encabezado y las tarjetas. Botones Elegir subidos sobre las prestaciones.
Oferta, selector, importes animados y comparacion completa conservados.

Corregido el borde: dependia del media query hover/fine. Reproducido en Chrome
con hover=false y cursor sin foco: opacity 0. Ahora pointerenter/move activa
cada card y sigue las coordenadas, pointerleave limpia el estado; no requiere
clic ni volver del diagnostico. Foco de teclado conservado, tacto sin hover
forzado. Verificados los tres bordes sin clic (opacity 1), secuencia y estado
final nitido, botones antes de beneficios, anual correcto, cierre del embudo
y movimiento reducido a 390 px sin overflow ni errores JS. Sin subagentes
ni auditoria integral; revision visual del conjunto pendiente.

**Actual — presentacion compacta de planes, 26/oct:** segmento 6 adaptado a
la referencia: tres beneficios resumidos por tarjeta, precios alineados,
accion dorada de contorno «Elegir Digital/Local/Cadena» al diagnostico y
lista completa existente en «Comparar todas las funciones». No se toman
los beneficios provisionales de la maqueta como nueva oferta: se conservan
los textos de planesPlataforma.js y la advertencia por rubro/ARCA.

Selector mensual inicial conservado. En anual Local muestra $47.200/mes como
equivalente y $566.400 al ano; Cadena $79.200/mes y $950.400 al ano por local.
Digital $14.999 solo mensual, sin descuento. Badges -20% solo en Local/Cadena
al ver anual. Calculos y fuente comercial sin cambios, sin modificar DB,
registro, cobros ni precios efectivos del edificio. Elegir abre el embudo;
no preselecciona ni contrata un plan en el alta.

Borde volt localizado segun cursor, sin renders React por movimiento; foco
por teclado tambien visible. Chrome 390/1280 verifica importes, totales,
dos badges, 13 beneficios completos, CTA y ausencia de overflow. Tarjetas
escritorio pasan de 567 a 516 px, con precios a la misma altura. Revision
visual pendiente; auditoria integral sigue diferida hasta aprobar el conjunto.

**Actual — Gastronomia 3D integrada, 26/oct:** incorporado el paquete final
entregado por Ricky (EscenaRubro-gastronomia.zip), con componente, motor,
CSS scoped e imagen alternativa. Three.js 0.186.1 fijado en package/lock:
version compatible declarada por el creador, licencia MIT verificada y
npm install sin vulnerabilidades. Geometria e imagen generadas para Divianco;
no usa modelos, fuentes, servicios externos ni datos de clientes.

La escena se carga en un chunk diferido al acercarse al segmento 3, conserva
el recorrido aprobado de Mesa 6, camara, sombras y pulsos. Pedido/Stock/Cobro
la detienen en sus encuadres; control explicito Pausar/Reanudar y texto del
momento automatico sincronizado. Cambiar de rubro desmonta el motor; Comercio
y Servicios mantienen su espacio pendiente, sin mostrar Gastronomia por error.
Respetado movimiento reducido; sin WebGL se muestra la imagen accesible y se
oculta la reproduccion. No se integraron interfaces ni contadores de prueba.

Verificacion Chrome 390/1280: sin peticiones al motor antes de acercarse,
un canvas por montaje, seleccion/reanudacion, desmontaje al cambiar de rubro,
movimiento reducido, sin errores JS ni overflow. Verificado tambien sin WebGL.
No se midio rendimiento ni tacto en celular real; Safari y Firefox pendientes.
Auditoria integral de diseno sigue pendiente hasta aprobacion del conjunto.

**Actual — ajuste del segmento 5 a la captura, 25/oct:** circulos negros
con contorno y numeros dorados; conexion fina y pulso azul volt con estela y
punta luminosa. Recorre 1 a 2 a 3 en un solo bucle de 4,8 s; vertical en
movil, estatico con movimiento reducido. Composicion mas amplia, CTA dorado
con burbuja negra y textos exactos de la referencia: «Registras tu negocio»,
«Cargas tus datos y te acompanamos para empezar a usar Dico» y «Empezar mi
diagnostico», con los acentos correspondientes en la UI. Conserva respuestas
al abrir el mismo diagnostico. Chrome 390/1280 confirma recorrido del pulso,
CTA, movimiento reducido y sin overflow. Gastronomia 3D sigue en revision
externa, sin integrar; no se modifica el segmento 3 por este ajuste.
El hook smoke usaba forks y bloqueo el commit por timeout de workers en
Windows: corregido a threads con dos workers, siguiendo AGENTS.md.

**Actual — nueva composicion del segmento 3, 25/oct:** Ricky elige escenas
3D por rubro, con dolor/respuesta a la izquierda, barra superior y momentos
bajo la escena. Sustituidos los paneles expansibles por una barra accesible
Gastronomia/Comercio/Servicios. El cambio sincroniza lateral, momentos y alcance.
Los momentos explican la zona y la intervencion real; se reinician al cambiar
de rubro y se deseleccionan al repetir clic. Conservadas todas las prestaciones
y pendientes, sin ampliar promesas comerciales.

La escena es un espacio reservado rotulado «en preparacion», no un 3D terminado.
Ricky prepara el artefacto; prompt y contrato de integracion en
LANDING-ESCENAS-3D.md. rubro usa gastronomia/comercio/servicios; momento concreto
pausa e ilumina, null permitira recorrido automatico. No hay motor ni dependencia
nueva. A diferencia del segmento 2, el lateral cuenta un dolor en tipografia
editorial y la seleccion de momentos se ubica bajo el escenario, sin capturas
de la app ni lista de pasos lateral. Chrome 390/1280 verifica barra por teclado, reinicio del momento, zonas y
CTA al diagnostico. Sin auditorias ni subagentes intermedios.

**Actual — segmentos 7 y 8, 25/oct:** completados para revision conjunta.
Preguntas frecuentes en acordeon centrado, con apertura independiente,
teclado nativo y acentos volt. Respuestas ajustadas al alcance real: Digital
solo mensual, conexion necesaria, funciones en desarrollo y puesta en marcha
sin prometer plazos. Cierre en panel zinc con «Todo tu negocio en un solo
lugar» y CTA dorado «Quiero Dico» al mismo diagnostico integrado.

Footer centrado con el logo original grande de Dico al fondo, navegacion,
WhatsApp, email y agenda existentes. No hay paginas publicas de Terminos ni
Privacidad en el repo: el enlace permite consultas legales por email, sin
inventar politicas. Retirados los bloques anteriores y su CSS huerfano;
conservado el pie compartido por /diagnostico. ESLint y comprobacion Chrome
en 390/1280: acordeon, teclado, apertura/cierre y sin overflow horizontal.
Los ocho segmentos quedan para correcciones de Ricky; auditoria integral
pendiente hasta aprobar el diseno, sin subagentes intermedios.

**Actual — ajustes del 5 y segmento 6, 25/oct:** circulos de los tres pasos
en oro y pulso dorado sobre la conexion volt, de izquierda a derecha; vertical
en movil y sin animacion con movimiento reducido. Implementadas tres cards
zinc Digital/Local/Cadena y selector Mensual/Anual comun, con importes animados
280 ms y valores finales accesibles, sin saltos de ancho.

Ricky confirma **Digital solo mensual: $14.999**. Al elegir Anual permanece
en mensual y lo aclara. Local conserva $59.000/mes o $566.400/ano ($47.200/mes);
Cadena $99.000/mes por local o $950.400/ano por local ($79.200/mes). Pesos,
por local y sin IVA, condiciones visibles. Un CTA dorado al diagnostico y
registro directo secundario. Se retira la carta y foto anterior de planes.

La oferta publica de preview y los textos del diagnostico comparten ahora
src/lib/planesPlataforma.js. Digital deja de presentarse como plan gratis;
los ids de respuestas (incluido gratis) se conservan para compatibilidad,
con una etiqueta que permite evaluar antes de pagar. No se modificaron la
base, las suscripciones ni los cobros. Antes de publicar esta oferta en main,
validar/sincronizar la tabla plans del edificio en la fase de cierre comercial.
36 pruebas pertinentes pasan. Chrome 390/1280 confirma importes finales,
selector, CTA, pulso y movimiento reducido sin overflow. Revision visual del
segmento 6 pendiente; luego segmento 7. Auditoria integral al aprobar el diseno
completo, sin subagentes intermedios.

**Actual — segmento 5, 25/oct:** Ricky aprueba la franja de negocios y pide
continuar con «Como empezas». Implementado «Empeza a tu ritmo» con los tres
pasos acordados: diagnostico, alta del negocio y puesta en marcha. Conexion
volt discreta, horizontal en escritorio y vertical en movil; fondo negro
zinc, sin nueva secuencia de scroll. Un CTA dorado «Hacer mi diagnostico» al
mismo embudo integrado, conservando respuestas. No promete minutos, carga
automatica ni reunion previa al alta. Verificacion visual y funcional en
390/1280: tres pasos, sin overflow, CTA y respuestas conservadas al reabrir.
Segmentos anteriores intactos. Precios y apartado 6 todavia pendientes;
revision visual del segmento 5 antes de avanzar. Auditoria integral al aprobar
el diseno completo, sin subagentes intermedios.

**Actual — franja de negocios, 25/oct:** apartado 4 reubicado entre hero y
segmento 2, con titulo «Negocios que ya usan Dico». Cuatro logos originales
(La Nona Pato, Crazy Miga, Monare, MiaEstudio), tomados de las fuentes publicas
registradas abajo y optimizados en WebP: unos 46 KB en total. Una sola fila
fija, sin duplicar marcas, siguiendo la excepcion expresa de Ricky para
pocos negocios. En movil se desliza con el dedo. Grises en reposo y colores
originales con hover/foco; cada enlace abre el Instagram configurado en otra
pestana. Retirada la tabla y galeria anteriores. Verificados orden de bloques,
cuatro imagenes/destinos, color al hover, desplazamiento movil y ausencia de
overflow en 390/1280. Segmentos 2 y 3 conservados. Revision visual pendiente;
auditoria integral al aprobar el diseno completo.

**Ultima revision del segmento 2 — 25/oct:** CTA «Quiero ordenar mi negocio»
ahora dorado, con circulo negro/flecha oro y relleno negro al hover, como el
hero. Las tres capturas avanzan cada 7 segundos mientras la seccion esta
visible; se congelan con cursor encima, foco de teclado, pestana oculta o
pausa explicita. Movimiento reducido conserva seleccion manual. Luz dorada
suave en movimiento detras del marco, pausada al explorar, sin alterar los
acentos volt de la interfaz. Descripcion bajo «Interfaz real» ampliada y a
15 px para explicar cada pantalla. Cinco pruebas pertinentes pasan; Chrome
confirma avance real, pausa por hover, CTA/diagnostico y ausencia de overflow
a 320 px. Segmento 3 sin modificaciones; ambos pendientes de aprobacion visual.

**Actual — segmento 3, 25/oct:** armado «Tu rubro, tu forma de trabajar»
con tres paneles seleccionables: Gastronomia, Comercio y Servicios. Expansion
280 ms por clic/toque/teclado; sin autoplay y cambio inmediato con movimiento
reducido. Fondo negro zinc y lectura volt. Cada rubro tiene tres capacidades,
pendientes explicitos y detalle del alcance completo. Se conserva la lista
de prestaciones; Agenda interna ahora figura disponible (registry y panel
actuales), diferenciada de la reserva online todavia pendiente. Las opciones
comunes pendientes quedan en su propio desplegable. CTA al mismo diagnostico,
sin preseleccionar rubro ni alterar respuestas. Verificado en Chrome 390/1280:
expansion, teclado y apertura/cierre del diagnostico, sin overflow. Segmento 2
no se modifica: Ricky lo esta revisando. Ambos segmentos pendientes de su
aprobacion; no avanzar segmento 4 por esta entrega. Auditoria integral al
aprobar el diseno completo, sin subagentes intermedios.

**Actual — segmento 2, 25/oct:** Ricky aprueba el hero («perfecto»). Pide
sustituir el circuito con mascota por la composicion de su captura: «Un
pedido. Todo en orden», tres momentos y la interfaz real a la derecha,
mas volt y menos oro. Implementado selector manual/teclado de Pedidos,
Stock y Resultado del dia, con capturas de los componentes de produccion
renderizados con datos ficticios. Ninguna captura contiene datos de clientes.
Se generaron con scripts/capturas-landing.mjs, sin acceso a Supabase; viven
en public/brand/landing/interfaz/. El admin no se modifica ni se carga su
codigo en la landing. Los colores internos de las capturas son los reales;
los indicadores, lectura y CTA de la seccion usan volt. Fondo negro/zinc
continuo. CTA abre el mismo diagnostico. En movil la captura se desplaza y
se puede ampliar en otra pestana. Pendiente revision visual de este segmento;
auditoria integral al aprobar el diseno completo, sin subagentes intermedios.

**Ultimo ajuste — 25/oct:** bajada, CTA, enlace y ayuda comparten la
velocidad parallax 0.33 del titulo, para que conserven su distancia al hacer
scroll. Registrate en oro. Retirado credito visible Osmo; fuente y licencia
CC0 conservadas en docs/marca/referencias/parallax-osmo.md. Sin cambios al
segmento 2 ni auditoria integral; pendiente aprobacion del hero.

**Correccion posterior — 25/oct:** recorte vertical de las tres capas bajado
sin deformarlas y sujeto centrado tambien en movil. Boton y textos quedan
arriba de la cabeza, comprobado en 390/768/1280/1613 px. Relleno hover ahora
por crecimiento del circulo negro real (transform, 480 ms), texto por encima
de la superficie. Cabecera incluye Entrar y Registrate con sus rutas reales.
Referencia React pegada revisada: misma continuidad boton/card, adaptada al
stack existente sin incorporar TypeScript, shaders ni dependencias nuevas.
Comprobadas fases intermedias del hover/apertura y cierre en Chrome.

**Actual — cierre visual del hero, 25/oct:** hero centrado segun las capturas
nuevas: titulo vigente, «Menos tiempo gestionando tu negocio. Mas tiempo para
vos y los tuyos», CTA «Empezar mi diagnostico», enlace «Ver como funciona»
y ayuda sin email. Boton dorado con circulo negro y flecha dorada; al hover
se rellena de negro desde la derecha, con borde oro y texto claro.

El negro se expande desde el boton hasta los limites de la card (640 ms),
sobre el hero difuminado, sin pantalla dorada. La card conserva los detalles
volt. Cerrar contrae la superficie oscura al boton (480 ms), despues vuelve
al estado natural dorado; se mantienen cierre X/Escape/Atras, respuestas,
foco y scroll. Parallax y segmento 2 se conservan. Verificacion basica:
29 pruebas pertinentes, apertura/cierre en Chrome 390/1280. Auditoria integral
pendiente hasta aprobacion visual de Ricky; misma rama y PR #52.

**Proceso pedido por Ricky:** construir de forma economica, sin subagentes
ni auditorias intermedias. La auditoria integral se hace despues de aprobar
el diseno, antes del cierre final. Esta instruccion posterior reemplaza el
flujo de auditoria por cada ajuste para el trabajo de esta landing. La card
y el boton quedan para revision visual; siguiente: segmento 2, «Cada parte
conectada. Todo mas claro». No hay aprobacion final ni publicacion en main.

**Historial — ritmo legible y recorrido inverso:** Ricky considera
demasiado rapida la secuencia de `5e1f8a5`. Referencia visual:
https://21st.dev/@moazamtrade/components/hero-button-expendable
Se toma la continuidad de la misma superficie desde el boton, la geometria
sin cortes y un ritmo que permita seguir el cambio. No se incorpora software
de la referencia. Confirma la inversa **tanto con Volver al inicio como con
Atras del navegador al regresar al hero**; entre preguntas, Atras sigue normal.

Ritmo local nuevo: **800 ms expansion + 120 ms pantalla dorada + 800 ms
compresion**, curva simetrica `cubic-bezier(0.65,0,0.35,1)`. Esta secuencia
focal mas lenta es una decision posterior del usuario; no cambia los tokens
generales de 160-480 ms ni el guino. Ida desde el CTA hasta la cara de 48 px;
vuelta desde esa cara hasta Dico en la burbuja de 40 px del CTA original.
El contenido cambia bajo el oro completo y el foco llega al destino. La
vuelta conserva respuestas y no crea entradas de historial adicionales.

Chrome 320/390/768/1280/1440 confirma ambas formas de volver, sin overflow
ni errores JS; fotogramas intermedios inspeccionados. Oro 390x844: 329.160
pixeles, ninguno fuera de oro. Corregido P2 de restauracion de scroll por
entrada: el helper ya no toca `history.scrollRestoration`; espera un RAF
cancelable antes de medir la vuelta. Ciclos reales auto/manual en 390/1440
conservan el modo original incluso al usar Forward o interrumpir la vuelta.
Atras entre preguntas no aumenta el numero de viajes; al reabrir se conserva
gastronomia y continua en la primera pregunta sin responder.

56 pruebas pertinentes en cuatro archivos pasan con pool threads; detector
estatico 17 warnings/6 advisory antes y despues, renderizado 390x844/1280x800
sin hallazgos antes/despues y detector nativo scoped sin hallazgos. Auditor
independiente cerro la segunda pasada sin pendientes. Misma rama y PR #52,
preview estable en el enlace de abajo. Siguiente: revision visual del ritmo
por Ricky y luego sus cambios del segmento 2; no avanzar rubros por esto.

**Historial — primera secuencia de Dico:** Ricky pide retirar la
flecha y poner la misma cara 2D dorada del diagnostico sobre el circulo negro.
Un guino al pasar el mouse (tambien con foco de teclado) y una secuencia:
boton dorado -> pantalla completamente dorada -> compresion hacia la cara
real del diagnostico. Confirma **Dico arriba de la primera pregunta en movil**.
Esto autoriza expresamente su presencia dentro del CTA, como excepcion al
criterio anterior de mantener al personaje fuera de los botones.

Implementado con `DicoBoton.jsx` y `viajeDico.js`: PNG neutral vigente y guino
localizado en un ojo en runtime, sin modificar masters, derivados ni vocabulario
global. Una capa dorada, expansion de 300 ms, al menos un fotograma completo
y compresion de 480 ms hacia las coordenadas medidas de la cara real. Retira
el morph nativo anterior; no estira imagenes ni texto ni clona el formulario.
Se monta una pregunta y una entrada de historial. Sin API, con movimiento
reducido, error o interrupcion se conserva el acceso. Limpia capa, listeners,
inert y bloqueo de scroll al terminar, cancelar o desmontar.

Chrome 320/390/768/1280/1440: sin overflow ni errores JS, destino de 48x48
visible; en movil queda antes de la pregunta. Pantalla dorada comprobada en
390x844: **329.160 pixeles de oro, ninguno de otro color**. Reposo y guino
inspeccionados a 3x. Doble clic, reduced, sin API, error, resize y Atras
verificados. Un P2 de foco al volver durante la llegada se corrigio: cancelar
retira inert antes del cambio de historial; en 390/1440 Atras devuelve foco
al CTA y el camino normal conserva foco en la pregunta. `/diagnostico`
independiente conserva su disposicion original. Parallax, suelo zinc y
segmento 2 permanecen como estaban.

Detector estatico 17 warnings/6 advisory antes y despues; renderizado en
390x844 y 1280x800 sin hallazgos antes/despues. `/diseno` con `impeccable
animate`, constructor y auditor independientes; segunda pasada sin pendientes.
42 pruebas en cuatro archivos pasan con pool threads (incluye regresion de
Atras durante llegada); ESLint sin errores ni advertencias. El preview estable y el CI
se consultan en los enlaces de rama/PR de abajo. Siguiente: cambios de Ricky
para el segmento 2; no avanzar rubros ni cerrar esa fase por esta entrega.

**Historial — ajuste de color anterior:** Ricky pide boton **dorado**, burbuja **negra** y flecha
**azul volt**. Se conserva la forma y la expansion al diagnostico. El titulo
sigue siendo **Tu tiempo vuelve a ser tuyo.** Hero y circuito comparten el
negro zinc `#09090B` mediante `--pl-suelo-continuo`; el grano entra gradualmente
en 128 px para evitar el corte de tono. La expansion tambien empieza negra.

Verificacion de este ajuste: Chrome 390x844 y 1440x900, CTA 202,61x56 px,
sin desborde ni errores JS. Texto sobre oro 9,31:1 (hover 6,89:1), flecha
sobre negro 4,50:1, foco visible. Union a 2 px antes/despues: de
`9,9,11 -> 12,12,14` a `9,9,11 -> 9,9,11` en ambos anchos. Abre el mismo
diagnostico a ancho y alto del viewport con foco en la pregunta; movimiento
reducido evita View Transition. Detector estatico 17 warnings/6 advisory antes
y despues; detector renderizado 390x844 y 1280x800: 0 hallazgos antes/despues.
Flujo `/diseno`, pulido con `impeccable`, constructor y auditor independientes;
auditoria cerrada sin hallazgos P0-P3.
No se cambian contenido, geometria ni logica del segmento 2 en este ajuste.

Preview de la rama (requiere sesion Vercel):
https://hermes-platform-git-landing-213595-diviancocorp-a11ys-projects.vercel.app/landing
CI y revision del codigo en el mismo PR #52:
https://github.com/diviancocorp-a11y/hermes-gastro/pull/52
Siguiente paso: recibir los cambios de Ricky para el segmento 2. Rubros y
demas bloques siguen pendientes; no se considera aprobado todo el circuito.

**Historial de la eleccion anterior:** Ricky elige el boton **Marfil en movimiento**
con la burbuja **dorada** y confirma el titulo **Tu tiempo vuelve a ser tuyo.**
La burbuja debe ser el origen de la expansion por la pantalla al diagnostico
existente. Autoriza continuar el apartado 2, con Dico central y fondo negro
zinc continuo. Boton, copy y apartado 2 implementados y auditados; preview
READY de `3a53c9d` en el mismo PR #52. CI del codigo y Playwright SUCCESS,
incluido el parche de seguridad transitorio indicado al final de esta entrega.

Ricky vio el preview de `58afd2b` y **le gusta el hero con parallax**. Pide
ajustar el boton, la bajada y evaluar tres titulos antes de seguir:

- Boton: dos propuestas para elegir, **Marfil en movimiento** y **Zinc y oro**.
  Se conserva el texto Quiero Dico y el destino al diagnostico. Comparacion
  visual en `docs/marca/referencias/botones-hero-opciones.html`; es una
  propuesta, no un cambio del componente real ni una eleccion confirmada.
- Bajada solicitada: "gestiona todas las necesidades de tu negocio para que
  tengas mas tiempo para vos y los tuyos". Alternativa editorial propuesta:
  "Dico simplifica la gestion de tu negocio para que tengas mas tiempo para
  vos y los tuyos". Evita la promesa absoluta de resolver todas las necesidades;
  las capacidades reales por rubro siguen siendo las de esta guia.
- Titulos propuestos: **Tu tiempo vuelve a ser tuyo.**, **Menos gestion.
  Mas vida.**, **Mas tiempo para los tuyos.** Pendiente de eleccion.
- **Decision para la proxima seccion:** fondo negro con textura zinc muy
  sutil, continuando el suelo oscuro de la escena. Al bajar no debe aparecer
  un corte a una superficie clara ni un nuevo fondo de concreto. Conservar
  esta continuidad al desarrollar el circuito de la fase 3.

La comparacion de botones anterior queda como historial de la eleccion. El
codigo actual ya aplica la capsula marfil con burbuja dorada y el titulo
confirmado; el resto de las alternativas no se implementa.

Verificacion de la propuesta aislada: Chrome en 320 y 736 px, ambos botones
202,61x56 px, sin desborde; carrusel Anterior/Siguiente operativo, Overused
local cargada y sin errores JavaScript. Marfil desplaza su flecha 8 px y zinc
la gira 45 grados; movimiento reducido deja transforms en none. Lint estetico
0 FAIL/0 WARN y detector del HTML sin hallazgos. Auditor independiente cerro
un ajuste de rol (foco en oro), sin pendientes. No son mediciones de conversion
ni cambios publicados del hero. La base de src/index.html conserva 17 warnings
y 6 advisory y no se modifico en esta revision.

### Construccion del apartado 2 — 24/oct

Alcance autorizado: aplicar la capsula marfil/burbuja dorada, el titulo elegido
y la bajada de gestion; construir **Como se conecta tu negocio**, sin avanzar
los otros bloques de la fase 3. La expansion nace de la burbuja y ocupa el
ancho de la pantalla para mostrar el mismo diagnostico, en el flujo de la web.

Linea base inmediatamente anterior: detector **17 warnings / 6 advisory**;
inspector sobre `/landing` **0 FAIL / 3 WARN** (hueso de marca, skip-link
preexistente y ausencia de video). Capturas en 1440/768/390 antes de editar.
Se conserva el flujo `/diseno`, estetica unica `design-taste-frontend`,
constructor y auditor independientes. Ninguna dependencia nueva.

La demostracion es **gastronomia de ejemplo**, no datos de un tenant:
catalogo/pedido recibido; pedido completado con descuento de harina segun
receta y cobro registrado como hecho separado; resultado del dia completo.
El neto de $669.000 sale de ventas $2.168.000 menos $1.499.000 de descuentos,
costo, nomina, merma y gastos, coherente con `Piezas.jsx`; no es la ganancia
de un solo pedido. Dico central representa la plataforma, no una IA autonoma.

Se reutiliza el pet actual con `DicoPhysical` y su manifiesto, sin cuerpos ni
poses nuevas. El grano zinc es un SVG estatico propio,
`public/brand/landing/zinc-grain.svg`, no una fotografia ni la textura de
concreto retirada. La opacidad debe ser baja para conservar lectura y union
con el suelo del hero. No se modifican los assets originales de Dico.

Implementado en `CircuitoNegocio.jsx` y `circuito-negocio.css`. En movil,
selector antes del diagrama y explicacion despues: mantiene el control cerca
de la escena. En escritorio bajo se compacta el circuito sin reducir los
textos por debajo de 15 px; conserva sticky y la cifra visible. Las conexiones
usan anclas medidas con ResizeObserver, sin coordenadas fijas que se desalineen.

Verificado localmente:

| Comprobacion | Antes | Despues |
|---|---:|---:|
| Detector estatico warnings/advisory | 17/6 | 17/6 |
| Inspector real 1440/768/390 | 0 FAIL / 3 WARN | 0 FAIL / 3 WARN |
| Tests pertinentes (pool threads, maxWorkers 2) | — | 78/78, 7 archivos |
| Hallazgos nuevos del auditor al cierre | — | 0 P0/P1/P2/P3 |

- Chrome 320x568, 390x844, 768x1024, 1280x600 y 1440x900: sin desborde,
  titulo de dos lineas y CTA visible al entrar. Estado, stock y cobro correctos
  al elegir los tres momentos. Scroll nativo tambien recorre los tres estados.
- Corregido P2 de escritorio bajo: Resultado paso de 2,38 % del diagrama
  visible al 100 %. Teclado centra el paso, conserva foco visible y cancela
  el cuadro pendiente de scroll para no sobrescribir la eleccion manual.
- Burbuja origen de 40x40; el destino ocupa todo el ancho. Abre una sola
  transicion, enfoca la pregunta y retira la escena y el pet del circuito.
  Minimo de alto 100svh en home; `/diagnostico` conserva su entrada propia.
  Medicion final del panel: 390x844 y 768x1024 exactos en esos viewports.
- Movimiento reducido desde carga: conexiones sin animacion ni transicion,
  0 animaciones corriendo en hero/circuito y 0 llamadas a View Transition
  al abrir; se mantiene el foco en la pregunta. Scroll de escritorio
  comprobado: estados 1 -> 2 -> 3.
- Fuente y personaje existentes, contraste de textos del circuito >=6,91:1;
  no nuevos cuerpos ni poses. Ni loops del pet ni pulsos continuos del beam.
- ESLint JSX sin warnings, typecheck y build pasan. Advertencias del inspector
  conservadas: hueso/marfil de marca, skip-link global preexistente 4,2:1 y
  ausencia de video (la escena elegida es parallax). No se ocultan ni cambian
  detectores para conseguir ese resultado.

Preview final del codigo `3a53c9d`, confirmado READY en Vercel:
https://hermes-platform-byaa0i2ua-diviancocorp-a11ys-projects.vercel.app/landing#que-hace

El CI de esa entrega detecto tres avisos de undici (dependencia de desarrollo
de jsdom), publicados en GitHub Advisory Database el 23/oct. Se actualiza solo
su entrada del lockfile, 7.30.0 -> 7.30.1, dentro del rango existente: sin
paquetes nuevos ni cambios a package.json. `npm audit --audit-level=high` da
0 vulnerabilidades y check:install-state confirma 466 paquetes. Referencia:
https://github.com/advisories/GHSA-xjj6-f33q-929c

CI de `3a53c9d`: Lint, Typecheck, Unit Tests, Security Audit y Build SUCCESS
(run 40105727258); Playwright chromium SUCCESS (run 40105727150). Smoke de
produccion SKIPPED por ser PR. Las 78 pruebas pertinentes tambien pasan con
el parche instalado; no cambia la UI auditada en `3eef553`. El preview requiere
la sesion de Vercel de Ricky; validacion funcional en Chrome local con backend
ficticio. No se accedio sorteando la proteccion ni se publico en main.

La validacion
visual del apartado 2 sigue pendiente de Ricky. Rubros, logos, pasos, planes,
FAQ y footer conservan por ahora la version anterior; no se cierra toda fase 3.

### Replanteo del hero — decision posterior de Ricky

Ricky **rechazo** el hero implementado en `b4084ad`: el concreto se veia raro,
no se percibia profundidad y el desglose estiraba la computadora. La auditoria
tecnica y el CI anterior no validaron esa direccion visual. No usar esa entrega
como aprobacion del hero ni extenderla a otros apartados.

Nueva instruccion: conservar la composicion de **Parallax Scrolling de Osmo**
y adaptar colores/texto a Dico. El beneficio es **tiempo para vivir y compartir
con los tuyos**. Se retiran concreto y dispositivos del hero, con el mismo
diagnostico funcional. Se trabaja sobre el mismo PR #52, sin tocar agenda,
precios ni produccion. Reemplazo implementado, auditado y subido en `58afd2b`.
Preview **READY** del mismo SHA:
https://hermes-platform-gnwx2hljm-diviancocorp-a11ys-projects.vercel.app/landing
CI del codigo: Lint, Typecheck, Unit Tests, Security Audit, Build y Playwright
**SUCCESS**; smoke de produccion SKIPPED. El criterio visual final es de Ricky;
seccion 11. El preview requiere sesion de Vercel; runtime remoto no verificado.

Referencia original gratuita CC0 localizada y verificada en Webflow. Tres
imagenes originales por capas ya guardadas en el repo, 192.604 bytes en total.
Fuente, licencia, geometria medida y decisiones:
`docs/marca/referencias/parallax-osmo.md`. No se instalan dependencias.

Linea base de este reemplazo: 17 warnings / 6 advisory estaticos; inspector
del hero rechazado 1 FAIL conocido de details cerrado y 3 WARN (hueso de marca,
skip-link global preexistente y ausencia de video). Capturas en temp del sistema.

Lo que sigue conserva el historial de la primera entrega y sus verificaciones;
la decision anterior reemplaza su direccion de hero.

### Ejecucion iniciada — Codex, 23/oct

- Ricky autorizo desarrollar el plan y avanzar con la implementacion.
- Se reutiliza `.claude/worktrees/landing-rediseno`, rama `landing/rediseno`:
  estaba limpia, sin commits propios pendientes contra main. Se actualizo
  por fast-forward a `645a522`; no se tocaron las worktrees de agenda.
- GitHub verificado: CI `40033359527` de `645a522` termino en **success**.
  Vercel confirma ese SHA en produccion, estado **READY**. El arreglo de
  vite/vitest ya esta integrado por PR #48: no se repite.
- La rama `landing/resultado-del-dia` no tiene PR (consulta de todos los
  estados). Se incorporaron sus cuatro commits por merge a esta rama para
  presentar un solo cambio coherente, sin perder la auditoria anterior.
- Guia y maqueta aprobadas trasladadas desde `docs-landing`, preservando
  aquella worktree. La implementacion usa esta copia como fuente de verdad.
- `/dico` y `/diseno` cargadas; estetica unica `design-taste-frontend`.
  Constructor `disenador` y auditor independiente, segun `/diseno`.
- Linea base: detector estatico **17 warnings / 6 advisory**. Inspector de
  la landing integrada: **0 FAIL / 2 WARN** (hueso de marca y ausencia de
  video), en 1440, 768 y 390 px. Evidencias en el temp del sistema.
  Se mide el componente real en un harness local ignorado porque faltan
  las variables publicas de Supabase en esta worktree; usa conexion ficticia,
  no datos de produccion. La ruta real se comprobara en el preview.
- Base de fase 1 preparada; fase 2 implementada, auditada y subida a preview.
  Pasos y criterios en seccion 10. Cuerpo, planes y footer siguen
  con la version anterior hasta fases 3/4. No se publico a produccion ni se
  modifico backend, agenda o precios.
- Decision comercial posterior de Ricky: **Digital $14.999 por mes**. Reemplaza
  la oferta Gratis del plan anterior. Pendiente de integrar en fase 4 con el
  diagnostico y la fuente de planes; anual sin definir, no inferir un precio.
  Verificacion de solo lectura: `plans` todavia declara Digital $29.000 y
  $23.200 como equivalente anual; Local $59.000/$47.200 y Cadena
  $99.000/$79.200. No se modificaron filas ni condiciones comerciales.

Primera entrega de codigo: hero con textura de concreto (171 KB), laptop,
tablet y celular como HTML; resultado de ejemplo prioritario y desglose nativo.
Quiero Dico abre el diagnostico existente con View Transition cuando esta
disponible y alternativa inmediata accesible; conserva respuestas, historial,
reintento y parametros del alta. Una sola presencia de Dico por estado.

Verificado en esta ejecucion:

| Comprobacion | Antes | Despues |
|---|---:|---:|
| Detector estatico: warnings / advisory | 17 / 6 | 17 / 6 |
| P0/P1 de auditoria independiente | — | 0 pendientes (2 P1 corregidos) |
| Desborde horizontal 390/768/1280/1440 | 0 | 0, tambien con desglose y diagnostico abiertos |
| Tests pertinentes, Vitest 4.1.12 / pool threads | — | 57/57, 5 archivos |

- ESLint de archivos tocados sin warnings; typecheck, build final,
  check:diseno, check:definer, check:expandir y check:alcanzable en verde.
  npm audit del lockfile corregido: 0 vulnerabilidades.
- Navegador real, conexion ficticia y guardado interceptado: los cuatro
  rubros llegan al resultado y a /registro con rubro/nombre/id correctos.
  Recarga conserva progreso; error/reintento funciona y recargar resultado
  no vuelve a guardar. /diagnostico sigue como entrada independiente.
- Auditor comprobo foco visible desde los primeros 8 frames, con API nativa,
  alternativa sin API y movimiento reducido; doble clic genera una sola
  entrada de historial. KPI corregido a Overused 700 con cifras tabulares.
- Inspector visual: baseline 0 FAIL/2 WARN. Despues aparece 1 aviso
  covered-text en tablet, **falso positivo comprobado**: lee rectangulos del
  segundo $669.000 dentro de details cerrado, no contenido pintado. No se
  modifico el detector ni se altero la UI para ocultarle texto. Los dos WARN
  anteriores siguen (hueso de marca y ausencia de video). Las capturas se
  revisaron ademas de los numeros. No hay medicion comparable de LCP/INP de
  produccion en esta entrega; el harness local no la reemplaza.
- Se detectaron dependencias de la worktree compartidas con el principal al
  intentar npm ci. Se restauro node_modules del principal desde SU lockfile,
  sin cambios de codigo, y se reconstruyo la instalacion propia de landing.
  check:install-state paso en ambas (466 paquetes por lockfile). En adelante,
  comprobar realpath y este gate antes de instalar en una worktree.

Entrega de esta fase: [PR #52 en borrador](https://github.com/diviancocorp-a11y/hermes-gastro/pull/52),
rama `landing/rediseno`, codigo `b4084ad`, integrado con main actual en
`c9cf4dc`. [Preview del hero](https://hermes-platform-q0jlduys8-diviancocorp-a11ys-projects.vercel.app/landing)
y [diagnostico independiente](https://hermes-platform-q0jlduys8-diviancocorp-a11ys-projects.vercel.app/diagnostico).
Vercel `dpl_813zuemFeE6sorpp3Lp5BUZEMxbx` **READY**, SHA `c9cf4dc`,
`version.json` respondio 200 con buildId `c9cf4dca`. Checks del PR para ese
SHA: Lint, Typecheck, Unit Tests, Build, Security Audit y Playwright SUCCESS.
Smoke de produccion SKIPPED, porque no se publico a main.

El preview requiere sesion de Vercel. El navegador automatico llego al login;
no se presenta como verificacion del runtime remoto. La revision automatica
rechazo crear un enlace temporal y tambien el fetch protegido del conector
porque pueden modificar/reutilizar bypass de acceso. No se cambio la
proteccion ni se intento otra via equivalente. La comprobacion de SHA/READY
y las pruebas locales siguen siendo validas; Ricky puede revisar con su sesion.

Siguiente: revisar esta primera entrega y ejecutar fases 3/4 con los apartados
acordados y la decision de precio Digital. El PR queda en borrador; no mergear
como landing completa ni publicar mientras falten esas fases.

La tabla siguiente conserva el estado historico de la guia en `99ffe83`;
la verificacion de ejecucion anterior reemplaza su estado de Security Audit.

| Que | Donde | Estado |
|---|---|---|
| Landing v3 (la home es el embudo de diagnostico) | `main` | **En produccion** en divianco.app |
| "El resultado del dia" en la landing y el diagnostico | rama `landing/resultado-del-dia` (4 commits, worktree `.claude/worktrees/landing-dia`) | Auditada, con preview, **sin PR**. Mergea limpio contra `main` |
| CI de `main` | GitHub Actions | **Security Audit en rojo desde el 22/oct**: alertas nuevas de `vite` 8.3.0-8.3.2 (alta) y `vitest` <=4.1.11. No es de la landing, pero el PR va a dar rojo hasta que se arregle |

Preview de la rama: `https://hermes-platform-git-landing-374273-diviancocorp-a11ys-projects.vercel.app/landing`
(en `*.vercel.app` la landing se ve en `/landing`; `/` cae al catalogo de respaldo).

**Actualizacion de la base durante la planificacion:** la referencia local
`origin/main` ya contiene el merge `dcdc0e1` del PR #48, con el arreglo
vite/vitest `b306031`, y el merge de agenda #47 `645a522`. No se modificaron
esas ramas. La consulta actual de Actions con `gh run list` fallo por conexion
a `api.github.com`: CI actual **no verificado**. El rojo de la tabla es el
estado historico de `99ffe83`, no una comprobacion del main nuevo.

**Siguiente paso:** verificar CI y base remota actuales, revisar si el PR de
`landing/resultado-del-dia` sigue pendiente y reutilizar el trabajo existente
de landing antes de crear otra rama. No repetir el arreglo de dependencias
ya integrado segun el historial. Ricky decide el merge de la landing.

### Exploracion visual del hero — 23/oct/2026 (Codex)

Ricky eligio combinar dispositivos (computadora, tablet y celular), fondo de
concreto, superficies zinc negro/carbono/cristal ahumado, dorado y acentos
volt. Referencias de movimiento: Parallax Scrolling de Osmo, profundidad de
Perspective Tunnel Hero y expansion del boton de Hero Button Expendable para
entrar al diagnostico. **Maqueta aprobada por Ricky** el 23/oct. Plan de
implementacion en la seccion 8; ejecucion pendiente, sin publicar.

[Maqueta conceptual del hero y diagnostico abierto](../marca/referencias/landing-hero-concepto-20261023.png),
generada con ImageGen usando logo y personaje existentes como referencias.
Las interfaces y datos son ilustrativos, no capturas del producto. La
aprobacion es visual; una imagen estatica no verifica las transiciones.
Arte y nota guardados en la worktree `docs-landing`; sin cambios de app,
dependencias, agenda ni produccion. Sigue vigente el pendiente de Security
Audit; no se corrigio en esta exploracion.

Ricky pidio decidir tambien los apartados restantes antes de construir por
fases. Para el apartado 2 eligio Animated Beam con Dico en el centro y delego
su union con Feature Highlights Scroll. Definicion en seccion 9; los demas
apartados siguen por elegir. Sin cambios de UI.

Continuacion: Ricky prefiere el acordeon de imagenes para "Dico en tu rubro"
y acepta tabs si hace falta mas calma. Se adopta el acordeon con expansion
solo al elegir y sin movimiento continuo; detalle al final de seccion 9.

Apartado 4 elegido: franja de logos basada en Cases with Infinite Scroll;
cada logo enlaza al Instagram oficial. Ricky prefiere reducir informacion y
mostrar todos los tenants comerciales. Confirmo expresamente incluir tambien
a Monare y MiaEstudio: se levantan sus exclusiones anteriores para esta franja.
Lista acordada: La Nona Pato, Crazy Miga, Monare y MiaEstudio. Falta verificar
logos e Instagram oficiales antes de implementar; sin publicar todavia.

Apartado 5 (como empezas): Ricky eligio la opcion 1, How It Works Steps,
por su sencillez y como respiro visual. Su boton abre el mismo diagnostico
del hero, que es el embudo; conserva el progreso si ya estaba iniciado.

Apartado 6 (planes): Ricky eligio las tres cards de la opcion 1 con selector
Mensual/Anual y transicion de importes de la opcion 3. Se conservan planes y
condiciones actuales; no es una decision de precios ni una implementacion
de cobros. Detalle al final de seccion 9.

Apartados 7 y 8 elegidos: FAQ centrada (opcion 1) y cierre en panel zinc
(opcion 1), con la frase exacta "Todo tu negocio en un solo lugar.". Footer
centrado (opcion 2), con el logo grande del ingreso al admin al fondo:
`public/brand/dico/logo/dico-oscuro.png`, confirmado en `LoginScreen.jsx`.
CTA aprobado: **"Quiero Dico"**, conservando el mismo diagnostico y una
aclaracion breve del paso siguiente. Estructura visual acordada; contenido
final, construccion y validacion pendientes. Fases generales al final de
seccion 9. Sin cambios de UI ni publicacion en esta planificacion.

## 2. Que es la landing y que vende

- **Una sola promesa:** "Todo tu negocio, en un solo lugar". Dico es
  multirubro (gastronomia, comercio, servicios). Lo que no cubre: "lo
  desarrollamos con vos".
- **La home es el embudo** (modelo IMAN): el visitante responde un
  diagnostico de 9 pasos, ve la solucion a su dolor y se da de alta solo. La
  reunion (Cal.com, 1 h, lun a vie 10-18) viene despues del alta, no antes.
- **Sin email en el embudo.** El diagnostico se guarda sin datos personales y
  se vincula al negocio cuando se registra.
- Delivery es un canal de venta, no un rubro.

### Honestidad (la regla que mas se rompio)

La landing solo promete lo que el producto hace hoy. Antes de escribir una
frase, se comprueba en la base o en el codigo. Hoy es verdad:

- Gastronomia: la ganancia neta de cada noche por sucursal (ventas, costo por
  receta, horas fichadas, merma, gastos). Migraciones 0103, 0106 y 0108.
- Stock que baja con cada venta, por receta o por articulo (0104).
- Comercio y servicios: el resultado de cada mes; cada dia, ventas, horas y
  gastos. **El costo de lo vendido por articulo esta en desarrollo**, y
  "que cada servicio descuente insumos" tambien.
- Los turnos para servicios estan en desarrollo.

Lo que no existe se escribe como "en desarrollo" (`pendiente` en
`solucion()`), nunca como hecho. Hay un test que lo exige.

### Clientes que se muestran

**Actualizado por Ricky el 23/oct/2026:** la franja publica de logos incluye
**La Nona Pato, Crazy Miga, Monare y MiaEstudio**, con enlace al Instagram
oficial de cada negocio. Esta autorizacion reemplaza la exclusion anterior
de Monare y MiaEstudio en este bloque. Titulo: **"Negocios que eligen Dico"**,
sin afirmar que todos tienen la misma operacion o etapa de implementacion.

`src/components/landing/clientes.js` todavia contiene solo La Nona Pato y
Crazy Miga; actualizarlo al implementar, con logos y enlaces verificados.
No presentar tenants tecnicos, fixtures, pruebas o negocios pausados como
clientes activos. Las fotos que se usen en otras partes llevan el nombre del
negocio y nunca se presentan como ejemplo generico.

## 3. Mapa de archivos

| Archivo | Que hace |
|---|---|
| `src/pages/PlatformLanding.jsx` | La home de divianco.app |
| `src/styles/platform-landing.css` | Sus estilos |
| `src/styles/plataforma-claro.css` | Paleta compartida (`--pc-*`) de landing, diagnostico, registro y bienvenida |
| `src/components/landing/Diagnostico.jsx` | El embudo: historial por paso, sessionStorage, guardado con reintento |
| `src/components/landing/Piezas.jsx` | Las piezas que muestran el producto (resultado, receta, turno, arqueo, pedidos, stock) |
| `src/components/landing/clientes.js` | Clientes y fotos |
| `src/components/landing/useEntradas.js` | Apariciones al scroll |
| `src/lib/diagnostico.js` | Contenido del diagnostico: rubros, dolores, `solucion()`, plan recomendado, `guardarDiagnostico` |
| `src/styles/diagnostico.css`, `src/pages/Diagnostico.jsx` | `/diagnostico` como pagina propia |
| `src/pages/Signup.jsx`, `src/services/signup.js` | El alta recibe `rubro`, `negocio` y `d` (id del diagnostico) |
| `src/pages/Bienvenido.jsx` | Despues del alta: agenda y redireccion al panel |
| `src/lib/contactoPlataforma.js` | WhatsApp, link de Cal.com y horarios (un solo lugar) |
| `src/lib/analiticaPlataforma.js` | Vercel Web Analytics; eventos como paginas virtuales `/evento/<nombre>` |
| `platform/functions/diagnostico/index.ts` | Edge function publica que guarda el diagnostico (verify_jwt=false, rate limit) |
| `platform/migrations/0100`, `0101`, `0105` | Tabla `diagnosticos`, multirubro, urgencia e inversion |
| `api/og.js` | Titulo, descripcion e imagen al compartir divianco.app |
| `public/sitemap.xml`, `public/llms.txt`, `public/robots.txt` | SEO y buscadores de IA |
| `src/test/diagnostico.test.js` | Las reglas del diagnostico, incluida la de honestidad |

Codigo huerfano (no se usa en la landing actual, se menciona y no se borra
sin ok): `src/components/landing/PalabraEscrita.jsx` y `FooterAscii.jsx`
(landing de septiembre).

Eventos de analitica: `diagnostico-cta`, `agenda`, `whatsapp`,
`registro-enviado`, `alta-confirmada`. Vercel Hobby no tiene eventos
propios: se ven como paginas `/evento/...` en el panel de Analytics.

Las listas de opciones del diagnostico estan **en tres lugares** que tienen
que coincidir: `src/lib/diagnostico.js`, los `CHECK` de la tabla
(migraciones) y la edge function. Si cambia una, cambian las tres, y la
function se redeploya (`node platform/scripts/deploy-functions.mjs --only diagnostico`, lo corre Ricky).

## 4. Diseno: reglas fijas

Autoridad, en este orden: `docs/marca/` (design system y tipografia), el
manual RC5 (resumen abajo) y recien despues la skill estetica.

- **Dorado** = accion, valor y Dico. Una sola accion dorada por pantalla. Como
  texto sobre claro, `gold-700`.
- **Volt `#3D6BFF`** = inteligencia, procesamiento. Sobre claro, la variante
  "intelligence-trace". Se usa ordenado, no de relleno.
- **Zinc** = estructura. Fondo claro hueso, no todo blanco y negro.
- **Motion: 160 a 480 ms**, se asienta sin rebote, respeta
  `prefers-reduced-motion` (sin motion se ve el estado final).
- Toques de 44 px minimo. Cuerpo de 16 px o mas, no mas de 5 tamanos.
- **Dico (la moneda) aparece una vez por pantalla**, como guia del diagnostico.
- Voz adulta, breve, con voseo. Preguntas del diagnostico en lenguaje
  profesional.
- Reglas de la casa de `design-taste-frontend` (direccion actual
  `quiet-instrument`): sin degradados, sin vidrio, sin tarjetas con icono, sin
  pastillas ni "eyebrows" decorativos.

## 5. Lo que se aprendio de IMAN (iman.ar, revisado el 22/oct)

IMAN no nos gana en producto sino en como vende. Lo que se mira para copiar
**la tecnica, no el codigo**:

- **Motion sin librerias.** JavaScript propio y CSS. Aparicion al scroll con
  IntersectionObserver (18 px hacia arriba, curva `cubic-bezier(.2,.8,.2,1)`;
  ellos usan 850 ms, nosotros nos quedamos en 480 ms por RC5). Un fondo en
  canvas que sigue al puntero, a 20-30 cuadros por segundo y apagado fuera de
  pantalla. Un boton que se convierte en la hoja del formulario al hacer
  scroll.
- **Demo que cuenta una historia.** La demo de su agente de compras (Gauss)
  trae la compra terminada en el HTML y, con motion, la reproduce paso a
  paso. Sin JS o con reduced-motion se ve el final: nunca queda vacia.
- **Embudo sin salir de la pagina:** rubro, datos y presupuesto, horario. La
  agenda esta embebida. `?rubro=` en la URL salta la primera pregunta para
  campanas por rubro.
- **Contenido:** 13 guias, 27 URLs en el sitemap, `llms.txt`, `llms-full.txt`
  y una pagina para agentes. Nosotros tenemos `llms.txt` y 2 URLs.
- **Gauss** ("tu ERP, nativo para agentes") pide precio a proveedores por
  WhatsApp, negocia y deja la compra lista para aprobar. Para eso se conecta
  al ERP del cliente; Dico ya **es** el ERP (proveedores, compras, stock,
  recetas). La version Dico se propone en el plan.

Donde Dico va adelante: producto propio con negocios reales, resultado del
dia por sucursal, stock por venta, caja, nomina, ARCA, Mercado Pago, y alta
sin hablar con nadie.

## 6. Plan

Ordenado por impacto y esfuerzo. Todo lo de la landing pasa por `/diseno`.

Actualizacion 23/oct: despues del saneamiento y PR del punto 1, la prioridad
visual es el hero aprobado (plan detallado en seccion 8). Los puntos 2-8
siguen como backlog; no se suman al alcance de este hero.

1. Arreglar Security Audit (rama propia) y abrir el PR de `landing/resultado-del-dia`.
2. `?rubro=` en el diagnostico: salta el primer paso si el rubro es valido.
3. Agenda de Cal.com embebida al final del diagnostico, en vez del link.
4. La pieza "Resultado de hoy" se arma linea por linea al entrar (demo que
   cuenta la historia, estado final en el HTML).
5. Tres guias: el resultado del dia, el costo de un plato por receta, el
   stock que baja con cada venta. Sumarlas al sitemap y a `llms.txt`; crear
   `llms-full.txt`.
6. Pixel de Meta con eventos de diagnostico, alta y reunion, que no cargue si
   el navegador pide no ser rastreado. Necesita el ID del pixel y el ok de Ricky.
7. Pagina "Desarrollo a medida": proceso en 4 pasos y preguntas frecuentes.
8. Producto (no landing): "Compras de Dico". Etapa 1 sin API de WhatsApp:
   cuando un insumo baja del minimo, Dico arma el pedido por proveedor con el
   ultimo precio y abre WhatsApp con el mensaje listo. Etapas 2 y 3 (comparar
   cotizaciones, agente que negocia) se deciden con el uso de la 1.

## 7. Como se trabaja desde Codex

1. **Arrancar:** leer `AGENTS.md`, `docs/HANDOFF.md` (primera seccion) y esta
   guia. `git worktree list` y `git -C <worktree> status --short` antes de
   tocar nada: lo modificado o sin seguimiento es trabajo vivo de otro.
2. **Una rama por tarea, en una worktree** dentro de `.claude/worktrees/`.
   Nunca se trabaja la landing sobre `main` ni se pushea a `main` sin ok.
   Para seguir lo de "resultado del dia", la worktree ya existe:
   `.claude/worktrees/landing-dia`.
3. **Diseno:** seguir `.agents/skills/diseno/SKILL.md` paso por paso. Codex
   tiene los agentes `disenador` y `auditor-diseno` en `.codex/agents/`:
   quien construye no audita. Linea base antes, medicion despues.
4. **Comandos** (en la maquina de Ricky, `NODE_ENV` vacio):
   ```bash
   NODE_ENV= npm run dev                              # local: http://localhost:5173/landing
   NODE_ENV=test npx vitest run --pool=threads src/test/diagnostico.test.js
   NODE_ENV= npm run build
   npm run check:diseno
   ```
   Husky no corre en las worktrees: los gates se corren a mano antes del commit.
5. **Ver el resultado:** push de la rama y el preview de Vercel
   (`/landing` y `/diagnostico`). El link va a Ricky.
6. **Commits chicos, de un solo tema, rutas explicitas** (nunca `git add -A`).
7. **Lo que pide ok de Ricky:** todo lo que cambia lo que ve un cliente
   (el PR), migraciones, deploy de la edge function, el pixel, variables de
   Vercel. Lo destructivo en la base lo aplica el desde el panel.
8. **Cerrar:** actualizar la seccion 1 de esta guia y el HANDOFF.

### Problemas conocidos

- **Preview en "Abriendo la tienda..."**: faltan `VITE_SUPABASE_*` en el
  entorno Preview de Vercel (ya estan cargadas; si vuelve a pasar, es eso).
- **`/landing` da 404**: la ruta existe solo en local y en `*.vercel.app`.
- **El panel de preview de la app pinta la landing en blanco**: es del panel;
  verificar en un navegador real.
- **Analytics sin datos** despues de tocar la config: hace falta un redeploy.
- **Numeros de migracion repetidos** entre sesiones paralelas: antes de crear
  una, mirar el ultimo numero en `main` y en las ramas abiertas.

## 8. Plan del hero aprobado — 23/oct/2026

### Objetivo y alcance

Construir la apertura de la landing y su entrada al diagnostico con la
direccion de la maqueta aprobada: concreto, dispositivos en profundidad,
zinc negro, carbono, cristal ahumado, dorado y volt. El visitante entiende
que es Dico, reconoce el producto y puede empezar sin esperar la animacion.

Alcance: hero, escena del producto y presentacion del diagnostico en modo
home. Se conserva el contenido de las secciones inferiores y el flujo de
alta. No incluye agenda, backend, nuevas preguntas, pixel, Cal.com embebido,
guias SEO ni cambios de planes. No hay migraciones ni despliegue de functions.

La maqueta es referencia de materiales y composicion, no una imagen que se
coloca como fondo con toda la interfaz incrustada. La implementacion necesita
texto real, controles accesibles y capas que se puedan mover por separado.

### 1. Preparar la base y medir

- Revalidar Git, worktrees y CI. Corregir vite/vitest y su cobertura compatible
  en una rama separada: elegir versiones corregidas segun el audit vigente,
  revisar diff del lockfile, audit, build y suite con pool threads. No ejecutar
  actualizaciones masivas de dependencias.
- Preparar el PR pendiente de `landing/resultado-del-dia`; Ricky decide el
  merge. Crear luego la rama `codex/landing-hero-concreto` en una worktree
  dentro de `.claude/worktrees/`, incorporando esa base sin tocar agenda ni
  hacer reset/rebase del checkout principal. Si el PR sigue pendiente, el
  trabajo puede prepararse sobre sus commits y declarar esa dependencia.
- Llevar a esa rama esta guia y la maqueta con cambios explicitos; no dejar
  la decision solo en la worktree documental.
- Antes de editar UI, ejecutar `/diseno`: autoridad del repo, direccion
  `design-taste-frontend` y linea base del detector, capturas y medidas de
  carga en movil y escritorio. Revisar tambien tablet.
- Mantener una sola direccion: la maqueta aprobada manda sobre la seleccion
  aleatoria de otra estetica. Cristal ahumado y profundidad son decisiones
  expresas de Ricky; no extenderlos automaticamente al resto del producto.

Entrega: rama aislada y linea base registrada; estado real del CI documentado.

### 2. Construir la composicion quieta

- Fondo de concreto sutil y legible; comprobar primero los assets del repo.
  Si falta una textura util, producir solo esa pieza, optimizarla y guardar
  el asset final en `public/brand/landing/`, con dimensiones reservadas.
- Marca original y fuentes locales. Butler en la apertura editorial y
  Overused Grotesk en interfaz. No recrear el logo ni el personaje.
- Titular: "Todo tu negocio, en un solo lugar." Bajada breve y boton
  "Quiero Dico"; aclarar el diagnostico siguiente. Una sola accion dorada visible.
- Computadora, tablet y celular como marcos ligeros con capas separadas;
  mostrar interfaces fieles al producto y ejemplos identificados. Priorizar
  `Piezas.jsx` y fixtures sinteticos coherentes; no consultar produccion para
  armar la escena ni exponer datos privados de clientes.
- Vista principal de resultado, pedidos en otra pantalla y catalogo en el
  telefono. Los ejemplos cuentan una misma operacion, con cuentas que cierran.
  No copiar las pantallas inventadas de ImageGen como si fueran capturas.
- Zinc negro como superficie predominante; carbono y cristal ahumado como
  detalles. Volt en seleccion, progreso y conexiones; oro en accion y valor.
- Una sola presencia del personaje por estado: al abrir el diagnostico se
  retira la presencia anterior y toma el lugar de guia. No repetir mascotas
  en cada dispositivo ni reproducir todos los logos de la imagen generada.

Entrega revisable A: hero quieto en movil, tablet y escritorio; mensaje y CTA
visibles de entrada y sin desborde horizontal. El contenido funciona antes
de agregar movimiento y no depende de un evento de animacion para aparecer.

### 3. Agregar la historia con movimiento

- Un recorrido corto, controlado por scroll nativo: concreto al fondo,
  dispositivos en planos intermedios y pocas cards en primer plano. No
  secuestrar la rueda ni exigir varias pantallas de scroll para continuar.
- Inicio: se entiende la promesa y se ven los dispositivos. Durante el scroll,
  las capas se acercan siguiendo la logica parallax de Osmo; las cards toman
  una profundidad moderada inspirada en Perspective Tunnel.
- Historia de gastronomia: pedido recibido, pedido completado, stock
  descontado y efecto en el resultado. Recibir el pedido NO debe aparentar
  que ya descuenta stock. En los otros rubros, respetar las funciones
  verificadas y el resultado del mes; no inventar consumo por servicio.
- El titulo y el boton no giran ni quedan tapados por las cards. Parar las
  actualizaciones fuera de pantalla y al entrar al diagnostico.
- Resolver primero con CSS, transforms y Web APIs. No importar GSAP, Lenis,
  Motion o WebGL por copiar la referencia; sumar una dependencia requiere una
  necesidad demostrada y autorizacion aparte. No instalar plugins de 21st.
- Transiciones temporizadas de 160-480 ms, sin rebote. El parallax sigue la
  distancia de scroll y no obliga a esperar. Con movimiento reducido, mostrar
  la composicion final quieta y permitir el mismo recorrido funcional.

Entrega revisable B: escena con movimiento en navegador real y movil. Comparar
carga, saltos de layout y respuesta al scroll contra la linea base; simplificar
capas y filtros si empeoran la interaccion. El efecto se reduce en pantallas
chicas conservando la historia y la accion principal.

### 4. Expandir el boton hacia el diagnostico existente

- Usar el boton real como origen visual de la expansion hacia un panel zinc.
  Transicion de 320-480 ms en escritorio; mas corta y directa en movil.
- Reutilizar `Diagnostico.jsx`: preguntas, respuestas, recorrido, historial,
  sessionStorage, guardado con reintento, resultado y parametros del alta.
  No crear otro formulario ni otro estado de respuestas en paralelo.
- Mantener la expansion en el flujo de la pagina. El contenido posterior
  sigue accesible; no convertir el hero en un modal que bloquee toda la web.
- El titulo de la pregunta recibe el foco al abrir; al volver a portada, el
  foco vuelve al boton. Coordinar mediciones y foco con la animacion para
  que no haya saltos ni texto enfocado oculto. Teclado y lector de pantalla
  tienen un solo formulario activo, sin clones interactivos durante el morph.
- Reabrir, retroceder y recargar conserva las respuestas; los CTAs inferiores
  llevan al mismo diagnostico. Un clic repetido no abre ni guarda dos veces.
- El ejemplo de ImageGen dice 1/4: NO es la cantidad real. El progreso se
  calcula con las preguntas existentes y sus saltos por rubro.
- Mantener `/diagnostico` como entrada independiente, con sus estilos y
  comportamiento comprobados. Aplicar el tratamiento oscuro al modo home,
  sin cambiar globalmente registro, bienvenida o catalogos de tenants.

Entrega revisable C: portada -> diagnostico -> resultado -> registro,
incluyendo volver, recargar, error de guardado y reintento.

### 5. Auditar y verificar

- Constructor `disenador` para esta pantalla; `auditor-diseno` independiente,
  de solo lectura. Resolver P0/P1 antes de presentar como terminada.
- Comparar detector y capturas antes/despues. Revisar 390x844 y 1280x800,
  tablet, teclado, foco, contraste, controles de al menos 44 px, zoom y
  `prefers-reduced-motion`; comprobar consola y red.
- Ejecutar lint, typecheck, build, `check:diseno` y los gates del repo que
  correspondan al diff; tests de diagnostico y analitica con `NODE_ENV=test`
  y `--pool=threads`. Agregar regresiones de interaccion relevantes para
  apertura, historial, recuperacion y doble envio si la cobertura no existe.
- Conservar los eventos existentes de CTA, inicio, resultado y alta, sin
  duplicarlos por el morph o por remontar componentes. Las visitas virtuales
  permiten observar el embudo; no prueban por si solas atribucion ni un
  aumento de conversion. No sumar tracking nuevo en este alcance.

Entrega: evidencia del flujo completo, medicion comparada y hallazgos de
auditoria, con cualquier limitacion expresamente documentada.

### 6. Preview y publicacion

- Commits pequenos por composicion, movimiento e integracion; rutas explicitas.
  Push de rama y preview de Vercel con `/landing` y `/diagnostico` para revisar
  desde el celular. Verificar SHA y estado del deployment antes de compartir.
- Preparar PR con problema, comportamiento resultante y validacion. Ricky
  decide el merge; no publicar a main automaticamente.
- Actualizar seccion 1 y HANDOFF con rama, SHA, preview, pruebas, pendientes y
  ubicacion de los assets. Guardar todo el trabajo final dentro del repo;
  evidencia temporal solo en el temp del sistema.

### Archivos previstos

| Archivo | Responsabilidad |
|---|---|
| `src/pages/PlatformLanding.jsx` | Integrar portada y escena, conservar CTAs inferiores |
| `src/components/landing/Diagnostico.jsx` | Presentacion home y transicion sin duplicar el flujo |
| `src/components/landing/Piezas.jsx` | Reutilizar demostraciones y ejemplos coherentes |
| `src/components/landing/EscenaHero.jsx` (si hace falta) | Encapsular dispositivos y capas del hero |
| `src/styles/platform-landing.css` | Composicion, materiales, responsive y movimiento del hero |
| `src/styles/diagnostico.css` | Tratamiento scoped al diagnostico de la home |
| `public/brand/landing/` | Textura y recursos finales optimizados que falten |
| `src/test/` | Regresiones funcionales necesarias por los cambios de integracion |

`src/lib/diagnostico.js`, la base y la edge function conservan sus opciones y
contrato. Revisar los archivos antes de confirmar la lista definitiva;
extraer solo lo necesario, sin refactor general de la landing.

## 9. Estructura completa acordada — 23/oct/2026

Ricky eligio las direcciones visuales de los ocho apartados con referencias.
Las alternativas se conservan debajo como registro; prevalece la decision
anotada de cada bloque. Esto aprueba la estructura, no declara implementacion
ni publicacion. El copy final y los datos reales se revisan antes de construir.

| Orden | Apartado | Trabajo de venta |
|---|---|---|
| 1 | Hero y diagnostico integrado | Entender la promesa y empezar; direccion aprobada |
| 2 | Como se conecta tu negocio | Circuito con Dico central y relato por scroll; direccion elegida |
| 3 | Dico en tu rubro | Acordeon de tres rubros con expansion breve al elegir; disponible y en desarrollo |
| 4 | Negocios que eligen Dico | Logos a Instagram: La Nona Pato, Crazy Miga, Monare y MiaEstudio |
| 5 | Como empezas | Tres pasos simples (opcion 1 elegida); CTA al diagnostico existente |
| 6 | Planes | Tres cards comparables + Mensual/Anual con importes animados; elegido |
| 7 | Preguntas frecuentes | Acordeon centrado (opcion 1); resolver objeciones reales |
| 8 | Cierre y pie | Panel zinc, CTA Quiero Dico y footer centrado con logo grande de fondo |

Ritmo: apertura con mayor profundidad y movimiento; cuerpo mas legible, con
materiales compartidos y movimiento que explica el producto. No repetir una
gran secuencia cinematografica en todos los apartados. Mantener anclas previas.

### Tres alternativas para el apartado 2

1. [Feature Highlights Scroll](https://21st.dev/@felipemenezes098/components/feature-03):
   titulo fijo y filas con texto e imagen que avanzan. Adaptacion propuesta:
   tres escenas de una operacion, de pedido a gestion y resultado, con
   ejemplos del rubro elegido. Recomendada para continuar la historia del hero.
2. [Feature List Showcase](https://21st.dev/@felipemenezes098/components/feature-01):
   seleccionar un elemento despliega su explicacion y cambia la imagen.
   Adaptacion: explorar preocupaciones (pedidos, costos, stock, caja,
   resultado), con una demostracion concreta de cada solucion.
3. [Animated Beam](https://21st.dev/@dillionverma/components/animated-beam):
   conexiones animadas entre elementos. Adaptacion: circuito entre catalogo,
   pedidos, stock, caja y resultado. Sustituir logos de terceros del ejemplo
   por piezas de producto; no insinuar integraciones que no existen.

No se instalo ni copio codigo de las referencias. Ricky eligio la 3 con Dico
en el centro, le gusto la sencillez de la 1 y delego como combinarlas.

### Apartado 2 elegido: un circuito que cuenta la operacion

Titulo propuesto: **"Cada parte conectada. Todo mas claro."** En la UI se
escribe con tildes. Un solo bloque, no dos demostraciones consecutivas.

- En escritorio, texto narrativo en la columna izquierda y circuito sticky
  en la derecha. Dico en el centro como cara del sistema; alrededor, cinco
  piezas legibles de catalogo, pedidos, stock, caja y resultado. Las piezas
  muestran datos breves del producto, no solo iconos.
- El scroll hace avanzar tres momentos del relato y activa las conexiones
  relacionadas. Las piezas permanecen en su lugar para que se entiendan;
  cambia su enfasis y contenido, no toda la geometria a cada paso.
- Momento 1, **"Recibis el pedido"**: catalogo y pedidos. Un ejemplo identificado
  entra al circuito. Recibirlo no aparenta descontar stock ni registrar cobro.
- Momento 2, **"La operacion queda registrada"**: al completar el pedido baja
  el stock segun las reglas reales; al registrar el cobro, se refleja en caja.
  Son hechos distintos aunque se expliquen en la misma escena.
- Momento 3, **"Ves el resultado"**: se destaca la pieza de resultado con las
  ventas y costos disponibles, sin insinuar que todos se generan por ese
  pedido. Dia en gastronomia, mes donde corresponda; ejemplos coherentes con
  `Piezas.jsx` y funciones verificadas. Rotular el rubro de la demostracion.
- Fondo negro zinc continuo (decision posterior del 24/oct, reemplaza el
  concreto de la propuesta inicial); piezas zinc/carbono.
  Dico aporta el dorado central; volt marca el camino activo. El resultado
  puede enfatizar su cifra en dorado, sin sumar botones principales dentro
  de cada pieza ni pulsos permanentes en todas las conexiones.
- Dico central representa la plataforma conectada. No presentarlo como un
  agente IA que toma decisiones o ejecuta tareas todavia no implementadas.
- En movil, circuito compacto seguido de tres pasos cortos; se puede tocar
  cada paso para ver su estado, sin exigir hover ni bloquear el scroll. No
  reducir un diagrama de escritorio hasta volverlo ilegible. Con movimiento
  reducido quedan textos y conexiones estaticos, con seleccion funcional.
- Sin duplicar el personaje dentro de las cards. Revisar tambien los bordes
  entre hero y este bloque para conservar una sola presencia dominante.

La unificacion queda como direccion para implementar y medir, no como una
promesa de mayor conversion. Las elecciones de los bloques restantes se
registran a continuacion. Mantener las reglas de honestidad de seccion 2.

### Apartado 3: Dico en tu rubro — referencias y direccion elegida

Titulo propuesto: **"Tu rubro, tu forma de trabajar."** La funcion del bloque
es que el visitante se reconozca y entienda el alcance actual. No repetir el
circuito del apartado 2 ni convertir servicios en una promesa de agenda lista.

1. [Slide Tabs](https://21st.dev/@minhxthanh/components/slide-tabs): referencia
   del selector animado, no una seccion completa. Adaptacion propuesta:
   Gastronomia / Comercio / Servicios y debajo una vista amplia del producto,
   tres capacidades vigentes y una aclaracion de lo que esta en desarrollo.
   Indicador volt; superficie zinc sobre concreto. Recomendada por claridad
   y por dar pausa al movimiento del hero y del circuito.
2. [Interactive Image Accordion](https://21st.dev/@minhxthanh/components/interactive-image-accordion):
   paneles que se expanden. Adaptacion: tres paneles por rubro, se abre uno
   al elegirlo y muestra producto y alcance. Usar vistas ilustrativas del
   producto rotuladas como ejemplos, sin necesitar nuevas fotos de clientes.
   En movil, acordeon vertical; accion por clic/toque/teclado, no solo hover.
3. [Feature Showcase Cards](https://21st.dev/@minhxthanh/components/feature-showcase-cards):
   referencia de grilla con efectos de hover y detalles de esquinas.
   Adaptacion: tres piezas visibles de peso equivalente, una por rubro,
   con un ejemplo de producto y alcance legible sin interaccion. Cambiar la
   grilla del ejemplo por tres piezas editoriales, sin iconos decorativos
   ni inventar clientes. Es la opcion mas directa para comparar rubros.

En cualquier opcion: revalidar capacidades contra el producto al implementar,
mostrar diferencias reales entre dia y mes, identificar lo pendiente y usar
un CTA que regrese al mismo diagnostico. Explorar un rubro no debe sobrescribir
las respuestas ya dadas ni guardar un diagnostico sin accion del visitante.

Decision: Ricky prefiere la 2 y acepta la 1 si es necesario dar mas calma.
Se conserva su preferencia por la 2 moderando el ritmo: tres paneles con
nombres siempre legibles, expansion solo por clic/toque/teclado y transicion
de 240-320 ms; sin autoplay, desplazamientos continuos ni expansion por el
simple paso del puntero. El contenido se queda quieto mientras se lee.
En movil, filas verticales expandibles con el mismo alcance. Con movimiento
reducido, cambio inmediato. Si las pruebas muestran problemas de legibilidad
o espacio, usar tabs como alternativa aceptada por Ricky. Sigue sin implementar.

### Apartado 4: negocios que ya lo usan — referencias y direccion elegida

Mostrar La Nona Pato y Crazy Miga, segun `clientes.js`, con fotos existentes
de `public/brand/landing/`. Toda foto lleva el negocio. No inventar citas,
resultados, opiniones, estrellas, ganancias ni cantidad de clientes. Verificar
cualquier descripcion de uso del sistema antes de publicarla. Esta era la
base de las referencias iniciales; la decision posterior agrega los logos
de Monare y MiaEstudio como se detalla abajo.

1. [Featured Project Hero](https://21st.dev/@ibrandify/components/featured-project-hero):
   referencia de proyectos destacados con imagen y resumen. Adaptacion para
   Dico: dos casos de peso equivalente, foto grande, nombre, rubro, breve
   descripcion de uso verificado y enlace al catalogo. Tomar la presentacion
   de casos, sin convertir el bloque en otro hero ni copiar historias ficticias
   de la demo. Recomendada porque dos negocios tienen lugar suficiente.
2. [Cases with Infinite Scroll](https://21st.dev/@tommyjepsen/components/cases-with-infinite-scroll):
   referencia de carrusel de imagenes. Adaptacion: recorrido manual por fotos
   de ambos negocios con sus nombres y contexto. Sin bucle infinito ni repetir
   logos para simular mas clientes; priorizar el gesto de deslizar en movil.
3. [Project Showcase](https://21st.dev/@jatin-yadav05/components/project-showcase):
   lista de proyectos con preview que sigue al cursor. Adaptacion: dos filas
   editoriales con nombre, rubro y enlace. En escritorio aparece la foto; en
   movil y teclado la imagen y datos tienen una presentacion accesible sin
   depender de hover. Es la opcion mas compacta.

Titulo inicial: **"Negocios que ya trabajan con Dico."** La recomendacion
inicial fue la 1; Ricky eligio simplificar el bloque siguiendo la 2.

Decision de Ricky: solo logos de empresas, cada uno enlazado a su Instagram
oficial para comprobar que son negocios reales. El catalogo se puede descubrir
desde la tienda del negocio. Quitar del bloque las fotos de productos, relatos
de uso, resultados y CTAs de catalogo. Conservar el nombre accesible y un
indicador discreto de que el enlace lleva a Instagram.

Composicion: franja horizontal sobre una superficie tranquila, logos con
tamano optico equilibrado y sus colores originales; navegacion manual cuando
no entren, sin repetir marcas para simular mas clientes. En movil, desplazable
con el dedo. Cada logo es un enlace con foco visible y area tactil suficiente.
No se necesita instalar el carrusel de referencia para lograrlo.

Ricky confirmo expresamente incluir tambien Monare y MiaEstudio el 23/oct.
La franja incluye La Nona Pato, Crazy Miga, Monare y MiaEstudio; quedan
levantadas las exclusiones anteriores para los logos de este bloque. Usar
**"Negocios que eligen Dico"** como titulo, incluyendo puesta en marcha sin
presentarla como operacion completa. Esto no autoriza inventar resultados,
testimonios ni funciones para ninguno de los negocios.

La lista no se deduce de tenants tecnicos, fixtures o pruebas. Antes de
implementarla, verificar los Instagram oficiales y usar logos originales;
no inventar cuentas o enlaces. Sin cambios de UI ni publicacion en esta decision.

### Apartado 5: como empezas — opcion 1 elegida

Propuesta de contenido: **"Empeza a tu ritmo."** (con tildes en UI).
Tres pasos: elegis por donde empezar con el diagnostico; creas tu negocio;
lo pones en marcha cargando tus datos, con acceso al acompanamiento despues
del alta. La reunion no es requisito previo para crear el negocio. No
prometer minutos de implementacion, una carga automatica ni funciones listas
que siguen en desarrollo. Descripcion de una frase por paso.

1. [How It Works Steps](https://21st.dev/@ln-dev7/components/how-it-works-09):
   tres pasos numerados con una conexion horizontal y una accion final.
   Adaptacion: numeros legibles, copy breve, trazo volt discreto y un boton
   que abre el diagnostico existente. Vertical en movil. Recomendada por
   explicar el arranque sin convertirlo en un proceso largo.
2. [Vertical How It Works Timeline](https://21st.dev/@ln-dev7/components/how-it-works-02):
   referencia de una linea vertical numerada; la demo tiene cuatro pasos.
   Adaptacion: tres momentos del alta y puesta en marcha con aparicion suave
   al scroll. Sin forzar un cuarto paso ni fijar la pantalla durante la lectura.
3. [Feature Steps Section](https://21st.dev/@felipemenezes098/components/feature-02):
   referencia de imagen central y pasos a los lados. Adaptacion: vista del
   negocio al empezar, rodeada de explicaciones breves del recorrido. Tomar
   su composicion, con el numero de pasos que requiere Dico, sin introducir
   nuevas fotos de personas ni volver a mostrar un hero de dispositivos.

Ricky eligio expresamente la opcion 1 por su sencillez y como respiro antes
de empezar. Se conserva espacio generoso, tres pasos de una frase y movimiento
minimo. Un solo boton dorado, **"Hacer mi diagnostico"** (con tildes en UI),
abre el mismo diagnostico integrado en el hero mediante el mecanismo existente.
Si ya hay respuestas, retoma el progreso sin reiniciarlo ni duplicar guardados.

Embudo acordado: diagnostico sin email -> recomendacion y plan -> alta del
negocio -> puesta en marcha y acceso al acompanamiento. La reunion viene
despues del alta. Esta seccion explica ese recorrido y vuelve a su entrada;
no cambia preguntas, registro o estado de respuestas. Sigue sin implementar.

### Apartado 6: planes — cards con Mensual/Anual elegidas

Comparar Digital, Local y Cadena con precios y condiciones ya definidos.
Fuente leida: `PlatformLanding.jsx` y `src/lib/diagnostico.js` en la rama
`landing/resultado-del-dia`. No modificar importes, alcance comercial o
descuentos al elegir el diseno; revalidar sus fuentes al implementar.

1. [Pricing Section](https://21st.dev/@mikolajdobrucki/components/pricing):
   cards con precio y lista de caracteristicas. Adaptacion: tres cards zinc,
   con cristal ahumado sutil y pocas diferencias utiles para comparar. Un
   unico CTA principal al diagnostico. Recomendada por mostrar los tres planes
   de un vistazo con la identidad material aprobada.
2. [Pricing Tiers List](https://21st.dev/@felipemenezes098/components/item-18):
   lista apilada con nombre, precio, descripcion y acciones. Adaptacion:
   tres filas amplias con comparacion breve y condiciones visibles. Opcion
   mas editorial y compacta; sin badges de popularidad no respaldados.
3. [Pricing Interaction](https://21st.dev/@ln-dev7/components/pricing-interaction):
   selector de planes y periodo mensual/anual con precios que cambian.
   Adaptacion: explorar los planes sin confundir la seleccion con una compra;
   si se muestra equivalente mensual anual, aclarar periodo de pago y total
   anual. No implementar cobros ni suscripciones por tomar esta referencia.

En cualquiera: moneda, precio por local y tratamiento del IVA legibles;
condiciones comunes separadas de las diferencias. El diagnostico puede
orientar la eleccion, sin afirmar "mas elegido" sin datos. Mantener el acceso
secundario de registro directo que ya existe, con menor jerarquia que el CTA
del embudo. Evitar tres botones dorados compitiendo y animaciones que impidan
leer precios. No se instalo codigo de las referencias.

Decision de Ricky: unificar la comparacion en tres cards de la opcion 1 con
el selector Mensual/Anual y el movimiento de importes de la opcion 3.

- Un unico selector de periodo encima de las tres cards: cambia todas juntas,
  conservando caracteristicas, orden y posicion. Arranque en Mensual.
- Mensual muestra la cuota mensual. Anual muestra el total a pagar por ano,
  acompanado del equivalente mensual para comparar; aclarar el pago anual,
  precio por local e IVA. Aplicar solo el descuento anual ya definido; no
  inventar promociones ni dar a entender debitos mensuales del plan anual.
- Decision posterior de Ricky: Digital cuesta $14.999 por mes y solo tiene
  pago mensual (confirmado 25/oct). Mantenerlo mensual al elegir Anual, con
  aclaracion visible, sin inventar descuento ni total anual.
- Los numeros transicionan brevemente (240-320 ms) al cambiar de periodo;
  etiquetas de periodo y valores finales permanecen claros. Reservar espacio
  para evitar saltos y usar numeros tabulares. Lectores de pantalla reciben
  el importe final, no todos los valores intermedios; movimiento reducido
  cambia el importe de inmediato.
- Mantener una sola accion principal dorada hacia el diagnostico, con las
  cards en zinc/carbono y el selector activo en volt. Explorar el periodo
  cambia la presentacion de precios, no cobra ni selecciona una suscripcion.
- En movil se mantiene el selector visible al principio y las tres cards
  apiladas; no esconder planes en un carrusel para incorporar el efecto.

La integracion visual sigue pendiente. Revalidar importes y condiciones
desde las fuentes del producto antes de implementarla.

### Apartado 7: preguntas frecuentes — opcion 1 elegida

Resolver dudas con respuestas breves y verificadas: empezar gratis, pago y
periodos, puesta en marcha, conectividad, alcance por rubro, soporte y datos.
Revisar el copy actual contra producto y condiciones reales; no copiar
politicas de reembolso, cancelacion, disponibilidad o privacidad de las demos.
No reducir preguntas necesarias solo por encajar en un numero decorativo.

1. [Centered Accordion FAQ](https://21st.dev/@ln-dev7/components/faqs-01):
   titulo, preguntas desplegables en una columna centrada y contacto inferior.
   Adaptacion: lista aireada sobre concreto, apertura breve y estados volt;
   WhatsApp discreto para dudas que no se resuelvan. Recomendada por claridad.
2. [Two-Column FAQ](https://21st.dev/@ln-dev7/components/faqs-02):
   introduccion y contacto a la izquierda, acordeon a la derecha. Adaptacion:
   mantener contexto de acompanamiento mientras se leen las preguntas;
   apilado en movil y sin crear una segunda area de scroll obligatoria.
3. [FAQ List](https://21st.dev/@felipemenezes098/components/collapsible-02):
   filas apiladas con respuestas expandibles y chevron animado. Adaptacion:
   pieza zinc compacta con separadores finos, para reducir la altura inicial.

En cualquiera, controles de teclado y foco visibles; la respuesta no depende
del hover. Se puede conservar mas de una abierta para comparar. El contacto
usa los datos oficiales existentes en `contactoPlataforma.js`. Ricky eligio
la opcion 1, Centered Accordion FAQ; implementacion pendiente.

### Apartado 8: cierre y pie elegidos

Una frase final y una accion principal al mismo diagnostico, retomando las
respuestas existentes. No agregar un formulario de email, otra agenda previa
al alta ni una segunda copia del embudo. Pie con enlaces reales, contacto y
legales de Divianco; no inventar direccion fisica, acreditaciones ni garantias.

1. [CTA with Rectangle](https://21st.dev/@mikolajdobrucki/components/cta-with-rectangle):
   referencia de llamada a la accion enmarcada. Adaptacion: gran panel zinc
   sobre concreto, frase breve, oro en el boton y un detalle volt. Recomendada
   como cierre con presencia, sin volver a desplegar toda la escena del hero.
2. [Call to Action](https://21st.dev/@felipemenezes098/components/cta-01):
   titulo, descripcion y boton centrados. Adaptacion: composicion editorial
   abierta sobre concreto, Butler en la frase y una sola accion dorada.
3. [Giant Wordmark Footer](https://21st.dev/@kedhareswer/components/kiln-wordmark-footer):
   referencia de gran marca con lema, navegacion y legales. Adaptacion:
   remate con el wordmark original de Dico y CTA encima; no usar el alfabeto
   SVG generativo de la demo para redibujar el logo. Seleccionar solo enlaces
   utiles en vez de copiar todas las columnas del ejemplo.

Ricky eligio la opcion 1, CTA with Rectangle. Frase final aprobada exacta:
**"Todo tu negocio en un solo lugar."**. Pie elegido abajo.
No se instalo codigo ni se modifico UI.

#### Footer: tres opciones para legales y contacto

1. [Minimal Two-Column Footer](https://21st.dev/@ln-dev7/components/footer-17):
   marca y frase a la izquierda, enlaces compactos a la derecha. Adaptacion:
   Dico de Divianco, contacto por WhatsApp/email y enlaces a Terminos y
   Privacidad cuando existan sus destinos reales. Fondo carbono, texto
   legible y acento volt solo en interaccion. Recomendado por su equilibrio
   con el cierre enmarcado; en movil se apila.
2. [Simple Centered Footer](https://21st.dev/@ln-dev7/components/footer-16):
   logo centrado, una fila de navegacion, iconos sociales y copyright.
   Adaptacion: una franja breve con contacto y legales; redes solo con
   destinos oficiales verificados. Es la alternativa mas compacta.
3. [Footer with Minimal Outline](https://21st.dev/@scrollxui/components/footer-with-minimal-outline):
   columnas de enlaces y gran marca delineada con aparicion al hacer scroll.
   Adaptacion: carbono y marca original Dico, dorado tenue y movimiento breve
   con variante reducida. Mas presencia visual y altura que las otras dos;
   no redibujar el logo ni instalar la dependencia motion por esta referencia.

Decision de Ricky: **opcion 2**, con el logo grande del ingreso al admin al
fondo. Asset confirmado en `src/components/admin/LoginScreen.jsx`:
`public/brand/dico/logo/dico-oscuro.png` (1368x452 declarados en el componente).
Reutilizar el original completo, sin recrearlo con texto ni sumar otra mascota.
Marca de fondo con presencia suave sobre carbono; contacto y legales en una
capa legible por encima. Imagen decorativa sin capturar clics ni duplicar su
lectura accesible. En movil, escala y espacio propios para no tapar enlaces.
No trasladar la espera del splash ni su bloqueo de pantalla al footer.

Contactos desde `contactoPlataforma.js`; verificar documentos y rutas legales
antes de implementar, sin enlaces ficticios.

#### CTA aprobado

Ricky compara "Hacer mi diagnostico" con "Colocalo en mi negocio". La segunda
expresa el resultado deseado, pero puede hacer esperar una instalacion
inmediata. Recomendacion de copy: **"Quiero Dico en mi negocio"**, con texto
adyacente **"Empezamos con un diagnóstico breve, sin email."**. Sigue abriendo
el mismo diagnostico, sin duplicar el embudo ni perder respuestas.

Es una hipotesis de comunicacion, no una mejora de conversion medida. La
claridad sobre lo que ocurre al pulsar se apoya en [NN/g: Button States,
Useful Button Label](https://www.nngroup.com/articles/button-states-communicate-interaction/).
Decision posterior de Ricky: le gusta "Quiero Dico". Se adopta esa etiqueta
breve para la accion principal, con aclaracion adyacente del diagnostico.
La frase larga queda como antecedente de la propuesta, no como otra accion.
Cambio aprobado en planificacion, todavia sin aplicar a la app.

### Fases generales con la estructura acordada

1. **Base y contenido:** verificar remoto, CI y PR pendiente; inspeccionar la
   rama/worktree `landing/rediseno` existente antes de crear otra. Recuperar
   estas decisiones en la rama de implementacion, revisar copy contra producto,
   precios, logos/Instagram oficiales y documentos legales. Registrar linea
   base de diseno y carga. El arreglo de dependencias ya aparece mergeado en
   el historial disponible; falta comprobar su CI actual.
2. **Hero y embudo:** seguir el detalle de seccion 8: composicion responsive,
   dispositivos, profundidad/parallax y expansion de Quiero Dico al mismo
   diagnostico. Primera entrega revisable en preview antes de extender el
   tratamiento a toda la pagina. Validar resultado y paso al registro.
3. **Cuerpo:** circuito con Dico central, acordeon por rubro y franja de los
   cuatro logos; despues tres pasos y planes Mensual/Anual. Revisar contenido
   y ritmo en movil mientras se integra cada bloque.
4. **Remate:** FAQ centrada, cierre zinc con la frase aprobada y footer
   centrado con el logo del admin grande al fondo; contacto y legales reales.
5. **Validacion y entrega:** auditor independiente, correcciones, medicion
   antes/despues, flujo completo y gates del repo. Preview de Vercel verificado
   para revisar en celular y PR; merge/publicacion por decision de Ricky.

Cada fase termina actualizando seccion 1 con estado, evidencia y pendientes.
Este plan no instala dependencias ni modifica agenda u otras pantallas.

## 10. Plan de ejecucion y criterios de salida — 23/oct/2026

La unidad de entrega es una fase verificable en esta misma rama. Ninguna
fase exige cambiar la base, los contratos del diagnostico o el billing.

### Fase 1 — Base comprobada y contenido

1. Inventariar estados de todas las worktrees; reutilizar la de rediseño
   limpia y actualizarla desde main. **Hecho** sobre `645a522`.
2. Comprobar CI, deploy y PR anterior. **Hecho**: CI success, produccion
   READY; el trabajo de resultado del dia se incorpora por merge.
3. Llevar guia y maqueta a la rama. **Hecho**; no borrar la copia documental.
4. Leer autoridad y medir antes de editar. **Hecho**: estatico 17/6,
   inspector sin FAIL en escritorio/tablet/movil. Guardar capturas en temp.
5. Comprobar el contenido antes de publicar cada bloque: modulos vivos,
   restricciones por rubro, precios y condiciones del selector, cuatro logos
   e Instagram oficiales. Los documentos legales deben existir antes de
   enlazarlos; nunca crear destinos vacios.

Salida: base conocida y evidencia de cada afirmacion; lo que no se verifica
queda pendiente explicitamente y no se presenta como operativo.

### Fase 2 — Hero y entrada al embudo

1. Componer primero sin movimiento: concreto, titular editorial, CTA y
   tres dispositivos con interfaces HTML y ejemplos identificados.
2. Reusar resultado del dia en gastronomia, pedidos y catalogo, con cifras
   coherentes y sin datos privados. No usar la maqueta como captura de app.
3. Adaptar 390/768/1280/1440 px, objetivos tactiles, foco y lectura.
4. Agregar profundidad/parallax ligero con scroll nativo y estado quieto
   para movimiento reducido; suspender fuera de pantalla y en diagnostico.
5. Expandir Quiero Dico hacia el mismo componente de diagnostico en home.
   Conservar historial, respuestas, reintento, analitica y paso al registro.
6. Auditar de forma independiente y verificar apertura, regreso, recarga,
   resultado, error de guardado y reintento. Comparar mediciones.

Salida: primer preview revisable del hero con el embudo funcional. Actualizar
seccion 1, con SHA, pruebas y limitaciones concretas.

### Fase 3 — Explicacion y confianza

1. Unir circuito con Dico central y relato de tres momentos; completar
   pedido descuenta stock, recibirlo no. Cobrar y vender son acciones distintas.
2. Acordeon por rubro con eleccion explicita, sin autoplay. Respetar las
   capacidades actuales y los pendientes del producto.
3. Sustituir casos extensos por los cuatro logos autorizados, con enlace
   al Instagram verificado y sin estadisticas ni testimonios inventados.
4. Integrar tres pasos sencillos y llevar su CTA al mismo diagnostico.
5. Verificar teclado, tactil, contraste, responsive y ritmo de lectura.

Salida: cada bloque explica una afirmacion y su prueba; auditoria sin P0/P1.

### Fase 4 — Comparacion y cierre

1. Mantener Digital/Local/Cadena. **Digital: $14.999 por mes, aprobado por
   Ricky el 23/oct; solo mensual confirmado el 25/oct.** Local y Cadena mantienen
   los importes verificados. Sincronizar landing, diagnostico y fuente de
   planes al implementar; no confundir precio de plan con alta sin tarjeta.
   Selector
   Mensual/Anual comun: mensual equivalente mas total anual y condiciones
   visibles; no simular descuentos no acordados. Sin implementar cobros.
2. Animar los importes sin cambiar ancho ni lectura accesible; movimiento
   reducido muestra directamente el valor final.
3. FAQ centrada con controles semanticos. Revisar respuestas contra producto
   y quitar promesas de tiempos o permanencia sin respaldo.
4. Cierre zinc: Todo tu negocio en un solo lugar. / Quiero Dico.
5. Footer centrado, logo original del admin grande al fondo, contacto real
   y textos legales de Divianco; sin enlaces ficticios ni logo redibujado.

Salida: comparacion entendible y contacto verificable, sin nuevas promesas
comerciales. Auditoria independiente y preview actualizado.

### Fase 5 — Pruebas, evidencia y entrega

1. Regresiones del diagnostico: recorrido por rubro, progreso tras recarga,
   Atras/Adelante, volver a portada, reabrir desde CTA inferior, error y
   reintento sin doble guardado, parametros correctos del alta.
2. Lint, typecheck, build, check:diseno y gates correspondientes al diff.
   Vitest siempre con NODE_ENV=test y pool threads.
3. Detector antes/despues con mismo alcance; capturas y contraste en movil,
   tablet y escritorio; movimiento reducido, foco y ausencia de desborde.
4. Constructor corrige los P0/P1 del auditor separado; hasta dos rondas.
5. Commits por tema, push de rama, verificar SHA/READY en Vercel y compartir
   /landing y /diagnostico. Preparar PR; Ricky decide merge y publicacion.
6. Actualizar seccion 1 y HANDOFF con hecho/verificado/pendiente, sin llamar
   terminada una fase que no paso sus criterios.

### Evidencia de contenido y recursos de esta ejecucion

Lectura de solo datos publicos de marca en el edificio, 23/oct:

| Negocio | Instagram guardado en su configuracion | Logo original |
|---|---|---|
| La Nona Pato | `lanonapato.ar` | `tenant-images/c8e3de7e-2fc9-44ad-b7e4-03bb73a94cdb/marca-20261019/d8c8e66604f2-logo-dico.png` |
| Crazy Miga | `crazymiga.ok` | `tenant-images/eb7a0184-bb22-4f70-a87f-abd7fa81f08d/logo-1791564598053-3ahnc2.jpeg` |
| Monare | `monare.boutique` | `tenant-images/1367edee-7754-4169-a616-45310d98c045/logo-1792078548674-x00bej.png` |
| MIA ESTUDIO | `miaestudiok` | `tenant-images/d3f27bf9-db9b-48be-9c7a-0bfe9b0e0bd2/marca-20261022/20412413dc2d-logo-y2k.png` |

Los objetos pertenecen al Storage publico de `wwwzdgprsooyjgkuyoav`; no se
regeneraron logos ni se escribieron datos del tenant. Esto verifica los
destinos configurados por sus marcas, no metricas de Instagram.

Textura de la entrega rechazada (retirada del runtime y del repo al reemplazar
el hero): `public/brand/landing/concreto-hero.webp`, 1536x1024,
171.234 bytes. Generada con herramienta integrada ImageGen y convertida a
WebP con `@jsquash/webp` ya instalado (calidad 72), sin dependencias nuevas.
No es una captura ni una fotografia de un negocio cliente. Prompt exacto:

> Use case: photorealistic-natural. Asset type: wide website background material texture, no user interface. Generate a subtly weathered architectural concrete wall and low concrete floor ledge, front-on almost orthographic with extremely slight natural perspective. Entire image is only matte smooth grey warm zinc concrete, fine pores and quiet mineral variation, soft natural light from upper left, subdued natural diagonal sunlight only on far right. Flat continuous uninterrupted upper 80% wall, low horizontal ledge at bottom 20%. Contemporary refined material photography, realistic and tactile, low contrast overall so dark text on left will stay clearly readable. Very wide 3:2 or landscape format. No objects, plants, devices, text, logos, typography, cracks, signs or strong seams. No vignette. This is a reusable background texture for Dico's landing page.

## 11. Reemplazo del hero: tiempo y parallax original — 23/oct/2026

Esta instruccion posterior de Ricky reemplaza la direccion del hero de la
seccion 8. Los demas apartados acordados mantienen su plan. No hace falta
volver a elegir referencias ni sumar otro efecto al que Ricky selecciono.

### Argumento y contenido

El visitante es el duenio que reparte su atencion entre pedidos, costos,
stock, caja y equipo. El resultado deseado es recuperar tiempo para su vida.
Dico lo ayuda reuniendo esa gestion en una plataforma; el diagnostico
identifica por donde empezar segun el negocio. No se promete una cantidad
de horas ahorradas ni que la app tome todas las decisiones por el duenio.

1. Hero: **Mas tiempo para vivir.** La escena de paisaje y persona transmite
   espacio personal; la bajada explica que Dico reune la operacion.
2. La prueba operativa sigue en el cuerpo y las piezas reales del diagnostico,
   no en una computadora que cambia de forma al desplegar una cuenta.
3. Accion: **Quiero Dico**, con aclaracion del diagnostico sin email.

### Construccion

1. Usar las tres capas del original gratuito CC0, servidas desde el repo.
   Mantener el orden cielo/montana/titulo/primer plano y la alineacion exacta
   de los planos. No generar otra textura ni convertir la escena en cards.
2. Trasladar el recorrido visible: velocidades claramente distintas, sin
   interceptar scroll ni agregar dependencias. El rango debe percibirse en
   el navegador, no solo existir como unos pocos pixeles en el codigo.
3. Adaptar los colores con la marca original, accion dorada, volt funcional
   y texto legible; conservar fotografia y composicion de la referencia.
4. Mensaje y CTA visibles al entrar en movil y escritorio. La persona puede
   quedar delante del plano del texto, pero no volver ilegible el titulo.
   Mantener el encuadre sin deformar las imagenes al cambiar viewport.
5. Conservar el diagnostico existente, el foco y sus respuestas. Abrirlo
   retira la escena y sus animaciones; /diagnostico sigue independiente.

### Verificacion antes de compartir

- Comparar escena al inicio, durante y despues de scroll: registrar movimiento
  de cada capa y comprobar diferencias grandes, continuidad y ausencia de
  bandas vacias. Mirar las capturas de 390/768/1280/1440, no solo los numeros.
- Movimiento reducido quieto, teclado/foco, touch targets, contraste sobre
  fotografia, cambios de ancho/alto y CTA siempre accionable.
- Auditor separado contra autoridad y referencia. Tests del ciclo de motion
  si se modifica, regresiones del diagnostico, lint, tipos, build y gates.
- Actualizar el PR #52 y el preview de la rama; no publicar a main. Registrar
  aqui evidencia y limites reales. El estado de aprobado depende de Ricky.

Fuentes y licencia: `docs/marca/referencias/parallax-osmo.md`.

### Evidencia del reemplazo

- Navegador Chrome local sobre `/landing`, no un harness: 1440x900,
  768x1024, 390x844, 320x568 y 1280x600. Sin desborde horizontal,
  imagenes cargadas con encuadre compartido y CTA visible al entrar.
- A scroll 288 px: cielo 236,16 px; montana 187,20 px; titulo 95,04 px;
  primer plano 34,56 px. Separacion cielo/frente 201,60 px. Capturas
  iniciales y durante scroll revisadas; ninguna escala de dispositivos.
- Cambio de preferencia a movimiento reducido: 0 animaciones del parallax,
  transforms `none`. Abrir Quiero Dico retira la escena y enfoca la primera
  pregunta en los cinco tamanios. Sin errores JavaScript en ese recorrido.
- 61 tests pertinentes / 5 archivos pasan con Vitest 4.1.12, pool threads;
  incluyen cuatro casos nuevos del ciclo de motion. Typecheck, build y
  `check:diseno` pasan. Sin nuevas dependencias ni cambios de backend.
- Auditor independiente: 0 hallazgos nuevos P0/P1/P2/P3. Registra un P2
  heredado en Entrar (38,86x44 px frente a objetivo 44x44); no se amplio el
  alcance al header global. No certifico AA numerico de toda la fotografia.
- Medicion estatica antes/despues: 17 warnings / 6 advisory, delta 0.
  Inspector real antes 1 FAIL/3 WARN, despues 0 FAIL/3 WARN: se retiro el
  details que provocaba el falso positivo; no se presenta como mejora AA.
  Warnings conservados: hueso del sistema de marca, skip-link global
  preexistente a 4,2:1 y ausencia de video (se usa el parallax elegido).
- Revalidado el ajuste de CTA de una linea en 320x568, sin desborde.
  No se declara aprobado el diseno por estas comprobaciones tecnicas.
  Vercel confirma READY y SHA `58afd2b0c7692bf8b0b963c471eb5149e01e2054`.
  Checks remotos del codigo en SUCCESS (smoke produccion SKIPPED).
  Runtime remoto no verificado por proteccion de Vercel; no se intento
  crear ni reutilizar un bypass. La validacion funcional de esta entrega
  corresponde al navegador local con conexion ficticia, no a produccion.
