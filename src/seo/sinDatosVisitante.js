// Solo el render de compilacion recibe este modulo en lugar del cliente real.
// Cualquier intento de consultar datos durante el prerender falla cerrado.
export const supabase = new Proxy({}, {
  get() { throw new Error('El prerender de la landing no puede consultar datos de visitantes'); },
});
