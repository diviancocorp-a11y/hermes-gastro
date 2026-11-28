// Que datos le faltan al perfil de una cuenta para poder pedir.
// El checkout exige nombre (2+ letras) y telefono (10+ digitos); un usuario
// registrado puede no tenerlos en `profiles`. Se calcula desde el perfil y no
// desde el form, para que el campo no desaparezca mientras se tipea.

const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

export function faltantesDelPerfil(profile) {
  return {
    name: String(profile?.name ?? "").trim().length < 2,
    phone: soloDigitos(profile?.phone).length < 10,
  };
}

// Lo que hay que guardar en el perfil despues de un pedido: solo lo que
// faltaba y que el form ya trae valido. Vacio = no hay nada que guardar.
export function datosParaGuardarEnPerfil(profile, form) {
  const falta = faltantesDelPerfil(profile);
  const out = {};
  const nombre = String(form?.name ?? "").trim();
  const tel = soloDigitos(form?.phone);
  if (falta.name && nombre.length >= 2) out.name = nombre;
  if (falta.phone && tel.length >= 10) out.phone = tel;
  return out;
}
