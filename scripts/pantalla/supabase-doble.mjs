// scripts/pantalla/supabase-doble.mjs
//
// El doble de `src/lib/supabase` para la vista previa. No habla con ninguna
// base: devuelve vacio a todo.
//
// Es un ALIAS de Vite y no un mock de test a proposito. Un mock solo vale en
// el archivo que lo declara; el alias vale para cualquier import, incluido el
// que hace un servicio tres niveles abajo del componente. Al armar la vista de
// Stock, el import real reventaba antes de renderizar nada porque el cliente
// lee variables de entorno que en un script no existen.
//
// Devolver vacio no es una limitacion: es el primer pintado, que es lo que ve
// el usuario antes de que llegue cualquier dato asincrono. Si una pantalla se
// ve rota con las listas vacias, esta rota de verdad.

const respuesta = { data: [], error: null };
const unaFila = { data: null, error: null };

function consulta() {
  const q = {
    select: () => q, insert: () => q, update: () => q, upsert: () => q,
    delete: () => q, eq: () => q, neq: () => q, in: () => q, is: () => q,
    gt: () => q, gte: () => q, lt: () => q, lte: () => q, like: () => q,
    ilike: () => q, order: () => q, limit: () => q, range: () => q,
    single: () => Promise.resolve(unaFila),
    maybeSingle: () => Promise.resolve(unaFila),
    then: (r) => Promise.resolve(respuesta).then(r),
  };
  return q;
}

export const supabase = {
  from: consulta,
  rpc: () => Promise.resolve(respuesta),
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
  storage: { from: () => ({ upload: () => Promise.resolve(unaFila), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe() {} }) }), subscribe: () => ({ unsubscribe() {} }) }),
  removeChannel: () => {},
};

export default supabase;
