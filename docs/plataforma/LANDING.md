# La landing de divianco.app — guia para seguir (Codex o Claude)

> Unico lugar de trabajo de la landing desde el 23/oct/2026. Lo que antes
> vivia afuera (docs de Claude, artifacts, el manual RC5 en Descargas, el
> analisis de IMAN) esta resumido aca. Si algo no esta en el repo, no cuenta.
> Se lee de arriba para abajo antes de tocar una linea.

---

## 1. Estado al 23/oct/2026

| Que | Donde | Estado |
|---|---|---|
| Landing v3 (la home es el embudo de diagnostico) | `main` | **En produccion** en divianco.app |
| "El resultado del dia" en la landing y el diagnostico | rama `landing/resultado-del-dia` (4 commits, worktree `.claude/worktrees/landing-dia`) | Auditada, con preview, **sin PR**. Mergea limpio contra `main` |
| CI de `main` | GitHub Actions | **Security Audit en rojo desde el 22/oct**: alertas nuevas de `vite` 8.3.0-8.3.2 (alta) y `vitest` <=4.1.11. No es de la landing, pero el PR va a dar rojo hasta que se arregle |

Preview de la rama: `https://hermes-platform-git-landing-374273-diviancocorp-a11ys-projects.vercel.app/landing`
(en `*.vercel.app` la landing se ve en `/landing`; `/` cae al catalogo de respaldo).

**Siguiente paso:** arreglar el Security Audit en su propia rama (`vite` y
`vitest` a la version corregida, build + tests), despues abrir el PR de
`landing/resultado-del-dia` contra `main`. Ricky mergea.

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

Solo tenants reales del edificio: **La Nona Pato** y **Crazy Miga**
(`src/components/landing/clientes.js`). **Monare no aparece nunca.**
MiaEstudio no, mientras no opere en Dico. Las fotos llevan el nombre del
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
