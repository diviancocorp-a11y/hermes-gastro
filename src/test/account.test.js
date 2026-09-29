import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ supabase: { from: mockFrom, rpc: mockRpc } }));

import {
  fetchUserData, toggleFavorite, fetchFavoriteProducts, fetchOrderHistory, updateProfile,
} from '../services/account';
import { chain } from './_chain.js';

const USER = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('favoritos', () => {
  it('son product_id', async () => {
    const c = chain({ data: null, error: null });
    mockFrom.mockReturnValue(c);

    await toggleFavorite(USER, 'p1', false);

    expect(mockFrom).toHaveBeenCalledWith('favorites');
    expect(c.insert).toHaveBeenCalledWith({ user_id: USER, product_id: 'p1' });
  });

  it('si el guardado falla devuelve false (el corazon no puede quedar pintado)', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'nope' } }));
    expect(await toggleFavorite(USER, 'p1', false)).toBe(false);
  });

  it('desmarcar borra por product_id', async () => {
    const c = chain({ data: null, error: null });
    mockFrom.mockReturnValue(c);

    await toggleFavorite(USER, 'p1', true);

    expect(c.delete).toHaveBeenCalled();
    // OJO _chain: todos los metodos son el MISMO vi.fn, asi que .eq acumula
    // las llamadas de todos. Hay que filtrar por argumento.
    const cols = c.eq.mock.calls.map(([col]) => col);
    expect(cols).toContain('product_id');
    expect(cols).not.toContain('recipe_id');
  });
});

describe('fetchFavoriteProducts', () => {
  it('traduce price -> sale_price para la pantalla', async () => {
    mockFrom.mockReturnValue(chain({ data: [{ id: 'p1', name: 'Pan', price: 900 }], error: null }));

    const r = await fetchFavoriteProducts(['p1']);

    expect(mockFrom).toHaveBeenCalledWith('products');
    expect(r[0].sale_price).toBe(900);
  });

  it('sin favoritos no consulta nada', async () => {
    await fetchFavoriteProducts([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('fetchUserData', () => {
  it('devuelve las tres claves aunque una consulta falle', async () => {
    // Si alguna volviera undefined, AuthContext pisaria su estado con eso y
    // la cuenta mostraria los datos del usuario anterior.
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'boom' } }));

    const r = await fetchUserData(USER);

    expect(r).toEqual({ profile: null, addresses: [], favorites: [] });
  });

  it('sin usuario no consulta', async () => {
    expect(await fetchUserData(null)).toEqual({ profile: null, addresses: [], favorites: [] });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('updateProfile', () => {
  it('hace upsert: el comprador todavia no tiene fila', async () => {
    const c = chain({ data: null, error: null });
    mockFrom.mockReturnValue(c);

    await updateProfile(USER, { name: 'Ana' });

    expect(c.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: USER, name: 'Ana' }));
    expect(c.update).not.toHaveBeenCalled();
  });
});

describe('historial', () => {
  it('con cuenta filtra por user_id', async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await fetchOrderHistory({ user: { id: USER } });

    expect(mockFrom).toHaveBeenCalledWith('orders');
    expect(c.eq).toHaveBeenCalledWith('user_id', USER);
  });

  it('traduce customer_name -> customer', async () => {
    mockFrom.mockReturnValue(chain({ data: [{ id: 'o1', customer_name: 'Ana' }], error: null }));

    const r = await fetchOrderHistory({ user: { id: USER } });

    expect(r[0].customer).toBe('Ana');
  });

  // Decision explicita, no un olvido: el RPC del legacy matcheaba por
  // telefono y cualquiera que escribiera un numero ajeno veia esos pedidos.
  it('sin cuenta (solo telefono) no consulta nada', async () => {
    expect(await fetchOrderHistory({ user: null, phone: '111' })).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
