import { createElement, createRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Diagnostico from '../components/landing/Diagnostico';

vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('../lib/analiticaPlataforma', () => ({ marcarEvento: vi.fn() }));

const pregunta = () => screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' });
function Portada({ onAbrir }) {
  return <button type="button" data-abrir onClick={onAbrir}>Quiero Dico</button>;
}
function montar() {
  const abrirRef = createRef();
  const montaje = render(<div className="pl-root">{createElement(Diagnostico, { modo: 'home', Portada, abrirRef })}</div>);
  return { ...montaje, abrirRef };
}

describe('Dico acompaña del CTA al diagnóstico real', () => {
  let animaciones;
  let cuadros;
  let push;
  let animarOriginal;
  let media;
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '');
    push = vi.spyOn(window.history, 'pushState');
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    animaciones = [];
    cuadros = [];
    media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => { cuadros.push(callback); return cuadros.length; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    animarOriginal = Element.prototype.animate;
    Element.prototype.animate = vi.fn((frames) => {
      let terminar;
      let rechazar;
      const finished = new Promise((resolve, reject) => { terminar = resolve; rechazar = reject; });
      const animacion = { frames, finished, terminar, rechazar, cancel: vi.fn() };
      animaciones.push(animacion);
      return animacion;
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.matches('[data-abrir]')) return { top: 500, bottom: 556, left: 20, right: 240, width: 220, height: 56 };
      if (this.matches('.dg-guia-cara')) return { top: 96, bottom: 144, left: 20, right: 68, width: 48, height: 48 };
      return { top: 0, bottom: 800, left: 0, right: 390, width: 390, height: 800 };
    });
  });
  afterEach(() => {
    cleanup();
    document.querySelectorAll('.pl-viaje-dico').forEach((capa) => capa.remove());
    if (animarOriginal) Element.prototype.animate = animarOriginal;
    else delete Element.prototype.animate;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.style.overflow = '';
  });
  const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
  const cubrir = async () => {
    await act(async () => animaciones[0].terminar());
    expect(document.querySelector('[data-viaje="pantalla"]')).toBeInTheDocument();
    await act(async () => cuadros.shift()());
    await act(async () => cuadros.shift()());
  };

  it('cubre toda la pantalla antes de montar una única pregunta y comprime hacia su cara', async () => {
    const { container } = montar();
    abrir();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(container.firstChild.inert).toBe(true);
    expect(animaciones[0].frames.at(-1).clipPath).toBe('inset(0px 0px 0px 0px round 0px)');
    await cubrir();
    expect(push).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveLength(1);
    expect(document.querySelector('[data-viaje="llegada"]')).toBeInTheDocument();
    expect(animaciones[1].frames.at(-1).clipPath).toContain('96px');
    expect(animaciones[1].frames.at(-1).clipPath).toContain('round 24px');
    await act(async () => animaciones[1].terminar());
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
    expect(container.firstChild.inert).not.toBe(true);
    expect(document.documentElement.style.overflow).toBe('');
    expect(pregunta()).toHaveFocus();
  });

  it('dos clics durante expansión o llegada no crean otras preguntas ni entradas', async () => {
    const { abrirRef } = montar();
    abrir();
    abrir();
    expect(animaciones).toHaveLength(1);
    await cubrir();
    act(() => abrirRef.current());
    expect(animaciones).toHaveLength(2);
    expect(push).toHaveBeenCalledOnce();
    await act(async () => animaciones[1].terminar());
  });

  it.each(['expansion', 'llegada'])('un rechazo de WAAPI durante %s abre y libera el formulario', async (fase) => {
    const { container } = montar();
    abrir();
    if (fase === 'llegada') await cubrir();
    await act(async () => animaciones.at(-1).rechazar(new Error('Animación interrumpida')));
    expect(pregunta()).toHaveFocus();
    expect(push).toHaveBeenCalledOnce();
    expect(container.firstChild.inert).not.toBe(true);
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
  });

  it('una API que arroja síncronamente tampoco impide abrir', async () => {
    Element.prototype.animate = vi.fn(() => { throw new Error('No disponible'); });
    montar();
    abrir();
    await act(async () => {});
    expect(pregunta()).toHaveFocus();
    expect(push).toHaveBeenCalledOnce();
  });

  it('resize cancela la geometría obsoleta, muestra la pregunta y restaura el scroll anterior', () => {
    document.documentElement.style.overflow = 'auto';
    montar();
    abrir();
    fireEvent.resize(window);
    expect(animaciones[0].cancel).toHaveBeenCalledOnce();
    expect(pregunta()).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('auto');
    expect(push).toHaveBeenCalledOnce();
  });

  it('Atrás durante expansión cancela sin crear una entrada tardía', async () => {
    montar();
    abrir();
    fireEvent.popState(window, { state: {} });
    await act(async () => animaciones[0].terminar());
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Quiero Dico' })).toHaveFocus();
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('Atrás durante llegada libera inert antes del commit y enfoca el CTA, sin foco tardío al heading saliente', async () => {
    const { container } = montar();
    abrir();
    await cubrir();
    expect(container.firstChild.inert).toBe(true);
    const enfocarPregunta = vi.spyOn(pregunta(), 'focus');
    fireEvent.popState(window, { state: {} });
    expect(container.firstChild.inert).not.toBe(true);
    expect(screen.getByRole('button', { name: 'Quiero Dico' })).toHaveFocus();
    expect(enfocarPregunta).not.toHaveBeenCalled();
    expect(animaciones[1].cancel).toHaveBeenCalledOnce();
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
    await act(async () => animaciones[1].terminar());
    expect(screen.getByRole('button', { name: 'Quiero Dico' })).toHaveFocus();
    expect(enfocarPregunta).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledOnce();
  });

  it('desmontar cancela y nunca monta el diagnóstico tarde', async () => {
    const { unmount } = montar();
    abrir();
    unmount();
    await act(async () => animaciones[0].terminar());
    expect(push).not.toHaveBeenCalled();
    expect(animaciones[0].cancel).toHaveBeenCalledOnce();
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('si una API nunca resuelve, el límite libera la página y abre una sola vez', () => {
    vi.useFakeTimers();
    try {
      montar();
      abrir();
      act(() => vi.advanceTimersByTime(1600));
      expect(pregunta()).toHaveFocus();
      expect(push).toHaveBeenCalledOnce();
      expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
      expect(document.documentElement.style.overflow).toBe('');
    } finally { vi.useRealTimers(); }
  });

  it('activar movimiento reducido durante el viaje cancela el movimiento y conserva acceso', () => {
    montar();
    abrir();
    const cambiar = media.addEventListener.mock.calls.find(([evento]) => evento === 'change')[1];
    media.matches = true;
    act(() => cambiar());
    expect(pregunta()).toHaveFocus();
    expect(animaciones[0].cancel).toHaveBeenCalledOnce();
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
  });

  it.each(['reducido', 'sin API', 'otra sección'])('%s abre inmediatamente y conserva foco e historial', (modo) => {
    if (modo === 'reducido') media.matches = true;
    if (modo === 'sin API') delete Element.prototype.animate;
    const { abrirRef } = montar();
    if (modo === 'otra sección') act(() => abrirRef.current());
    else abrir();
    expect(animaciones).toHaveLength(0);
    expect(push).toHaveBeenCalledOnce();
    expect(pregunta()).toHaveFocus();
  });
});
