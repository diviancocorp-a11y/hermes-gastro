import { beforeEach, describe, expect, it } from 'vitest';
import { contextoDelRegistro, recordarRegistroGoogle } from '../lib/registroPlataforma';
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { sessionStorage.clear(); window.history.replaceState({}, '', '/registro'); });
describe('contexto privado del alta', () => {
  it('no mezcla el contacto de un diagnostico distinto', () => {
    sessionStorage.setItem('dico:diagnostico-v2-en-curso', JSON.stringify({ id, respuestas: { contacto_nombre: 'Ana', nombre_negocio: 'Otro negocio' } }));
    window.history.replaceState({}, '', '/registro?d=22222222-2222-4222-8222-222222222222');
    expect(contextoDelRegistro().fullName).toBe(''); expect(contextoDelRegistro().bizName).toBe('');
  });
  it('recupera el borrador de Google pero nunca almacena contraseña ni capacidad', () => {
    recordarRegistroGoogle({ fullName: 'Ana', bizName: 'La Esquina', vertical: 'gastro', modo: 'hibrido', country: 'AR', plan: 'local', periodo: 'anual', diagnostico: id, password: 'no-guardar', token: 'capacidad-privada' });
    expect(sessionStorage.getItem('dico:registro-google')).not.toMatch(/no-guardar|capacidad-privada|password|token/);
    window.history.replaceState({}, '', '/registro?oauth=google');
    expect(contextoDelRegistro()).toMatchObject({ fullName: 'Ana', bizName: 'La Esquina', modo: 'hibrido', plan: 'local', periodo: 'anual', diagnostico: id });
  });
  it('descarta borradores vencidos y planes o periodos inventados', () => {
    sessionStorage.setItem('dico:registro-google', JSON.stringify({ creado: Date.now() - 3600001, fullName: 'Viejo' }));
    window.history.replaceState({}, '', '/registro?oauth=google&plan=inventado&periodo=anual');
    expect(contextoDelRegistro()).toMatchObject({ fullName: '', plan: 'digital', periodo: 'mensual' });
  });
});
