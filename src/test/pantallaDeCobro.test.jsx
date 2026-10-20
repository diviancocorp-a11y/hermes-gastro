// El cobro de una cuenta (Etapa 6d).
//
// Lo que importa que sea cierto:
//   - que el monto venga cargado con lo que FALTA (el cobro de un toque);
//   - que lo que se asienta sea lo cobrado y NO lo que el cliente entrego,
//     porque registrar el billete entero descuadra el arqueo todos los dias;
//   - que un pago parcial deje la cuenta abierta y recargue el resto;
//   - que sin medios de pago se diga, en vez de mostrar un boton muerto.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PantallaDeCobro from '../components/admin/platform/PantallaDeCobro';
import * as caja from '../services/platformCaja';

vi.mock('../services/platformCaja', () => ({
  fetchMediosDePago: vi.fn(),
  saldoDelPedido: vi.fn(),
  fetchPagosDePedido: vi.fn(),
  cobrar: vi.fn(),
}));

const MEDIOS = [
  { id: 'm-efe', name: 'Efectivo', kind: 'cash' },
  { id: 'm-tar', name: 'Tarjeta', kind: 'card' },
  { id: 'm-qr', name: 'QR', kind: 'mp' },
  { id: 'm-tra', name: 'Transferencia', kind: 'transfer' },
];

const pedido = (over = {}) => ({
  id: 'o1', code: '104', customer_name: 'Vale', total: 6500, ...over,
});

function montar(props = {}) {
  return render(
    <PantallaDeCobro tenantId="t1" pedido={pedido()} {...props} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  caja.fetchMediosDePago.mockResolvedValue(MEDIOS);
  caja.fetchPagosDePedido.mockResolvedValue([]);
  caja.saldoDelPedido.mockResolvedValue(6500);
  caja.cobrar.mockResolvedValue({ ok: true, pago: { id: 'p1' } });
});

// La region que describe al campo: la ayuda y el aviso viven en el mismo lugar.
const regionDe = (campo) => document.getElementById(campo.getAttribute('aria-describedby'));

describe('PantallaDeCobro — el camino de un toque', () => {
  it('carga el monto con lo que falta', async () => {
    montar();
    const monto = await screen.findByDisplayValue('6500');
    expect(monto).toBeInTheDocument();
  });

  it('cobra el saldo completo con el medio elegido', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Efectivo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    await waitFor(() => expect(caja.cobrar).toHaveBeenCalledWith('t1', 'o1', 'm-efe', 6500));
  });

  it('con un solo medio no hace elegir', async () => {
    caja.fetchMediosDePago.mockResolvedValue([MEDIOS[0]]);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Cobrar \$/ }));
    await waitFor(() => expect(caja.cobrar).toHaveBeenCalledWith('t1', 'o1', 'm-efe', 6500));
  });
});

describe('PantallaDeCobro — el vuelto no se registra', () => {
  it('calcula el vuelto pero cobra el monto de la cuenta', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Efectivo/ }));
    fireEvent.change(screen.getByPlaceholderText('Para calcular el vuelto'), {
      target: { value: '10000' },
    });
    expect(screen.getByText(/Vuelto/)).toBeInTheDocument();
    expect(screen.getByText(/3\.?500/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    // 6500, no 10000: lo entregado nunca sale de la pantalla.
    await waitFor(() => expect(caja.cobrar).toHaveBeenCalledWith('t1', 'o1', 'm-efe', 6500));
  });

  it('avisa cuando lo entregado no alcanza', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Efectivo/ }));
    fireEvent.change(screen.getByPlaceholderText('Para calcular el vuelto'), {
      target: { value: '5000' },
    });
    expect(screen.getByText(/Faltan/)).toBeInTheDocument();
  });

  it('el campo de vuelto solo aparece en efectivo', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Tarjeta/ }));
    expect(screen.queryByPlaceholderText('Para calcular el vuelto')).not.toBeInTheDocument();
  });
});

describe('PantallaDeCobro — cuenta dividida', () => {
  it('un pago parcial deja el resto cargado y la cuenta abierta', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Efectivo/ }));
    fireEvent.change(screen.getByDisplayValue('6500'), { target: { value: '4000' } });

    caja.fetchPagosDePedido.mockResolvedValue([
      { id: 'p1', method_id: 'm-efe', amount: 4000 },
    ]);
    caja.saldoDelPedido.mockResolvedValue(2500);

    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    await waitFor(() => expect(caja.cobrar).toHaveBeenCalledWith('t1', 'o1', 'm-efe', 4000));
    // El siguiente cobro arranca con lo que quedo.
    expect(await screen.findByDisplayValue('2500')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar la cuenta' })).not.toBeInTheDocument();
  });

  it('saldada, ofrece cerrar la cuenta y no el cobro', async () => {
    caja.saldoDelPedido.mockResolvedValue(0);
    caja.fetchPagosDePedido.mockResolvedValue([
      { id: 'p1', method_id: 'm-tar', amount: 6500 },
    ]);
    const onCompletar = vi.fn();
    const onCerrar = vi.fn();
    montar({ onCompletar, onCerrar });

    const cerrar = await screen.findByRole('button', { name: 'Cerrar la cuenta' });
    // Blanco fijo sobre el verde del oscuro da 1.6:1: la tinta va por token.
    expect(cerrar.style.color).toBe('var(--ag-ok-ink)');
    fireEvent.click(cerrar);
    expect(onCompletar).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1' }));
    expect(onCerrar).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Cobrar \$/ })).not.toBeInTheDocument();
  });
});

describe('PantallaDeCobro — referencias conciliables', () => {
  it('tarjeta exige cuatro números y guarda autorización', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Tarjeta/ }));
    fireEvent.change(screen.getByLabelText('Últimos 4 números del comprobante'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    expect(caja.cobrar).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Últimos 4 números del comprobante'), {
      target: { value: '1234' },
    });
    fireEvent.change(screen.getByLabelText('Número de autorización'), {
      target: { value: '928177' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    await waitFor(() => expect(caja.cobrar).toHaveBeenCalledWith(
      't1', 'o1', 'm-tar', 6500, { lastFour: '1234', reference: '928177' },
    ));
  });

  it('QR permite registrar sin referencia para que Caja lo verifique', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^📱 QR$/ }));
    expect(screen.getByText(/Caja lo deja pendiente para revisión/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    await waitFor(() => expect(caja.cobrar).toHaveBeenCalledWith('t1', 'o1', 'm-qr', 6500));
  });

  it('muestra la referencia de un pago ya registrado', async () => {
    caja.fetchPagosDePedido.mockResolvedValue([{
      id: 'p1', method_id: 'm-tar', amount: 6500,
      receipt_last_four: '4312', reference: 'AUT-19',
    }]);
    caja.saldoDelPedido.mockResolvedValue(0);
    montar();
    expect(await screen.findByText(/4312/)).toBeInTheDocument();
    expect(screen.getByText(/AUT-19/)).toBeInTheDocument();
  });
});

describe('PantallaDeCobro — lo que puede salir mal se dice', () => {
  it('sin medios de pago no muestra un boton muerto', async () => {
    caja.fetchMediosDePago.mockResolvedValue([]);
    montar();
    expect(await screen.findByText(/no tiene medios de pago cargados/)).toBeInTheDocument();
  });

  it('avisa que el cobro no entra en ningun arqueo si la caja esta cerrada', async () => {
    montar({ hayTurnoAbierto: false });
    expect(await screen.findByText(/no va a\s+entrar en el arqueo/)).toBeInTheDocument();
  });

  it('muestra el error de la base sin cerrar la pantalla', async () => {
    caja.cobrar.mockResolvedValue({ __error: 'db', message: 'El monto tiene que ser mayor a cero.' });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Efectivo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    expect(await screen.findByText('El monto tiene que ser mayor a cero.')).toBeInTheDocument();
  });

  // P0-2 del smoke del 4/9/2026: se pudo cobrar $58.000 sobre un pedido de
  // $29.000. El tope de verdad esta en `register_payment` (0063); esto mide
  // que la pantalla no lo deje ni intentar.
  it('no deja cobrar mas que el saldo', async () => {
    montar();
    const monto = await screen.findByDisplayValue('6500');
    fireEvent.click(screen.getByRole('button', { name: /Efectivo/ }));
    fireEvent.change(monto, { target: { value: '9000' } });
    expect(await screen.findByText(/No se puede cobrar más que lo que falta/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    expect(caja.cobrar).not.toHaveBeenCalled();
  });

  it('cobra un parcial sin protestar', async () => {
    montar();
    const monto = await screen.findByDisplayValue('6500');
    fireEvent.click(screen.getByRole('button', { name: /Efectivo/ }));
    fireEvent.change(monto, { target: { value: '3000' } });
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    await waitFor(() => expect(caja.cobrar).toHaveBeenCalledWith('t1', 'o1', 'm-efe', 3000));
  });

  it('no cobra sin medio elegido', async () => {
    montar();
    await screen.findByDisplayValue('6500');
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    expect(caja.cobrar).not.toHaveBeenCalled();
  });
});

// Auditoria de Caja (19/oct): Number(String(x).replace(',', '.')) || 0 leia
// "1.500,50" como 0 y "12.500" como 12.5.
describe('PantallaDeCobro — montos en formato argentino', () => {
  it('cobra centavos escritos con coma y punto de miles', async () => {
    montar();
    const monto = await screen.findByDisplayValue('6500');
    fireEvent.click(screen.getByRole('button', { name: /Efectivo/ }));
    fireEvent.change(monto, { target: { value: '1.500,50' } });
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    await waitFor(() => expect(caja.cobrar).toHaveBeenCalledWith('t1', 'o1', 'm-efe', 1500.5));
  });

  it('el vuelto lee el punto de miles', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Efectivo/ }));
    fireEvent.change(screen.getByPlaceholderText('Para calcular el vuelto'), {
      target: { value: '10.000' },
    });
    expect(screen.getByText(/Vuelto \$3\.500/)).toBeInTheDocument();
  });

  it('el saldo con centavos viene cargado en formato argentino y se cobra', async () => {
    caja.saldoDelPedido.mockResolvedValue(6500.5);
    montar();
    expect(await screen.findByDisplayValue('6500,5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Efectivo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$/ }));
    await waitFor(() => expect(caja.cobrar).toHaveBeenCalledWith('t1', 'o1', 'm-efe', 6500.5));
  });

  it('un monto que no se entiende no cobra y dice por que', async () => {
    montar();
    const monto = await screen.findByDisplayValue('6500');
    fireEvent.click(screen.getByRole('button', { name: /Efectivo/ }));
    fireEvent.change(monto, { target: { value: '1,2,3' } });
    const boton = screen.getByRole('button', { name: /^Cobrar/ });
    expect(boton).toBeDisabled();
    const aviso = screen.getByText(/No entiendo ese número/);
    expect(aviso).toHaveTextContent(/1\.500,50/);
    expect(aviso.closest('[aria-live="polite"]')).not.toBeNull();
    expect(monto).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(boton);
    expect(caja.cobrar).not.toHaveBeenCalled();
  });

  it('el aviso del monto entra en una region live que ya estaba montada', async () => {
    // Un aria-live que entra al DOM con el texto adentro no se anuncia en
    // muchos lectores (WCAG 4.1.3): la region tiene que estar antes.
    montar();
    const monto = await screen.findByDisplayValue('6500');
    fireEvent.click(screen.getByRole('button', { name: /Efectivo/ }));
    const region = regionDe(monto);
    expect(region).toHaveAttribute('aria-live', 'polite');
    fireEvent.change(monto, { target: { value: '1,2,3' } });
    expect(regionDe(monto)).toBe(region);
    expect(region).toHaveTextContent(/No entiendo ese número/);
  });

  it('la ayuda y el aviso no se meten en el nombre del campo', async () => {
    montar();
    const monto = await screen.findByDisplayValue('6500');
    fireEvent.click(screen.getByRole('button', { name: /Efectivo/ }));
    fireEvent.change(monto, { target: { value: '1,2,3' } });
    fireEvent.change(screen.getByPlaceholderText('Para calcular el vuelto'), {
      target: { value: '1,2,3' },
    });
    expect(screen.getByRole('textbox', { name: '¿Cuánto cobrás?' }))
      .toHaveAccessibleDescription(/No entiendo ese número/);
    expect(screen.getByRole('textbox', { name: '¿Con cuánto paga? (opcional)' }))
      .toHaveAccessibleDescription(/No entiendo ese número/);
  });

  it('el aviso de lo entregado tambien entra en una region que ya estaba', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Efectivo/ }));
    const entregado = screen.getByPlaceholderText('Para calcular el vuelto');
    const region = regionDe(entregado);
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
    fireEvent.change(entregado, { target: { value: '1,2,3' } });
    expect(regionDe(entregado)).toBe(region);
    expect(region).toHaveTextContent(/No entiendo ese número/);
  });

  it('a medio tipear no avisa error, pero tampoco deja cobrar', async () => {
    montar();
    const monto = await screen.findByDisplayValue('6500');
    fireEvent.click(screen.getByRole('button', { name: /Efectivo/ }));
    fireEvent.change(monto, { target: { value: '1.500,' } });
    expect(screen.queryByText(/No entiendo ese número/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Cobrar/ })).toBeDisabled();
  });

  it('lo entregado que no se entiende avisa y no inventa un vuelto', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Efectivo/ }));
    fireEvent.change(screen.getByPlaceholderText('Para calcular el vuelto'), {
      target: { value: '1,2,3' },
    });
    expect(screen.getByText(/No entiendo ese número/)).toBeInTheDocument();
    expect(screen.queryByText(/Vuelto|Faltan/)).not.toBeInTheDocument();
  });
});
