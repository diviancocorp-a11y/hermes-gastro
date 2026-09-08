import { describe, expect, it } from 'vitest';
import {
  accionesOperativas, destinoDeImpulso, matrizKasavana, recomendacionProductoKasavana,
  proximidadKasavana, recomendacionesKasavana, ventasPorProducto,
} from '../modules/gestionProductos';

const products = [
  { id: 'estrella', name: 'Estrella', price: 1000, active: true, stock: 8 },
  { id: 'caballo', name: 'Caballo', price: 500, active: true, stock: 8 },
  { id: 'enigma', name: 'Enigma', price: 1200, active: true, stock: 10 },
  { id: 'perro', name: 'Perro', price: 400, active: true, stock: 2 },
];

const orders = [
  { id: 'o1', status: 'completed', created_at: '2026-09-06T18:00:00Z' },
  { id: 'o2', status: 'pending', created_at: '2026-09-06T18:10:00Z' },
];

const items = new Map([
  ['o1', [
    { product_id: 'estrella', qty: 8, subtotal: 8000 },
    { product_id: 'caballo', qty: 8, subtotal: 4000 },
    { product_id: 'enigma', qty: 1, subtotal: 1200 },
    { product_id: 'perro', qty: 1, subtotal: 400 },
  ]],
  ['o2', [{ product_id: 'enigma', qty: 99, subtotal: 99999 }]],
]);

const ingredientes = [
  { id: 'caro', name: 'Caro', cost: 450, stock: 10, min_stock: 2 },
  { id: 'barato', name: 'Barato', cost: 100, stock: 10, min_stock: 2 },
  { id: 'agotado', name: 'Agotado', cost: 100, stock: 0, min_stock: 2 },
];

const recetas = new Map([
  ['estrella', [{ ingredient_id: 'barato', qty: 1 }]],
  ['caballo', [{ ingredient_id: 'caro', qty: 1 }]],
  ['enigma', [{ ingredient_id: 'barato', qty: 1 }]],
  ['perro', [{ ingredient_id: 'caro', qty: 1 }]],
]);

describe('gestion de productos por turno', () => {
  it('cuenta solo pedidos completados dentro de la ventana', () => {
    const ventas = ventasPorProducto(orders, items, { desde: '2026-09-06T17:00:00Z' });
    expect(ventas.get('enigma').unidades).toBe(1);
    expect(ventas.get('estrella').unidades).toBe(8);
  });

  it('ubica los cuatro comportamientos de la matriz Kasavana', () => {
    const matriz = matrizKasavana({ products, orders, itemsPorPedido: items, recetas, ingredientes });
    expect(matriz.cuadrantes.estrellas.map(x => x.producto.id)).toContain('estrella');
    expect(matriz.cuadrantes.caballos.map(x => x.producto.id)).toContain('caballo');
    expect(matriz.cuadrantes.enigmas.map(x => x.producto.id)).toContain('enigma');
    expect(matriz.cuadrantes.perros.map(x => x.producto.id)).toContain('perro');
  });

  it('calcula los umbrales dentro de cada categoría comercial', () => {
    const productosPorCategoria = products.map((producto, indice) => ({
      ...producto,
      category: indice < 2 ? 'Principales' : 'Postres',
    }));
    const matriz = matrizKasavana({
      products: productosPorCategoria, orders, itemsPorPedido: items, recetas, ingredientes,
    });
    const estrella = matriz.cuadrantes.estrellas.find(x => x.producto.id === 'estrella');
    const enigma = matriz.cuadrantes.estrellas.find(x => x.producto.id === 'enigma');

    expect(estrella.categoria).toBe('Principales');
    expect(enigma.categoria).toBe('Postres');
    expect(estrella.corteMargen).not.toBe(enigma.corteMargen);
    expect(estrella.participacion).toBeCloseTo(0.5);
    expect(enigma.participacion).toBeCloseTo(0.5);
  });

  it('excluye productos ocultos del ranking vigente sin contarlos como incompletos', () => {
    const oculto = { ...products[0], active: false };
    const matriz = matrizKasavana({
      products: [oculto, ...products.slice(1)], orders, itemsPorPedido: items, recetas, ingredientes,
    });
    const ids = Object.values(matriz.cuadrantes).flat().map(fila => fila.producto.id);

    expect(ids).not.toContain('estrella');
    expect(matriz.productosOcultos).toBe(1);
    expect(matriz.productosSinDatos).toBe(0);
  });

  it('traduce cada cuadrante a una decisión concreta', () => {
    const matriz = matrizKasavana({ products, orders, itemsPorPedido: items, recetas, ingredientes });
    expect(recomendacionesKasavana(matriz)).toEqual([
      expect.stringMatching(/^Mantener Estrella/),
      expect.stringMatching(/^Revisar costo o precio de Caballo/),
      expect.stringMatching(/^Promocionar Enigma/),
      expect.stringMatching(/^Considerar reformular o sacar Perro/),
    ]);
  });

  it('explica la mejora necesaria para el perfil de un producto', () => {
    const matriz = matrizKasavana({ products, orders, itemsPorPedido: items, recetas, ingredientes });
    const enigma = matriz.cuadrantes.enigmas[0];
    expect(recomendacionProductoKasavana('enigma', enigma, matriz))
      .toMatch(/^Promocionar Enigma:.*unidades adicionales/);
  });

  it('describe proximidad sin inventar una tendencia historica', () => {
    const matriz = matrizKasavana({ products, orders, itemsPorPedido: items, recetas, ingredientes });
    const enigma = matriz.cuadrantes.enigmas[0];
    const señal = proximidadKasavana('enigma', enigma);

    expect(señal).toMatchObject({ direccion: 'sube', destino: 'Estrella' });
    expect(señal.motivo).toMatch(/popularidad/);
  });

  it('prioriza un faltante real antes que una oportunidad de impulso', () => {
    const recetasConFaltante = new Map(recetas);
    recetasConFaltante.set('perro', [{ ingredient_id: 'agotado', qty: 1 }]);
    const acciones = accionesOperativas({
      products, orders: [], itemsPorPedido: new Map(), recetas: recetasConFaltante, ingredientes,
    });
    expect(acciones[0]).toMatchObject({ tipo: 'faltante', producto: { id: 'perro' } });
    expect(acciones.some(a => a.tipo === 'impulsar')).toBe(true);
  });

  it('dirige bebidas a barra y el resto al equipo de salón', () => {
    expect(destinoDeImpulso({ name: 'Negroni', category: 'Cócteles' })).toEqual({
      area: 'barra', etiqueta: 'equipo de barra',
    });
    expect(destinoDeImpulso({ name: 'Pizza fugazzeta', category: 'Pizzas' })).toEqual({
      area: 'salon', etiqueta: 'camareros y recepción',
    });
  });
});
