// La puerta de entrada al panel.
//
// Lo que importa que sea cierto:
//   - que se pueda recuperar la contraseña SIN salir de acá, porque quien no
//     puede entrar tampoco puede ir a buscar el link a ningún otro lado;
//   - que pedir el reset NO revele si esa dirección tiene cuenta — el aviso
//     tiene que ser el mismo en los dos casos, si no la pantalla se convierte
//     en un verificador de correos registrados;
//   - que donde iba la inicial del negocio esté Dico, y que salude;
//   - que la marca del splash sea DICO y no la de Hermes.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginScreen from '../components/admin/LoginScreen';

const login = vi.fn();
const pedirResetPassword = vi.fn();
const fetchTenantBrand = vi.fn();

vi.mock('../lib/adminService', () => ({ login: (...a) => login(...a) }));
vi.mock('../services/signup', () => ({ pedirResetPassword: (...a) => pedirResetPassword(...a) }));
vi.mock('../services/platformSettings', () => ({ fetchTenantBrand: (...a) => fetchTenantBrand(...a) }));
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) },
}));

// El canvas de partículas no aporta nada a estos contratos y en jsdom no hay
// contexto 2D: se reemplaza por un div para no llenar la salida de ruido.
vi.mock('../components/admin/FlowFieldBackground', () => ({
  default: (props) => <div data-flow="" data-color={props.color} data-pulso={props.pulseColor} data-pulso-n={String(props.pulseSize)} />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  fetchTenantBrand.mockResolvedValue(null);
  pedirResetPassword.mockResolvedValue({ ok: true });
});

describe('LoginScreen — la marca', () => {
  it('el splash es el logo DICO, no el de Hermes', () => {
    const { container } = render(<LoginScreen onLogin={() => {}} />);
    const logo = container.querySelector('img[alt="DICO"]');
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute('src')).toBe('/brand/dico/logo/dico-oscuro.png');
    // Dimensiones declaradas: sin ellas el splash salta cuando carga el PNG.
    expect(logo.getAttribute('width')).toBe('1368');
    expect(logo.getAttribute('height')).toBe('452');
  });

  it('las venas son volt y el pulso que las recorre es oro', () => {
    // Las particulas NO llevan acento: son todas del mismo color. El oro es
    // el pulso, que es un grupo aparte y viaja junto — ver la cabecera de
    // `FlowFieldBackground`.
    const { container } = render(<LoginScreen onLogin={() => {}} />);
    const flujo = container.querySelector('[data-flow]');
    expect(flujo.getAttribute('data-color')).toBe('#60A5FA');
    expect(flujo.getAttribute('data-pulso')).toBe('#E8B947');
    expect(Number(flujo.getAttribute('data-pulso-n'))).toBeGreaterThan(1);
  });

  it('sin logo del negocio, en la placa esta DICO y no una inicial', () => {
    const { container } = render(<LoginScreen onLogin={() => {}} />);
    expect(container.querySelector('[data-dico-native]')).toBeInTheDocument();
  });

  it('al pasar el mouse por la placa, Dico saluda', () => {
    const { container } = render(<LoginScreen onLogin={() => {}} />);
    const placa = container.querySelector('[data-dico-native]').closest('.ms-trace');

    expect(container.querySelector('[data-dico-native="neutral"]')).toBeInTheDocument();
    fireEvent.mouseEnter(placa);
    expect(container.querySelector('[data-dico-native="happy"]')).toBeInTheDocument();
    fireEvent.mouseLeave(placa);
    expect(container.querySelector('[data-dico-native="neutral"]')).toBeInTheDocument();
  });
});

describe('LoginScreen — recuperar la contraseña', () => {
  it('se pide desde acá, sin irse a otra pantalla', async () => {
    render(<LoginScreen onLogin={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }));
    // La contraseña deja de pedirse: lo único que hace falta es el mail.
    expect(screen.queryByPlaceholderText('Contraseña')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'dueno@local.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme el mail' }));

    await waitFor(() => expect(pedirResetPassword).toHaveBeenCalledWith('dueno@local.test'));
  });

  it('el aviso NO confirma si esa direccion tiene cuenta', async () => {
    render(<LoginScreen onLogin={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }));
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'existe@local.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme el mail' }));

    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent(/si esa dirección tiene cuenta/i);
    // Ni el correo ni una confirmación: con cualquiera de las dos, la pantalla
    // sirve para averiguar qué direcciones estan registradas.
    expect(aviso.textContent).not.toContain('existe@local.test');
    expect(aviso.textContent).not.toMatch(/te enviamos|enviado a|tu cuenta/i);
  });

  it('el error del servicio se muestra y no se traga', async () => {
    // Un email con forma valida: el navegador no deja ni enviar el formulario
    // con uno mal escrito, asi que ese caso no llega nunca al servicio. Lo que
    // si llega es lo que falla del otro lado —el rate limit, por ejemplo—.
    pedirResetPassword.mockResolvedValue({ ok: false, error: 'Esperá un minuto antes de volver a pedirlo.' });
    render(<LoginScreen onLogin={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }));
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'dueno@local.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme el mail' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esperá un minuto antes de volver a pedirlo.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('se vuelve al login, y el aviso no queda colgado', async () => {
    render(<LoginScreen onLogin={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }));
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'dueno@local.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme el mail' }));
    await screen.findByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Volver a entrar' }));
    expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('entrar sigue siendo entrar: no se rompio el camino normal', async () => {
    login.mockResolvedValue({ ok: true });
    const onLogin = vi.fn();
    render(<LoginScreen onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'dueno@local.test' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'secreta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(onLogin).toHaveBeenCalled());
    expect(login).toHaveBeenCalledWith('dueno@local.test', 'secreta');
  });
});
