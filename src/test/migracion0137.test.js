// Migracion 0137 (Cochi fase 5): forma del SQL. No ejecuta nada contra la base.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('platform/migrations/0137_checkout_doble_moneda.sql', 'utf8');

describe('0137', () => {
  it('solo expande: ni drop, ni rename, ni not null sin default', () => {
    const sinComentarios = sql.replace(/--.*$/gm, '');
    expect(sinComentarios).not.toMatch(/\bdrop\s+(table|column|function)\b/i);
    expect(sinComentarios).not.toMatch(/\brename\b/i);
    expect(sinComentarios).toMatch(/add column if not exists delivery_pending boolean not null default false/);
  });
  it('set_delivery_cost: invoker, una sola vez, tasa congelada, sin anon', () => {
    expect(sql).toMatch(/function public\.set_delivery_cost\(p_order_id uuid, p_cost numeric\)[\s\S]*security invoker/);
    expect(sql).toMatch(/p_cost < 0/);
    expect(sql).toMatch(/where o\.id = p_order_id and o\.delivery_pending/);
    expect(sql).toMatch(/o\.fx_rate is not null/);
    expect(sql).toMatch(/revoke all on function public\.set_delivery_cost\(uuid, numeric\) from public, anon/);
  });
  it('el espejo, get_catalog y el tracker emiten las claves nuevas', () => {
    expect(sql).toMatch(/'delivery_a_confirmar', new\.delivery_a_confirmar/);
    expect(sql).toMatch(/'pedido_por_whatsapp', {2}new\.pedido_por_whatsapp/);
    expect(sql).toMatch(/'delivery_a_confirmar', coalesce\(\(select \(settings->>'delivery_a_confirmar'\)::boolean from t\), false\)/);
    expect(sql).toMatch(/'total_secondary', {5}v_o\.total_secondary/);
    expect(sql).toMatch(/'delivery_pending', {4}v_o\.delivery_pending/);
  });
  it('no pierde ninguna clave de get_catalog respecto de la 0135', () => {
    const clave = (txt) => new Set([...txt.matchAll(/^\s+'([a-z_]+)',/gm)].map(m => m[1]));
    const desde = (txt, ini) => txt.slice(txt.indexOf(ini));
    const viejo = clave(desde(readFileSync('platform/migrations/0135_opciones_y_sugerencias_al_pedir.sql', 'utf8'), 'CREATE OR REPLACE FUNCTION public.get_catalog'));
    const nuevo = clave(desde(sql, 'CREATE OR REPLACE FUNCTION public.get_catalog'));
    for (const k of viejo) expect(nuevo.has(k), k).toBe(true);
  });
});
