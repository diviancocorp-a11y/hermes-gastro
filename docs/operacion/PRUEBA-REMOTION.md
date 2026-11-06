# Prueba de Remotion (rama `prueba/remotion`, 6/nov/2026)

Remotion arma videos con React: cada cuadro es un componente y el tiempo es
una prop (`useCurrentFrame`). Sirve para piezas de marca repetibles: la misma
plantilla da un reel por plan o por tenant cambiando solo los datos.

## Donde vive

- `video/` es un proyecto aparte con su propio `package.json`. No toca las
  dependencias del edificio ni entra en el build de Vercel.
- `video/remotion.config.js` apunta a `../public`: el logo y las fuentes de
  marca (Butler, Overused Grotesk) salen del mismo lugar que la landing.
- `video/out/` (los MP4) y `video/node_modules/` estan en `.gitignore`. Los
  videos terminados van a Google Drive, no al repo.

## Como se usa

```bash
cd video
NODE_ENV= npm install --include=dev
npm run estudio     # editor en el navegador, con linea de tiempo
npm run render      # out/promo-dico.mp4
```

Para otra version sin tocar codigo:

```bash
npx remotion render src/index.jsx PromoDico out/magnus.mp4 --props='{"titulo":"Varios locales, una sola caja.","items":["Sucursales","Stock central","Reportes"],"cierre":"divianco.app"}'
```

## Resultado de la prueba

- `PromoDico`: reel 1080x1920, 30 fps, 8 s, tres escenas (titulo en Butler,
  lista en Overused Grotesk con punto dorado, logo con resorte y dominio).
- Instalacion: 246 paquetes en 25 s. Render: 240 cuadros, MP4 h264 de 410 kB.
- Verificado sacando cuadros con ffmpeg y mirandolos: las dos fuentes de marca
  cargan y el logo se ve sobre el fondo `--ds-color-neutral-950`.

## Segunda pieza: "Dos restaurantes" (6/nov)

- `DosRestaurantes` (`video/src/historia/`): reel de 36 s, 8 escenas, guion
  aprobado por Ricky. Estructura tomada del reel de ImpulsePages (competidor
  directo: web, IA de atencion, puntos y resenas para restaurantes); el
  conflicto es propio: los dos locales llenos, solo uno gana plata.
- Todo lo que muestra existe en DICO: catalogo en `<slug>.divianco.app`, aviso
  de pedido, stock que se descuenta con la venta y avisa bajo minimo, cierre
  de caja, y el chat de Dico (placeholder real de `DicoPanel.jsx`).
- **Dice "cuanto vendio", no "cuanto gano"**: `unit_cost` va en 0 y el P&L no
  da. Cuando haya modelo de costos, se cambia el texto.
- Las pantallas son maquetas con los tokens de DICO, no componentes reales:
  los del panel piden sesion y Supabase. Datos inventados ("Resto A").
- Sin voz ni musica: solo subtitulos. Render: 1080 cuadros, MP4 de 3,5 MB.
- Para ver la referencia se sacaron cuadros con ffmpeg (1 por segundo) y el
  audio lo transcribio Gemini desde la app.

## Pendiente para decidir

- **Licencia:** Remotion es gratis para personas y empresas de hasta 3
  personas; arriba de eso pide licencia paga. Divianco hoy entra en la gratis;
  revisarlo si crece el equipo.
- Repetir con una pieza real (un reel de Crazy Miga con su menu, o uno por
  plan) antes de pasar de "en prueba" a adoptada.
- La mascota vigente (la de ChatGPT) no esta en `public/`; las poses
  `dico-2d-*` son del diseno viejo y no se usan.
