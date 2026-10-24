import { createElement, createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Diagnostico from '../components/landing/Diagnostico';
import EscenaHero from '../components/landing/EscenaHero';

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


describe('parallax fotográfico', () => {
  let preferencia;
  let visibilidad;
  let cuadro;
  let animaciones;
  let animar;
  let desconectar;
  let animateOriginal;

  beforeEach(() => {
    animateOriginal = Element.prototype.animate;
    animaciones = [];
    animar = vi.fn(() => {
      const animacion = { pause: vi.fn(), cancel: vi.fn(), currentTime: 0 };
      animaciones.push(animacion);
      return animacion;
    });
    Element.prototype.animate = animar;
    preferencia = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => preferencia));
    desconectar = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback) { visibilidad = callback; }
      observe() {}
      disconnect() { desconectar(); }
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => { cuadro = callback; return 7; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });
  afterEach(() => {
    cleanup();
    if (animateOriginal) Element.prototype.animate = animateOriginal;
    else delete Element.prototype.animate;
  });

  const montarEscena = () => render(
    <div className="dg-cerrado">
      <h1 data-tiempo-capa="0.33">Más tiempo para vivir.</h1>
      {createElement(EscenaHero)}
    </div>,
  );

  it('sincroniza cuatro planos al scroll y al resize sin un loop permanente', () => {
    const { container } = montarEscena();
    const raiz = container.firstChild;
    vi.spyOn(raiz, 'getBoundingClientRect').mockReturnValue({ top: -400 });
    expect(animar).toHaveBeenCalledTimes(4);
    expect(animar.mock.calls.map(([frames]) => frames[1].transform)).toEqual([
      'translate3d(0, 990px, 0)', 'translate3d(0, 2460px, 0)',
      'translate3d(0, 1950px, 0)', 'translate3d(0, 360px, 0)',
    ]);
    act(() => visibilidad([{ isIntersecting: true }]));
    act(() => cuadro());
    expect(animaciones.map((animacion) => animacion.currentTime)).toEqual([400, 400, 400, 400]);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    fireEvent.resize(window);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    act(() => cuadro());
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('fuera de pantalla cancela el cuadro pendiente y no agenda otros', () => {
    montarEscena();
    act(() => visibilidad([{ isIntersecting: true }]));
    act(() => visibilidad([{ isIntersecting: false }]));
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    fireEvent.scroll(window);
    fireEvent.resize(window);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
  });

  it('movimiento reducido deja la composición quieta y responde al cambio de preferencia', () => {
    preferencia.matches = true;
    const { unmount } = montarEscena();
    expect(animar).not.toHaveBeenCalled();
    const cambiar = preferencia.addEventListener.mock.calls[0][1];
    preferencia.matches = false;
    act(() => cambiar());
    expect(animar).toHaveBeenCalledTimes(4);
    preferencia.matches = true;
    act(() => cambiar());
    animaciones.forEach((animacion) => expect(animacion.cancel).toHaveBeenCalledOnce());
    unmount();
    expect(preferencia.removeEventListener).toHaveBeenCalledWith('change', cambiar);
  });

  it('abrir el diagnóstico retira la escena, cancela animaciones y limpia listeners', () => {
    const quitar = vi.spyOn(window, 'removeEventListener');
    render(<Diagnostico modo="home" Portada={Portada} lado={createElement(EscenaHero)} />);
    expect(screen.getByRole('figure')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    expect(desconectar).toHaveBeenCalledOnce();
    animaciones.forEach((animacion) => expect(animacion.cancel).toHaveBeenCalledOnce());
    expect(quitar).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(quitar).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveFocus();
  });
});
