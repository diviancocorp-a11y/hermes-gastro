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

## 5/nov/2026 — Instagram DICO: portadas aprobadas y próximo paso ManyChat (Codex)

### Hecho
- Cuenta: @appdico. Ricky prepara Instagram para vender DICO. Orden pedido: destacadas primero, después bio/referencias de reels, al final esquema de producción con preguntas.
- Cinco portadas elegidas: Qué es DICO (personaje oficial guiñando un ojo), Así funciona (botón negro con cursor), Tu ganancia (barras negras, moneda), Planes (tres tarjetas negras), Empezá acá (botón de encendido negro). Elementos negros satinados con bordes dorados finos; fondo degradado marfil arriba y azul profundo abajo; SIN aro exterior.
- Corrección de Ricky que debe conservarse: somos una empresa de software; evitar ilustración dibujada, maquetas genéricas, exceso de dorado y deformar la mascota. Usar el personaje oficial como referencia de identidad; no recrearlo en escenas. Descartó barras azul volt y puerta por geometría incorrecta.
- Biblioteca solicitada explícitamente por Ricky: `C:/Users/ricar/OneDrive/Desktop/Biblioteca de empresas/MIS PROYECTOS/dico/instagram`. Todo material futuro de Instagram va allí, no al repo. Portadas finales en `portadas/v2-final/01-que-es-dico.png` hasta `05-empeza-aca.png`. Las imágenes directamente en `portadas/` son versiones dibujadas descartadas. `ESTADO-2026-11-05.txt` indica qué usar.
- `historias/01-que-es-dico-borrador.txt`: borrador de cuatro historias, todavía sin aprobación ni diseño. Su párrafo de dirección visual dibujada está obsoleto; prevalece el estado v2-final.
- Referencia oficial: `C:/Users/ricar/OneDrive/Desktop/Biblioteca de empresas/MIS PROYECTOS/dico/mascota/perfil-instagram/dico-perfil-oficial.png`.
- ManyChat propuesto para reel → comentario con palabra clave → DM con respuesta rápida → ejemplo por rubro → consulta/demo. Producción/publicación sería otro flujo, inicialmente con aprobación de piezas. No se construyó sistema de agentes ni se eligió publicador.

### Verificado
- Generadas con imagegen y revisadas visualmente las portadas; aprobación explícita de Ricky de la primera, negro para Así funciona/Tu ganancia y botón de encendido. Para Planes pidió avanzar a la siguiente.
- Copias finales de las cinco portadas enumeradas en biblioteca, junto con estado y borrador. No se publicó contenido ni se conectó ManyChat o redes.
- Se consultó documentación oficial de ManyChat: https://help.manychat.com/en/articles/17741897-instagram-post-and-reel-comments-trigger . El DM inicial por comentario no abre por sí solo la ventana de 24 h; hace falta interacción válida, por ejemplo respuesta rápida.
- Instagram no permitió visualizar iman.ar ni https://www.instagram.com/p/DfVpjIkuSqd/; no se analizó su montaje. Pedir videos/grabaciones para hacerlo, no afirmar que se vieron.
- Sin cambios de código, DB, migraciones o despliegues. `.env.local` sigue ignorado. Cierre documental preparado desde origin/main en worktree aislada para no subir la rama ajena `prueba/glyph-portal`.

### Pendiente inmediato
1. Retomar ManyChat y sistema de producción/publicación: responder las tres preguntas de abajo y definir una campaña piloto completa antes de automatizar volumen.
2. Diseñar historias de destacadas con pantallas REALES de la app; los textos actuales son borrador. Revisar bio completa (última línea cortada en captura), y referencias de reels con archivos visibles.
3. Después, definir calendario y esquema funcional de contenido con preguntas, como pidió Ricky.

### Bloqueado por Ricky
- ¿Solo Instagram DICO o también Facebook/otras redes y marcas?
- ¿Ya hay cuenta ManyChat conectada a Instagram? No verificado.
- ¿Consultas hacia WhatsApp, reunión o registro DICO?
- Videos de referencia accesibles para analizar ritmo, esquemas 3D y mezcla con app real.

### Archivos y limpieza
- Fuera de src/docs/platform/scripts: biblioteca externa autorizada explícitamente por Ricky (portadas, borrador y estado); renders automáticos en `.codex/generated_images`; worktree documental `.claude/worktrees/cierre-instagram-20261105`.
- El checkout principal ya tenía trabajo ajeno no trackeado (.agents, .codex, platform/divianco-workadventure) y rama de pruebas con commits fuera de main: no se toca ni se publica.
- Se crearon copias de portadas en docs/marca/referencias/instagram-destacadas durante la sesión; se trasladan a biblioteca y se retiran esas copias del repo tras comprobar igualdad. No son parte del commit documental.
- Worktrees inspeccionadas: landing-soul-footer limpia y su rama codex/cierre-landing-20261105 contenida en origin/main; prueba-21st limpia pero no mergeada. No se borraron. Checkout de ~/.codex protegido.

### Pendientes preservados de la sección de login que se archiva
Se conserva lo pendiente reportado por esa sesión; no fue revalidado aquí y puede haber sido resuelto por secciones posteriores (manifest/topbar y datos de Mía ya tienen actualizaciones arriba).

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


---

## 5/nov/2026 — Landing publicada: Machine Soul, contactos y navegación (Codex)

### Hecho

- **PR #75**, merge `09902be`: frase elegida «Pusiste el alma en tu negocio.
  Que también te deje tiempo para vivir» en `TransicionVolt.jsx` y
  `transicion-volt.css`. Entrada sticker una sola vez y bob suave después;
  se pausa fuera de pantalla y respeta movimiento reducido. Se reutiliza
  el efecto entre hero y Rubros, sin agregar otro segmento.
- **Footer** (`cierre-negocio.css`): las cápsulas vuelven a expandirse con
  mouse/foco y cerrarse al salir. El ancho de pantalla y `hover:none` las
  dejaban siempre abiertas. El navegador integrado puede declarar ese modo
  aunque haya cursor: no usarlo para forzar la apertura de los contactos.
- **Registro móvil** (`signup.css`): bienvenida `position:relative` para
  contener su imagen absoluta. Antes se posicionaba contra el viewport y
  tapaba el formulario. El formulario queda marfil opaco; el paisaje sigue
  limitado a la bienvenida. Sin cambios de alta, planes, prueba ni cobros.
- **PR #77**, merge `3750163`: `NavegacionLanding.jsx`,
  `navegacion-landing.css` e integración en `PlatformLanding.jsx`. Barra fija
  negra solo después del hero, logo original, enlaces a Rubros,
  Acompañamiento, Planes y Preguntas, sección activa dorada y CTA al mismo
  diagnóstico. Se oculta durante el embudo para no interferir con el modal.
- Logo, enlaces y CTA permanecen en **una sola fila** en todos los anchos.
  En celular el botón dice Diagnóstico y los enlaces se deslizan sin
  scrollbar visible. La línea volt de avance va en el **borde inferior**,
  ligada al scroll y reversible; no es un pulso decorativo.
- No se tocó la arquitectura, la base, migraciones ni edge functions.
  Se conservan los planes Paris/Dante/Magnus que ya venían de main.

### Verificado

- **Producción:** landing publicada en `3750163`, Vercel READY.
  Al cerrar otra sesión publicó #78; `divianco.app` releído READY en
  `9f886ea`, que conserva esta landing. CI completo y E2E de `3750163` con éxito; hay un
  smoke de producción exitoso y ejecuciones redundantes canceladas/omitidas.
- **Preview:** 320, 390, 768 y 1280 px sin desborde; logo, enlaces y CTA
  comparten eje vertical. Planes queda accesible al deslizar y el título
  no queda detrás de la barra. CTA abre el diagnóstico y permite cerrarlo.
  Línea de progreso comprobada debajo de la barra. El último ajuste que
  oculta la scrollbar pasó build/CI; no se repitió la inspección visual
  de ese cambio de CSS en producción.
- Footer: a 900 px cápsulas cerradas de 64 px, solo WhatsApp se expande a
  340 px al pasar el cursor y vuelve a cerrarse; sin abrir destinos externos.
  Registro a 390 px: imagen contenida y fondo de formulario marfil opaco.
- ESLint, typecheck, build y 87 pruebas habituales locales correctos.
  `check:diseno` antes/después: 17 hallazgos conocidos, ninguno nuevo.
  La animación final sticker/bob pasó build y CI; no se capturó su ciclo
  completo en navegador. No se probaron altas ni pagos reales en esta sesión.

### Pendiente inmediato

1. Landing y navegación quedan aprobadas y publicadas. No hay cambios de
   producto de esta sesión sin subir; el próximo cambio lo define Ricky.
2. Legales siguen pendientes de textos aprobados: los controles existentes
   no equivalen a documentos publicados. No se modificaron en esta sesión.
3. Los pendientes de planes, funciones, analítica y agenda de las secciones
   siguientes siguen a cargo de sus sesiones; no se dan por resueltos aquí.

### Bloqueado por Ricky

- Ninguna acción necesaria para conservar esta publicación.
- Textos legales cuando quiera habilitarlos. Próxima prioridad de producto
  por definir; no iniciar cambios nuevos al retomar sin su indicación.

### Pendientes preservados del 24/oct que se archiva

- Catálogo por rubro: PR borrador #56, no publicado; preview separado
  `codex/catalogo-filtros-rubro-preview` usa fallback Monare y **no se fusiona**.
  Requiere aprobación visual de Ricky y listado Vegano/Sin TACC de la clienta;
  Skin Contact sigue en Vinos y envases de 3 L pendientes. Migraciones
  0114/0115 ya aplicadas. Detalle de verificaciones en el histórico.
- Checkout de Codex bajo `~/.codex/worktrees/` protegido por tarea fijada:
  no se borra. No confundirlo con esta worktree de la landing.

### Archivos y limpieza

- Código solo en `src/`, documentación en `docs/`. Fuera del repo quedaron
  capturas/archivos temporales de revisión en Temp y una maqueta ilustrativa
  en la carpeta automática de imágenes generadas de Codex; no son código ni
  dependencias del producto y ninguna imagen ilustrativa reemplazó sus assets.
- `.env.local` sigue ignorado; no se guardaron secretos en commits.
- Worktree propia `.claude/worktrees/landing-soul-footer`: limpia y rama
  `codex/landing-navegacion` ya en main. Tras subir este cierre también se
  puede retirar la rama documental. **Se ofrece limpiar; no se borra sin sí.**
  `prueba-21st` no está mergeada y no se toca; tampoco el checkout de `~/.codex`.
- Checkout principal tiene trabajo ajeno no trackeado y usa otra rama:
  no se tocó, no se añadió ni se eliminó nada de esa sesión.

---

## 5/nov/2026 — Planes Paris, Dante y Magnus, eventos para GerenteDico y deploy de functions (Claude)

### Hecho

**Nombres y oferta** (`f52c6ba`, `0ae6e29`, migraciones 0121 y 0123):
- Los planes se llaman Paris, Dante y Magnus. Los ids siguen siendo `digital`, `local` y `cadena`.
- Paris sale **$14.999/mes**, sin precio anual.
- Landing, preguntas, consola y diagnóstico usan los nombres nuevos.
- El bloque "Planes de DICO" está en `CLAUDE.md` y `AGENTS.md`.
- **Lo que no se promete todavía:**
  - La factura de ARCA, hasta probarla de punta a punta.
  - Dico con IA, porque todavía no existe.

**Qué separa a cada plan** (`src/modules/planes.js`, PR #74, merge `620460f`):
- Paris tiene toda la operación, incluidos los avisos de pedidos.
- Dante suma:
  - ganancia;
  - CRM y promos;
  - cobros online;
  - ARCA;
  - historial completo;
  - soporte por chat;
  - 300 consultas de IA por mes.
- Magnus suma consolidado, roles por local y soporte telefónico.
- **Por qué este corte:** Ricky quiere que el sistema se sienta limitado y que vaya desbloqueando a medida que se paga más. Bloquear la operación haría que Paris no sirva para trabajar. Lo que empuja a pasar a Dante es saber cuánto se gana y volver a venderles a los clientes que no vuelven.
- **Sin `plan_id` = todo:** los 5 tenants actuales no tienen plan y no cambian.
- Funciones nuevas en `planes.js`:
  - `planTieneFuncion`;
  - `planMinimoParaFuncion`;
  - `planEfectivo`: con `prueba_hasta` futuro y un plan menor, devuelve `local`;
  - `diasDePrueba`.

**Prueba de 14 días de Dante en el alta** (migración 0122):
- Columna nueva `tenants.prueba_hasta`.
- `signup_tenant()` crea el negocio con `plan_id='digital'` y `prueba_hasta = now()+14 días`. Se copió el cuerpo desplegado y se le sumaron esas dos columnas.
- **Por qué no se suspende al terminar:** la suspensión de la 0052 exige `paga_hasta not null`, y un negocio en Paris sin `paga_hasta` queda en `sin_fecha`.
- Las altas con `create-owner` siguen sin plan.

**Bloqueos en el panel** (`BloqueoDePlan.jsx`, `admin-plan.css`, `clientesInactivos.js`):
- **Clientes:** muestra el número real de clientes que no compran hace más de 90 días. Si la consulta falla, no muestra ningún número.
- **Ganancia:** se bloquea en Ventas > Hoy (`ResultadoDelDia`) y en Resumen (Resultado, Exportar y los análisis).
- **Cobros online:** se bloquea.
- **ARCA en Caja:** dice "No incluida". La factura automática exige `facturacion_arca`.
- `AvisoDePrueba` va debajo del saludo y muestra los días que le quedan de prueba.
- Eventos `plan-bloqueo-visto` (una vez por función y por sesión) y `plan-bloqueo-click`. Primero salieron con `trackEvent` y **no llegaban a ningún lado** (se arregló en #76, ver más abajo): `trackEvent` (`src/lib/observability.js`) manda a Plausible solo si existe `VITE_ANALYTICS_ID`, y el bundle de producción no lo tiene. Lo comprobé el 5/nov: `plausible` no aparece en ningún JS publicado. Vercel Web Analytics no está activo en `hermes-platform` (la API devuelve 404).

**Diagnóstico** (`platform/functions/diagnostico/v2.js`, `motivosDelPlanV2`):
- Recomienda Magnus con 2 locales o más.
- Recomienda Dante si se da alguno de estos casos:
  - no sabe cuánto gana;
  - vende mucho;
  - tiene equipo grande;
  - ya usa un sistema;
  - tiene salón.
- En cualquier otro caso recomienda Paris.

**Eventos en el edificio** (PR #76, merge `fa7ef38`, migración 0124):
- Los eventos de bloqueo pasaron a la tabla `eventos_app`, por `registrarEvento` (`src/services/eventosApp.js`). `BloqueoDePlan` ya no usa `trackEvent`.
- **RLS:** el miembro escribe solo en su negocio y con su propio `user_id`; lee solo el staff.
- **Por qué una tabla y no Vercel:** Web Analytics pedía activarlo, una dependencia nueva y probablemente el plan Pro. GerenteDico y morning-health ya leen la base.
- **Quién los lee:**
  - GerenteDico, con la herramienta nueva `eventos`.
  - morning-health, con un bloque "📊 Bloqueos de plan" en la ventana de cada turno. Solo aparece si hubo eventos.
- La lógica del resumen (`platform/functions/gerente-webhook/eventos.js`) es la misma para las dos puntas.

**Deploy de functions y aviso de prueba** (PR #78, merge `9f886ea`):
- **Qué falló:** `npm run deploy:functions` falló en las 18 sin cambiar nada.
  - `npx` no vio el CLI local, por `NODE_ENV=production`.
  - Bajó `supabase@3.0.0`, que pide confirmar cada deploy y sin terminal no puede.
- **Arreglo:** el script usa el CLI fijado (`node_modules/supabase`, 2.116.0) por ruta, o `npx` con esa versión exacta, y siempre pasa `--yes`.
- morning-health avisa a la mañana las pruebas de Dante a 3 días o menos de terminar (`scripts/pruebas-por-vencer.mjs`).

### Verificado
- **Producción:**
  - El deploy `620460f` está `READY` y es el `HEAD` de `origin/main`.
  - El CI de `620460f` pasó entero (`npm run ci:esperar`, exit 0).
- **Base**, comprobado con `select`:
  - `plans`: Paris en 14999, con anual null.
  - Existe la columna `prueba_hasta`.
  - `signup_tenant` contiene `prueba_hasta`.
  - anon no puede ejecutar `signup_tenant`.
- **Diseño:**
  - `impeccable detect`: 22 hallazgos antes y 22 después.
  - `check:diseno`: ningún hallazgo nuevo.
  - Auditor, dos rondas: en la primera encontró un P1 (la ganancia del mes se veía en Paris), que se corrigió. En la segunda no quedaron P0 ni P1.
- **Tests:** en la suite local fallaron 4 tests que no tienen que ver con este cambio (diagnosticoContactoPrevio, HomeScreenFacets, landingHero y reservaOnline). Corridos aislados pasan 41/41. Fallaron por la carga de la máquina.
- **Functions desplegadas** (Ricky, 5/nov): las 18 en OK.
  - `list_edge_functions` muestra todas actualizadas.
  - El `gerente-webhook` desplegado tiene la herramienta `eventos`.
  - **`arca-invoice` y `table-assistance` se publicaron por primera vez (versión 1)**: antes no estaban en producción.
- **Eventos:**
  - RLS probado en la base, con transacciones revertidas: un miembro escribe en su negocio, no en uno ajeno, y no lee si no es staff; anon queda rechazado.
  - Hoy `eventos_app` tiene 0 filas, porque ningún negocio tiene plan.
- **CI** verde en `620460f`, `f03a8cd` y `52e4047`.
- **NO verificado:**
  - Un negocio real en Paris dentro de la app. Solo se probaron los tests y la vista de "Hoy" en Paris sin datos.
  - Un alta self-service nueva de punta a punta con la prueba de 14 días.
  - Que GerenteDico conteste bien una pregunta de eventos por Telegram.
  - El bloque de morning-health con datos reales: no hay eventos ni pruebas vigentes.
  - Que `arca-invoice` y `table-assistance` respondan bien en producción, con sus secrets cargados.

### Pendiente inmediato
1. **Probar con un negocio de prueba en Paris** (`plan_id='digital'`, `prueba_hasta` null):
   - que se vean los bloqueos;
   - que aparezcan filas en `eventos_app`;
   - que GerenteDico las cuente.
2. **Revisar `arca-invoice` y `table-assistance`:** ahora están vivas por primera vez.
   - Mirar en el panel de Supabase que tengan los secrets que piden.
   - `arca-invoice` quedó con `verify_jwt=true`, porque no está en `NO_VERIFY_JWT`.
3. **Corte del lado del servidor:** hoy los bloqueos son solo de pantalla. Un negocio que conectó Mercado Pago durante la prueba sigue cobrando online en el catálogo después de volver a Paris. Para cortarlo, `create-payment-preference` tiene que mirar `planEfectivo`. Falta que Ricky decida si se hace.
4. **Decisiones abiertas de Ricky sobre lo que se ve en Paris:**
   - el margen por producto en Productos;
   - los ingresos y egresos de Resumen, que dejan sacar la ganancia restando (se dejaron a propósito);
   - el diseñador ocultó también el análisis USAR y Exportar, quizás de más.
5. **CRM:** el conteo de clientes inactivos usa una lista con el tope de 1000 filas de PostgREST. Con más clientes, el número queda corto.
6. **Antes de tocar precios**, mirar 2 a 3 semanas de eventos de bloqueo.
7. **Chicos:**
   - El `/start` de GerenteDico (`BIENVENIDA` en `index.ts`) no menciona la herramienta `eventos`.
   - `eventos_app` no tiene retención: crece sin límite.

### Bloqueado por Ricky
- Decidir los puntos 3 y 4.
- Sacar `NODE_ENV=production` de las variables de entorno de Windows. Es la causa de la falla del deploy y de la de `npm install`.
- Siguen vigentes los de la sección del 4/nov: Mía pega el Access Token de MP e instalar el panel en el celular.

### Archivos y limpieza
- **`8d50ecb`** (el commit local de planes que quedaba sin pushear) ya no está en ninguna rama: lo reemplazó esta sesión. Se resuelve así el punto 2 del 4/nov.
- No se creó nada fuera de `src/`, `docs/`, `platform/` y `scripts/`.
- **Worktrees:**
  - Las ramas `feat/planes-bloqueos`, `feat/eventos-edificio` y `fix/deploy-functions-cli` ya están en `main`. Se pueden borrar, local y en origin.
  - `landing-soul-footer` (`codex/landing-soul-footer`) está en el `HEAD` de main y limpia. Parece recién creada por Codex: no se toca.
  - `prueba-21st` no está mergeada.
- **Se archiva la sección de Codex del 24/oct** (landing: botón y circuito con Dico central). Lo que dejaba pendiente era la aprobación visual del hero y el segmento 2 de la landing. Está en `historico/HANDOFF-anterior.md`.

---

## 4/nov/2026 — Topbar con dos menús y el panel instalable como app (Claude)

### Hecho

**Topbar en dos menús** (PR #72, `8b4ed33`, mergeado):
- La burbuja de perfil lleva el logo del negocio (iniciales si no hay) y abre **solo** los negocios de la persona, más la consola si es staff.
- El nombre abre Configuración, Tema, **Ver catálogo** (salió de la topbar) y Salir. "Ver catálogo" además queda fijo en el encabezado de Productos, para todos los roles.
- `MenuDesplegable` en `ControlesDeSesion.jsx` es el componente común de los dos menús: teclado, Escape, clic afuera y devolución de foco. Abrir uno cierra el otro.

**App instalable por negocio** (PR #73, `45369bb`, mergeado):
- `api/manifest.js?app=panel`: "<negocio> · Panel", `id`/`start_url`/`scope` `/admin`. **Por qué un `id` propio:** con el mismo id que el catálogo (`/`), el navegador tomaría las dos como una app y la segunda pisaría a la primera.
- Ícono = logo o favicon del negocio solo si es **cuadrado y de 192 px o más**. El endpoint lo mide leyendo la cabecera (Range de 64 KB); si no cumple, queda la inicial sobre `logo_color`. Crazy Miga tiene logo vertical (704×1524), así que va con la inicial. Ahora usa `get_tenant_brand` en vez de `get_catalog`, que traía el catálogo entero.
- `src/lib/instalarApp.js` hace tres cosas:
  - Guarda el `beforeinstallprompt` **solo en `/admin`**. En el catálogo no se toca, así los clientes conservan la barra de instalación de Chrome.
  - `main.jsx` apunta el manifest del panel antes del render. Si el manifest cambia después del aviso, el aviso viejo se descarta, porque instalaría la app de `/`.
  - El `apple-touch-icon` del iPhone se elige midiendo en el navegador: el primero cuadrado de 180 px o más.
- Menú del nombre → **Instalar app** (debajo de Ver catálogo):
  - Con el aviso de Chrome/Edge, abre el diálogo del sistema.
  - Sin el aviso, `GuiaDeInstalacion.jsx` muestra los pasos para compu, Android e iPhone, arrancando por el dispositivo detectado.
  - Se oculta si ya corre como app.

**Proceso:** `/cerrardico` suma el paso de listar las worktrees ya mergeadas y ofrecer borrarlas (`354d99b`, en `.claude/skills` y `.agents/skills`).

**MercadoPago:** no hay una vía más simple que pegar el Access Token en Configuración → Finanzas → Cobros online. MP no permite OAuth para apps de "Integración propia". Queda pendiente que Mía lo pegue (MiaEstudio no tiene fila en `payment_integrations`).

### Verificado
- **Producción:**
  - Deploy `8d9d140` `READY` = `origin/main`.
  - `curl` a `/api/manifest?app=panel` de los 5 negocios: nombre "· Panel" y `/admin` en todos. Ícono: logo en LNP (1024), Monare (logo y favicon) y MIA (1254); inicial en Crazy Miga y Cochi.
  - En el navegador, `la-nona-pato.divianco.app/admin` sin login: el manifest del panel y el `apple-touch-icon` = logo. En `/` queda el manifest del catálogo.
- **Local:** suite 173/2284, build, ESLint sin errores, `check:diseno` 17 conocidos y ninguno nuevo. CI de `354d99b` verde.
- **Auditor independiente:** 0 P0. Se corrigieron los 2 P1 (aviso con el manifest viejo; `preventDefault` en el catálogo), los P2 (ícono iOS no cuadrado, contraste del segmento elegido) y los P3 de textos.
- **NO verificado:**
  - La instalación real en Chrome, Android e iPhone.
  - La guía a 390 px y en tema oscuro.
  - Si Chrome vuelve a disparar `beforeinstallprompt` después del cambio de manifest; si no lo hace, el botón cae en la guía.
  - El selector de negocios de #72 con la cuenta staff.

### Pendiente inmediato
1. **Ricky instala el panel** en el celular (`/admin` → nombre → Instalar app) y confirma nombre, ícono y que abre en el panel.
2. **Commit local sin pushear en `main` del checkout principal:** `8d50ecb` "feat(planes): Paris, Dante y Magnus…", de Ricky. No se tocó. El `main` local diverge de `origin/main` (le faltan #73 y este cierre): hace falta `git pull --rebase` antes de pushearlo.
3. **Skills de diseño sin bajar:** `.claude/skills/impeccable/` está vacía en el checkout principal y el `disenador` no la pudo cargar. Correr `npm run skills:diseno`.
4. Deuda del auditor sin resolver:
   - `.ag-dialog-panel` sin `overscroll-behavior: contain` (afecta a todas las hojas).
   - El ítem "Instalar app" sigue visible si el panel ya está instalado pero se abre en una pestaña.
5. Sigue vigente el pendiente de la sección del 3/nov (reserva online de Mía, datos de Mía, contraer `prep_time_min`, recordatorios de turnos).

### Bloqueado por Ricky
- Mía pega el Access Token de MercadoPago en Cobros online. Sin eso no hay seña online.
- Pushear (o descartar) `8d50ecb`.

### Heredados de la sección del 23/oct que se archiva
- Landing, fases 3 y 4 (circuito, rubros, logos con Instagram, pasos, planes, FAQ y footer), y el precio Digital de **$14.999/mes** que aprobó Ricky (anual sin definir), sincronizado en landing, diagnóstico y tabla `plans`. Revisar si `8d50ecb` (planes Paris, Dante y Magnus) lo reemplaza.

### Archivos y limpieza
- No se creó nada fuera de `src/`, `docs/`, `platform/` y `scripts/`, salvo `api/manifest.js` (ya existía; es el endpoint de Vercel) y las dos copias de la skill `cerrardico`.
- Se borraron las worktrees ya mergeadas: 15 al empezar (respaldo de `.codex`/`.agents` en la rama `respaldo/codex-config-2026-11-03`), más `topbar-dos-menus` y `app-instalable`. La carpeta `modest-hopper-c05e8d` quedó vacía y trabada por un proceso; git ya no la registra. Quedan `prueba-21st` (sin mergear) y la de Codex en `~/.codex`.

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
