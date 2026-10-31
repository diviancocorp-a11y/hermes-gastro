import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ResultadoDiagnostico from '../components/landing/ResultadoDiagnostico';
import { solucion } from '../lib/diagnostico';
import { PLANES_COMERCIALES, pesosDelPlan, precioDelPeriodo } from '../lib/planesPlataforma';

vi.mock('../lib/supabase', () => ({ supabase: {} }));
afterEach(cleanup);
const base = { vertical: 'gastronomia', establecimiento: 'restaurante', desafio: 'costos', senal: 'mensual', canales: ['salon'], locales: 'uno', equipo: 'hasta_5', gestion_actual: 'planillas', sistema_nombre: '', sistema_costo: '', nombre_negocio: 'Mi negocio' };
function mostrar(respuestas) {
  render(<ResultadoDiagnostico sol={solucion(respuestas.desafio, respuestas.vertical)} respuestas={respuestas} id="diag-ejemplo" guardado="ok" encabezado={<h1>Orientación</h1>} resumen={<details><summary>Ver mis respuestas</summary></details>} />);
}

describe('resultado orientado a empezar con Dico', () => {
  it.each([
    ['digital', {}], ['local', { gestion_actual: 'otro_sistema', sistema_nombre: 'Mi sistema' }], ['cadena', { locales: 'dos_tres' }],
  ])('recomienda %s con el precio compartido y un unico CTA que conserva los datos', (idPlan, cambios) => {
    mostrar({ ...base, ...cambios });
    const plan = PLANES_COMERCIALES.find(p => p.id === idPlan);
    expect(screen.getByRole('heading', { name: plan.nombre, exact: true })).toBeInTheDocument();
    expect(document.querySelector('.dg-plan-importe')).toHaveTextContent(pesosDelPlan(plan.mensual));
    const acciones = screen.getAllByRole('link', { name: /Empezar con Dico/ });
    expect(acciones).toHaveLength(1);
    const url = new URL(acciones[0].getAttribute('href'), 'https://divianco.app');
    expect(url.pathname).toBe('/registro');
    expect(url.searchParams.get('plan')).toBe(idPlan);
    expect(url.searchParams.get('d')).toBe('diag-ejemplo');
    expect(url.searchParams.get('negocio')).toBe('Mi negocio');
    expect(document.querySelector('form')).toBeNull();
    expect(screen.queryByRole('textbox', { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Comparar planes/ })).toHaveAttribute('href', '/#comparar-planes');
  });
  it('muestra el total anual de la misma oferta, como alternativa secundaria', () => {
    mostrar({ ...base, locales: 'dos_tres' });
    fireEvent.click(screen.getByText('Alternativa con pago anual'));
    const plan = PLANES_COMERCIALES.find(p => p.id === 'cadena');
    const anual = precioDelPeriodo(plan, true);
    expect(document.querySelector('.dg-plan-anual')).toHaveTextContent(`${pesosDelPlan(anual.importe)} al año por local`);
    expect(document.querySelector('.dg-plan-anual')).toHaveTextContent(pesosDelPlan(anual.equivalente));
  });
  it('mantiene visible el alcance pendiente fuera de gastronomia', () => {
    const respuestas = { ...base, vertical: 'comercio', establecimiento: 'bebidas', desafio: 'rentabilidad', senal: 'fin_mes' };
    mostrar(respuestas);
    expect(screen.getByRole('heading', { name: 'Qué está disponible hoy' })).toBeInTheDocument();
    expect(screen.getByText(solucion('rentabilidad', 'comercio').pendiente)).toBeInTheDocument();
  });
  it('no ofrece arqueo como parte del inicio a un servicio sin local fisico', () => {
    mostrar({ ...base, vertical: 'servicios', desafio: 'mermas_caja', senal: 'hasta_10000', canales: ['catalogo_online'] });
    expect(screen.queryByText('Caja y arqueo')).not.toBeInTheDocument();
    expect(screen.getByText(/qué controles de cobro corresponden/)).toBeInTheDocument();
  });
});
