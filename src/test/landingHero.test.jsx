import { createElement, createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Diagnostico from '../components/landing/Diagnostico';

vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('../lib/analiticaPlataforma', () => ({ marcarEvento: vi.fn() }));

function Portada({ onAbrir }) {
  return <button type="button" data-abrir onClick={onAbrir}>Quiero Dico</button>;
}

function montar() {
  const abrirRef = createRef();
  render(createElement(Diagnostico, { modo: 'home', Portada, abrirRef }));
  return abrirRef;
}

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '');
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  delete document.startViewTransition;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('hero y diagnóstico comparten un solo recorrido', () => {
  it('abre con foco y un CTA de otra sección conserva la pregunta y la respuesta', () => {
    const abrirRef = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    expect(screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveFocus();
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    const pregunta = screen.getByRole('heading', { name: '¿Qué es lo que más te preocupa hoy?' });
    act(() => abrirRef.current());
    expect(pregunta).toHaveFocus();
    expect(screen.getByText('Pregunta 2 de 8')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('dico:diagnostico-en-curso')).respuestas.vertical).toBe('gastronomia');
  });

  it('volver al inicio devuelve el foco al CTA y las respuestas sobreviven al reabrir', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Quiero Dico' })).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    expect(screen.getByRole('heading', { name: '¿Qué es lo que más te preocupa hoy?' })).toHaveFocus();
    expect(JSON.parse(sessionStorage.getItem('dico:diagnostico-en-curso')).respuestas.vertical).toBe('gastronomia');
  });

  it('la mejora visual hace una sola entrada de historial y una sola pregunta real', () => {
    document.startViewTransition = vi.fn((actualizar) => {
      actualizar();
      return { finished: Promise.resolve() };
    });
    const push = vi.spyOn(window.history, 'pushState');
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    expect(document.startViewTransition).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveLength(1);
  });

  it('dos clics antes del callback visual producen una sola apertura', () => {
    let actualizar;
    document.startViewTransition = vi.fn((callback) => {
      actualizar = callback;
      return { finished: Promise.resolve() };
    });
    const push = vi.spyOn(window.history, 'pushState');
    montar();
    const boton = screen.getByRole('button', { name: 'Quiero Dico' });
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(document.startViewTransition).toHaveBeenCalledOnce();
    act(() => actualizar());
    expect(push).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveFocus();
  });

  it('un rechazo asíncrono antes del callback también abre el formulario', async () => {
    document.startViewTransition = vi.fn(() => ({
      updateCallbackDone: Promise.reject(new Error('Transición cancelada')),
      finished: Promise.resolve(),
    }));
    const push = vi.spyOn(window.history, 'pushState');
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveFocus());
    expect(push).toHaveBeenCalledOnce();
  });

  it('movimiento reducido conserva el recorrido sin iniciar la transición', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    document.startViewTransition = vi.fn();
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    expect(document.startViewTransition).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveFocus();
  });

  it('una API de transición que falla no impide abrir ni duplica el historial', () => {
    document.startViewTransition = vi.fn(() => { throw new Error('No disponible'); });
    const push = vi.spyOn(window.history, 'pushState');
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    expect(screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveFocus();
    expect(push).toHaveBeenCalledOnce();
  });
});
