// El entorno con el que se construye un release.
//
// El defecto que esto evita ya paso, el 8/9/2026: `vercel pull` no entrega el
// valor de una variable marcada como Sensitive —baja el literal
// "[SENSITIVE]"— y el build local lo horneo como URL de Supabase.
// `createClient` la rechazo al importar el modulo y se cayo TODA la app en
// produccion, no solo la parte que dependia de esa variable.
//
// La auditoria de entonces miraba buildId, release de Sentry y sourcemaps:
// tres cosas ciertas sobre un artefacto que no arrancaba.

import { describe, it, expect } from 'vitest';
import { envUsable, VALOR_CENSURADO } from '../../scripts/release-lib.mjs';

describe('envUsable', () => {
  it('acepta un entorno sano', () => {
    const { ok, rotas } = envUsable([
      'VITE_SUPABASE_URL="https://abc.supabase.co"',
      'VITE_SUPABASE_ANON_KEY="una-clave"',
      'CLIENT="hermes-cochi"',
    ].join('\n'));
    expect(ok).toBe(true);
    expect(rotas).toEqual([]);
  });

  it('rechaza la variable que vino censurada', () => {
    const { ok, rotas } = envUsable(`VITE_SUPABASE_URL="${VALOR_CENSURADO}"`);
    expect(ok).toBe(false);
    expect(rotas).toHaveLength(1);
    expect(rotas[0].nombre).toBe('VITE_SUPABASE_URL');
    expect(rotas[0].motivo).toMatch(/censurada/);
  });

  it('rechaza la variable vacia, con y sin comillas', () => {
    expect(envUsable('VITE_A=\nVITE_B=""').rotas.map((r) => r.nombre)).toEqual(['VITE_A', 'VITE_B']);
  });

  it('solo mira las VITE_*: son las unicas que Vite hornea en el bundle', () => {
    // Una variable de servidor censurada es normal y no tiene que frenar nada:
    // no viaja al navegador. Confundirlas volveria el guard imposible de pasar.
    expect(envUsable(`SUPABASE_SERVICE_ROLE_KEY="${VALOR_CENSURADO}"`).ok).toBe(true);
  });

  it('no filtra ningun valor en lo que reporta', () => {
    // El guard corre en consola y en logs de CI: si escupiera el valor, un
    // arreglo de deploy se convertiria en una fuga.
    const { rotas } = envUsable('VITE_SUPABASE_ANON_KEY="clave-secreta-de-verdad"\nVITE_X=""');
    expect(JSON.stringify(rotas)).not.toContain('clave-secreta-de-verdad');
  });
});
