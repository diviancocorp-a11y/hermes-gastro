// La puerta de entrada al panel.
//
// Lo que importa que sea cierto:
//   - que se pueda recuperar la contraseña SIN salir de acá, porque quien no
//     puede entrar tampoco puede ir a buscar el link a ningún otro lado;
//   - que pedir el reset NO revele si esa dirección tiene cuenta — el aviso
//     tiene que ser el mismo en los dos casos, si no la pantalla se convierte
//     en un verificador de correos registrados;
//   - que donde iba la inicial del negocio esté Dico, y que salude;
//   - que la marca del splash sea DICO y no la de Hermes;
//   - que el aro Volt de Dico este vivo, y que conteste al gesto;
//   - que la entrada dure lo que tarda en verse: el logo y DOS latidos.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import LoginScreen from '../components/admin/LoginScreen';
import { TIEMPOS } from '../components/admin/tiemposDeEntrada';

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

describe('LoginScreen — el aro Volt', () => {
  const aroDelSplash = (c) => c.querySelector('.hg-splash-aro');
  const aroDeLaPlaca = (c) => c.querySelector('[data-dico-native] [data-dico-pulso]');

  afterEach(() => { vi.useRealTimers(); });

  it('el aro de la O se enciende en la entrada', () => {
    // El pulso es una CAPA sobre el PNG: el arte no se repinta. Que exista el
    // overlay y este en `active` es lo que hace que el logo entre latiendo.
    const { container } = render(<LoginScreen onLogin={() => {}} />);
    const aro = aroDelSplash(container);
    expect(aro).toBeInTheDocument();
    expect(aro.getAttribute('data-dico-pulso')).toBe('active');
  });

  it('el aro del splash cae SOBRE el aro del arte, no en cualquier lado', () => {
    // Los numeros salen de medir los pixeles azules de la O (ver `ARO_LOGO`).
    // El radio sobre el medio-ancho del personaje tiene que dar el mismo
    // r/R 0,67 que `DicoNative` midio sobre los assets 2D: si alguien cambia
    // el PNG del logo y no vuelve a medir, esto deja de cerrar.
    const { container } = render(<LoginScreen onLogin={() => {}} />);
    const aro = aroDelSplash(container);
    const r = Number(aro.querySelector('circle').getAttribute('r'));
    expect(r / 50).toBeGreaterThan(0.64);
    expect(r / 50).toBeLessThan(0.70);
    // La caja tiene que ser cuadrada: el SVG no declara `preserveAspectRatio`,
    // asi que en una caja rectangular el navegador lo encaja con letterbox y
    // el aro queda corrido respecto del arte.
    expect(aro.parentElement.style.aspectRatio.replace(/\s/g, '')).toBe('1/1');
  });

  it('la entrada dura el logo MAS dos latidos enteros', () => {
    // El defecto que esto evita es el de la primera version: 1,4s de entrada
    // contra un latido de 2,8s — la pantalla se iba antes de que el aro
    // llegara a encenderse una vez.
    expect(TIEMPOS.latidos).toBeGreaterThanOrEqual(2);
    expect(TIEMPOS.intro).toBe(TIEMPOS.entrada + TIEMPOS.latido * TIEMPOS.latidos);

    // Y que el latido ESPERE a que el logo se asiente: si arrancara junto con
    // la entrada, el primero de los dos pasaria mientras el logo todavia se
    // esta acomodando y no se veria.
    const { container } = render(<LoginScreen onLogin={() => {}} />);
    const css = container.querySelector('style').textContent;
    expect(css).toContain(`animation-duration: ${TIEMPOS.latido}ms`);
    expect(css).toContain(`animation-delay: ${TIEMPOS.entrada}ms`);
    expect(css).toContain(`animation-iteration-count: ${TIEMPOS.latidos}`);
  });

  it('el formulario recien se puede tocar cuando termino la entrada', async () => {
    vi.useFakeTimers();
    render(<LoginScreen onLogin={() => {}} />);
    const form = screen.getByRole('button', { name: 'Entrar' }).closest('form');

    await act(async () => { vi.advanceTimersByTime(TIEMPOS.intro - 100); });
    expect(form.style.pointerEvents).toBe('none');

    await act(async () => { vi.advanceTimersByTime(200); });
    expect(form.style.pointerEvents).toBe('auto');
  });

  it('en la placa el aro gira: del otro lado hay algo encendido', () => {
    const { container } = render(<LoginScreen onLogin={() => {}} />);
    expect(aroDeLaPlaca(container).getAttribute('data-dico-pulso')).toBe('processing');
  });

  it('al pasarle el mouse deja de girar y LATE: Dico contesta', () => {
    const { container } = render(<LoginScreen onLogin={() => {}} />);
    const placa = container.querySelector('[data-dico-native]').closest('.ms-trace');

    fireEvent.mouseEnter(placa);
    expect(aroDeLaPlaca(container).getAttribute('data-dico-pulso')).toBe('active');
    // Y al irse vuelve a girar: el hover es una respuesta, no un interruptor.
    fireEvent.mouseLeave(placa);
    expect(aroDeLaPlaca(container).getAttribute('data-dico-pulso')).toBe('processing');
  });
});
