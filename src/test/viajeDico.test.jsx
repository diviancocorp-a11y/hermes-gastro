import { createElement, createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Diagnostico from '../components/landing/Diagnostico';

vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('../lib/analiticaPlataforma', () => ({ marcarEvento: vi.fn() }));

const pregunta = () => screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' });
function Portada({ onAbrir }) {
  return <button type="button" data-abrir onClick={onAbrir}>Quiero Dico<span className="pl-hero-burbuja" /></button>;
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
    window.history.scrollRestoration = 'auto';
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
    const estiloOriginal = window.getComputedStyle;
    vi.stubGlobal('getComputedStyle', (elemento) => {
      if (!elemento.matches('.pl-viaje-dico')) return estiloOriginal(elemento);
      return { getPropertyValue: (token) => ({
        '--pl-viaje-expansion': '800ms', '--pl-viaje-pantalla': '120ms',
        '--pl-viaje-compresion': '800ms', '--pl-viaje-curva': 'cubic-bezier(0.65, 0, 0.35, 1)',
      }[token] || '') };
    });
    Element.prototype.animate = vi.fn((frames, opciones) => {
      let terminar;
      let rechazar;
      const finished = new Promise((resolve, reject) => { terminar = resolve; rechazar = reject; });
      const animacion = { frames, opciones, finished, terminar, rechazar, cancel: vi.fn() };
      animaciones.push(animacion);
      return animacion;
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.matches('[data-abrir]')) return { top: 500, bottom: 556, left: 20, right: 240, width: 220, height: 56 };
      if (this.matches('.pl-hero-burbuja')) return { top: 508, bottom: 548, left: 192, right: 232, width: 40, height: 40 };
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
  const cubrir = async (indice = 0) => {
    await act(async () => animaciones[indice].terminar());
    expect(document.querySelector('[data-viaje="pantalla"]')).toBeInTheDocument();
    await act(async () => cuadros.shift()());
    await act(async () => cuadros.shift()());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 130)));
  };
  const completarIda = async () => {
    abrir();
    await cubrir();
    await act(async () => animaciones[1].terminar());
  };
  const arrancarVuelta = async () => {
    expect(document.querySelector('[data-sentido="vuelta"]').hidden).toBe(true);
    await act(async () => cuadros.shift()());
  };
  const completarVuelta = async () => {
    await arrancarVuelta();
    await cubrir(2);
    await act(async () => animaciones[3].terminar());
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

  it('Volver al inicio recorre cara → pantalla dorada → burbuja del CTA, sin perder respuestas ni agregar historial', async () => {
    montar();
    await completarIda();
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    await waitFor(() => expect(document.querySelector('[data-sentido="vuelta"]')).toBeInTheDocument());
    await arrancarVuelta();
    expect(pregunta()).toBeInTheDocument();
    expect(animaciones[2].frames[0].clipPath).toContain('round 24px');
    expect(window.history.scrollRestoration).toBe('auto');
    await cubrir(2);
    expect(screen.getByRole('button', { name: 'Quiero Dico' })).toBeInTheDocument();
    expect(animaciones[3].frames.at(-1).clipPath).toContain('508px');
    expect(animaciones[3].frames.at(-1).clipPath).toContain('round 20px');
    await act(async () => animaciones[3].terminar());
    expect(screen.getByRole('button', { name: 'Quiero Dico' })).toHaveFocus();
    expect(window.history.scrollRestoration).toBe('auto');
    expect(push).toHaveBeenCalledOnce();
    expect(JSON.parse(sessionStorage.getItem('dico:diagnostico-en-curso')).respuestas.vertical).toBe('gastronomia');
    abrir();
    await cubrir(4);
    await act(async () => animaciones[5].terminar());
    expect(screen.getByRole('heading', { name: '¿Qué es lo que más te preocupa hoy?' })).toHaveFocus();
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('Atrás del navegador también reproduce la vuelta al cerrar, con el mismo foco final', async () => {
    montar();
    await completarIda();
    act(() => window.history.back());
    await waitFor(() => expect(document.querySelector('[data-sentido="vuelta"]')).toBeInTheDocument());
    await completarVuelta();
    expect(screen.getByRole('button', { name: 'Quiero Dico' })).toHaveFocus();
    expect(push).toHaveBeenCalledOnce();
  });

  it('Atrás entre preguntas mantiene navegación normal, sin iniciar una vuelta', async () => {
    montar();
    await completarIda();
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(screen.getByRole('heading', { name: '¿Qué es lo que más te preocupa hoy?' })).toHaveFocus();
    act(() => window.history.back());
    await waitFor(() => expect(pregunta()).toHaveFocus());
    expect(animaciones).toHaveLength(2);
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Gastronomía' })).toBeChecked();
  });

  it.each(['expansion', 'llegada'])('una navegación nueva durante %s de vuelta gana sobre callbacks tardíos', async (fase) => {
    montar();
    await completarIda();
    fireEvent.popState(window, { state: {} });
    await arrancarVuelta();
    if (fase === 'llegada') await cubrir(2);
    const anterior = animaciones.at(-1);
    fireEvent.popState(window, { state: { dg: 0, desde: true } });
    expect(pregunta()).toHaveFocus();
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
    expect(anterior.cancel).toHaveBeenCalledOnce();
    await act(async () => anterior.terminar());
    expect(pregunta()).toHaveFocus();
    expect(push).toHaveBeenCalledOnce();
  });

  it('otra acción Atrás durante la vuelta cancela, devuelve el CTA y no crea otro recorrido', async () => {
    montar();
    await completarIda();
    fireEvent.popState(window, { state: {} });
    await arrancarVuelta();
    fireEvent.popState(window, { state: {} });
    await act(async () => animaciones[2].terminar());
    expect(screen.getByRole('button', { name: 'Quiero Dico' })).toHaveFocus();
    expect(animaciones).toHaveLength(3);
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledOnce();
  });

  it('resize durante la vuelta termina en el hero y restaura la interacción', async () => {
    const { container } = montar();
    await completarIda();
    fireEvent.popState(window, { state: {} });
    fireEvent.resize(window);
    expect(screen.getByRole('button', { name: 'Quiero Dico' })).toHaveFocus();
    expect(container.firstChild.inert).not.toBe(true);
    expect(window.history.scrollRestoration).toBe('auto');
    expect(push).toHaveBeenCalledOnce();
  });

  it('desmontar durante la vuelta limpia la capa sin cambiar tarde DOM ni historial', async () => {
    const { unmount } = montar();
    await completarIda();
    fireEvent.popState(window, { state: {} });
    await arrancarVuelta();
    unmount();
    await act(async () => animaciones[2].terminar());
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
    expect(window.history.scrollRestoration).toBe('auto');
    expect(document.documentElement.style.overflow).toBe('');
    expect(push).toHaveBeenCalledOnce();
  });

  it.each(['reducido', 'sin API', 'API rechazada'])('%s permite volver directamente al CTA', async (modo) => {
    montar();
    await completarIda();
    if (modo === 'reducido') media.matches = true;
    if (modo === 'sin API') delete Element.prototype.animate;
    fireEvent.popState(window, { state: {} });
    if (modo === 'API rechazada') {
      await arrancarVuelta();
      await act(async () => animaciones[2].rechazar(new Error('Cancelada')));
    }
    expect(screen.getByRole('button', { name: 'Quiero Dico' })).toHaveFocus();
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledOnce();
  });

  it.each(['auto', 'manual'])('no escribe scrollRestoration ni durante la ida ni durante la vuelta con modo inicial %s', async (modo) => {
    const anterior = Object.getOwnPropertyDescriptor(window.history, 'scrollRestoration');
    const escribir = vi.fn();
    Object.defineProperty(window.history, 'scrollRestoration', {
      configurable: true, get: () => modo, set: escribir,
    });
    try {
      montar();
      await completarIda();
      fireEvent.popState(window, { state: {} });
      await completarVuelta();
      expect(escribir).not.toHaveBeenCalled();
      expect(window.history.scrollRestoration).toBe(modo);
    } finally { Object.defineProperty(window.history, 'scrollRestoration', anterior); }
  });

  it('cancelar la vuelta antes del RAF no muestra oro ni bloquea la interacción después', async () => {
    const { container } = montar();
    await completarIda();
    fireEvent.popState(window, { state: {} });
    const capa = document.querySelector('[data-sentido="vuelta"]');
    expect(capa.hidden).toBe(true);
    expect(animaciones).toHaveLength(2);
    const pendiente = cuadros.shift();
    fireEvent.popState(window, { state: { dg: 0, desde: true } });
    await act(async () => pendiente());
    expect(pregunta()).toHaveFocus();
    expect(container.firstChild.inert).not.toBe(true);
    expect(document.querySelector('.pl-viaje-dico')).not.toBeInTheDocument();
    expect(animaciones).toHaveLength(2);
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
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1120));
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
