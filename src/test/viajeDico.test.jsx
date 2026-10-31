import { createElement, createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Diagnostico from '../components/landing/Diagnostico';

vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('../lib/analiticaPlataforma', () => ({ marcarEvento: vi.fn() }));
function Portada({ onAbrir }) {
  return <button type="button" data-abrir onClick={onAbrir}>Quiero Dico</button>;
}
const pregunta = () => screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' });
const oro = () => document.querySelector('.pl-viaje-dico');
const boton = () => screen.getByRole('button', { name: 'Quiero Dico' });
function montar(modo = 'home') {
  const abrirRef = createRef();
  const montaje = render(<div className="pl-root">{createElement(Diagnostico, { modo, Portada, abrirRef, lado: <div data-testid="escena">Escena persistente</div> })}</div>);
  return { ...montaje, abrirRef };
}

describe('diagnóstico en card oscura sobre el hero', () => {
  let animaciones;
  let cuadros;
  let secuencia;
  let media;
  let original;
  let push;
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '');
    window.history.scrollRestoration = 'auto';
    push = vi.spyOn(window.history, 'pushState');
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    animaciones = [];
    cuadros = new Map();
    secuencia = 0;
    media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => { cuadros.set(++secuencia, callback); return secuencia; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id) => cuadros.delete(id)));
    original = Element.prototype.animate;
    Element.prototype.animate = vi.fn((frames, opciones) => {
      let terminar;
      let rechazar;
      const finished = new Promise((resolve, reject) => { terminar = resolve; rechazar = reject; });
      const handle = { frames, opciones, finished, terminar, rechazar, cancel: vi.fn() };
      animaciones.push(handle);
      return handle;
    });
    const estiloOriginal = window.getComputedStyle;
    vi.stubGlobal('getComputedStyle', (elemento) => elemento.matches('.pl-viaje-dico') ? {
      clipPath: elemento.style.clipPath,
      getPropertyValue: (token) => ({ '--pl-viaje-expansion': '640ms', '--pl-viaje-contraccion': '480ms', '--pl-viaje-curva': 'cubic-bezier(0.2, 0.7, 0.2, 1)' }[token] || ''),
    } : estiloOriginal(elemento));
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.matches('.dg-modal-card')) return { top: 80, bottom: 680, left: 40, right: 984, width: 944, height: 600 };
      if (this.matches('[data-abrir], [data-footer]')) return { top: 500, bottom: 556, left: 20, right: 240, width: 220, height: 56 };
      return { top: 0, bottom: 800, left: 0, right: 390, width: 390, height: 800 };
    });
  });
  afterEach(() => {
    cleanup();
    if (original) Element.prototype.animate = original;
    else delete Element.prototype.animate;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  });
  const abrir = async () => {
    boton().focus();
    fireEvent.click(boton());
    await act(async () => animaciones.at(-1).terminar());
  };
  const medirCierre = async () => {
    await waitFor(() => expect(oro()?.dataset.viaje).toBe('contraccion'));
    await act(async () => {
      const pendientes = [...cuadros.values()];
      cuadros.clear();
      pendientes.forEach((callback) => callback());
    });
  };
  const cerrarPorBoton = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar diagnóstico' }));
    await medirCierre();
    await act(async () => animaciones.at(-1).terminar());
  };
  const eventoCss = async (tipo = 'animationend') => {
    const evento = new Event(tipo, { bubbles: true });
    Object.defineProperty(evento, 'animationName', { value: 'pl-viaje-superficie' });
    await act(async () => oro().dispatchEvent(evento));
  };

  it('expande una sola vez hasta la card y monta un único formulario sobre el hero persistente', async () => {
    const { container } = montar();
    const escena = screen.getByTestId('escena');
    boton().focus();
    fireEvent.click(boton());
    expect(screen.queryByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute('inert');
    expect(animaciones).toHaveLength(1);
    expect(animaciones[0].frames.at(-1).clipPath).toBe('inset(80px 40px 88px 40px round 0px)');
    const superficie = oro();
    await act(async () => animaciones[0].terminar());
    expect(oro()).toBe(superficie);
    expect(oro().dataset.viaje).toBe('abierto');
    expect(screen.getByTestId('escena')).toBe(escena);
    expect(screen.getAllByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: '¿Qué tipo de negocio tenés?' })).toContainElement(pregunta());
    expect(pregunta()).toHaveFocus();
    expect(container.firstChild).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    expect(push).toHaveBeenCalledOnce();
  });

  it('X oculta la card y contrae una sola vez hasta el botón completo; restaura foco y recursos', async () => {
    const { container } = montar();
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar diagnóstico' }));
    await medirCierre();
    expect(screen.queryByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).not.toBeInTheDocument();
    expect(animaciones).toHaveLength(2);
    expect(animaciones[1].frames[0].clipPath).toBe('inset(80px 40px 88px 40px round 0px)');
    expect(animaciones[1].frames.at(-1).clipPath).toContain('round 28px');
    expect(container.firstChild).toHaveAttribute('inert');
    await act(async () => animaciones[1].terminar());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(oro()).not.toBeInTheDocument();
    expect(container.firstChild).not.toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(boton()).toHaveFocus();
    expect(push).toHaveBeenCalledOnce();
  });

  it.each(['Escape', 'X'])('%s desde la segunda pregunta cierra todo el diagnóstico y conserva respuestas', async (accion) => {
    montar();
    await abrir();
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Restaurante' }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(window.history.state.dgProfundidad).toBe(2);
    if (accion === 'Escape') fireEvent.keyDown(document, { key: 'Escape' });
    else fireEvent.click(screen.getByRole('button', { name: 'Cerrar diagnóstico' }));
    await medirCierre();
    await act(async () => animaciones.at(-1).terminar());
    expect(boton()).toHaveFocus();
    expect(window.history.state.dg).toBeUndefined();
    expect(JSON.parse(sessionStorage.getItem('dico:diagnostico-v2-en-curso')).respuestas.vertical).toBe('gastronomia');
    fireEvent.click(boton());
    await act(async () => animaciones.at(-1).terminar());
    expect(screen.getByRole('heading', { name: '¿Qué es lo que más te preocupa hoy?' })).toHaveFocus();
  });

  it('Atrás entre preguntas no anima; el Atrás que sale al hero sí contrae', async () => {
    montar();
    await abrir();
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Restaurante' }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    act(() => window.history.back());
    await waitFor(() => expect(pregunta()).toHaveFocus());
    expect(animaciones).toHaveLength(1);
    act(() => window.history.back());
    await medirCierre();
    await act(async () => animaciones[1].terminar());
    expect(boton()).toHaveFocus();
  });

  it('Tab y Shift+Tab quedan dentro del diálogo', async () => {
    montar();
    await abrir();
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Restaurante' }));
    const dialogo = screen.getByRole('dialog');
    const primero = within(dialogo).getByRole('button', { name: 'Cerrar diagnóstico' });
    const ultimo = within(dialogo).getByRole('button', { name: /Continuar/ });
    ultimo.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(primero).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(ultimo).toHaveFocus();
  });

  it('reinicia el scroll de la card al pasar de pregunta', async () => {
    montar();
    await abrir();
    const card = pregunta().closest('.dg-modal-card');
    card.scrollTop = 500;
    const contenido = card.querySelector('.dg-unificado');
    contenido.scrollTop = 500;
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Restaurante' }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(card.scrollTop).toBe(0);
    expect(contenido.scrollTop).toBe(0);
  });

  it('otras secciones abren directamente y devuelven foco a su disparador al cerrar', async () => {
    const { abrirRef } = montar();
    const footer = document.createElement('button');
    footer.dataset.footer = '';
    footer.textContent = 'Dico en el footer';
    document.body.append(footer);
    try {
      footer.focus();
      act(() => abrirRef.current({ disparador: footer }));
      expect(animaciones).toHaveLength(0);
      expect(pregunta()).toHaveFocus();
      await cerrarPorBoton();
      expect(footer).toHaveFocus();
      expect(animaciones).toHaveLength(1);
    } finally { footer.remove(); }
  });

  it('dos clics de apertura no duplican formulario ni historial', async () => {
    montar();
    const disparador = boton();
    fireEvent.click(disparador);
    fireEvent.click(disparador);
    expect(animaciones).toHaveLength(1);
    await act(async () => animaciones[0].terminar());
    expect(push).toHaveBeenCalledOnce();
  });

  it('Adelante durante contracción cancela el cierre pendiente y conserva el diálogo más reciente', async () => {
    montar();
    await abrir();
    fireEvent.popState(window, { state: {} });
    await medirCierre();
    const cierre = animaciones[1];
    fireEvent.popState(window, { state: { dg: 0, desde: true, dgProfundidad: 1 } });
    expect(pregunta()).toHaveFocus();
    await act(async () => cierre.terminar());
    expect(pregunta()).toHaveFocus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(push).toHaveBeenCalledOnce();
  });

  it('Escape durante expansión cancela su apertura tardía', async () => {
    montar();
    fireEvent.click(boton());
    const apertura = animaciones[0];
    fireEvent.keyDown(document, { key: 'Escape' });
    await medirCierre();
    await act(async () => animaciones.at(-1).terminar());
    await act(async () => apertura.terminar());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(boton()).toHaveFocus();
  });

  it('movimiento reducido conserva apertura y cierre inmediatos', async () => {
    media.matches = true;
    montar();
    fireEvent.click(boton());
    expect(pregunta()).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar diagnóstico' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(animaciones).toHaveLength(0);
    expect(boton()).toHaveFocus();
  });

  it('sin WAAPI expande y contrae mediante CSS, conservando la superficie entre ambas', async () => {
    delete Element.prototype.animate;
    montar();
    fireEvent.click(boton());
    expect(oro().dataset.motor).toBe('css');
    expect(screen.queryByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).not.toBeInTheDocument();
    await eventoCss();
    expect(pregunta()).toHaveFocus();
    expect(oro()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar diagnóstico' }));
    await medirCierre();
    await eventoCss();
    expect(oro()).not.toBeInTheDocument();
    expect(boton()).toHaveFocus();
  });

  it.each(['throw', 'reject', 'incompleta'])('WAAPI %s usa CSS sin bloquear el acceso', async (fallo) => {
    if (fallo === 'throw') Element.prototype.animate = vi.fn(() => { throw new Error('WebView'); });
    if (fallo === 'incompleta') Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() }));
    montar();
    fireEvent.click(boton());
    if (fallo === 'reject') await act(async () => animaciones[0].rechazar(new Error('WebView')));
    expect(oro().dataset.motor).toBe('css');
    await eventoCss();
    expect(pregunta()).toHaveFocus();
  });

  it('la contracción progresa aunque RAF no responda', async () => {
    montar();
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar diagnóstico' }));
    await waitFor(() => expect(animaciones).toHaveLength(2));
    await act(async () => animaciones[1].terminar());
    expect(boton()).toHaveFocus();
  });

  it.each(['abriendo', 'abierto', 'cerrando'])('desmontar %s restaura los recursos del dueño modal', async (fase) => {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'scroll';
    const { container, unmount } = montar();
    const fondo = container.firstChild;
    fireEvent.click(boton());
    if (fase !== 'abriendo') await act(async () => animaciones[0].terminar());
    if (fase === 'cerrando') { fireEvent.popState(window, { state: {} }); await medirCierre(); }
    unmount();
    await act(async () => animaciones.at(-1).terminar());
    expect(fondo.inert).not.toBe(true);
    expect(document.documentElement.style.overflow).toBe('auto');
    expect(document.body.style.overflow).toBe('scroll');
    expect(oro()).not.toBeInTheDocument();
  });

  it('resize termina una apertura y el modal conserva inert hasta su cierre', async () => {
    const { container } = montar();
    fireEvent.click(boton());
    fireEvent.resize(window);
    expect(pregunta()).toHaveFocus();
    expect(container.firstChild).toHaveAttribute('inert');
    await cerrarPorBoton();
    expect(container.firstChild).not.toHaveAttribute('inert');
  });

  it('una sesión v2 sin profundidad cierra sin añadir ni adivinar historial', async () => {
    sessionStorage.setItem('dico:diagnostico-v2-en-curso', JSON.stringify({ version: 2, respuestas: {} }));
    window.history.replaceState({ dg: 0, desde: true }, '');
    const go = vi.spyOn(window.history, 'go');
    montar();
    expect(pregunta()).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar diagnóstico' }));
    await medirCierre();
    await act(async () => animaciones[0].terminar());
    expect(go).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(window.history.state.dg).toBeUndefined();
  });

  it('la ruta independiente no se convierte en modal', () => {
    montar('pagina');
    expect(pregunta()).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(oro()).not.toBeInTheDocument();
  });
});
