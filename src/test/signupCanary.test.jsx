import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
const signupService = vi.hoisted(() => ({ slugDisponible: vi.fn(), registrarNegocio: vi.fn(), googleDisponible: vi.fn(), iniciarRegistroGoogle: vi.fn(), cuentaGoogleActual: vi.fn(), registrarNegocioConGoogle: vi.fn() }));
vi.mock('../services/signup', () => signupService);
import _Signup from '../pages/Signup';
const signupCss = readFileSync('src/styles/signup.css', 'utf8');
const diag = '11111111-1111-4111-8111-111111111111';
async function montar() { await act(async () => render(<_Signup />)); }
async function cuenta() {
  fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana Pérez' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'hola@cafeuno.com' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'segura123' } });
  fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
}
async function negocio() {
  fireEvent.change(screen.getByLabelText('Nombre de tu negocio'), { target: { value: 'Café Uno' } });
  fireEvent.click(screen.getByRole('button', { name: 'Servicios' }));
  fireEvent.click(screen.getByRole('button', { name: 'A distancia' }));
  fireEvent.change(screen.getByLabelText('País y moneda'), { target: { value: 'UY' } });
  await act(async () => vi.advanceTimersByTimeAsync(400));
}
beforeEach(() => {
  vi.useFakeTimers(); sessionStorage.clear(); window.history.replaceState({}, '', '/registro');
  signupService.slugDisponible.mockReset().mockResolvedValue(true);
  signupService.registrarNegocio.mockReset().mockResolvedValue({ ok: true, needsConfirmation: true });
  signupService.googleDisponible.mockReset().mockResolvedValue(false);
  signupService.iniciarRegistroGoogle.mockReset().mockResolvedValue({ ok: true });
  signupService.cuentaGoogleActual.mockReset().mockResolvedValue({ ok: false, error: 'No se completó Google.' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); window.history.replaceState({}, '', '/'); });
describe('registro en tres pasos', () => {
  it('usa los tokens y el logo oficial', async () => {
    for (const font of ['ui', 'soul', 'technical']) expect(signupCss).toContain(`var(--ds-font-${font})`);
    expect(signupCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    await montar(); expect(document.querySelector('.signup-logo img')).toHaveAttribute('src', '/brand/dico/logo/dico-oscuro.png');
    expect(screen.getByRole('heading', { name: /Tu negocio empieza acá/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Saludar a Dico' })).not.toBeInTheDocument();
  });
  it('valida la cuenta antes de mostrar el negocio y conserva sus valores al volver', async () => {
    await montar(); fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByText('Escribí un email válido.')).toBeInTheDocument();
    expect(signupService.registrarNegocio).not.toHaveBeenCalled();
    await cuenta(); expect(screen.getByLabelText('País y moneda')).toHaveValue('AR');
    expect(screen.getByRole('button', { name: 'Gastronomía' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'En un local' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a tu cuenta' }));
    expect(screen.getByLabelText('Email')).toHaveValue('hola@cafeuno.com');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('segura123');
  });
  it('separa el plan de la cuenta y permite crear el negocio sin contratar ni cobrar', async () => {
    await montar();
    expect(screen.queryByRole('button', { name: 'Cambiar', exact: true })).not.toBeInTheDocument();
    await cuenta(); await negocio();
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByRole('heading', { name: 'Confirmá tu comienzo' })).toBeInTheDocument();
    expect(screen.getByText('Café Uno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear mi cuenta/ })).toBeEnabled();
    expect(signupService.registrarNegocio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a tu negocio' }));
    expect(screen.getByLabelText('País y moneda')).toHaveValue('UY');
    expect(screen.getByRole('button', { name: 'A distancia' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Servicios' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Nombre de tu negocio')).toHaveValue('Café Uno');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Crear mi cuenta/ })));
    expect(signupService.registrarNegocio).toHaveBeenCalledWith(expect.objectContaining({ bizName: 'Café Uno', country: 'UY', currency: 'UYU', plan: 'digital', periodo: 'mensual' }));
    expect(screen.getByRole('heading', { name: 'Revisá tu email' })).toBeInTheDocument();
  });
  it('precarga solo el diagnostico correcto y permite cambiar plan y datos', async () => {
    sessionStorage.setItem('dico:diagnostico-v2-en-curso', JSON.stringify({ id: diag, respuestas: { nombre_negocio: 'La Esquina', contacto_nombre: 'Ricardo', vertical: 'gastronomia', canales: ['salon', 'catalogo_online'], locales: 'dos_tres' } }));
    window.history.replaceState({}, '', `/registro?d=${diag}&plan=cadena&rubro=gastro&negocio=La+Esquina`);
    await montar(); expect(screen.getByLabelText('Tu nombre')).toHaveValue('Ricardo');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ricardo@ejemplo.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'segura123' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByLabelText('Nombre de tu negocio')).toHaveValue('La Esquina');
    expect(screen.getByRole('button', { name: 'Ambas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: /Cadena/ })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /Digital/ }));
    expect(screen.getByLabelText('Período de pago')).toHaveValue('mensual');
    expect(screen.queryByRole('option', { name: 'Anual' })).not.toBeInTheDocument();
  });
  it('no deja que una comprobacion vieja de enlace pise la nueva', async () => {
    let resolverViejo;
    signupService.slugDisponible.mockImplementation(slug => slug === 'viejo' ? new Promise(resolve => { resolverViejo = resolve; }) : Promise.resolve(true));
    await montar(); await cuenta();
    fireEvent.change(screen.getByLabelText('Nombre de tu negocio'), { target: { value: 'Viejo' } });
    await act(async () => vi.advanceTimersByTimeAsync(400));
    fireEvent.change(screen.getByLabelText('Nombre de tu negocio'), { target: { value: 'Nuevo' } });
    await act(async () => vi.advanceTimersByTimeAsync(400));
    await act(async () => resolverViejo(false));
    expect(screen.getByText('El enlace está disponible.')).toBeInTheDocument();
    expect(screen.getByText('nuevo.divianco.app')).toBeInTheDocument();
  });
  it('solo ofrece Google si esta habilitado y guarda un borrador sin contraseña', async () => {
    signupService.googleDisponible.mockResolvedValue(true); await montar();
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto123' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' })));
    const borrador = sessionStorage.getItem('dico:registro-google');
    expect(borrador).toContain('Ana'); expect(borrador).not.toMatch(/secreto123|password|token/);
    expect(signupService.iniciarRegistroGoogle).toHaveBeenCalledOnce();
  });
  it('al volver de Google pasa al negocio con el email verificado sin pedir contraseña', async () => {
    window.history.replaceState({}, '', '/registro?oauth=google');
    signupService.cuentaGoogleActual.mockResolvedValue({ ok: true, email: 'ana@gmail.com', nombre: 'Ana' });
    await montar(); expect(screen.getByRole('heading', { name: 'Prepará tu negocio' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a tu cuenta' }));
    expect(screen.getByLabelText('Email')).toHaveValue('ana@gmail.com');
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
  });
});
