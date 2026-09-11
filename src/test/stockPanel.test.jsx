/**
 * Stock: la lista deja de ser una lista de nombres.
 *
 * Lo que se prueba aca no es que "renderice": es que las tres decisiones que
 * hacen util a la pantalla sigan en pie.
 *
 *   1. el nivel se mide contra el minimo, y sin minimo NO se inventa uno
 *   2. lo que falta sube arriba de todo, sin importar el orden alfabetico
 *   3. el conteo guarda la DIFERENCIA, no el numero contado
 *
 * La tercera es la que mas facil se rompe al refactorizar: mandar el numero
 * contado en vez del delta duplica el stock y el sintoma aparece un dia
 * despues, cuando alguien mira el libro.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

import {
  nivelContraMinimo, diasDeCobertura, pasoDe, guardarConteoDeDeposito,
} from '../services/platformInventory';
import { supabase } from '../lib/supabase';
import StockPanel from '../components/admin/platform/StockPanel';
import ConteoDeDeposito from '../components/admin/platform/ConteoDeDeposito';

const TENANT = '11111111-1111-1111-1111-111111111111';

const insumo = (over = {}) => ({
  id: over.id || crypto.randomUUID(),
  tenant_id: TENANT,
  name: 'Insumo',
  unit: 'kg',
  cost: 100,
  stock: 10,
  min_stock: 0,
  category: null,
  supplier_id: null,
  is_archived: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  // El panel pide el consumo diario al montar; sin datos la linea no sale.
  supabase.rpc.mockResolvedValue({ data: [], error: null });
});

describe('nivel contra el minimo', () => {
  it('sin minimo cargado NO dice que esta bien: dice que no se puede medir', () => {
    const { nivel, estado } = nivelContraMinimo(insumo({ stock: 3, min_stock: 0 }));
    expect(nivel).toBeNull();
    expect(estado).toBe('sin-minimo');
  });

  it('la mitad del minimo o menos es critico', () => {
    expect(nivelContraMinimo(insumo({ stock: 2.5, min_stock: 8 })).estado).toBe('critico');
    expect(nivelContraMinimo(insumo({ stock: 4, min_stock: 8 })).estado).toBe('critico');
  });

  it('entre la mitad y el minimo es bajo, y desde el minimo es ok', () => {
    expect(nivelContraMinimo(insumo({ stock: 6, min_stock: 8 })).estado).toBe('bajo');
    expect(nivelContraMinimo(insumo({ stock: 8, min_stock: 8 })).estado).toBe('ok');
    expect(nivelContraMinimo(insumo({ stock: 20, min_stock: 8 })).estado).toBe('ok');
  });

  it('el nivel se topa en 1: una barra al 250% se sale de la celda', () => {
    expect(nivelContraMinimo(insumo({ stock: 20, min_stock: 8 })).nivel).toBe(1);
  });
});

describe('dias de cobertura', () => {
  it('sin consumo medido devuelve null, que no es lo mismo que cero', () => {
    expect(diasDeCobertura(10, 0)).toBeNull();
    expect(diasDeCobertura(10, null)).toBeNull();
    expect(diasDeCobertura(10, undefined)).toBeNull();
  });

  it('con consumo divide el stock por el ritmo', () => {
    expect(diasDeCobertura(2.5, 6)).toBeCloseTo(0.4166, 3);
    expect(diasDeCobertura(18, 6)).toBe(3);
  });
});

describe('el paso del conteo depende de la unidad', () => {
  it('lo que se cuenta de a bultos va de a uno', () => {
    expect(pasoDe('u')).toBe(1);
    expect(pasoDe('unidad')).toBe(1);
    expect(pasoDe(null)).toBe(1);
  });

  it('peso y volumen van en fracciones', () => {
    expect(pasoDe('kg')).toBe(0.5);
    expect(pasoDe('L')).toBe(0.5);
    expect(pasoDe('litros')).toBe(0.5);
  });

  it('gramos y mililitros van de a 50: contar de a 0.5 g no existe', () => {
    expect(pasoDe('g')).toBe(50);
    expect(pasoDe('ml')).toBe(50);
  });
});

describe('la lista pone arriba lo que falta', () => {
  const insumos = [
    insumo({ id: 'a', name: 'Aceite', stock: 45, min_stock: 25 }),   // ok
    insumo({ id: 'z', name: 'Zanahoria', stock: 0, min_stock: 0 }),  // sin minimo
    insumo({ id: 'm', name: 'Muzzarella', stock: 2.5, min_stock: 8 }), // critico
    insumo({ id: 'p', name: 'Pan', stock: 36, min_stock: 60 }),      // bajo
  ];

  it('el orden es critico, bajo, sin minimo, ok — no alfabetico', () => {
    render(<StockPanel tenantId={TENANT} insumos={insumos} />);
    const filas = document.querySelectorAll('.ag-stock-fila');
    const nombres = [...filas].map(f => f.querySelector('strong').textContent);
    expect(nombres).toEqual(['Muzzarella', 'Pan', 'Zanahoria', 'Aceite']);
  });

  it('la cinta de bajo minimo cuenta critico y bajo, no el que no tiene minimo', () => {
    render(<StockPanel tenantId={TENANT} insumos={insumos} />);
    const cintas = [...document.querySelectorAll('.ag-stock-cinta')];
    const bajo = cintas.find(c => /bajo mínimo/i.test(c.textContent));
    expect(bajo.querySelector('.ag-stock-cinta-valor').textContent).toBe('2');
  });

  it('cuenta aparte los que no se pueden medir, en vez de darlos por buenos', () => {
    render(<StockPanel tenantId={TENANT} insumos={insumos} />);
    const cintas = [...document.querySelectorAll('.ag-stock-cinta')];
    const sinMinimo = cintas.find(c => /sin mínimo definido/i.test(c.textContent));
    expect(sinMinimo.querySelector('.ag-stock-cinta-valor').textContent).toBe('1');
  });

  it('la barra del insumo sin minimo queda marcada, no pintada de verde', () => {
    render(<StockPanel tenantId={TENANT} insumos={[insumos[1]]} />);
    const barra = document.querySelector('.ag-stock-barra');
    expect(barra.getAttribute('data-sin-minimo')).toBe('true');
    expect(barra.querySelector('i')).toBeNull();
  });
});

describe('el minimo se carga desde la fila', () => {
  it('la fila sin minimo ofrece definirlo sin abrir nada', async () => {
    const onGuardarInsumo = vi.fn().mockResolvedValue({ id: 'z' });
    render(
      <StockPanel
        tenantId={TENANT}
        insumos={[insumo({ id: 'z', name: 'Zanahoria', stock: 4, min_stock: 0, unit: 'kg' })]}
        onGuardarInsumo={onGuardarInsumo}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /definir mínimo/i }));
    fireEvent.change(screen.getByLabelText(/mínimo de zanahoria/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /listo/i }));

    await waitFor(() => {
      expect(onGuardarInsumo).toHaveBeenCalledWith(expect.objectContaining({ min_stock: 10 }));
    });
  });
});

describe('la ficha resuelve la accion de la fila', () => {
  const muzza = insumo({
    id: 'm', name: 'Muzzarella', stock: 2.5, min_stock: 8, unit: 'kg', cost: 8500,
    category: 'Lácteos',
  });

  it('el ajuste se carga como cuanto HAY y muestra la diferencia', () => {
    render(<StockPanel tenantId={TENANT} insumos={[muzza]} />);
    fireEvent.click(document.querySelector('.ag-stock-fila'));
    fireEvent.click(screen.getByRole('button', { name: /^ajustar$/i }));

    const campo = screen.getByLabelText(/cuánto hay contado/i);
    fireEvent.change(campo, { target: { value: '6' } });

    // 6 contados contra 2.5 registrados: la pantalla dice el delta, que es lo
    // que va a asentar en el libro.
    expect(screen.getByText(/\+3\.5 kg/)).toBeInTheDocument();
  });

  it('la merma no deja dar de baja mas de lo que hay', async () => {
    const onRegistrarMerma = vi.fn();
    render(<StockPanel tenantId={TENANT} insumos={[muzza]} onRegistrarMerma={onRegistrarMerma} />);
    fireEvent.click(document.querySelector('.ag-stock-fila'));
    fireEvent.click(screen.getByRole('button', { name: /^merma$/i }));

    fireEvent.change(screen.getByLabelText(/cuánto se perdió/i), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: /dar de baja/i }));

    expect(await screen.findByText(/no podés dar de baja más de lo que hay/i)).toBeInTheDocument();
    expect(onRegistrarMerma).not.toHaveBeenCalled();
  });

  it('la merma valida exige motivo y lo manda', async () => {
    const onRegistrarMerma = vi.fn().mockResolvedValue(true);
    render(<StockPanel tenantId={TENANT} insumos={[muzza]} onRegistrarMerma={onRegistrarMerma} />);
    fireEvent.click(document.querySelector('.ag-stock-fila'));
    fireEvent.click(screen.getByRole('button', { name: /^merma$/i }));

    fireEvent.change(screen.getByLabelText(/cuánto se perdió/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'roto' } });
    fireEvent.click(screen.getByRole('button', { name: /dar de baja/i }));

    await waitFor(() => {
      expect(onRegistrarMerma).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm' }), 1, 'roto');
    });
  });

  it('sin consumo medido no inventa cuantos dias alcanza', () => {
    render(<StockPanel tenantId={TENANT} insumos={[muzza]} />);
    fireEvent.click(document.querySelector('.ag-stock-fila'));
    expect(screen.queryByText(/alcanza para/i)).not.toBeInTheDocument();
    expect(screen.getByText(/sin consumo medido/i)).toBeInTheDocument();
  });
});

describe('conteo de deposito', () => {
  const insumos = [
    insumo({ id: 'm', name: 'Muzzarella', stock: 2.5, min_stock: 8, unit: 'kg' }),
    insumo({ id: 'c', name: 'Carne', stock: 4, min_stock: 10, unit: 'kg' }),
  ];

  it('sin tocar nada no hay nada que guardar', () => {
    render(<ConteoDeDeposito tenantId={TENANT} insumos={insumos} />);
    expect(screen.getByText(/sin cambios todavía/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar conteo/i })).toBeDisabled();
  });

  it('cada toque mueve un paso de la unidad del insumo', () => {
    render(<ConteoDeDeposito tenantId={TENANT} insumos={[insumos[0]]} />);
    fireEvent.click(screen.getByRole('button', { name: /sumar 0\.5 kg a muzzarella/i }));
    expect(screen.getByText(/^3 kg$/)).toBeInTheDocument();
  });

  it('no deja bajar de cero', () => {
    // Arranca filtrado en "Bajo": un insumo sin minimo no esta ahi, y eso es
    // a proposito. Se pasa a "Todos" para contarlo.
    render(<ConteoDeDeposito tenantId={TENANT} insumos={[insumo({ id: 'x', name: 'Vacio', stock: 0, min_stock: 5, unit: 'u' })]} />);
    expect(screen.getByRole('button', { name: /restar 1 u de vacio/i })).toBeDisabled();
  });

  it('guarda lo CONTADO y la RPC asienta la diferencia', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    render(<ConteoDeDeposito tenantId={TENANT} insumos={insumos} onGuardado={vi.fn()} />);

    // De 2.5 a 3.5: dos toques de 0.5.
    const mas = screen.getByRole('button', { name: /sumar 0\.5 kg a muzzarella/i });
    fireEvent.click(mas);
    fireEvent.click(mas);
    fireEvent.click(screen.getByRole('button', { name: /guardar conteo/i }));

    await waitFor(() => {
      const llamada = supabase.rpc.mock.calls.find(c => c[0] === 'guardar_conteo_de_deposito');
      expect(llamada).toBeTruthy();
      // Se manda el contado (3.5). La RPC resta el registrado y asienta +1.
      expect(llamada[1].p_conteos).toEqual([{ ingredient_id: 'm', contado: 3.5 }]);
    });
  });

  it('solo manda los insumos que cambiaron, no el deposito entero', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    render(<ConteoDeDeposito tenantId={TENANT} insumos={insumos} onGuardado={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sumar 0\.5 kg a carne/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar conteo/i }));

    await waitFor(() => {
      const llamada = supabase.rpc.mock.calls.find(c => c[0] === 'guardar_conteo_de_deposito');
      expect(llamada[1].p_conteos).toHaveLength(1);
      expect(llamada[1].p_conteos[0].ingredient_id).toBe('c');
    });
  });

  it('sumar 0.5 tres veces no deja cola de punto flotante', () => {
    render(<ConteoDeDeposito tenantId={TENANT} insumos={[insumo({ id: 'k', name: 'Harina', stock: 0, min_stock: 4, unit: 'kg' })]} />);
    const mas = screen.getByRole('button', { name: /sumar 0\.5 kg a harina/i });
    fireEvent.click(mas); fireEvent.click(mas); fireEvent.click(mas);
    // 0.1+0.2 clasico: sin redondeo esto daria 1.5000000000000002
    expect(screen.getByText(/^1\.5 kg$/)).toBeInTheDocument();
  });
});

/**
 * Esta regresion ya paso: la primera version de StockPanel porto la LISTA y se
 * olvido del alta y la edicion, que el componente legacy si tenia. Quedo
 * publicada. Los dos tests de abajo existen para que no vuelva a pasar en
 * silencio: una pantalla de stock sin forma de dar de alta un insumo no es una
 * pantalla de stock.
 */
describe('se puede dar de alta y editar un insumo', () => {
  it('la cabecera ofrece agregar', () => {
    const onNuevoInsumo = vi.fn();
    render(<StockPanel tenantId={TENANT} insumos={[]} onNuevoInsumo={onNuevoInsumo} />);
    fireEvent.click(screen.getByRole('button', { name: /agregar insumo/i }));
    expect(onNuevoInsumo).toHaveBeenCalled();
  });

  it('la ficha ofrece editar el insumo elegido', () => {
    const onEditarInsumo = vi.fn();
    const ing = insumo({ id: 'm', name: 'Muzzarella', stock: 2.5, min_stock: 8 });
    render(<StockPanel tenantId={TENANT} insumos={[ing]} onEditarInsumo={onEditarInsumo} />);
    fireEvent.click(document.querySelector('.ag-stock-fila'));
    fireEvent.click(screen.getByRole('button', { name: /editar insumo/i }));
    expect(onEditarInsumo).toHaveBeenCalledWith(expect.objectContaining({ id: 'm' }));
  });
});

describe('el servicio del conteo', () => {
  it('descarta filas sin cantidad valida antes de llamar a la base', async () => {
    const r = await guardarConteoDeDeposito({
      tenantId: TENANT,
      conteos: [{ ingredient_id: 'a', contado: 'ocho' }, { ingredient_id: null, contado: 3 }],
    });
    expect(r.__error).toBe('conteo_vacio');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('traduce los errores crudos de la RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'no_sos_miembro' } });
    const r = await guardarConteoDeDeposito({
      tenantId: TENANT, conteos: [{ ingredient_id: 'a', contado: 3 }],
    });
    expect(r.__error).toBe('db');
    expect(r.message).toMatch(/no sos parte de este negocio/i);
  });
});
