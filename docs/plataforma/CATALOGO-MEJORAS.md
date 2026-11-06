# Catalogo publico: mejoras pendientes (auditoria del 6/nov/2026)

Salen de una auditoria de solo lectura sobre `crazy-miga.divianco.app` y el
codigo de `src/catalog-pro/` y `src/pages/Catalog.jsx`: un auditor de diseno,
una medicion en vivo de carga y cinco agentes-persona (panadera, hamburgueseria
delivery, gerenta de cadena, clienta final, barbero). Nota promedio del
catalogo: **5,4/10**.

Nada de esto esta aplicado. Toda la UI pasa por `/diseno` (skill `impeccable`,
es pulir algo que existe). Las lineas citadas son del 6/nov: verificar antes
de tocar.

**Leyenda:** ✔ verificado en el codigo; (P) reportado por las personas o la
medicion en vivo, sin releer el codigo.

## P0 — Confianza y compra

1. **Estrellas y opiniones inventadas** ✔. `homeHelpers.js:24-32`:
   `ratingFor` ("Rating fake estable: 4.3 – 4.9") y `reviewsFor` ("12 – 211")
   salen de un hash del id. Riesgo de marca y de defensa del consumidor.
   Sacarlas, o mostrar solo resenas reales.
2. **Arranque vacio y CLS 0.90** (P + ✔ en codigo). Mientras espera
   `get_catalog`, `HomeScreen` muestra "Catalogo · 0 productos"
   (`HomeScreen.jsx:451`), "No encontramos productos con estos filtros"
   (`:505`) y el header "Cerrado · todavia no toma pedidos". `loading` solo se
   usa para la letra del logo (`Catalog.jsx:1072`) y `error="offline"`
   (`:356`) nunca se pinta. Despues entran la barra de envio (34 px) y el
   carrusel (160 px) y empujan todo. Ver "Skeleton" abajo.
3. **Boton primario blanco sobre `--ac`** ✔. 1.83:1 en `noche`, 2.15:1 en
   `ambar` (minimo 4.5:1). `CheckoutScreen.jsx:739-741` y `:859`, `:181`,
   `:715`, `tokens.css:133`, `HomeScreen.jsx:299` y `:575`,
   `CartScreen.jsx:45` y `:234`, `AgeGate.jsx:31`, `PushOptInBanner.jsx:64` y
   `:101`, `OrdersScreen.jsx:106`. Arreglo: token `--ac-on` por tema.
4. **El carrito se pierde** (P). Un recargar o un "atras" de mas lo vacia: en
   localStorage no hay carrito. Persistirlo y que el carrito sea una entrada
   del historial.

## P1 — Conversion

5. **Horario y zona tarde** (P). Recien en el paso 1 del checkout se ve que
   Crazy Miga entrega de 13 a 16 h; la zona y el envio ($3.700) recien en el
   paso 2. Mostrar en el header "Entregamos de 13 a 16 h · Zona Norte · envio
   desde $X". "Abrimos hoy 12:00" no coincide con el primer horario (13:00).
   No hay tiempo de entrega estimado en ningun paso.
6. **Aviso +18 en cada compra** (P). Salta al agregar, firmado "Dico -
   consumo responsable". Pedirlo una vez al entrar, explicado y firmado por
   el negocio (`AgeGate.jsx`).
7. **Splash con "Bienvenido a Dico"** ✔. `fallbackSettings.biz_name` es
   `'Dico'` (`catalogConstants.js:20`, `clients/edificio/business.js:23`) y
   el splash dura 2,2 s fijos. Usar el nombre solo con cache o settings
   cargados; cerrar el splash cuando llegan los datos (minimo y tope).
8. **Link compartido sin marca** (P). La pestana dice "Dico" hasta cargar y
   la descripcion es "Pedidos online y gestion para tu negocio." (sin tilde).
   El titulo, la descripcion y la imagen deberian salir del tenant desde el
   servidor (`api/og.js` / `tenantHead.js`).
9. **WhatsApp** (P). `WhatsAppFloat` solo aparece si el negocio cargo el
   numero; en Crazy Miga no hay. Avisar fuerte en el alta si falta.
10. **Pagos** (P). Juli vio solo Efectivo y Alias; el checkout soporta
    Mercado Pago (`CheckoutScreen.jsx`). Probable: Crazy Miga sin MP
    configurado. Verificar con el tenant antes de tocar codigo.
11. **Recordar datos del cliente** (P). Nombre, telefono y direccion para el
    segundo pedido; hoy son 11 a 14 toques hasta "Completar pedido".

## P1 — Peso y precarga

12. **10,8 MB de PNG precargados** ✔. `Catalog.jsx:351` llama a
    `preloadImages`; `optimizeImage` (`preloadImages.js:19`) devuelve la URL
    original (free tier sin transforms). PNG de ~1400 px (2,7 MB c/u) para
    96–331 px. Generar WebP de 400 y 800 px al subir, `srcset`, precargar solo
    la primera visible con `fetchpriority="high"`, y `width`/`height` en las
    `img`.
13. **Musica precargada** ✔. `catalogMusic.js:35` `audio.preload = "auto"`:
    646 KB en cada visita. Pasar a `"none"` y crear el `Audio` en el primer
    gesto.
14. **`mp-status` en cada visita** (P). 0,4–0,75 s. Diferirlo al checkout o a
    idle.
15. **Fuentes de Google bloqueantes** (P + auditor). `tokens.css:8` hace
    `@import` de Inter, Source Serif 4 y JetBrains Mono: queda primero en el
    CSS global y frena el primer pintado de todas las rutas. Inter va contra
    `DICO-BRAND-TYPOGRAPHY.md`. Autoalojar y cargar solo en el catalogo.
16. **Bundle compartido con la landing** (auditor). `App.jsx:14-19` importa
    sin lazy `Catalog`, `PlatformLanding`, `Consola`, `Signup` y `Login`:
    `index-*.js` de 670 KB. Partir por ruta.
17. **Logo del tenant** (P). JPEG de 704x1524 (88 KB) para 36x36 px.

## P1 — Accesibilidad

18. `--t3` no llega a AA en ningun tema (`tokens.css:17/64/80/96`), usado como
    texto en ~37 lugares.
19. Inputs sin foco visible: `outline: "none"` inline en
    `CheckoutScreen.jsx:543/565/847`, `HomeScreen.jsx:367`,
    `SearchScreen.jsx:81`, `CartScreen.jsx:152/182`,
    `ProductDetailScreen.jsx:220`.
20. Inputs sin label (solo placeholder) ni `autoComplete`/`name`:
    `CheckoutScreen.jsx:194-196`, `:323`, `:375-376`; `HomeScreen.jsx:361`;
    `SearchScreen.jsx:76`.
21. Inputs de 13–14 px: iOS hace zoom al enfocar. Minimo 16 px.
22. Areas tactiles < 44 px: stepper 22 px (`HomeScreen.jsx:669-671`),
    "Agregar" 28 y "+1" 24 (`CartScreen.jsx:225/232`), `AddRound` 32
    (`atoms.jsx:191`), `iconBtn` 38 (`CheckoutScreen.jsx:864`), links del
    footer de 18 px de alto.
23. Botones del carrusel con aria-label "Ver undefined"; +/− sin nombre.
24. Historias del Home rotan cada 4,5 s sin pausa (`HomeScreen.jsx:148`).
25. `autoFocus` en el checkout (`CheckoutScreen.jsx:195`, `:534`) abre el
    teclado al entrar al paso.

## P2 — Pulido

26. Textos sin tilde: "Revisa lo que te llevas", "Minimo de pedido",
    "DIRECCION", "Usar mi ubicacion actual", "¿CON CUANTO PAGAS?", "Silenciar
    musica". "3 productos" arriba y "3 items" en el boton.
27. Fecha cruda: "Programado: 2026-11-06 a las 16:00" → "hoy viernes 6, 16 h".
28. Calendario: dice "dias tachados" y estan en gris.
29. Texto de zona "No entregamos dentro de villas" (dato del tenant; hablarlo
    con Crazy Miga).
30. Eslogan cortado ("Bienvenidos a la dimension desc…") y estado cortado en el
    header a 375 px.
31. Margenes laterales mezclados (22, 24 y 34 px) y sin ancho maximo en
    desktop.
32. Flash de tema en la primera visita: pinta ambar y salta a noche
    (`index.html:85-91`).
33. Sin `color-scheme: dark` en el tema noche.
34. `100vh` en `HomeScreen.jsx:165`, `WelcomeSplash.jsx:38`, `reservar.css:11`
    y `App.jsx:42`: pasar a `100dvh`.
35. Cupon con `fontFamily: "monospace"` (`CheckoutScreen.jsx:565`) en vez de
    `var(--font-mono)`.
36. z-index sueltos (AgeGate 9999, WelcomeSplash 9000/9001, BirthdayGift 8000,
    footer 1200): escala `--z-*` en tokens.
37. Fallback de Suspense generico "Cargando..." (`App.jsx:41-45`) sin
    `cp-root`, lo ven MpStatus, OrderTracker, MyAccount y Reservar.
38. `/reservar` en un negocio sin reservas muestra "Probar de nuevo" como si
    fuera un error.
39. `/info` da 404.
40. Sugerencia de notas "Sin sal · coccion jugosa · sin cebolla" en
    productos que no son comida salada.
41. `bounce-easing` en `BirthdayGift.jsx:192`.

## Skeleton del arranque (medidas a 375 px)

Mientras `loading` sea true: nunca "0 productos" ni el empty state de filtros.

| Bloque | Alto | Nota |
|---|---|---|
| Barra de envio | 34 px | Reservar siempre o no mostrarla hasta tener settings |
| Header | 79 px | Usar `cp_sett_cache` en vez de "todavia no toma pedidos" |
| Carrusel TOP/NUEVO | 160 px | Tarjetas de ~98x137, 3,5 visibles |
| Saludo | 64 px | |
| Chips de filtro | 68 px | |
| Recomendaciones | 50 px | Margenes de 22 px |
| Lista | desde y=475 | Tarjetas de 331x140, margenes de 22 px |

## Mejora al proceso

Sumar a `check:diseno` una regla que falle con `color: "#fff"` sobre
`background: "var(--ac)"` en `catalog-pro`: el detector no ve contraste en
estilos inline de JSX y por eso el P0-3 llego a produccion.
