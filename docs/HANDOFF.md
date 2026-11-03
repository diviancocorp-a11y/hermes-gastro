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

## 3/nov/2026 (tarde) — MiaEstudio con datos y tienda abierta; el tiempo solo en servicios (Claude)

### Hecho

**Datos de MiaEstudio** (de la planilla "Mia Estudio — Datos para activar el sistema.xlsx"; solo datos del tenant `d3f27bf9-…`, por MCP):
- Descripciones de los 7 servicios. Horarios en `staff_schedules`: sábado 09–17 y domingo 10–19.
- Medios de pago: Tarjeta y MercadoPago `active=false`; nuevo "Transferencia" (kind `transfer`). `settings.payment_accounts` con alias `miuchis.mp` (Mercado Pago, titular Mia Jazmín González).
- Insumos: Bótox líquido The Real Brazilian Keratin (ml, costo 28, stock 200), Gel sólido Charlt limit (costo 800, stock 5), Removedor Las Verano (costo 36, stock 500). Receta: 50 ml de bótox en "Bótox capilar".
- **Tienda abierta**: `store_open=true` y la sucursal Principal con lat -34.409833 / lng -58.857472 (pin que mandó Ricky). Sin coordenadas `catalogo_activo` da false aunque `store_open` sea true (0083, `private.tiene_ubicacion`).

**El tiempo del catálogo** (`4517491`, y antes la migración **0119**):
- 0119 `get_catalog` emite `type` y `duration_min` por producto (solo expandir, aplicada por MCP).
- `tiempoFor(p)` en `src/catalog-pro/homeHelpers.js`: muestra la duración real solo si `type === "service"` ("3 h", "2 h 30", "50 min"); todo lo demás, nada. Se sacaron `prepFor`/`prepMin` y la prop `prepDefault` de Home, Category, Family, ProductDetail, Search y `Catalog.jsx`.
- **Por qué:** Ricky decidió que en gastronomía y comercio el tiempo sobra ("somos un software de gestión, no de pedidos"). Antes todo producto mostraba `settings.prep_time_min` (30 por defecto, sin pantalla para editarlo) y los servicios de Mía decían "30 min".

### Verificado
- Producción: deploy de `4517491` `READY`, CI verde (Lint, Security Audit, Typecheck, Unit Tests, Build). `crazy-miga.divianco.app`: 8 productos, ningún "min". `mia-estudio.divianco.app`: 3 h, 2 h 30, 50 min ×2, 2 h, 2 h 30; Flores 3D sin tiempo (no tiene duración).
- Suite local 171 archivos / 2249 tests (la primera corrida tras el rebase falló 2 por la intermitencia de Windows; la segunda pasó entera). Test nuevo `src/test/tiempoDelCatalogo.test.js`.

### Pendiente inmediato
1. **Datos de Mía que faltan** (no se inventaron): insumos de soft gel y esmaltado (la planilla era vaga), producto del alisado, consumo por clienta del gel sólido y del removedor, y el recargo de $4.000 por reprogramar (no hay columna donde guardarlo).
2. **Contraer `prep_time_min`**: sigue en `settings`, Zod y manifest pero ya no lo lee nadie. Migración aparte con `-- contraer:` cuando `4517491` lleve unos días.
3. P3 del auditor, sin resolver: `formatearDuracion` sin espacio duro ("2 h 30" puede partirse) y "1 h 30" vs "1 hora y media" (el aviso de encargo usa la segunda).
4. Sigue vigente todo el pendiente de la sección de abajo (reserva online de Mía, app instalable, etc.).

### Bloqueado por Ricky
- Los datos del punto 1 tienen que venir de Mía.

### Heredados de la sección del 22/oct que se archiva (siguen vigentes)
- Marca de Mía: Modak/Poppins y la paleta Y2K del manual no están implementados (`catalog_font` no tiene consumidor; `logo_color` no reemplaza `--ac`). Logo del header a 36 px (el manual pide 60) y link de Instagram a 40 px (objetivo táctil 44): son cambios de código compartido, pasan por `/diseno`.
- Confirmar si Flores 3D se cobra por flor, uña o trabajo, y si los retiros se reservan por separado.
- Comprobar el aviso del candado del orquestador en una sesión de Claude sobre `main`, y contrastar el gate de hooks con la worktree `cool-fermat`.

---

## 3/nov/2026 — Login único, consola en su subdominio y agenda de servicios (Claude)

### Hecho

**Agenda de turnos para rubros de servicio** (primer caso MiaEstudio; PRs #47–#55, migraciones 0109–0113). El plan y las decisiones están en `docs/plataforma/PLAN-AGENDA.md`.
- Disponibilidad en la base (`get_available_slots`: horario − turnos − bloqueos − buffer − traslado), zonas con minutos de traslado, adicionales (`is_addon`), panel de agenda y reserva online pública (`/reservar`, edge function `booking`, seña por MercadoPago con `mp-webhook` y vencimiento a los 5 min).
- 0113: `get_available_slots` rompía para `service_role` (`permission denied for schema private`); ahora se mira el rol del JWT antes de tocar `private`. Con tests SQL (`agenda_huecos.sql`, `agenda_reserva_online.sql`).
- Probado en producción con un tenant descartable (`zz-prueba-reserva`, ya borrado): 29/30, y el corte de seña sin MercadoPago responde 503. **La seña real con MercadoPago NO se probó.**

**Login único** (PRs #65–#71; Ricky mergeó todo; deploy de producción `91f6ab4` en `READY`, mismo SHA que `main`).
- `divianco.app/entrar` es la misma puerta que el login del admin (`LoginShell` compartido), con marca Dico fija. Con email y clave lee los negocios de la persona (`src/services/entradaUnica.js`): uno entra directo a `<slug>.divianco.app/admin`, varios eligen, y el staff ve además "Consola de Divianco". Se entra una sola vez: la sesión viaja en el hash `#dico-sesion=` y el destino la toma antes de preguntar si hay sesión (`tomarTraspaso`, llamado desde `usePlatformTenant` y `Consola`).
- **Consola en `consola.divianco.app`** (#67, migración **0120**, `consola` reservado en `tenantHost.js` y en `is_reserved_slug`). `divianco.app/consola` redirige. Se borró el login propio de la consola: sin sesión manda a `/entrar`, con sesión sin permiso muestra "Esa cuenta no tiene acceso" (`SinAcceso`). No se indexa (`meta noindex`: el `robots.txt` es el mismo para todos los hosts). La recuperación de clave del staff es la de `/entrar`; el acceso lo da la fila de `platform_admins`, no la clave.
- **Intro de Dico** (#70): ya no está en los logins. Se ve al abrir el negocio, solo tras un login real (login del admin o traspaso desde `/entrar`); no si la app se abre con la sesión ya abierta. `ConIntro` es la raíz común de todos los estados de `PlatformAdmin` (si cada estado armaba su propio árbol, el overlay se remontaba y el intro arrancaba de nuevo).
- **Topbar** (#69): logo del negocio (`settings.logo_url`) y botón "Ver catálogo" (`/`, pestaña nueva).
- **Selector de negocios en la burbuja de perfil** (#71, estilo Instagram): "Tus negocios" con el actual tildado y la consola si es staff; consultas perezosas al abrir.

### Por qué (lo caro de reconstruir)
- **`supabase.auth.signOut()` revoca la sesión en el servidor, incluso con `{ scope: 'local' }`** (`POST /logout?scope=local`, verificado en `node_modules/@supabase/auth-js`). El primer traspaso lo usaba para "olvidar" la sesión de `divianco.app` y la que viajaba llegaba muerta: todos volvían a `/entrar` (producción rota entre #65 y #68). Ahora se frena el auto-refresh y se borran las claves `hermes-auth*` del localStorage del origen, sin tocar el servidor (`olvidarSesionLocal`). Los tests mockeaban `signOut` y no lo podían ver: hay un test que afirma que **nunca** se llama en el traspaso.
- **La sesión se mueve, no se copia.** El mismo refresh token en dos orígenes se rompería con la rotación de Supabase. Consecuencia: cambiar de negocio deslogea las otras pestañas del mismo origen. Se usa `location.replace` para que "atrás" no vuelva a una página sin sesión (bfcache).
- **`tenants_select` deja ver TODOS los negocios al staff** (`OR es_staff_divianco()`, 0052). `negociosDelUsuario()` filtra por membresía propia (`tenant_members.user_id`); sin eso un staff veía el edificio entero en `/entrar` y habría sido tratado como dueño de todo.
- Cerrar sesión desde el admin lleva al login **del propio negocio**, no a `/entrar` (decisión de Ricky): es lo que va a abrir la app instalada del local.

### Verificado
- En producción (integración de Vercel): deploy `91f6ab4` `READY` = `main`. Migración `reservar_consola` aplicada y releída (`is_reserved_slug('consola') = true`, 0 tenants reservados).
- Suite completa 2235/2235, build, ESLint sin errores y `check:diseno` (17 conocidos, ninguno nuevo) en cada PR. Auditor independiente en cada cambio de UI (0 P0; los P1/P2 se corrigieron antes de mergear).
- Ricky confirmó "ya se arregló" tras el #68 (ingreso a negocios y consola) y que cerrar sesión lleva al login del negocio.
- **NO verificado:** el intro tras un login real, la topbar en móvil, el selector de negocios (con varios negocios y con la cuenta staff) y el anuncio con lector de pantalla. Todo eso está cubierto solo por tests de jsdom; ningún subagente tuvo sesión de Supabase.

### Pendiente inmediato (en orden)
1. **Ricky mira en producción** el selector (burbuja de perfil, con su cuenta staff), el intro y la topbar en el celular.
2. **Verificar en Supabase → Authentication → URL Configuration** que `https://consola.divianco.app/**` (o `https://*.divianco.app/**`) esté en Redirect URLs: de eso dependen los links de invitación y recuperación de la consola. No pude verlo desde el MCP.
3. **Abrir la reserva online de MiaEstudio.** Hoy: canal `appointment` (sin `online_booking`), 7 servicios (varios en borrador), **0 zonas**, horarios cargados, 0 turnos. Falta: servicios activos, zonas con minutos de traslado, MercadoPago conectado (no se sabe si lo está) y medios de pago (efectivo + alias `miuchis.mp`, sin cargar: no se adivinó el formato). Después, con OK de Ricky, sumar `online_booking` a `tenants.channels` y probar una reserva real con seña de $6.000 hasta ver el turno en `confirmed` por `mp-webhook`.
4. **App instalable por negocio.** Hoy `public/manifest.json` es genérico ("Hermes", `start_url: "/"` = catálogo público) y no hay aviso de instalación. Falta: manifest dinámico por host (nombre e ícono del negocio, `start_url: /admin`), tutorial de instalación (compu, Android, iPhone) y botón de instalar en el admin. Resuelve también el pendiente de La Nona Pato (el manifest genera la inicial "L").
5. Recordatorios automáticos de turnos (fase 3C: push/mail primero; WhatsApp requiere decidir quién paga y el proveedor), luego cierre del turno → venta/insumos (4), política de cancelación y reembolsos (5), lista de espera (6).
6. Deuda de UI anotada por el auditor, sin resolver: ramas muertas `stage === "intro"` en `loginEstilos.js` (`estiloCaja`) y comentario de `tiemposDeEntrada.js`; `FlowFieldBackground` ignora `prefers-reduced-motion`; pie del login del admin con contraste 2,59:1; inputs del login del admin sin label; JetBrains Mono sin `@font-face`.
7. Menores de agenda: ancla `zonas` en el pendiente, "Mover" no ignora el propio turno, horas del panel en la zona horaria del dispositivo, selección y cantidad de adicionales.

### Bloqueado por Ricky
- Paso 2 (Redirect URLs de Supabase), conexión de MercadoPago de MiaEstudio, decidir cuándo se abre la reserva online, y quién paga WhatsApp si se hace.

### Heredados de las secciones que se archivan (siguen vigentes)
- **k6** (`docs/operacion/CARGA-K6.md`): Ricky debe hacer "Run now" de la tarea quincenal; `mp-status` diferido espera su OK; faltan escenario de panel y CI para ramas; no retirar la worktree `cool-fermat` sin revisar su `.codex`; accesibilidad de `SkipToContent` y side-tabs, demora de crons y contenido/contacto de la landing sin resolver.
- **La Nona Pato:** tarifas y condiciones de envío; reemplazar el WhatsApp provisional cuando Ricky confirme el definitivo; completar el titular de transferencia; fotos individuales restantes.
- **Monare:** 32 precios, precio de la caja Ópalo, fotos definitivas y datos bancarios reales (no se inventaron); sin recetas.
- **GerenteDico:** cerrar el issue #29 de prueba; próxima etapa `gerentedico` → PR/preview.
- **General:** primer error real desminificado de Sentry sin verificar. La existencia y el alta de MiaEstudio se verificaron en esta sesión (existe, activo).

### Archivos y limpieza
- No se creó ningún archivo fuera de `src/`, `docs/`, `platform/` y `scripts/`. Los scripts de prueba viven en el temp del sistema (fuera del repo).
- Se eliminaron las worktrees propias ya mergeadas (agenda ×5, fix-audit ×2, login-unico, intro-al-abrir, topbar-admin, cambiar-de-negocio) y sus ramas locales. Las 19 que quedan son de otros agentes; no se tocaron.

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
