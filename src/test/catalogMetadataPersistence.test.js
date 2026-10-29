import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chain } from './_chain';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }));
import { upsertProduct } from '../services/platformAdmin';

describe('persistencia de clasificación del catálogo', () => {
  let query;
  const product = { id: 'producto', name: 'Vino', price: 100 };
  beforeEach(() => {
    vi.clearAllMocks();
    query = chain({ data: product, error: null });
    mocks.from.mockReturnValue(query);
  });

  it('envía clasificación y características explícitas dentro del tenant', async () => {
    const attributes = { category: 'Tintos', brand: 'Bodega', features: ['vegan'] };
    await upsertProduct('tenant', { ...product, catalog_attributes: attributes });
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant', catalog_attributes: attributes,
    }));
    expect(query.select.mock.calls[0][0]).toContain('catalog_attributes');
  });

  it('permite quitar todas las características sin perder la clasificación', async () => {
    await upsertProduct('tenant', { ...product, catalog_attributes: { category: 'Tintos', features: [] } });
    expect(query.upsert.mock.calls[0][0].catalog_attributes).toEqual({ category: 'Tintos', features: [] });
  });

  it('un formulario anterior que omite metadatos no borra los existentes', async () => {
    await upsertProduct('tenant', product);
    expect(query.upsert.mock.calls[0][0]).not.toHaveProperty('catalog_attributes');
  });

  it.each([{ features: ['desconocido'] }, { features: ['vegan', 'vegan'] }, { extra: true }])(
    'rechaza atributos inválidos antes de escribir: %j', async attributes => {
      const result = await upsertProduct('tenant', { ...product, catalog_attributes: attributes });
      expect(result.__error).toBe('validation');
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );
});
