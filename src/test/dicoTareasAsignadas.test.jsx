import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DicoTareasAsignadas from '../components/admin/platform/DicoTareasAsignadas';

const item = {
  id: 'aviso:stock',
  titulo: 'Revisar stock',
  recomendacion: 'Hay productos que necesitan revisión.',
  gravedad: 'alta',
  zona: 'Stock',
};

beforeEach(() => localStorage.clear());

describe('DicoTareasAsignadas', () => {
  it('muestra la tarea recibida y permite aceptarla', () => {
    localStorage.setItem('dico:centro-decisiones:v1', JSON.stringify({ 'aviso:stock': 'tarea' }));
    localStorage.setItem('dico:sala-control:tareas:v1', JSON.stringify({
      'aviso:stock': { item, assignedTo: 'u2', assignedToName: 'Ana', assignedByName: 'Ricky', workflowStatus: 'asignada' },
    }));

    render(<DicoTareasAsignadas currentUserId="u2" roles={[]} />);
    expect(screen.getByRole('heading', { name: 'Tareas asignadas' })).toBeInTheDocument();
    expect(screen.getByText('Revisar stock')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(JSON.parse(localStorage.getItem('dico:sala-control:tareas:v1'))['aviso:stock'].workflowStatus).toBe('aceptada');
    expect(screen.getByText('Aceptada')).toBeInTheDocument();
  });

  it('separa las tareas asignadas por mí', () => {
    localStorage.setItem('dico:centro-decisiones:v1', JSON.stringify({ 'aviso:stock': 'tarea' }));
    localStorage.setItem('dico:sala-control:tareas:v1', JSON.stringify({
      'aviso:stock': { item, assignedBy: 'u1', assignedTo: 'u2', assignedToName: 'Ana', workflowStatus: 'asignada' },
    }));

    render(<DicoTareasAsignadas currentUserId="u1" roles={['owner']} />);
    fireEvent.click(screen.getByRole('tab', { name: /Asignadas por mí/ }));
    expect(screen.getByText('Revisar stock')).toBeInTheDocument();
    expect(screen.getByText(/Para Ana/)).toBeInTheDocument();
  });
});
