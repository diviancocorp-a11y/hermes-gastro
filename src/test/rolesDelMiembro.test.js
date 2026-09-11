// Los roles con los que entra una persona son los de SUS filas, no los del
// equipo entero.
//
// La policy de `tenant_members` deja que un miembro lea a los demas miembros
// del negocio. `fetchMyTenant` pide el tenant con sus miembros embebidos, asi
// que la consulta devuelve el equipo completo. Unir todo eso daba la suma de
// permisos del local: medido el 10/9/2026 en QA Lite, un mozo leia
// `[{roles:['owner']},{roles:['attendant']}]` y entraba con el riel del duenio
// —Caja, Gastos, Configuracion— porque `puedeVer` recibia 'owner'.
//
// La navegacion no es la seguridad: lo que de verdad protege son las policies
// (0050). Pero mostrarle a alguien secciones que no le tocan es un bug igual,
// y no habia un solo test mirando esto.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const consulta = { data: null, error: null };
let usuario = null;

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => consulta }),
      }),
    }),
    auth: { getUser: async () => ({ data: { user: usuario } }) },
  },
}));

vi.mock('../lib/activeTenant', () => ({
  resolveTenantSlug: async () => 'dico-qa-lite',
  getTenantSlugSync: () => 'dico-qa-lite',
}));

const { fetchMyTenant } = await import('../services/platformAdmin');

const MOZO = '00000000-0000-4000-8000-0000000000aa';
const DUENIO = '00000000-0000-4000-8000-0000000000bb';

const tenantCon = (miembros) => ({
  data: {
    id: 't1', slug: 'dico-qa-lite', name: 'QA', vertical: 'gastro',
    timezone: null, status: 'active', settings: {},
    plan_id: null, ciclo: null, paga_hasta: null, suspendido_at: null,
    tenant_members: miembros,
  },
  error: null,
});

describe('fetchMyTenant: los roles son los propios', () => {
  beforeEach(() => {
    usuario = { id: MOZO };
    Object.assign(consulta, { data: null, error: null });
  });

  it('descarta las filas de otros miembros del mismo negocio', async () => {
    Object.assign(consulta, tenantCon([
      { user_id: DUENIO, role: 'owner', roles: ['owner'], branch_id: null },
      { user_id: MOZO, role: 'staff', roles: ['attendant'], branch_id: null },
    ]));

    const { roles, role } = await fetchMyTenant();

    expect(roles).toEqual(['attendant']);
    expect(roles).not.toContain('owner');
    expect(role).toBe('staff');
  });

  it('une las filas propias cuando hay una por sucursal', async () => {
    Object.assign(consulta, tenantCon([
      { user_id: DUENIO, role: 'owner', roles: ['owner'], branch_id: null },
      { user_id: MOZO, role: 'staff', roles: ['attendant'], branch_id: 'b1' },
      { user_id: MOZO, role: 'staff', roles: ['cashier'], branch_id: 'b2' },
    ]));

    const { roles, branchIds } = await fetchMyTenant();

    expect(roles.sort()).toEqual(['attendant', 'cashier']);
    expect(branchIds.sort()).toEqual(['b1', 'b2']);
  });

  // Sin sesion no hay a quien atribuirle roles. Quedarse con los del equipo
  // seria darle a un anonimo los permisos del duenio.
  it('sin usuario no hereda los roles de nadie', async () => {
    usuario = null;
    Object.assign(consulta, tenantCon([
      { user_id: DUENIO, role: 'owner', roles: ['owner'], branch_id: null },
    ]));

    const { roles, role } = await fetchMyTenant();

    expect(roles).toEqual([]);
    expect(role).toBeNull();
  });
});
