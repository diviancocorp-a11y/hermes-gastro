import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const usuarios = vi.hoisted(() => ({
  listAdminUsers: vi.fn(),
  addMember: vi.fn(),
  setMemberRoles: vi.fn(),
  removeAdminUser: vi.fn(),
}));

vi.mock('../services/adminUsers', () => usuarios);

import _EquipoDelNegocio from '../components/admin/platform/EquipoDelNegocio';

describe('alta de una persona en el equipo', () => {
  beforeEach(() => {
    usuarios.listAdminUsers.mockReset().mockResolvedValue({ ok: true, users: [] });
    usuarios.addMember.mockReset().mockResolvedValue({ ok: true, reused: false });
  });

  afterEach(cleanup);

  it('exige y envia el nombre de la persona', async () => {
    render(
      <_EquipoDelNegocio
        vertical="gastro"
        modo="fisico"
        terminos={{}}
        showToast={vi.fn()}
      />,
    );
    await waitFor(() => expect(usuarios.listAdminUsers).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '+ Sumar a alguien' }));

    const guardar = screen.getByRole('button', { name: 'Sumar al equipo' });
    fireEvent.change(screen.getByPlaceholderText('Su email'), {
      target: { value: 'ana@ejemplo.com' },
    });
    expect(guardar).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Nombre de la persona'), {
      target: { value: 'Ana Pérez' },
    });
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);

    await waitFor(() => expect(usuarios.addMember).toHaveBeenCalledWith(
      'Ana Pérez', 'ana@ejemplo.com', '', ['attendant'], null,
    ));
  });
});
