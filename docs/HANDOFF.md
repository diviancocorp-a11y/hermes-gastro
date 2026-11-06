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

## 6/nov/2026 — Cobro recurrente con Mercado Pago: decisiones (Claude)

Sin codigo todavia. Via y decisiones de Ricky en `docs/plataforma/COBRO-SUSCRIPCION.md`:
suscripcion de MP por negocio sin plan asociado, con la cuenta de Divianco;
tarjeta obligatoria en la primera entrada; primer debito al vencer los 14 dias;
solo la promo de la prueba; anual por adelantado; Paris es pago y sin pago se
suspende; Dante/Magnus sin pago bajan a Paris; el corte de
`create-payment-preference` va junto.

### Pendiente inmediato
1. Verificar contra la doc vigente de MP los puntos que lista el doc.
2. Migracion aditiva + `suscripcion-crear` + `suscripcion-webhook`, probados con usuarios de prueba de MP sobre un tenant de QA.

### Bloqueado por Ricky
- Credenciales de MP de Divianco y secrets cargados en Supabase.

---

## 5/nov/2026 (cierre) — Landing: intro DIVIANCO → DICO, óvalo en el teléfono y "Conocé Dico" con Earth Blaze (Claude)

Publicado en producción: `92f6dd9` (intro), `9a2aeac` (óvalo) y `f51415d` (Conocé Dico). Todo pasó por `/diseno` con `impeccable`, constructor y auditor separados (cuatro auditorías).

### Hecho

- **Intro de carga** (`index.html`, `src/styles/entrada-landing.css`): arranca con DIVIANCO a lo ancho y se cierra en DICO (80vw, tope 170vh); recién ahí se abren las compuertas. DI y CO son recortes del PNG real (`dico-oscuro.png`, corte en x=574 de 1368, entre la I y la C) y VIAN es un SVG con la tinta medida del logo (relleno blanco, trazo volt 4 px, alto 38–402): el final ES el logo. Se anima solo con transform y opacity (DI y CO se juntan, VIAN se achica hacia el centro): animar `width` se desincronizaba con el hilo ocupado. Sin la línea de la unión ni los bordes dorados al abrir; las mitades se pisan 1 px porque con DPR fraccional (Android) la costura aparecía igual. El brillo dorado va en `.de-di`/`.de-co` y no en la `img` (ahí lo recortaba el `overflow`). Mismo tiempo mínimo de 2800 ms: no cambió `entradaLanding.test.jsx`.
- **Óvalo de la frase en el teléfono** (`src/styles/transicion-volt.css`): en ≤700 px la lente medía 144% del ancho y las puntas quedaban afuera (se veía como una franja). Ahora entra entera, 2:1 (50vw de alto) con `--hv-aire` arriba y abajo para el halo, y la frase se achica (piso 14 px, `text-wrap: balance`).
- **"Conocé Dico"** (`src/components/landing/QueEsDico.jsx`, `que-es-dico.css`), entre Negocios y Rubros, `id="que-es"` (sumado a `ordenLanding.test.jsx`):
  - **Earth Blaze** (`src/components/landing/EarthBlaze.jsx`, `earth-blaze.css`): componente WebGL de 21st.dev portado a JS. Halo, borde y aurora en el dorado DICO; nebulosa teñida con `--ds-color-intelligence-trace`; los tintes aceptan `var(--token)`. Sin la textura de la Tierra del CDN de 21st (el planeta queda como silueta). Decorativo (`interactive={false}`: sin foco ni gestos) y el WebGL arranca recién cuando la sección está a 200 px de la pantalla. Prop nueva `luz` (-1 a 1) que corre el sol por el horizonte; sin interacción viaja lento (τ 1.1 s).
  - **Tres escenas** que rotan cada 5 s con fundido: Qué es, Visión ("Que cada negocio sepa cuánto gana.") y Misión ("Devolverte el tiempo para lo que importa."). Los textos de visión y misión los redacté yo y Ricky los aprobó viendo el preview. Pestañas `role=tablist` con barra dorada de progreso, flechas/Home/End; paneles inactivos con `inert` + `aria-hidden`; los tres en el HTML de SEO.
  - **Pausa:** con el mouse encima, mientras se mantiene apretado en el teléfono (sigue al soltar), con foco de teclado (solo `:focus-visible`), con el texto fuera de pantalla y con movimiento reducido. **Ricky pidió sacar el botón de pausa**: WCAG 2.2.2 pide un control para lo que se mueve solo más de 5 s, y sin el botón queda solo la pausa por hover/toque.
  - Texto a la derecha en el negro del planeta; **apilado (escena arriba, texto abajo) debajo de 1280 px** y en el teléfono acostado, porque entre 701 y 1280 el sol caía detrás del texto.
- **Tabla de herramientas evaluadas** (`CLAUDE.md` + `AGENTS.md`): fila de Earth Blaze.

### Verificado

- **Producción:** deploy READY de `92f6dd9` y `curl` a divianco.app con el markup nuevo de la intro; CI de `92f6dd9` verde (5 jobs). El de `f51415d` se esperó con `ci:esperar` en este cierre (ver resumen).
- **Navegador integrado (local):** intro en tres momentos (DIVIANCO, cierre, DICO) en 1280 y 375, y la apertura de compuertas; óvalo en 375 y 320; "Conocé Dico" en 1280, 820 y 375, rotación sola a los 5–8 s, clic en pestañas, sol corriéndose, paneles ocultos para lectores. El WebGL arranca recién al acercarse (antes queda sin iniciar).
- **Tests de la landing** (`ordenLanding`, `landingHero`, `seoPlataforma`, `entradaLanding`), ESLint, `check:diseno` (17 conocidos, ninguno nuevo), integridad y build del pre-commit: verdes.
- **NO verificado:** la última versión de la pausa (5 s, sin botón, apretar en el teléfono): el panel del navegador estaba oculto y no corre los IntersectionObserver; la lógica se revisó en el código. Tampoco se vio en un teléfono real ni el rendimiento del WebGL en gama baja.

### Pendiente inmediato

1. **Licencia de Earth Blaze:** se publicó sin confirmar autor ni licencia (decisión de Ricky). Con el link de 21st, poner autor y licencia en la cabecera de `EarthBlaze.jsx` y en la tabla. Si no permite uso comercial, sacarlo.
2. **Probar en el teléfono de Ricky** la pausa al apretar y el rendimiento: hay 4+ contextos WebGL en la landing (Safari iOS descarta contextos cuando son muchos; el respaldo CSS existe).
3. **Óvalo, P2 del auditor sin tocar:** entre 701 y ~1100 px (tablet) la lente vuelve a ser casi un rombo (regla base de `min-height`), y en el teléfono acostado no entra en la pantalla. Con la letra del sistema al 130% o más, el texto toca el trazo en 320 px.
4. **Intro:** las esquinas de V, A y N son en punta (el logo las tiene apenas redondeadas) y "Preparando Dico" queda chico en escritorio.
5. **`--ds-color-zinc-300` no existe** (solo zinc 50/400/800/900/950) y lo usan `negocios-dico.css:2` y el `<p>` de la intro (este con fallback). Revisar qué color se ve en Negocios.
6. Siguen los pendientes 1, 2, 3, 5 y 6 de la sección de abajo (precargar Overused Grotesk, portal estático en celulares lentos, etc.).
7. Borrar la worktree `.claude/worktrees/earth-blaze` y la rama `prueba/earth-blaze`: su contenido ya está en `main` (copiado, no mergeado), con el sí de Ricky.

### Bloqueado por Ricky

- Pasar el link de 21st.dev de Earth Blaze (autor y licencia).

### Heredados de la sección del 4/nov que se archiva (siguen vigentes)

- Ricky instala el panel en el celular (`/admin` → nombre → Instalar app) y confirma nombre, ícono y que abre en el panel. No verificado en Chrome, Android ni iPhone.
- Mía pega el Access Token de MercadoPago en Configuración → Finanzas → Cobros online (MiaEstudio no tiene fila en `payment_integrations`).
- Deuda del auditor: `.ag-dialog-panel` sin `overscroll-behavior: contain`, y "Instalar app" visible con el panel ya instalado pero abierto en una pestaña.

### Archivos y limpieza

- No se creó nada fuera de `src/`, `docs/`, `platform/` y `scripts/` salvo `index.html` (ya existía) y la worktree `.claude/worktrees/earth-blaze`. Temporales de los auditores en el scratchpad del sistema.

---

## 5/nov/2026 (noche) — Landing: títulos con movimiento, portal DICO, nuevo orden y óvalo dorado (Claude)

Publicado en producción: `main` = `df62f77`, deploy de `hermes-platform` READY con ese SHA y CI verde (los 5 jobs, run 42131926867). Todo pasó por `/diseno` con `impeccable`, constructor y auditor separados.

### Hecho

- **Títulos palabra por palabra** (`04a135a`, `ad00ccb`): `src/components/landing/Palabras.jsx` parte cada h2 de sección en máscaras; suben con `--pc-t-personaje` y `--pc-curva`. `useEntradas.js` los observa aparte con el borde de abajo corrido 30%, porque arrancaban antes de que se leyeran. Ricky eligió **el mismo efecto en todos los títulos** (consistencia); la variedad va en un momento fuerte por sección.
- **Cinta de clientes** en `NegociosDico.jsx`: 3 vueltas y frena (WCAG 2.2.2), pausa con hover/foco/fuera de pantalla; con movimiento reducido queda la fila deslizable. **Brillo una vez** en la tarjeta de Dante.
- **Glyph Portal** (`src/components/landing/GlyphPortal.jsx` + `glyph-portal.css`): port a JS del componente MIT de Christian Katzmann (criterio de entrada de terceros: rama `prueba/glyph-portal`, ya mergeada). Sin modo interactivo ni anotaciones. La cámara entra por la **O de DICO** con luces doradas adentro de las letras (prop `campo`). El portal marca `data-gp-listo` (progreso >= .62 o foco) y `platform-landing.css` retiene títulos y `[data-reveal]` de adentro hasta ahí. Revela el contenido entre p .55 y .70 para que suba con el scroll y no quede azul vacío.
- **Cómo empezar va dentro del portal**, sobre el token nuevo **`--ds-color-intelligence-noche` (#132258)** en `dico-tokens.css`: oro 7.25:1, zinc-50 14.4:1. Volt y trace no daban AA con texto claro chico (4.43 y 5.58). El paso 3 se pone dorado cuando el pulso llega; el pulso arranca con el primer círculo al 85% de la pantalla y termina con el último al 35% (antes terminaba con el segmento saliendo).
- **Nuevo orden** (lo fija `src/test/ordenLanding.test.jsx`, que además exige que cada `href="#..."` tenga su id una sola vez y que el título y el botón del Cierre estén en el HTML de SEO): portada → Negocios → Rubros → Cómo empezar (portal) → frase "Pusiste el alma" → Planes → Preguntale a Dico → Cierre → pie. El pie salió de `CierreNegocio.jsx` a `PieNegocio.jsx`. El Cierre es una section azul noche común (la compuerta se borró). Barra fija y pie siguen el orden nuevo.
- **La frase dentro de un óvalo en punta** (`TransicionVolt.jsx`, `transicion-volt.css`): lente de dos arcos, shader solo adentro (máscara SVG), línea dorada con núcleo casi blanco y halo en cuatro capas; alrededor el negro liso de Planes. En pantallas de 700 px o menos la lente es más ancha que la pantalla (si no, quedaba un rombo).
- **Licencia MIT en el bundle** (`2c2fe4d`): `vite.config.js` conserva `/*! @license */` con `output.comments.legal`. Sin eso rolldown descartaba el aviso.

### Verificado

- En producción: SHA del deploy = `df62f77`, CI verde.
- En el preview real (navegador integrado con link de acceso de Vercel): óvalo y halo en 1024 y 375 px.
- El movimiento del portal con rAF real **no** se vio en el navegador integrado (el panel no dibujaba o tardaba más de 2.5 s en el primer cuadro y el portal quedaba estático, que es su fallback). Ricky lo vio en el preview y aprobó.
- Tests de la landing (`ordenLanding`, `landingHero`, `entradaLanding`, `seoPlataforma`, `circuitoNegocio`, `viajeDico`) y `check:diseno` sin hallazgos nuevos (17, deuda conocida).

### Pendiente inmediato

1. **Precargar Overused Grotesk** en `index.html` (`<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/dico/overused-grotesk/OverusedGrotesk-VF.woff2">`): si la fuente llega con el visitante parado en el portal, el alto salta de estático a movimiento. Toca `index.html`: pasa por `/diseno`.
2. **El portal queda estático si el primer cuadro tarda más de 2.5 s** (lógica heredada del original, `stalled`). En un celular lento puede que nunca se vea el efecto. Medirlo en un teléfono real antes de tocarlo.
3. Celular horizontal con alto útil menor a ~367 px: el salto a `#como-empezar` cae con el contenido a medio revelar (P2 del auditor).
4. El paso del azul de Cómo empezar al negro de la frase es un corte recto: Ricky pidió sacar el difuminado; si lo pide de vuelta, suavizarlo sin tocar el óvalo.
5. Las luces doradas del portal son una excepción a "oro solo acción y valor": anotarla en `docs/marca/` si queda.
6. `ci:esperar` espera 15 min a un CI que no va a arrancar cuando la rama no está en los disparadores de `ci.yml` (solo `main` y PR): que avise enseguida.

### Bloqueado por Ricky

- Nada de esta sección.

### Heredados de la sección del 3/nov que se archiva (siguen vigentes)

- Datos de Mía que faltan: insumos de soft gel y esmaltado, producto del alisado, consumo por clienta del gel sólido y del removedor, y el recargo de $4.000 por reprogramar (no hay columna). Tienen que venir de Mía.
- Contraer `prep_time_min` (sigue en `settings`, Zod y manifest sin lectores), en migración aparte con `-- contraer:`.
- P3 sin resolver: `formatearDuracion` sin espacio duro y "1 h 30" vs "1 hora y media".
- Marca de Mía: Modak/Poppins y paleta Y2K sin implementar (`catalog_font` sin consumidor; `logo_color` no reemplaza `--ac`); logo del header a 36 px (el manual pide 60) e Instagram a 40 px. Pasa por `/diseno`.
- Confirmar si Flores 3D se cobra por flor, uña o trabajo, y si los retiros se reservan aparte.
- Comprobar el aviso del candado del orquestador en una sesión sobre `main` y contrastar el gate de hooks con la worktree `cool-fermat`.

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
