# 🛠 La Nona Pato — Mejoras Pendientes

> Documento de trabajo. Tachá o mové a "Hecho" cada ítem al completarse.

---

## 🔴 PRIORIDAD ALTA (sin esto hay cosas rotas)

### 1. Crear tablas faltantes en Supabase
- [ ] Ejecutar `supabase_tablas_faltantes.sql` en el SQL Editor de Supabase
- Tablas a crear: `sales`, `expenses`, `purchases`, `purchase_items`
- Columnas a agregar en tablas existentes: `category` en ingredients, `exp_cats/ing_cats` en settings
- **Sin esto**: Ventas, Gastos y Compras fallan silenciosamente

### 2. Botón de Logout en el admin
- [ ] Agregar botón de cerrar sesión en el header o en Settings
- Actualmente no hay forma de cerrar sesión desde la UI

### 3. El Inicio/Dashboard no muestra datos reales
- [ ] Los stats de Ventas/Ganancia/Gastos del home usan la tabla `sales` que puede no existir
- [ ] Verificar que `fetchDashboardStats` conecte bien con las tablas reales

---

## 🟡 PRIORIDAD MEDIA (mejoras de UX importantes)

### 4. Feedback de errores visible al usuario
- [ ] Cuando una operación falla (ej: guardar receta, agregar ingrediente) mostrar un mensaje de error en pantalla
- Actualmente los errores solo van a la consola del browser

### 5. Validación de formularios
- [ ] Campos numéricos no pueden ser negativos (precio, stock, cantidad)
- [ ] Campo "Nombre" obligatorio antes de guardar (ya está en algunos, falta en otros)
- [ ] Precio de venta > 0 obligatorio para recetas visibles en catálogo

### 6. Stock bajo: advertencia antes de confirmar pedido
- [ ] Al pasar un pedido a "Preparando", si algún ingrediente queda en negativo, mostrar alerta

### 7. Catálogo público: manejo de pedidos sin stock
- [ ] Si un producto no tiene ingredientes suficientes, marcar como "Sin stock" en el catálogo
- [ ] O al menos advertir al admin cuando acepta el pedido

### 8. Pedidos desde el catálogo no se guardan bien
- [ ] Verificar que los pedidos creados desde el catálogo público aparezcan en el admin
- [ ] Revisar que `order_items` se inserte correctamente con `unit_price` y `subtotal`

### 9. Actualización automática de pedidos
- [ ] El admin debería actualizar automáticamente cuando llega un nuevo pedido (sin recargar)
- [ ] Usar Supabase Realtime para suscribirse a cambios en la tabla `orders`

---

## 🟢 PRIORIDAD BAJA (nice to have, para después)

### 10. Historial de compras (Compras registradas)
- [ ] Ver el historial de compras anteriores en el overlay de Compra
- [ ] Detalle de qué se compró, cuándo y a qué precio

### 11. Gráficos en el Dashboard
- [ ] Gráfico de ventas por día/semana del mes actual
- [ ] Gráfico de margen por producto

### 12. Exportar datos
- [ ] Exportar ventas del mes a CSV o PDF
- [ ] Exportar gastos del mes

### 13. Buscador en Pedidos
- [ ] Buscar pedido por nombre de cliente o teléfono

### 14. Imágenes de productos
- [ ] Upload de imágenes directo desde el formulario (hoy solo acepta URL)
- [ ] Usar Supabase Storage para guardar las imágenes

### 15. Modo oscuro
- [ ] Toggle de tema claro/oscuro en Settings

### 16. Notificaciones push
- [ ] Cuando llega un pedido nuevo, notificación push al celular del admin
- [ ] Requiere configurar service worker + Web Push API

### 17. Múltiples usuarios admin
- [ ] Roles: dueño vs. empleado (empleado solo ve pedidos, no finanzas)

### 18. WhatsApp integration
- [ ] Al completar un pedido, botón para enviar mensaje WhatsApp al cliente con el detalle

---

## 📋 FLUJO DE TRABAJO ACORDADO

Para cada mejora:
1. Ricardo describe qué quiere cambiar (screenshot o texto)
2. Claude hace los cambios en el código
3. Ricardo ejecuta: `git add -A && git commit -m "descripción" && git push`
4. Vercel hace deploy automático
5. Verificar en producción

Para cambios en base de datos:
1. Claude genera el SQL
2. Ricardo lo ejecuta en Supabase → SQL Editor
3. Claude actualiza el código si hace falta

---

## ✅ COMPLETADO

- [x] Deploy inicial en Vercel
- [x] Routing SPA con vercel.json
- [x] Panel admin con autenticación Supabase
- [x] Catálogo público con carrito y checkout
- [x] Reconstrucción completa del admin (igual a la app de referencia)
- [x] CSS del admin con todas las clases de la app de referencia
- [x] Funciones en adminService: fetchSales, createSale, updateIngredientStock
- [x] Navegación inferior con 5 tabs
- [x] Dashboard con alertas, stats y top vendidos
- [x] Stock con búsqueda, filtros y valor de inventario
- [x] Recetas con barra de margen y rentabilidad
- [x] Pedidos con filtros por estado, historial y cancel dialog
- [x] Ventas agrupadas por fecha
- [x] Compras con creación de insumos inline
- [x] Settings con color picker y categorías
