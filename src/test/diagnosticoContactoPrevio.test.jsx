import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Diagnostico from '../components/landing/Diagnostico';
import { supabase } from '../lib/supabase';
import { marcarEvento } from '../lib/analiticaPlataforma';

vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('../lib/analiticaPlataforma', () => ({ marcarEvento: vi.fn() }));
vi.mock('../components/landing/ShaderBackground', () => ({ default: () => <canvas data-testid="efecto-hero" /> }));
const base = { vertical: 'gastronomia', establecimiento: 'restaurante', desafio: 'costos', senal: 'mensual', canales: ['salon'], locales: 'uno', equipo: 'hasta_5', gestion_actual: 'planillas', venta_mensual: 'no_se', urgencia: 'este_mes', decisor: 'yo', nombre_negocio: '' };
function montar(cambios = {}, historia = 7) {
  sessionStorage.setItem('dico:diagnostico-v2-en-curso', JSON.stringify({ version: 2, respuestas: { ...base, ...cambios } }));
  window.history.replaceState({ dg: historia }, '');
  render(createElement(Diagnostico));
}
function completar(nombreNegocio = '') {
  fireEvent.change(screen.getByRole('textbox', { name: /Nombre del negocio/ }), { target: { value: nombreNegocio } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Tu nombre' }), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Tu WhatsApp' }), { target: { value: '+54 (9) 11-1234-5678' } });
  fireEvent.click(screen.getByRole('checkbox'));
}
const enviar = async () => act(async () => fireEvent.click(screen.getByRole('button', { name: /Ver mi diagnóstico/ })));
beforeEach(() => {
  vi.useFakeTimers(); sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks();
  window.scrollTo = vi.fn();
  supabase.functions.invoke.mockImplementation((_nombre, { body }) => Promise.resolve({ data: body.accion === 'contacto' ? { ok: true } : { id: 'diag-test', contacto_token: 'capacidad-test' }, error: null }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); window.history.replaceState({}, ''); });

describe('contacto antes del resultado', () => {
  it('exige nombre, telefono y autorizacion; el negocio queda opcional', async () => {
    montar(); await enviar();
    expect(screen.getByText(/al menos dos caracteres/)).toBeInTheDocument();
    expect(screen.getByText(/Necesitamos tu autorización/)).toBeInTheDocument();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    completar(); await enviar();
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
    const cuerpos = supabase.functions.invoke.mock.calls.map(c => c[1].body);
    expect(cuerpos[0]).not.toHaveProperty('contacto_nombre');
    expect(cuerpos[1]).toMatchObject({ accion: 'contacto', id: 'diag-test', token: 'capacidad-test', nombre: 'Ana', whatsapp: '+5491112345678', consentimiento: true });
    expect(document.querySelector('.dg-guia .dg-analisis-mensaje')).not.toBeNull();
    expect(screen.getByTestId('efecto-hero')).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(9600));
    expect(screen.getByText('Ana, esto es lo primero que resolvería para tu negocio.')).toBeInTheDocument();
    const enlace = screen.getByRole('link', { name: /Empezar con Dico/ }).getAttribute('href');
    expect(enlace).not.toMatch(/Ana|12345678|capacidad/);
    expect(marcarEvento.mock.calls.flat().join(' ')).not.toMatch(/Ana|12345678|capacidad/);
  });
  it('personaliza el mensaje y el resultado con el nombre del local', async () => {
    montar(); completar('La Esquina'); await enviar();
    await act(async () => vi.advanceTimersByTime(9600));
    expect(screen.getByText('Esto es lo primero que resolvería para La Esquina.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Un punto de partida para La Esquina.' })).toBeInTheDocument();
    expect(document.querySelector('.dg-resultado-intro')).toHaveTextContent('Ana, según tus respuestas');
    const guardados = supabase.functions.invoke.mock.calls.length;
    cleanup();
    render(createElement(Diagnostico));
    expect(screen.getByRole('heading', { name: 'Un punto de partida para La Esquina.' })).toBeInTheDocument();
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(guardados);
  });
  it('conserva datos si falla el contacto y reintenta sin duplicar el diagnostico', async () => {
    let falla = true;
    supabase.functions.invoke.mockImplementation((_nombre, { body }) => Promise.resolve(body.accion === 'contacto' ? { data: { ok: !falla }, error: null } : { data: { id: 'diag-test', contacto_token: 'capacidad-test' }, error: null }));
    montar(); completar('La Esquina'); await enviar();
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos guardar tus datos');
    expect(screen.getByRole('textbox', { name: 'Tu nombre' })).toHaveValue('Ana');
    falla = false; await enviar(); await act(async () => vi.advanceTimersByTime(9600));
    expect(screen.getByRole('heading', { name: 'Lo que entendimos' })).toBeInTheDocument();
    expect(supabase.functions.invoke.mock.calls.filter(c => c[1].body.accion !== 'contacto')).toHaveLength(1);
  });
  it('no entrega el resultado mientras el contacto siga pendiente, aunque termine la animacion', async () => {
    let resolver;
    supabase.functions.invoke.mockImplementation((_nombre, { body }) => body.accion === 'contacto' ? new Promise(r => { resolver = r; }) : Promise.resolve({ data: { id: 'diag-test', contacto_token: 'capacidad-test' } }));
    montar(); completar(); await enviar();
    await act(async () => vi.advanceTimersByTime(12000));
    expect(screen.queryByRole('heading', { name: 'Lo que entendimos' })).not.toBeInTheDocument();
    await act(async () => resolver({ data: { ok: true }, error: null }));
    expect(screen.getByRole('heading', { name: 'Lo que entendimos' })).toBeInTheDocument();
  });
  it('una recarga antes de confirmar el contacto devuelve al ultimo paso', () => {
    montar({ contacto_nombre: 'Ana', contacto_whatsapp: '+5491112345678', contacto_consentimiento: true }, 'resultado');
    expect(screen.getByRole('textbox', { name: 'Tu nombre' })).toHaveValue('Ana');
    expect(screen.queryByRole('heading', { name: 'Lo que entendimos' })).not.toBeInTheDocument();
  });
});
