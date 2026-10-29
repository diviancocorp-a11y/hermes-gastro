# HANDOFF — Dico, plataforma multi-rubro (para seguir en code)

> Punto de entrada para continuar. **Las secciones van de mas nueva a mas
> vieja: leer la primera.** Docs largos: `PLAN-ERP.md` (el plan vivo del ERP),
> `docs/plataforma/PLAN-MULTI-RUBRO.md`, `docs/plataforma/ARQUITECTURA-MODULAR.md`. SQL en `platform/`.
>
> Para retomar en un chat nuevo: **`/dico`**. Para cerrar: **`/cerrardico`**.
>
> Quedan las ultimas 5 secciones. Las anteriores estan en
> `historico/HANDOFF-anterior.md`; las mueve `npm run handoff:archivar`.

---

## 24/oct/2026 — Catálogo por rubro preparado para revisión (Codex)

- Rama `codex/catalogo-filtros-rubro`, PR borrador #56. No fusionada ni publicada
  en producción. Preview separado `codex/catalogo-filtros-rubro-preview`: sólo
  ese branch cambia el fallback a Monare; NO fusionar su commit a main.
- Preview verificado: https://hermes-platform-li3ohpykf-diviancocorp-a11ys-projects.vercel.app/
  (protección Vercel: obtener share link vigente por MCP si hace falta).
- Perfiles gastro/bebidas/retail/barber configurables desde Productos por owner.
  Categoría, bodega/marca, línea, cepa y presentación combinables; Cajas es
  presentación. Gastronomía conserva filtros rápidos. Características explícitas
  en editor, tarjeta y detalle; nunca inferidas de nombres o descripciones.
- Migraciones 0114/0115 aplicadas vía MCP y releídas. 53 productos Monare con
  clasificación, 40 activos/13 inactivos; precios, imágenes, descripción,
  disponibilidad y categorías legacy sin cambios. Perfil beverages. Cero
  características asignadas: Ricky espera listado de Vegano/Sin TACC de la clienta.
  Skin Contact queda en Vinos hasta confirmar estilo; envases de 3L pendientes.
- Datos nuevos validados en DB/Zod/servicios; omitir catalog_attributes conserva
  datos desde formularios anteriores. get_catalog conserva contrato previo.
- Verificación: 84 tests específicos, 87 smoke pre-commit, build, typecheck,
  columnas, schema, compatibilidad, definer y check:diseno. CI inicial pasó
  unit tests, lint, build y Playwright; audit detectó undici 7.30.0 (dev/jsdom).
  Parche compatible actualizado a 7.30.1, npm audit: cero vulnerabilidades.
- Diseño: antes/después 17 warnings + 6 advisory conocidos; ninguno nuevo.
  Auditor independiente: cero pendientes tras corregir tokens y copy del editor.
  390x844 y 1280x800 sin desborde; categorías 16 -> 5; controles nuevos 48px,
  contraste 15,34:1, foco visible. Probado Espumantes+Chandon=1, Cajas=7,
  Hielo=4 (descarta combinación incompatible), detalle con clasificación.
- El navegador no abrió localhost; revisión visual hecha en Vercel. Editor
  y selector de perfil cubiertos por pruebas de interacción; no guardados sobre
  productos reales durante QA. La publicación espera OK explícito de Ricky.
- Worktree real dentro de `.claude/worktrees/catalogo-filtros-rubro`.
  La herramienta creó además un checkout vacío externo bajo `.codex/worktrees/`;
  archive_worktree rechazó archivarlo por estar protegido por tarea/workspace fijado.
  No se editó ni se usó ese checkout. El HANDOFF de precios previo se conserva aquí.

---

---

## 24/oct/2026 — Landing: boton elegido y circuito con Dico central (Codex)

### Ultima continuacion — 24/oct (leer primero)

- 25/oct: hero centrado segun nuevas capturas. CTA «Empezar mi diagnostico»
  oro con circulo negro/flecha oro; relleno negro desde derecha al hover.
  Apertura negra hasta card, hero difuminado alrededor, volt interno intacto.
  Cierre negro al boton y retorno al oro. Sustituye el fondo oro persistente
  descripto debajo. 29 pruebas, build y Chrome 390/1280 verificados.
  Esperar aprobacion visual del hero antes de avanzar segmento 2.
- Pedido posterior de Ricky: construir sin subagentes ni auditorias
  intermedias para ahorrar uso; auditoria integral despues de aprobar diseno.
  Diagnostico ahora en card zinc sobre oro persistente: una expansion640ms,
  card180ms, contraccion480ms al boton al cerrar. Dico arriba en movil,
  X/Escape desde cualquier paso, respuestas conservadas y hero montado debajo.
  CTA oro con contorno y circulo azul volt detras de Dico. Comprobacion basica
  390/1280 y cierre/reapertura en pregunta2; revision integral pendiente.
  Misma rama landing/rediseno y PR52. Proximo: cambios del segmento2.
- Ricky rechazo el ritmo de 5e1f8a5 por rapido. Referencia Hero Button Expendable
  de 21st: superficie continua desde CTA; ahora800+120+800ms con curva simetrica,
  excepcion focal posterior a la regla general, sin cambiar otros controles.
  Confirma vuelta tanto Volveralinicio como Atrasnativo: cara48 -> oro -> Dico
  en burbuja40delCTA. Atras entre preguntas normal, respuestas conservadas.
  Chrome5viewports320-1440 ambasvueltas sin overflow/JSerrors; foco correcto,
  oro329.160pixelesuniformes y fotogramasintermedios inspeccionados.
  P2scrollRestoration corregido: ninguna escritura al modo del navegador,
  RAFcancelable antes de medir vuelta. Auto/manual preservados en390/1440
  con Forward/Back/interrupciones. 56tests/4files, poolthreads; detector17/6
  sin cambios, render390/1280y scopednativo sin hallazgos, auditor2sin pendientes.
  LANDINGseccion1 tiene detalle y preview estable. Pendiente Ricky revise ritmo;
  luego cambiosdel segmento2. No avanzaron rubros ni otros bloques.
- Cambio mas reciente: reemplazar flecha por Dico2D dorado sobre circulo negro,
  guino al hover/foco y boton que cubre viewport de oro y se comprime hacia
  la cara real del diagnostico. Ricky confirma guia antes de pregunta movil.
  DicoBoton/viajeDico nuevos, sin modificar assets/masters ni dependencias.
  Expansion300ms -> fotograma completo -> compresion480ms. Un montaje/history;
  reduced/sinAPI/error/cancelacion mantienen acceso y restauran inert/scroll.
  Chrome320/390/768/1280/1440: sin overflow/erroresJS; cara48x48visible.
  Oro390x844:329.160pixeles,0fueraoro; guinoinspeccionado3x. P2 de foco con
  Atras durante llegada corregido y confirmado en390/1440; /diagnostico propia
  conserva disposicion. Detector17/6sin cambios, render390/1280sin hallazgos.
  42tests/4archivos(poolthreads) y ESLint pasan, auditoria2sin pendientes.
  Actualiza LANDINGseccion1; segmento2/parallax/zinc sin cambio. Todavia
  pendiente recibir mas cambios del segmento2, no avanzar rubros.
- Ajuste posterior de Ricky: CTA dorado, burbuja negra y flecha volt; conserva
  forma, hover y expansion. Suelo compartido zinc950 en hero/circuito/home del
  diagnostico; grano aparece gradualmente en 128 px, sin costura de tono.
  Chrome390/1440: union9,9,11 a ambos lados, CTA202,61x56,0overflow/erroresJS,
  apertura/foco y reduced verificados. Contrastes9,31/6,89/4,50:1; detector
  estatico17/6 y render390/1280 sin hallazgos, sin aumento de deuda. Solo3CSS
  y estas notas. Siguiente: cambios de Ricky al segmento2, no avanzar rubros.
  LANDING seccion1 contiene el preview estable de rama y el PR#52 para CI.
- Ricky aprobo el parallax y eligio la capsula **Marfil en movimiento** con
  burbuja dorada y el titulo **Tu tiempo vuelve a ser tuyo.** Bajada de gestion
  aplicada. La burbuja origina la expansion al diagnostico existente: ancho
  completo, minimo100svh en home, con alternativa inmediata sin API/reduced.
- Apartado 2 implementado: `CircuitoNegocio.jsx` + CSS scoped, pet vigente
  `DicoPhysical` central y cinco piezas (catalogo/pedidos/stock/caja/resultado).
  Tres momentos por scroll nativo en escritorio y seleccion manual/teclado;
  en movil, selector -> diagrama -> explicacion. Negro zinc continuo desde
  el hero, grano SVG propio estatico de baja opacidad en public/brand/landing.
- Gastronomia de ejemplo: recibir no descuenta ni cobra; completar descuenta
  receta; registrar cobro es accion distinta. Neto$669.000 del dia completo,
  mismas cifras de Piezas, sin datos privados ni nueva promesa IA.
- Verificado:78tests/7archivos, poolthreads/maxWorkers2; JSXlint, tipos y build.
  Chrome320/390/768/1280x600/1440:0overflow, titular2lineas,CTAvisible,
  seleccion3estados, foco y apertura. Estatico17warnings/6advisory sin cambio;
  inspector0FAIL/3WARN conocidos. Auditor independiente sin pendientes al
  cierre: P2 sticky bajo corregido; teclado ya no manda foco fuera de vista.
- Sin paquetes/backend nuevos. El unico recurso final nuevo fuera de
  src/docs/platform/scripts es zinc-grain.svg, necesario para servir el grano;
  no se modificaron los masters ni los assets del pet. Agenda intacta.
- Codigo `3eef553` y parche `3a53c9d` subidos al PR#52 en borrador; preview READY:
  https://hermes-platform-byaa0i2ua-diviancocorp-a11ys-projects.vercel.app/landing#que-hace
  El CI encontro alertas nuevas de undici via jsdom: parche solo del lockfile
  7.30.0 -> 7.30.1, sin dependencias nuevas. Audit local 0 vulnerabilidades e
  instalacion coherente con 466 paquetes. CI de `3a53c9d` SUCCESS: Lint,
  Typecheck, Unit Tests, Security Audit, Build (run40105727258), tambien
  Playwright (run40105727150); smoke produccion SKIPPED. 78 pruebas pertinentes
  tambien pasan con el parche. Chrome local con backend ficticio; preview
  requiere sesion Vercel. No se mergeo ni se publico en main.
  Ricky revisa apartado2 antes de seguir. Misma rama landing/rediseno. Fases3/4 aun
  pendientes: rubros, logos/Instagram, pasos, planes, FAQ/footer. Digital14999
  sigue documentado, sin aplicar aqui. LANDINGseccion1 es el estado vivo.

### Historial — 23/oct: reemplazo del hero rechazado

### Ultima decision de Ricky y reemplazo (leer primero)

- Ricky rechazo el hero de concreto/dispositivos de `b4084ad`: textura rara,
  profundidad insuficiente y laptop deformada al abrir el ejemplo. Los checks
  anteriores no equivalian a aprobacion visual. No extender esa direccion.
- Se reemplazo por la composicion original de Parallax Scrolling de Osmo:
  paisaje, montana, titulo y caminante en cuatro planos. Mensaje **Mas tiempo
  para vivir.**, bajada de pedidos/stock/caja/resultados y tiempo para los tuyos.
  Quiero Dico mantiene el diagnostico. Recursos originales CC0, 192.604 bytes,
  procedencia y licencia en `docs/marca/referencias/parallax-osmo.md`.
- Misma worktree y PR #52. Se retiro la textura huerfana de public; las tres
  capas WebP son los nuevos archivos finales fuera de src/docs/platform/scripts,
  necesarios para servir la escena localmente. Sin paquetes ni backend nuevos.
- Verificado localmente: 61 tests/5 archivos, tipos, build y check:diseno.
  Chrome en 1440/768/390/320/1280 sin overflow; CTA visible y abre con foco.
  Scroll288 mueve cielo236,16/montana187,20/titulo95,04/frente34,56 px.
  Movimiento reducido cancela las cuatro animaciones, sin errores de JS.
- Auditor independiente: 0 hallazgos nuevos. P2 heredado Entrar38,86x44px;
  contraste AA fotografico completo no certificado. Detector17/6 sin cambio;
  inspector real pasa de1FAIL/3WARN a0FAIL/3WARN (se retira details que daba
  falso positivo). Los tres warnings preexistentes se explican en LANDING.
  CTA de una linea revalidado en320px, sin desborde.
- Codigo `58afd2b`, PR #52 en borrador. Vercel READY del mismo SHA:
  https://hermes-platform-gnwx2hljm-diviancocorp-a11ys-projects.vercel.app/landing
  CI: Lint, Typecheck, Unit Tests, Security Audit, Build y Playwright SUCCESS;
  smoke produccion SKIPPED. Runtime remoto no verificado por proteccion de
  Vercel; no se intento bypass en esta entrega. Temporales propios retirados.
- La aceptacion visual sigue pendiente de Ricky; cuerpo y planes siguen
  pendientes de fases3/4. Este preview requiere su sesion de Vercel.
  Detalle y evidencia viva en LANDING secciones1/11. Agenda intacta.

### Historial de la entrega anterior (reemplazada)

## 23/oct/2026 — La landing se sigue desde un solo lugar (Claude)

- `docs/plataforma/LANDING.md` es la guia unica de la landing: estado, mapa de
  archivos, reglas de honestidad y de marca (resumen del RC5), lo aprendido de
  IMAN y el plan. Ricky la sigue desde Codex.
- Continuacion Codex: Ricky eligio la estructura completa y autorizo avanzar.
  Plan de 5 fases con pasos y criterios en seccion 10; seccion 1 registra el
  estado y debe actualizarse al cerrar cada fase. Se reutilizo la worktree
  limpia `landing-rediseno` y se incorporo la rama de resultado del dia.
- Fase 2: hero de concreto, laptop/tablet/celular con HTML de ejemplo, KPI y
  desglose nativo; Quiero Dico abre el diagnostico existente mediante morph
  nativo o alternativa accesible, sin duplicar respuestas ni guardados.
  Una sola presencia Dico por estado; fuentes locales y tokens Zinc existentes.
- Codigo `b4084ad`, integrado con main `645181e` en `c9cf4dc`.
  PR #52 **en borrador**: https://github.com/diviancocorp-a11y/hermes-gastro/pull/52
  Preview READY del SHA c9cf4dc:
  https://hermes-platform-q0jlduys8-diviancocorp-a11ys-projects.vercel.app/landing
  Entrada separada en el mismo host: /diagnostico. No se publico a main.
- Verificacion: 57 tests/5 archivos con Vitest4.1.12 y pool threads; ESLint,
  tipos, build y gates del repo pasaron. CI del PR en c9cf4dc: Lint, Typecheck,
  Unit Tests, Build, Security Audit y Playwright SUCCESS. El arreglo vite/vitest
  ya estaba mergeado en main, no se repitio. Smoke produccion SKIPPED.
- Auditor independiente: 2 P1 corregidos (KPI700 y foco inicialmente oculto),
  0 P0/P1 pendientes. Detector estatico 17warnings/6advisory antes/despues;
  sin desborde en390/768/1280/1440, tambien con desglose/diagnostico abiertos.
  Inspector reporta un falso positivo comprobado de rectangulos de contenido
  en details cerrado; no se altero UI ni detector para esquivarlo.
- Navegador local con conexion ficticia: cuatro rubros hasta registro con
  parametros correctos; recarga, error/reintento y no duplicacion de guardado.
  Preview remoto: version.json200/buildIdc9cf4dca y READY verificados. Runtime
  remoto no verificado: navegador llego al login de Vercel. Revision automatica
  rechazo enlace temporal/fetch protegido por bypass de acceso. Proteccion intacta.
- Pendiente inmediato: fases3/4 (circuito, rubros, logos con Instagram, pasos,
  planes, FAQ y footer con logo del admin). Siguen con UI anterior en el preview.
  Ricky aprobo Digital **$14.999/mes**; anual sin definir. Aun no se cambiaron
  precios en landing, diagnostico ni tabla plans; sincronizar en fase4.
  No confundir cuenta sin tarjeta con plan gratis. No publicar este borrador
  como landing completa. No hay migraciones, funciones ni billing nuevos.
- Instalacion: se detecto node_modules compartido al sincronizar dependencias.
  Se restauro el principal desde su propio lockfile y se dejo landing aislada;
  check:install-state paso en ambas (466 paquetes). Codigo/agenda principal
  intactos. En adelante verificar realpath e install-state antes de npm ci.
- Recursos finales dentro del repo: maqueta en docs/marca/referencias y textura
  optimizada en public/brand/landing/concreto-hero.webp (1536x1024,171KB).
  Public es el unico archivo final nuevo fuera de src/docs/platform/scripts,
  necesario para servir el fondo; ImageGen conserva original en su cache.
  Prompt y procedencia en LANDING. Temporales de prueba se limpian al entregar.

---

## 22/oct/2026 — MiaEstudio: acceso y servicios cargados, datos de turnos pendientes (Codex)

### Actualización del 22/oct

- Marca aplicada según la Biblioteca de empresas/CLIENTES/mia-estudio:
  MANUAL.md, marca.json y fuente HTML del manual v2. Solo datos del tenant,
  sin JSX/CSS, schema ni otros tenants. Nombre público `MIA ESTUDIO` también
  en `tenants.name` (get_catalog lo toma de ahí), color de marca `#DF0359`,
  tema `carbon` como base crema disponible, Instagram `miaestudiok` y texto
  `Uñas y pelo · Zona Norte · Pilar · A domicilio` en slogan.
- Original `logos/logo-y2k.png` (1254x1254, 1.390.915 bytes) cargado como logo
  y favicon: `tenant-images/<tenant_id>/marca-20261022/20412413dc2d-logo-y2k.png`.
  Original `logos/logo-completo-horizontal-claro.png` (2225x800, 497.235 bytes)
  cargado como cover_url y og_image_url, mismo prefijo, nombre
  `d103adcf4219-logo-completo-horizontal-claro.png`. Ambos HTTP 200 y SHA256
  idéntico al original (prefijos de hash en nombre); sin regenerar ni editar
  imágenes ni modificar la Biblioteca. api/og.js usa cover_url para compartir.
- Readback de settings y get_catalog verificado. HTTP de producción como
  facebookexternalhit: 200, og:title MIA ESTUDIO, descripción y og:image nuevos,
  theme-color fucsia. Siete productos idénticos antes/después, todos borradores;
  store_open=false, horarios sin tocar. Constructor separado revisó recursos.
- Límite de la personalización actual: catalog_font no tiene consumidor y
  logo_color no reemplaza --ac de catalog-pro. Carbon conserva tipografía
  Source Serif y acento chocolate; Modak/Poppins y la paleta Y2K completa del
  manual NO quedaron implementados. Cover no es un hero visible. No se
  amplió el sistema global como parte de esta carga de datos.
- /diseno: detector estático antes/después 17 warnings y 6 advisory, sin
  cambios; check:diseno verde. Auditor independiente: 0 P0/P1 nuevos, sin
  desborde a 390x844 y 1280x800, consola limpia, slogan 15,19:1 y foco de
  Instagram visible. Dos P2 de contenedores compartidos: logo header 36 px
  frente a mínimo 60 del manual y enlace IG 40 px frente a objetivo táctil
  44. No corregidos en esta carga de datos: requieren cambios de código.
  Evidencias y settings anteriores solo en el
  temporal del sistema mia-estudio-marca-20261022. Sin archivos nuevos fuera
  de src/docs/platform/scripts dentro del repo.

- Cargados y releídos por MCP los siete servicios del tenant `mia-estudio`:
  Alisado $26.000, Bótox capilar $18.000, Soft gel $12.000, Esmaltado
  semipermanente $10.000, Flores 3D $700, Retiro de trabajo de Mía $1.000 y
  Retiro de otra profesional $1.500. Tipo `service`, categorías Pelo/Uñas/
  Retiros. Quedan como borradores (`active=false`), con `duration_min=NULL`;
  `store_open=false` y horarios sin completar. No se inventaron duraciones.
- En descripción del alisado figura resultado aproximado de 4 a 6 meses;
  en bótox, de 2 a 4 meses, según el mensaje de Mía del 20/oct. Son duración
  del resultado, no tiempo de atención. Los retiros conservan la aclaración
  de que se hacen antes del nuevo servicio. Falta confirmar si Flores 3D se
  cobra por flor, uña o trabajo y si los retiros se reservan por separado.
- Creada cuenta de Auth para `miajazmingonzalez18@gmail.com`, usuario
  `3ee37a6b-b090-4236-9437-f6dcff3fe706`, y vinculada como propietaria mediante
  la RPC vigente `attach_owner` (cuerpo vivo revisado). Verificados login con
  la clave suministrada, lectura de su membresía `roles=['owner']` y cierre
  de la sesión de prueba. La clave no se guardó en archivos ni en Drive.
  Panel: https://mia-estudio.divianco.app/admin . Interfaz del panel no
  recorrida en esta tarea; el login se verificó por API.
- Planilla nativa creada en Drive/ChatGPT y verificada por lecturas y navegador:
  https://docs.google.com/spreadsheets/d/1F8KPcpfH8tXoIU1jyb2XIvINbv50i014EWDl7knSUgg/edit
  Pestañas Servicios (atención en minutos, margen entre turnos, profesional y
  aclaraciones), Atención (horarios diarios, lugar, contacto, profesionales,
  cobros/seña y cancelaciones) e Insumos (producto, marca, contenido/costo del
  envase, stock y consumo por clienta con unidad). Casilleros amarillos vacíos.
- Bótox líquido The Real Brazilian Keratin, envase de 250 ml, registrado como
  dato confirmado en la planilla. No se cargó stock ni costo cero en la base:
  faltan cantidad disponible, costo exacto y consumo por servicio. Marcas de
  uñas informadas y rango $2.500–$10.000 conservados como referencia, sin
  transformarlos en insumos o costos individuales inventados. Producto de
  alisado pendiente de identificación.
- Ricky autorizó compartir la planilla con `miajazmingonzalez18@gmail.com`
  como editora, sin notificación por correo. Aplicado y verificado en el
  diálogo de Drive: correo exacto, Editor y acceso general Restringido.
  Evidencia visual en el temporal del sistema. No se envió ningún mensaje.
  También autorizó el push del HANDOFF a main tras el rechazo inicial de la
  revisión automática. La carga del tenant no depende de un deploy.
- Sigue pendiente implementar agenda y consumo por turno (ver alta inicial
  abajo). Completar la planilla aporta datos, no habilita esas funciones.
  Sin cambios de UI, schema, código ni otros tenants. Temporales de la
  planilla solo en el temp del sistema; no se crearon archivos nuevos dentro
  del repo fuera de src/docs/platform/scripts. Se preservó el HANDOFF previo
  sin commitear, que documentaba el alta de este mismo tenant.
- Al archivar la sección del orquestador se conserva su pendiente: comprobar
  el aviso del candado en una sesión de Claude sobre main. Su otro pendiente
  era el gate de hooks inexistentes; contrastar su integración con la
  worktree `cool-fermat` antes de darlo por cerrado.

### Alta inicial del 20/oct (registro histórico de esta carga)

- Pedido de Ricky: salon de unas y pelo, con turnos y consumo de productos
  configurable por servicio. No se informaron correo de la duena, servicios,
  precios, duraciones, profesionales, horarios ni insumos/cantidades.
- Creado por MCP en el edificio el tenant `mia-estudio`, MiaEstudio,
  `d3f27bf9-db9b-48be-9c7a-0bfe9b0e0bd2`, rubro `barber`, estado `active`,
  canal `appointment`. Modo `fisico`, moneda ARS y zona Buenos Aires heredados
  del alta; confirmar si trabaja a domicilio. Sucursal Principal default
  `d3fcd8e8-55b8-4155-8f79-969f6e623791`, sin ubicacion inventada.
- Readback SQL: settings creados, `store_open=false`, cero servicios, insumos,
  turnos y owners. `get_catalog('mia-estudio')` devuelve MiaEstudio,
  `vertical=barber`, productos vacios y `catalogo_activo=false`.
- Acceso pendiente del correo de la duena (preguntado a Ricky). No se asigno
  otra cuenta como propietaria ni se creo un usuario sin su identidad.
  Dominio previsto: https://mia-estudio.divianco.app/; HTTP/navegador no
  verificados en esta tarea.
- La agenda NO esta implementada en el panel (`MODULOS.agenda.implementado`
  es false). La base tiene staff/appointments y evita superposiciones, pero
  el unico trigger vivo de appointments completa sucursal: finalizar un turno
  no registra venta ni consumo. `usaReceta('barber')` es false: tampoco se
  pueden configurar los insumos del servicio desde su editor actual.
- Reutilizable, verificado leyendo el cuerpo vivo: 0104 descuenta insumos
  de `product_ingredients` al completar un pedido y deja asiento en el libro.
  Falta conectar servicios/turnos con ese circuito. No duplicar tablas de
  recetas ni confundir `appointment` (canal declarado) con agenda habilitada.
  Flujo propuesto: reservar/cancelar no consume; finalizar el servicio consume
  una sola vez las cantidades configuradas. No implementado en esta tarea.
- Solo datos del tenant nuevo y este HANDOFF: sin cambios de UI, schema,
  precios, condiciones comerciales ni otros tenants. No se crearon archivos
  fuera de src/docs/platform/scripts. Trabajo paralelo preservado.

## 19/oct/2026 — La Nona Pato: manual de marca aplicado (Codex)

- Solo configuracion y assets del tenant `la-nona-pato`, sin cambios de
  JSX/CSS, schema, precios, stock u otros tenants. El manual v3 y sus archivos
  originales viven en Biblioteca de empresas/CLIENTES/LA NONA PATO.
- Subidos a `tenant-images/<tenant_id>/marca-20261019/` el retrato preparado
  para DICO, favicon 64 px e imagen social 1200x630. Eslogan:
  **Porque el amor tambien se come** (con tilde en el dato). Tema `carbon`,
  el existente mas cercano al fondo crema; terracota `#A83715` conservado.
- Imagen social guardada en `og_image_url` y `cover_url`: `api/og.js` consume
  este ultimo; la home actual no lo usa como portada visible. HTTP 200 como
  facebookexternalhit confirma titulo, eslogan e imagen nueva para compartir.
- Seis fotos propias asociadas a productos coincidentes: alfajores de maicena,
  picada, tortilla y las tres brusquetas. Las fotos de surtidos de canastitas
  y empanadas no identifican sabor; quedan fuera. Siguen 43 productos activos,
  ahora 6 con foto y 37 sin ella. Nueve originales publicos verificados por
  lectura HTTP y SHA256; fuentes y URLs en
  `docs/operacion/la-nona-pato-marca-20261019.json`.
- Horarios vigentes 09-21 todos los dias, WhatsApp provisional, direccion/pin
  y alias `pato.jhs` preservados por readback del catalogo. Se ignoro el horario
  7-18 anterior del manual en favor de la confirmacion reciente de Ricky.
- /diseno: constructor `disenador` reviso assets y asociaciones; auditor
  independiente `auditor-diseno` inspecciono catalogo y detalle en produccion
  1280x720: 0 regresiones P0-P3. Antes/despues: marca/fotos 0 -> 3/6;
  detector estatico 17 warnings y 6 advisory sin cambio, gate verde.
  Movil 390, contraste calculado y foco: no verificados, IAB no ofrece viewport.
- Instagram `lanonapato.ar` confirmado por Ricky y guardado en el tenant;
  readback del catalogo publico verificado. La ficha de marca de la biblioteca
  conserva la indicacion anterior de no confirmado; no se modifico ese archivo.
- Pendiente: el manifest de
  instalacion PWA sigue generando la inicial L: es una limitacion del sistema,
  mientras favicon, icono de Apple y marca del catalogo ya usan el retrato.
  Tarifas/condiciones de envio y fotos individuales restantes siguen pendientes.
- Temporales fuera de src/docs/platform/scripts: solo `.preview/nona-marca/`,
  ignorado, para subida e inspeccion; se elimina al terminar. Sin archivos en
  carpetas hermanas ni modificaciones a la biblioteca de origen.
- Pendientes heredados de k6 que siguen vigentes al archivar su seccion:
  Ricky debe hacer Run now de la tarea quincenal; `mp-status` diferido espera
  su ok; faltan escenario de panel y CI para ramas. No retirar la worktree
  cool-fermat sin revisar su .codex. Accesibilidad de SkipToContent, side-tabs,
  demora de crons y contenido/contacto de la landing siguen sin resolver aqui.
  Detalle: `docs/operacion/CARGA-K6.md` y la seccion archivada de 17-19/oct.

## 19/oct/2026 — Monare: imágenes, filtros y dirección de Boedo (Codex)

### Actualización 24/oct — precios por línea y audios

- Ricky confirmó que los nuevos precios aplican a todas las cepas: Ancestral
  caja x3 $93.571; por botella Fantasía $9.125, Gran Ópalo $25.090, Grandes
  Varietales $35.490, Poético $14.950 y Zapam Zucum $9.590. Actualizados 22
  productos; 20 pasaron de borrador a activo. No se recalcularon cajas x6.
- Readback de los 53 productos y catálogo público: 40 activos, 13 inactivos,
  precios correctos y campos ajenos preservados. Tres Ancestral ahora indican
  caja de madera x3, confirmada por audio. No se modificaron cantidades de stock.
- Dos audios transcritos con Descript tras autorización explícita de subida:
  proyecto privado https://web.descript.com/08e2d238-eda8-412b-a297-fbe13635c608 .
  La clienta confirma igual precio por cepa y falta de stock de los productos
  que no cotizó. Los audios y transcripciones no se copiaron al repo.
- Planilla actualizada: 20 filas con precio confirmado; contador 13 pendientes.
  Doce sin precio y sin stock (anotado en observaciones); Ópalo Syrah caja x6
  sigue pendiente. El $68.600 de C39 es informado, no confirmado; D39 vacío,
  sin trasladarlo a la base. Dos Fantasía ya activos cambiaron $9.490 -> $9.125.

### Planilla para completar precios y revisar descripciones

- **20/oct, actualización:** Ricky pidió cargar las propuestas. Aplicadas las
  53 descripciones de la columna C de Descripciones a Monare, conservando las
  aclaraciones de imágenes/envases y los precios por bolsa y medios de pago
  del hielo. Readback: 53/53 textos coinciden; precios, imágenes y estados sin
  cambios (20 activos, 33 inactivos). `get_catalog('monare')` devuelve los 20
  activos con las descripciones nuevas. La planilla no se modificó.
- Google Sheets nativa: https://docs.google.com/spreadsheets/d/1fKf-okJoccHwbBhZopKl9OG6fQ_G9VObclGWq_0Z9uo/edit
- Pestaña Precios: 32 presentaciones sin precio y caja Ópalo Syrah x6 para
  confirmar/corregir los $48.600 informados. Los 33 precios confirmados están
  vacíos; celdas amarillas para completar, validación positiva en ARS y contador.
- Pestaña Descripciones: 53 propuestas con sabor y maridaje cuando hay ficha
  oficial; fuentes por fila y datos inciertos señalados. Son borradores en
  Drive: esta tarea no cambió descripciones ni precios de la base.
- Verificados los 33 registros de precios y las 53 descripciones contra lo
  redactado; contador probado al completar y luego vaciar una celda.
- `importacionmarcano@gmail.com` tiene permiso Editor, comprobado en Compartir;
  acceso general restringido. Se desactivó la notificación por correo al compartir.

### Aplicado y verificado en el edificio

- Solo datos de `monare` (`1367edee-7754-4169-a616-45310d98c045`): los 53
  productos tienen imagen asociada. Son 40 WebP públicos en `tenant-images`,
  prefijo `<tenant_id>/catalogo-20261019/`; 31 composiciones con fotos de
  bodega/PDF y 9 imágenes provisorias que cubren 14 productos. Registro técnico
  de fuentes, URLs y asociaciones: `docs/operacion/monare-imagenes-20261019.json`.
  El PNG del fondo maestro también está en Storage, URL en ese registro, para
  seguir incorporando productos con el mismo fondo.
- Fondo común basado en el manual de Monare de la Biblioteca de empresas:
  carbón, berenjena/bordó, luz cálida y logo original copa + MONARE dorado.
  Se descartó el logo M viejo. Generadas con ImageGen y convertidas a WebP
  sin recortar ni recomponer. Las referencias inciertas llevan texto
  `IMAGEN PROVISORIA` y aclaración en descripción; las cajas muestran la
  botella individual y los envases de 3 litros quedan por confirmar.
- Ricky autorizó usar referencias provisorias y reemplazarlas después.
  Pedir fotos de frente, etiqueta y capacidad de: Mumm; Freixenet Dulce;
  Cosecha Especial Rosé; Cosecha Tardía Rosé; Pulka Rosé (confirmar nombre);
  bolsas de hielo de 2 y 15 kg; Fantasía Criolla Tinta; Ancestral White Blend;
  Inspirado Chardonnay; Ópalo Semillón-Sauvignon Blanc; Skin Contact Viognier;
  Inspirado Cabernet Franc/Cabernet Cabernet/Blend de 3 litros.
- Se corrigió Louis -> **Lois Rosé** según la etiqueta oficial de Lorca, sin
  modificar precios. Siguen 20 activos, 32 inactivos sin precio actualizado
  y la caja de Ópalo Syrah pendiente. Stock sigue NULL en los 53.
- Nueva dirección indicada por Ricky: **Quintino Bocayuva 1130, Boedo, CABA**.
  Sucursal default `bb84f552-75e4-442e-a6e0-f3f8453e1498`, ahora Despacho Monare,
  coordenadas USIG CABA `-34.626682, -58.421350`. Reemplazada la dirección
  provisoria de Av. de los Incas en settings, sucursal, aviso de envío y
  `/info/compras-y-envios`. Sigue sin local de atención al público.
- Horario corregido por Ricky: **lunes a sábado 08:30–20:30**, domingo cerrado.
  WhatsApp e Instagram permanecen como confirmó antes.
- Readback SQL: 53/53 imágenes, 20 activos, stock NULL; `get_catalog('monare')`
  emite 20 imágenes, `catalogo_activo=true`, coordenadas nuevas y domingo cerrado.
  Los 40 objetos se comprobaron por HTTP HEAD al cargarlos.
  Playwright contra producción: 26 elementos de imagen del nuevo prefijo
  cargados, cero errores JS; la página pública de compras muestra Boedo,
  lunes a sábado y domingo cerrado (exit 0).

### Filtros publicados y verificados

- 15 grupos en `settings.cat_groups`: Cajas, Espumantes, Vinos tintos,
  Vinos blancos, Hielo, Mauricio Lorca, Chandon, Salentein, Mumm, Freixenet,
  Malbec, Cabernet Sauvignon, Chardonnay, Syrah, Rosé. Categorías hoja por
  producto/presentación permiten pertenecer a varios grupos sin duplicarlo.
- El catálogo ignoraba `settings.cat_groups`; corregido en PR #38, integrado
  en main `905be1370a92757c152f57707aff320e8dd35977` con OK explícito de Ricky.
  Solo UI/helpers/tests: Catalog.jsx, HomeScreen.jsx, catalogCategories.js y
  catalogCategories.test.js. El fallback del edificio no cambió en ese PR.
- Preview Vercel READY `dpl_4tYS8NJMF1M15oMWzL6AaJmxiLei`, rama temporal
  `codex/monare-catalogo-preview`, SHA `0349939225657a2dada04395eb85d46206244f75`:
  https://hermes-platform-rkb3vflej-diviancocorp-a11ys-projects.vercel.app/
  Misma UI revisada, más un cambio temporal de fallback Cochi -> Monare para
  ver ese tenant en `*.vercel.app`. **No mergear la rama de preview.**
  Usar MCP `get_access_to_vercel_url` para un enlace de revisión sin login;
  no guardar el secreto del enlace en este repo público.
- Verificación: 94 pruebas (categorías/utils/schemas), typecheck, build y
  `check:diseno` pasan. CI del PR sobre `7276762` pasó lint/typecheck/tests,
  build, audit y Playwright. Luego rebase a main `8073f2d` para preservar
  cambios paralelos (recetario/RLS y La Nona Pato); sin cambio en la UI.
- Auditoría independiente final en preview, móvil 390x844 y escritorio
  1280x800: cero hallazgos nuevos P0–P3, cero desborde, 16 chips de 48 px,
  aria-pressed y foco de teclado. Todos 20, Cajas 4, Hielo 4, Espumantes 9.
  Sin imágenes rotas en la vista de Hielo. Detector de archivos tocados [];
  global 17 -> 17 (deuda previa). Sin pedido ni pago de prueba.
- CI final del PR `0840512`: lint, typecheck,  unit tests, audit, build y
  Playwright aprobados. Vercel producción READY
  `dpl_FRtUES9XsmF99QTTGRh9YwAyznaH`, SHA `905be137`.
  Verificado ahora en `monare.divianco.app`: version.json buildId `905be137`,
  Cajas 4 / Hielo 4 / Espumantes 9 / Todos 20, chips 48 px y selección correcta;
  26 imágenes cargadas, cero desborde y cero errores JS. Dirección y horario
  correctos en la página pública de compras (Playwright exit 0).
- Eliminadas worktree y ramas propias de revisión/preview después del merge,
  sin tocar las de los demás chats. Temporales de imágenes limpios; los 40
  WebP finales y el fondo maestro permanecen en Storage. La URL de preview
  anterior queda solo como registro de la revisión; la tienda ya es pública.
- Falta de negocio: 32 precios, precio de caja Ópalo, fotos definitivas y
  datos bancarios reales. No se inventaron. Sin recetas.
- Archivos temporales en `.preview/monare-assets/` (ignorado) y temp del sistema
  durante el armado; los originales de ImageGen quedan en su caché por regla
  de la herramienta. Ninguna dependencia nueva ni schema ni migración.
- Pendientes heredados de GerenteDico que se archivan: cerrar issue #29 de
  prueba; próxima etapa issue `gerentedico` -> PR/preview. No tratados acá.

## 19/oct/2026 — La Nona Pato: acceso y ubicacion de despacho (Codex)

- El acceso fallaba por el enlace con doble n (`la-nonna-pato`). El tenant
  existente es `la-nona-pato`; catalogo y `/admin` muestran La Nona Pato.
  No se creo ni renombro ningun tenant. Estado `active`, 43 productos activos,
  sin imagenes y sin pedidos al consultar; Ricardo figura como owner.
- Solo datos de `c8e3de7e-2fc9-44ad-b7e4-03bb73a94cdb`: direccion de despacho
  confirmada por Ricky en `settings.store_address` y en la sucursal Principal
  (`10a833ea-0f8e-4b9f-9505-1259f30a15ba`). Coordenadas del pin que compartio
  Ricky: `-34.4097901, -58.857199`. La sucursal sigue activa y default.
- Verificado por readback SQL: direccion guardada, tenant activo y
  `get_catalog('la-nona-pato')` devuelve `catalogo_activo=true`, esas coordenadas
  y 43 productos. Browser de produccion muestra La Nona Pato y "Abierto".
  No se envio pedido de prueba ni se verifico una venta completa.
- Continuacion confirmada por Ricky: todos los dias (lunes a domingo),
  09:00-21:00, en los siete indices de `store_hours`. WhatsApp provisional
  `+5491172381841`, tambien guardado como telefono de la sucursal Principal.
  Efectivo disponible de forma implicita; cuenta de transferencia activa para
  checkout con alias `pato.jhs`. Sin titular ni CBU informados. El QR es fisico
  y Ricky pidio dejarlo fuera del catalogo. Readback del RPC publico confirma
  telefono, siete horarios, alias, catalogo activo y 43 productos.
- Pendiente: condiciones/tarifas de envio. No se cambiaron precios ni se
  enviaron pedidos de prueba. Reemplazar WhatsApp provisional cuando Ricky
  confirme el definitivo; completar titular de transferencia cuando lo informe.
- Sin cambios de codigo ni schema ni otros tenants. Solo documentacion en
  `docs/`; no se crearon archivos fuera de `src/`, `docs/`, `platform/` o
  `scripts/`. Preservados los archivos sin seguimiento y el trabajo paralelo.
- Pendientes que siguen vigentes de las secciones a archivar: primer error
  real desminificado de Sentry y existencia/alta de MiaEstudio no verificados
  en esta tarea. GerenteDico etapas 2/3 se describen en las secciones siguientes.
