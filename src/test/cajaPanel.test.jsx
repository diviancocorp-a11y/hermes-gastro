// El turno de caja (Etapa 6d).
//
// Lo que importa que sea cierto: que el faltante se vea, que no se pueda
// cerrar por accidente, y que el conteo de ayer no quede en pantalla para el
// turno de hoy.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CajaPanel from '../components/admin/platform/CajaPanel';

const turno = (over = {}) => ({
  id: 't1', opening_amount: 5000, opened_at: '2026-08-19T13:00:00Z',
  business_day: '2026-08-19', status: 'open', ...over,
});

// La region que describe al campo: la ayuda y el aviso viven en el mismo lugar.
const regionDe = (campo) => document.getElementById(campo.getAttribute('aria-describedby'));

describe('CajaPanel — sin turno', () => {
  it('pide la apertura y explica que poner', () => {
    render(<CajaPanel turno={null} esperado={0} />);
    expect(screen.getByText('CAJA CERRADA')).toBeInTheDocument();
    expect(screen.getByText(/¿Con cuánto arrancás\?/)).toBeInTheDocument();
    expect(screen.getByText(/Si no dejás nada, poné 0/)).toBeInTheDocument();
  });

  it('abre con el monto tipeado', () => {
    const onAbrir = vi.fn();
    render(<CajaPanel turno={null} esperado={0} onAbrir={onAbrir} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir caja' }));
    expect(onAbrir).toHaveBeenCalledWith(5000, null);
  });

  it('el campo no acepta letras', () => {
    render(<CajaPanel turno={null} esperado={0} onAbrir={vi.fn()} />);
    const input = screen.getByPlaceholderText('0');
    fireEvent.change(input, { target: { value: '12a3b' } });
    expect(input.value).toBe('123');
  });

  it('muestra los arqueos previos y marca el que no cerro justo', () => {
    render(<CajaPanel turno={null} esperado={0} turnosPrevios={[
      { id: 'a', business_day: '2026-08-18', difference: 0, status: 'closed' },
      { id: 'b', business_day: '2026-08-17', difference: -200, status: 'closed' },
    ]} />);
    expect(screen.getByText('cerró justo')).toBeInTheDocument();
    expect(screen.getByText(/-\s?\$?\s?200/)).toBeInTheDocument();
  });
});

describe('CajaPanel — turno abierto', () => {
  it('desglosa la apertura y lo cobrado en efectivo', () => {
    // Solo efectivo: lo de tarjeta no esta en el cajon y sumarlo haria que el
    // arqueo diera mal siempre.
    render(<CajaPanel turno={turno()} esperado={12000} />);
    expect(screen.getByText('Apertura')).toBeInTheDocument();
    expect(screen.getByText('Cobrado en efectivo')).toBeInTheDocument();
    expect(screen.getByText('Debería haber')).toBeInTheDocument();
  });

  it('el faltante se muestra, no se esconde', () => {
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '12800' } });
    expect(screen.getByText('Falta')).toBeInTheDocument();
  });

  it('un sobrante tambien se marca', () => {
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '13500' } });
    expect(screen.getByText('Sobra')).toBeInTheDocument();
  });

  it('cuando coincide, lo dice', () => {
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '13000' } });
    expect(screen.getByText('Cierra justo')).toBeInTheDocument();
  });

  it('pregunta el motivo solo cuando hay diferencia', () => {
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={vi.fn()} />);
    expect(screen.queryByText(/¿Sabés por qué\?/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '12800' } });
    expect(screen.getByText(/¿Sabés por qué\?/)).toBeInTheDocument();
  });

  it('no se puede cerrar sin contar', () => {
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Cerrar caja/ })).toBeDisabled();
  });

  it('cerrar pide confirmacion: no se termina el turno de un toque', () => {
    // Cerrar la caja no se deshace.
    const onCerrar = vi.fn();
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={onCerrar} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '12800' } });

    fireEvent.click(screen.getByRole('button', { name: /Cerrar caja/ }));
    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /¿Seguro\?/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /¿Seguro\?/ }));
    expect(onCerrar).toHaveBeenCalledWith(12800, null);
  });

  it('cambiar el conteo cancela la confirmacion pendiente', () => {
    const onCerrar = vi.fn();
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={onCerrar} />);
    const input = screen.getByPlaceholderText('0');

    fireEvent.change(input, { target: { value: '12800' } });
    fireEvent.click(screen.getByRole('button', { name: /Cerrar caja/ }));
    fireEvent.change(input, { target: { value: '13000' } });

    // Vuelve a "Cerrar caja": si quedara armado, corregir el conteo cerraria
    // la caja con el numero equivocado.
    expect(screen.getByRole('button', { name: /Cerrar caja/ })).toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('el motivo viaja con el cierre', () => {
    const onCerrar = vi.fn();
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={onCerrar} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '12800' } });
    fireEvent.change(screen.getByPlaceholderText(/Se pagó un flete/), {
      target: { value: 'se pagó un flete' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cerrar caja/ }));
    fireEvent.click(screen.getByRole('button', { name: /¿Seguro\?/ }));
    expect(onCerrar).toHaveBeenCalledWith(12800, 'se pagó un flete');
  });

  it('al cambiar de turno se limpia el conteo anterior', () => {
    // Dejar el numero de ayer en pantalla es la forma mas facil de cerrar el
    // turno de hoy con el conteo equivocado.
    const { rerender } = render(<CajaPanel turno={turno()} esperado={13000} onCerrar={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '12800' } });

    rerender(<CajaPanel turno={turno({ id: 't2' })} esperado={0} onCerrar={vi.fn()} />);
    expect(screen.getByPlaceholderText('0').value).toBe('');
  });
});

// Lo que encontro la auditoria del 19/oct, accion por accion.
describe('CajaPanel — montos en formato argentino', () => {
  it('abre con centavos escritos con coma', () => {
    const onAbrir = vi.fn();
    render(<CajaPanel turno={null} esperado={0} onAbrir={onAbrir} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1500,50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir caja' }));
    expect(onAbrir).toHaveBeenCalledWith(1500.5, null);
  });

  it('el punto de miles no se lee como decimal', () => {
    const onAbrir = vi.fn();
    render(<CajaPanel turno={null} esperado={0} onAbrir={onAbrir} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '12.500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir caja' }));
    expect(onAbrir).toHaveBeenCalledWith(12500, null);
  });

  it('vacio abre con 0, como dice la ayuda', () => {
    const onAbrir = vi.fn();
    render(<CajaPanel turno={null} esperado={0} onAbrir={onAbrir} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir caja' }));
    expect(onAbrir).toHaveBeenCalledWith(0, null);
  });

  it('un numero que no se entiende no abre y dice por que', () => {
    const onAbrir = vi.fn();
    render(<CajaPanel turno={null} esperado={0} onAbrir={onAbrir} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1,2,3' } });
    expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeDisabled();
    expect(screen.getByText(/No entiendo ese número/)).toHaveTextContent(/1\.500,50/);
    expect(screen.getByPlaceholderText('0')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir caja' }));
    expect(onAbrir).not.toHaveBeenCalled();
  });

  it('el aviso entra en una region live que ya estaba montada', () => {
    // Un aria-live que entra al DOM con el texto adentro no se anuncia en
    // muchos lectores (WCAG 4.1.3): la region tiene que estar antes.
    render(<CajaPanel turno={null} esperado={0} onAbrir={vi.fn()} />);
    const campo = screen.getByPlaceholderText('0');
    const region = regionDe(campo);
    expect(region).toHaveAttribute('aria-live', 'polite');
    fireEvent.change(campo, { target: { value: '1,2,3' } });
    expect(regionDe(campo)).toBe(region);
    expect(region).toHaveTextContent(/No entiendo ese número/);
  });

  it('la ayuda y el aviso no se meten en el nombre del campo', () => {
    // Dentro del <label>, el lector los leia como parte del nombre y despues
    // otra vez como descripcion, y el nombre cambiaba al equivocarse.
    const { unmount } = render(<CajaPanel turno={null} esperado={0} onAbrir={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1,2,3' } });
    expect(screen.getByRole('textbox', { name: '¿Con cuánto arrancás?' }))
      .toHaveAccessibleDescription(/No entiendo ese número/);
    unmount();
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1,2,3' } });
    expect(screen.getByRole('textbox', { name: '¿Cuánto contaste?' }))
      .toHaveAccessibleDescription(/No entiendo ese número/);
  });

  it('al cerrar, el aviso tambien entra en una region que ya estaba', () => {
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={vi.fn()} />);
    const campo = screen.getByPlaceholderText('0');
    const region = regionDe(campo);
    expect(region).toHaveAttribute('aria-live', 'polite');
    fireEvent.change(campo, { target: { value: '1,2,3' } });
    expect(regionDe(campo)).toBe(region);
    expect(region).toHaveTextContent(/No entiendo ese número/);
  });

  it('a medio tipear no avisa error, pero tampoco deja abrir', () => {
    // "1.500,50" pasa por "1." y "1.500,": no es un error, todavia no termino.
    render(<CajaPanel turno={null} esperado={0} onAbrir={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1.500,' } });
    expect(screen.queryByText(/No entiendo ese número/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeDisabled();
  });

  it('cierra con el conteo en formato argentino y la diferencia sale bien', () => {
    const onCerrar = vi.fn();
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={onCerrar} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '12.800,50' } });
    expect(screen.getByText('Falta')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cerrar caja/ }));
    fireEvent.click(screen.getByRole('button', { name: /¿Seguro\?/ }));
    expect(onCerrar).toHaveBeenCalledWith(12800.5, null);
  });

  it('un conteo que no se entiende no deja cerrar', () => {
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1.2.3' } });
    expect(screen.getByRole('button', { name: /Cerrar caja/ })).toBeDisabled();
    expect(screen.queryByText('Falta')).not.toBeInTheDocument();
  });
});

describe('CajaPanel — doble toque', () => {
  const pendiente = () => {
    let resolver;
    const promesa = new Promise((r) => { resolver = r; });
    return { promesa, resolver };
  };

  it('abrir no se dispara dos veces mientras corre la llamada', async () => {
    const { promesa, resolver } = pendiente();
    const onAbrir = vi.fn(() => promesa);
    render(<CajaPanel turno={null} esperado={0} onAbrir={onAbrir} />);
    const boton = screen.getByRole('button', { name: 'Abrir caja' });

    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(onAbrir).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Abriendo/ })).toBeDisabled();

    await act(async () => { resolver(); await promesa; });
    expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeEnabled();
  });

  it('el toque de confirmacion de cerrar no se dispara dos veces', async () => {
    const { promesa, resolver } = pendiente();
    const onCerrar = vi.fn(() => promesa);
    render(<CajaPanel turno={turno()} esperado={13000} onCerrar={onCerrar} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '13000' } });
    fireEvent.click(screen.getByRole('button', { name: /Cerrar caja/ }));

    const confirmar = screen.getByRole('button', { name: /¿Seguro\?/ });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    expect(onCerrar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Cerrando/ })).toBeDisabled();

    await act(async () => { resolver(); await promesa; });
  });
});

describe('CajaPanel — hora del local', () => {
  const AR = 'America/Argentina/Buenos_Aires';

  it('"desde" muestra la hora del local, no la UTC', () => {
    // 13:00 UTC son las 10:00 en Buenos Aires.
    render(<CajaPanel turno={turno({ opened_at: '2026-08-19T13:00:00Z' })}
      esperado={0} timezone={AR} />);
    expect(screen.getByText(/desde 10:00/)).toBeInTheDocument();
    expect(screen.queryByText(/desde 13:00/)).not.toBeInTheDocument();
  });

  it('un arqueo viejo sin business_day toma el dia del local', () => {
    // 02:00 UTC del 19 es todavia el 18 a la noche en Buenos Aires.
    render(<CajaPanel turno={null} esperado={0} timezone={AR} turnosPrevios={[
      { id: 'v', opened_at: '2026-08-19T02:00:00Z', difference: 0, status: 'closed' },
    ]} />);
    expect(screen.getByText('2026-08-18')).toBeInTheDocument();
  });

  it('una zona mal cargada no deja la caja sin pantalla', () => {
    render(<CajaPanel turno={turno()} esperado={0} timezone="Marte/Olympus" />);
    expect(screen.getByText(/desde \d{2}:\d{2}/)).toBeInTheDocument();
  });
});

describe('CajaPanel — tokens del panel', () => {
  // #fff sobre el rojo del tema oscuro daba 2.77:1: la tinta va con el tema.
  it('el texto de la confirmacion de cierre usa la tinta del rojo', () => {
    render(<CajaPanel turno={turno()} esperado={0} onCerrar={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /Cerrar caja/ }));
    const confirmar = screen.getByRole('button', { name: /¿Seguro\?/ });
    expect(confirmar.style.color).toBe('var(--ag-bad-ink)');
  });

  // cp-root es la raiz del catalogo: en el admin pinta fondo blanco e Inter,
  // y en tema oscuro deja la supervision a 1.17:1.
  it('no usa la raiz del catalogo, con o sin turno', () => {
    const { container, rerender } = render(<CajaPanel turno={null} esperado={0} />);
    expect(container.querySelector('.cp-root')).toBeNull();
    rerender(<CajaPanel turno={turno()} esperado={0} />);
    expect(container.querySelector('.cp-root')).toBeNull();
  });
});
