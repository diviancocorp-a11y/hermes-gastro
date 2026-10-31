import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registrarNegocio, iniciarRegistroGoogle, cuentaGoogleActual, registrarNegocioConGoogle } from '../services/signup';
import { supabase } from '../lib/supabase';
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signUp: vi.fn(), signInWithOAuth: vi.fn(), getUser: vi.fn(), updateUser: vi.fn() } } }));
const datos = { email: 'ana@ejemplo.com', password: 'segura123', bizName: 'La Esquina', fullName: 'Ana Pérez', slug: 'la-esquina', vertical: 'gastro', operationMode: 'hibrido', country: 'AR', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires', channels: ['table_service', 'delivery'], diagnostico: '11111111-1111-4111-8111-111111111111', plan: 'local', periodo: 'anual' };
beforeEach(() => { vi.clearAllMocks(); supabase.auth.signUp.mockResolvedValue({ data: { session: null }, error: null }); supabase.auth.signInWithOAuth.mockResolvedValue({ error: null }); supabase.auth.updateUser.mockResolvedValue({ error: null }); });
describe('registro por email o Google', () => {
  it('email mantiene confirmacion y datos del negocio en el servidor, sin contratar el plan', async () => {
    expect(await registrarNegocio(datos)).toEqual({ ok: true, needsConfirmation: true });
    const payload = supabase.auth.signUp.mock.calls[0][0];
    expect(payload.options.data).toMatchObject({ biz_name: 'La Esquina', operation_mode: 'hibrido', diagnostico: datos.diagnostico, requested_plan: 'local', requested_billing_period: 'anual' });
    expect(payload.options.data).not.toHaveProperty('plan_id');
    expect(payload.options.emailRedirectTo).toContain(`/bienvenido?d=${datos.diagnostico}`);
  });
  it('Google vuelve al registro sin datos personales en el enlace', async () => {
    await iniciarRegistroGoogle();
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/registro?oauth=google`, scopes: 'email profile' } });
  });
  it('no acepta una cuenta no verificada como acceso con Google', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { email: 'ana@ejemplo.com', identities: [{ provider: 'google' }] } }, error: null });
    expect((await cuentaGoogleActual()).ok).toBe(false);
    expect((await registrarNegocioConGoogle(datos)).ok).toBe(false);
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });
  it('con Google confirmado guarda el mismo negocio, sin contraseña ni otra alta', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { email: 'ana@gmail.com', email_confirmed_at: '2026-10-30T00:00:00Z', identities: [{ provider: 'google' }], user_metadata: { full_name: 'Ana' } } }, error: null });
    expect(await registrarNegocioConGoogle(datos)).toEqual({ ok: true, needsConfirmation: false });
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
    const payload = supabase.auth.updateUser.mock.calls[0][0];
    expect(payload.data).toMatchObject({ biz_name: datos.bizName, diagnostico: datos.diagnostico, channels: datos.channels, requested_plan: 'local' });
    expect(payload).not.toHaveProperty('password'); expect(payload).not.toHaveProperty('email');
  });
});
