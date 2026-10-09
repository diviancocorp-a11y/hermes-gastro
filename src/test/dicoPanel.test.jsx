import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import DicoPanel from '../components/admin/platform/DicoPanel';

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
});

const datos = {
  productos: [{ id: 'p1', name: 'Milanesa', price: 0, active: true }],
  ventas: [],
  clientes: [],
  utilizacion: [],
  esperaPerdida: [],
  gastos: [],
  settings: {},
  vertical: 'gastro',
  listo: true,
};

describe('DicoPanel', () => {
  it('muestra el centro de decisiones y conserva un aviso como tarea', () => {
    // mesSinGastos solo avisa desde el dia 10: sin fijar la fecha el test
    // depende del dia en que se corre.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00'));
    render(React.createElement(DicoPanel, {
      ...datos,
      roles: ['owner'],
      currentUserId: 'u1',
      currentUserName: 'Ricky',
      personal: [{ user_id: 'u2', name: 'Ana', job: 'Moza' }],
    }));

    expect(screen.getByRole('heading', { name: 'Habla con Dico' })).toBeInTheDocument();
    expect(screen.getByText('Dico')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Dico' })).toBeInTheDocument();
    expect(screen.getByText('¿En qué te puedo ayudar?')).toBeInTheDocument();
    expect(screen.queryByText('Dico está mirando tu operación')).not.toBeInTheDocument();
    expect(screen.queryByText('¿Por dónde empezar?')).not.toBeInTheDocument();
    expect(screen.queryByText('¿Menos margen?')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Hablar con Dico' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir herramientas del chat' }));
    expect(screen.getByRole('menuitem', { name: 'Subir archivos' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Abrir cámara' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hablarle a Dico' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Nuevo chat' })).toBeInTheDocument();
    expect(screen.queryByText('Prioridad alta')).not.toBeInTheDocument();
    expect(screen.queryByText('Prioridad media')).not.toBeInTheDocument();
    expect(screen.queryByText('Prioridad baja')).not.toBeInTheDocument();
    expect(screen.queryByText('Dico 2D')).not.toBeInTheDocument();
    expect(screen.getByText(/producto está sin precio/i)).toBeInTheDocument();
    const cards = screen.getAllByRole('article');
    expect(cards.map(card => card.querySelector('h3')?.textContent)).toEqual([
      '1 producto está sin precio',
      expect.stringMatching(/^Van \d+ días del mes sin un solo gasto cargado$/),
    ]);

    const dico = screen.getByRole('img', { name: 'Dico' });
    fireEvent.mouseEnter(dico.parentElement);
    expect(dico).toHaveAttribute('data-dico-physical', 'explain');
    expect(screen.getByText(/producto está sin precio/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Más acciones/ })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Asignar' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Seleccionar usuario' }), { target: { value: 'u2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(screen.queryByText('Tareas asignadas')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('dico:centro-decisiones:v1'))).toEqual({
      'aviso:sin-precio': 'tarea',
    });
  });

  it('reemplaza la bienvenida por la respuesta y permite iniciar una nueva accion', () => {
    render(React.createElement(DicoPanel, datos));
    fireEvent.change(screen.getByRole('textbox', { name: 'Preguntarle a Dico' }), {
      target: { value: 'Necesito ayuda' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));

    expect(screen.queryByText('¿En qué te puedo ayudar?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir herramientas del chat' }));
    expect(screen.getByRole('menuitem', { name: 'Nuevo chat' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nuevo chat' }));
    expect(screen.getByRole('button', { name: 'Abrir herramientas del chat' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Preguntarle a Dico' })).toHaveValue('');
  });

  it('responde hola con el texto precargado y sin tarjeta azul', () => {
    vi.useFakeTimers();
    render(React.createElement(DicoPanel, datos));
    fireEvent.change(screen.getByRole('textbox', { name: 'Preguntarle a Dico' }), {
      target: { value: 'hola' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    act(() => vi.advanceTimersByTime(4000));

    expect(screen.queryByText('¿En qué te puedo ayudar?')).not.toBeInTheDocument();
    expect(screen.getByText(/Soy Dico/)).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Dico' })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: /Más acciones/ })[0]);
    expect(screen.getByRole('menuitem', { name: 'Asignar' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Descartar' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Posponer' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Más acciones/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir herramientas del chat' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nuevo chat' }));
    expect(screen.getByRole('button', { name: /Historial de chats/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'hola' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Historial de chats/ }));
    expect(screen.getByRole('dialog', { name: 'Historial de chats' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'hola' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'hola' }));
    expect(screen.getByText(/Soy Dico/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Historial de chats/ })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('reinicia el chat al volver a la sala y conserva el historial con cinco chats', () => {
    const archivadas = Array.from({ length: 6 }, (_, indice) => ({
      id: `chat-${indice}`,
      title: `Consulta ${indice}`,
      messages: [{ id: `mensaje-${indice}`, rol: 'usuario', texto: `Consulta ${indice}` }],
      updatedAt: indice,
    }));
    localStorage.setItem('dico:sala-control:conversaciones:v1', JSON.stringify(archivadas));

    const vista = render(React.createElement(DicoPanel, datos));
    expect(screen.getByText('¿En qué te puedo ayudar?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Historial de chats/ })).toHaveTextContent('5/5');
    fireEvent.click(screen.getByRole('button', { name: /Historial de chats/ }));
    expect(screen.getByRole('dialog', { name: 'Historial de chats' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Consulta 5' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consulta 0' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Preguntarle a Dico' }), { target: { value: 'hola' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    vista.unmount();

    expect(localStorage.getItem('dico:sala-control:chat:v1')).toBeNull();
    render(React.createElement(DicoPanel, datos));
    expect(screen.getByText('¿En qué te puedo ayudar?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Historial de chats/ }));
    expect(screen.getByRole('button', { name: 'hola' })).toBeInTheDocument();
  });

  it('deja visibles las intervenciones historicas aunque Dico 3D ya se cerro', () => {
    render(React.createElement(DicoPanel, { ...datos, historial: [{
      id: 'catalogo-vacio',
      titulo: 'Dico te marco una accion',
      recomendacion: 'Revisala cuando puedas.',
      estado: 'pendiente',
      pose: 'pointDown',
    }] }));

    expect(screen.getByText('Dico te marco una accion')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Dico' })).toBeInTheDocument();
  });
});
