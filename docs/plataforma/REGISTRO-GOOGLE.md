# Registro con Google — activación pendiente

Estado al 30/oct/2026: el frontend está preparado en PR #62. La consulta pública
de Auth confirmó `external.google=false`, `external.apple=false`, email activo.
No se cambiaron proveedores ni credenciales. El acceso a Google Cloud desde la
sesión de Codex no se completó; falta configurar el cliente con la cuenta titular.

## Configuración del proveedor

1. En Google Cloud, crear o elegir un proyecto propiedad de Divianco. Configurar
   el nombre visible **Dico**, el correo de soporte real y audiencia externa.
2. Crear un cliente OAuth de tipo aplicación web. URI de redirección autorizada:
   `https://wwwzdgprsooyjgkuyoav.supabase.co/auth/v1/callback`.
3. En Supabase, proyecto `wwwzdgprsooyjgkuyoav`, Auth → proveedores → Google,
   cargar Client ID y Client Secret y habilitarlo. El secreto queda únicamente
   en el proveedor; nunca en el frontend, el repo, un chat o una URL.
4. Agregar a los redirects permitidos de Supabase
   `https://divianco.app/registro?oauth=google`, conservando los existentes
   (especialmente `/bienvenido`). Para una revisión, agregar la URL concreta
   del preview vigente con `/registro?oauth=google`; no abrir dominios ajenos.
5. Probar el ingreso con una cuenta del titular: volver a Tu negocio, editar
   datos, confirmar el registro y comprobar la creación/vinculación del tenant.
   Los tests simulados no sustituyen esta comprobación con Google habilitado.

Documentación oficial:
https://supabase.com/docs/guides/auth/social-sign-in/auth-google

## Recorrido que queda preparado

- El botón se ofrece solo si el proveedor está activo; email/contraseña sigue
  disponible aunque falle la consulta de configuración.
- Antes de salir se guarda un borrador por pestaña, con vencimiento de una hora,
  sin contraseña, tokens ni capacidad privada del diagnóstico.
- Google vuelve a `/registro?oauth=google`. Se consulta `getUser()` para verificar
  identidad Google y correo confirmado. Se recupera el borrador y se muestra el
  segundo paso; todavía no se crea el tenant.
- Al confirmar el formulario, `updateUser` guarda el mismo contrato de negocio
  que email. `/bienvenido` ejecuta la RPC existente `signup_tenant`, que revalida
  y es idempotente. No se incorporan RPCs, tablas o permisos nuevos.
- El diagnóstico viaja por UUID en metadata; nombre y teléfono no se agregan a
  la URL. El diagnóstico conserva el teléfono, sin volver a pedirlo en el alta.
- `requested_plan` y `requested_billing_period` conservan una preferencia. No
  conceden permisos, asignan plan, activan prueba ni autorizan cobros. Esa
  confirmación comercial es una etapa aparte.

El icono del botón se guarda en `public/brand/google.svg`, tomado del recurso
oficial `https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg`.
