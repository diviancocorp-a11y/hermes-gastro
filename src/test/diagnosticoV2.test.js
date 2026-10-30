// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PREGUNTAS_DOLOR, VENTAS_MENSUALES, DECISORES, extrasV2, validarExtrasV2, normalizarWhatsapp } from '../../platform/functions/diagnostico/v2.js';
import { ORDEN_PASOS, desafiosDe, planRecomendado } from '../lib/diagnostico';
import { hallazgosDelDiagnostico, herramientasDelDiagnostico } from '../lib/resultadoDiagnostico';

const base = { vertical: 'servicios', desafio: 'turnos', senal: 'tres_cinco', canales: ['catalogo_online'], locales: 'uno', equipo: 'hasta_5', gestion_actual: 'planillas', sistema_nombre: '', sistema_costo: '', venta_mensual: 'prefiero_no_responder', decisor: 'yo' };
describe('diagnostico v2', () => {
  it('tiene ocho pantallas y no pregunta inversion', () => { expect(ORDEN_PASOS).toHaveLength(8); expect(ORDEN_PASOS).not.toContain('inversion'); expect(ORDEN_PASOS).not.toContain('establecimiento'); });
  it('cada dolor de cada rubro tiene su detalle, incluidos los desconocidos', () => { for (const v of ['gastronomia', 'comercio', 'servicios', 'otro']) for (const d of desafiosDe(v)) expect(PREGUNTAS_DOLOR[d.id].opciones.some(o => o.id === 'no_se')).toBe(true); });
  it('no convierte turnos ni ventas en dinero perdido ni descarta una venta desconocida', () => { const hallazgos = hallazgosDelDiagnostico(base).join(' '); expect(hallazgos).toContain('3 a 5'); expect(hallazgos).not.toContain('$'); expect(hallazgos).toContain('no le asignamos un valor monetario'); expect(planRecomendado(base)).toBe(planRecomendado({ ...base, venta_mensual: 'mas_15m' })); });
  it('describe una diferencia de caja sin presentarla como perdida recuperable', () => { const texto = hallazgosDelDiagnostico({ ...base, desafio: 'mermas_caja', senal: '10000_50000' }).join(' '); expect(texto).toContain('$10.000 y $50.000'); expect(texto).toContain('no una pérdida'); });
  it('no ofrece salon ni cocina a un servicio remoto; si agenda implementada', () => { const modulos = herramientasDelDiagnostico(base).map(h => h.id); expect(modulos).toContain('agenda'); expect(modulos).not.toContain('mesas'); expect(modulos).not.toContain('kds'); });
  it('valida extras y permite no conocer ingresos o costo del sistema', () => { expect(validarExtrasV2(base, extrasV2(base))).toBeNull(); expect(validarExtrasV2(base, { ...extrasV2(base), senal: 'inventado' })).toBeTruthy(); expect(validarExtrasV2(base, { ...extrasV2(base), sistema_costo: -2 })).toBeTruthy(); });
  it('normaliza solo telefonos internacionales y exige formato acotado', () => { expect(normalizarWhatsapp('+54 (9) 11-1234-5678')).toBe('+5491112345678'); expect(normalizarWhatsapp('1112345678')).toBeNull(); expect(normalizarWhatsapp('+54<script>')).toBeNull(); });
  it('mantiene los ids de las listas compartidas en los CHECK de la base', () => { const sql = readFileSync('platform/migrations/0117_diagnostico_v2_contacto.sql', 'utf8'); for (const o of [...VENTAS_MENSUALES, ...DECISORES, ...Object.values(PREGUNTAS_DOLOR).flatMap(p => p.opciones)]) expect(sql).toContain(`'${o.id}'`); });
});
