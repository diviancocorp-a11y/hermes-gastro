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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('hero y diagnóstico comparten un solo recorrido', () => {
  it('abre con foco y un CTA de otra sección conserva la pregunta y la respuesta', () => {
    const abrirRef = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    expect(screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveFocus();
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Restaurante' }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    const pregunta = screen.getByRole('heading', { name: '¿Qué es lo que más te preocupa hoy?' });
    act(() => abrirRef.current());
    expect(pregunta).toHaveFocus();
    expect(screen.getByText('Pregunta 2 de 8')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('dico:diagnostico-v2-en-curso')).respuestas.vertical).toBe('gastronomia');
  });

  it('el porcentaje sigue las respuestas y el resumen no adelanta un plan ni filas vacias', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100');
    expect(screen.queryByText('Plan que te conviene')).not.toBeInTheDocument();
    const resumen = document.querySelector('.dg-resumen');
    expect(resumen).not.toHaveAttribute('open');
    expect(resumen.querySelectorAll('dt')).toHaveLength(0);
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    fireEvent.click(screen.getByRole('radio', { name: 'Restaurante' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '13');
    expect(resumen.querySelectorAll('dt')).toHaveLength(2);
  });

  it('editar desde el resumen vuelve a la pregunta conservando respuestas y sin remontar Dico por cada seleccion', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    const personaje = document.querySelector('.dico-pose-celda');
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Restaurante' }));
    expect(document.querySelector('.dico-pose-celda')).toBe(personaje);
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.click(screen.getByText('Ver mis respuestas'));
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar rubro' }));
    expect(screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Gastronomía' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Restaurante' })).toBeChecked();
    expect(document.querySelector('.dg-resumen')).not.toHaveAttribute('open');
  });

  it('mantiene una lectura pausada con mensajes reales y termina en 100%', async () => {
    vi.useFakeTimers();
    try {
      sessionStorage.setItem('dico:diagnostico-v2-en-curso', JSON.stringify({ version: 2, respuestas: {
        vertical: 'gastronomia', establecimiento: 'restaurante', desafio: 'costos', senal: 'mensual',
        canales: ['salon'], locales: 'uno', equipo: 'hasta_5', gestion_actual: 'planillas',
        venta_mensual: 'no_se', urgencia: 'este_mes', decisor: 'yo', nombre_negocio: 'Prueba',
      } }));
      window.history.replaceState({ dg: 7, desde: true }, '');
      montar();
      fireEvent.click(screen.getByRole('button', { name: /Ver mi diagnóstico/ }));
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByText('Estoy revisando lo que me contaste.')).toBeInTheDocument();
      expect(document.querySelector('.dg-avance')).not.toHaveClass('dg-avance-completo');
      await act(async () => vi.advanceTimersByTime(2500));
      expect(screen.getByText('Estoy relacionando tu prioridad con las herramientas de Dico.')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Tu prioridad' })).not.toBeInTheDocument();
      await act(async () => vi.advanceTimersByTime(7100));
      expect(screen.getByRole('heading', { name: 'Tu prioridad' })).toBeInTheDocument();
      expect(document.querySelector('.dg-avance')).toHaveClass('dg-avance-completo');
      expect(document.querySelector('#dg-resultado-titulo').closest('.dg-resultado-contenido')).not.toBeNull();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    } finally { cleanup(); vi.useRealTimers(); }
  });

  it('volver al inicio devuelve el foco al CTA y las respuestas sobreviven al reabrir', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Gastronomía' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Restaurante' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Quiero Dico' })).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    expect(screen.getByRole('heading', { name: '¿Qué es lo que más te preocupa hoy?' })).toHaveFocus();
    expect(JSON.parse(sessionStorage.getItem('dico:diagnostico-v2-en-curso')).respuestas.vertical).toBe('gastronomia');
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

  it('sincroniza los planos y la luz al scroll y al resize sin un loop permanente', () => {
    const { container } = montarEscena();
    const raiz = container.firstChild;
    vi.spyOn(raiz, 'getBoundingClientRect').mockReturnValue({ top: -400 });
    expect(animar).toHaveBeenCalledTimes(5);
    expect(animar.mock.calls.map(([frames]) => frames[1].transform)).toEqual([
      'translate3d(0, 990px, 0)', 'translate3d(0, 2460px, 0)',
      'translate3d(0, 1950px, 0)', 'translate3d(0, 1950px, 0)', 'translate3d(0, 360px, 0)',
    ]);
    act(() => visibilidad([{ isIntersecting: true }]));
    act(() => cuadro());
    expect(animaciones.map((animacion) => animacion.currentTime)).toEqual([400, 400, 400, 400, 400]);
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
    expect(animar).toHaveBeenCalledTimes(5);
    preferencia.matches = true;
    act(() => cambiar());
    animaciones.forEach((animacion) => expect(animacion.cancel).toHaveBeenCalledOnce());
    unmount();
    expect(preferencia.removeEventListener).toHaveBeenCalledWith('change', cambiar);
  });

  it('abrir la card conserva el mismo parallax montado debajo', () => {
    render(<Diagnostico modo="home" Portada={Portada} lado={createElement(EscenaHero)} />);
    const escena = screen.getByRole('figure');
    fireEvent.click(screen.getByRole('button', { name: 'Quiero Dico' }));
    expect(screen.getByRole('figure')).toBe(escena);
    expect(desconectar).not.toHaveBeenCalled();
    animaciones.forEach((animacion) => expect(animacion.cancel).not.toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¿Qué tipo de negocio tenés?' })).toHaveFocus();
  });
});
