// @vitest-environment node
// gerente-webhook: la firma que valida la function es la que registra el
// script, los resumenes que ve el modelo no mienten ni filtran datos, y
// anotar no crea un issue sin el SI de Ricky.
import { describe, it, expect } from 'vitest';
import { firmaDelGerente, iguales } from '../../platform/functions/gerente-webhook/firma.ts';
import { firmaDelGerente as firmaDelScript } from '../../platform/scripts/gerente-webhook.mjs';
import { firmaDeWebhook } from '../../platform/functions/tg-webhook/firma.ts';
import {
  cortar, diasValidos, HERRAMIENTAS, resumirPedidos, slugValido,
} from '../../platform/functions/gerente-webhook/herramientas.ts';
import {
  crearIssue, cuerpoDelIssue, esNo, esSi, fechaArgentina, HISTORIA_MAX, historiaComoMensajes, LABEL,
  NOTA_VENCE_MIN, notaVencida, paraGuardar, REPO, textoDePropuesta, tituloValido,
} from '../../platform/functions/gerente-webhook/anotar.ts';

const TOKEN = '123456:ABC-token-de-prueba';

describe('firma del webhook', () => {
  it('la function y el script de registro calculan lo mismo', async () => {
    expect(await firmaDelGerente(TOKEN)).toBe(firmaDelScript(TOKEN));
  });

  it('no es la misma que la de tg-webhook', async () => {
    expect(await firmaDelGerente(TOKEN)).not.toBe(await firmaDeWebhook(TOKEN));
  });

  it('solo usa caracteres que Telegram acepta en secret_token', async () => {
    expect(await firmaDelGerente(TOKEN)).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
  });

  it('iguales compara exacto', () => {
    expect(iguales('abc', 'abc')).toBe(true);
    expect(iguales('abc', 'abd')).toBe(false);
    expect(iguales('abc', 'abcd')).toBe(false);
  });
});

describe('argumentos que manda el modelo', () => {
  it('slug: solo minusculas, numeros y guiones', () => {
    expect(slugValido(' Crazy-Miga ')).toBe('crazy-miga');
    expect(slugValido("x' or 1=1")).toBeNull();
    expect(slugValido('')).toBeNull();
  });

  it('dias: de 1 a 31, 7 si no viene', () => {
    expect(diasValidos(undefined)).toBe(7);
    expect(diasValidos(0)).toBe(7);
    expect(diasValidos(3)).toBe(3);
    expect(diasValidos(400)).toBe(31);
  });
});

describe('resumirPedidos', () => {
  const filas = [
    { status: 'completed', channel: 'catalog', total: '9000.00', created_at: '2026-10-10T12:00:00Z' },
    { status: 'cancelled', channel: 'catalog', total: '18000', created_at: '2026-10-12T12:00:00Z' },
    { status: 'pending', channel: 'telegram', total: 33000, created_at: '2026-10-11T12:00:00Z' },
  ];

  it('los cancelados no suman a lo facturado', () => {
    const r = resumirPedidos(filas, 7);
    expect(r.pedidos).toBe(3);
    expect(r.facturado_sin_cancelados).toBe(42000);
    expect(r.por_estado).toEqual({ completed: 1, cancelled: 1, pending: 1 });
    expect(r.por_canal).toEqual({ catalog: 2, telegram: 1 });
    expect(r.ultimo_pedido).toBe('2026-10-12T12:00:00Z');
  });

  it('sin pedidos', () => {
    expect(resumirPedidos([], 7)).toMatchObject({ pedidos: 0, facturado_sin_cancelados: 0, ultimo_pedido: null });
  });
});

describe('herramientas', () => {
  it('tres de consulta y anotar, que solo propone', () => {
    expect(HERRAMIENTAS.map((h) => h.function.name).sort()).toEqual(['anotar', 'negocios', 'pedidos', 'productos']);
    const anotar = HERRAMIENTAS.find((h) => h.function.name === 'anotar');
    expect(anotar.function.description).toMatch(/NO lo crea/);
    expect(anotar.function.parameters.required).toEqual(['titulo', 'detalle']);
  });

  it('cortar respeta el limite de Telegram', () => {
    expect(cortar('hola')).toBe('hola');
    expect(cortar('x'.repeat(5000)).length).toBe(4000);
  });
});

describe('memoria de la charla', () => {
  it('llega de la mas nueva a la mas vieja y OpenAI la recibe en orden', () => {
    const filas = [
      { rol: 'assistant', texto: 'Vendio $ 161.000' },
      { rol: 'user', texto: 'como viene crazy-miga' },
    ];
    expect(historiaComoMensajes(filas)).toEqual([
      { role: 'user', content: 'como viene crazy-miga' },
      { role: 'assistant', content: 'Vendio $ 161.000' },
    ]);
  });

  it('no pasa de HISTORIA_MAX y descarta roles raros o vacios', () => {
    const muchas = Array.from({ length: 30 }, (_, i) => ({ rol: i % 2 ? 'user' : 'assistant', texto: `m${i}` }));
    expect(historiaComoMensajes(muchas)).toHaveLength(HISTORIA_MAX);
    expect(historiaComoMensajes(muchas).at(-1).content).toBe('m0');
    expect(historiaComoMensajes([{ rol: 'system', texto: 'x' }, { rol: 'user', texto: '' }])).toEqual([]);
  });

  it('paraGuardar respeta el check de 4000 de la 0099', () => {
    expect(paraGuardar('hola')).toBe('hola');
    expect(paraGuardar('x'.repeat(5000))).toHaveLength(4000);
  });
});

describe('el SI que crea el issue', () => {
  it('acepta si con o sin tilde, mayusculas y signos', () => {
    for (const t of ['si', 'SI', 'Sí', ' si! ', 'dale', 'Crealo.']) expect(esSi(t)).toBe(true);
  });

  it('cualquier otra cosa no es SI', () => {
    for (const t of ['no', 'si, pero cambia el titulo', 'sisi', 'como viene crazy-miga', '', undefined]) {
      expect(esSi(t)).toBe(false);
    }
  });

  it('un no explicito', () => {
    expect(esNo('No')).toBe(true);
    expect(esNo('cancelar')).toBe(true);
    expect(esNo('si')).toBe(false);
  });

  it('la nota vence a los NOTA_VENCE_MIN minutos', () => {
    const creada = '2026-10-17T12:00:00Z';
    const t0 = new Date(creada).getTime();
    expect(notaVencida(creada, t0 + (NOTA_VENCE_MIN - 1) * 60_000)).toBe(false);
    expect(notaVencida(creada, t0 + (NOTA_VENCE_MIN + 1) * 60_000)).toBe(true);
  });
});

describe('que va en el issue', () => {
  it('titulo: limpio y hasta 80 caracteres', () => {
    expect(tituloValido('  Arreglar   el boton  ')).toBe('Arreglar el boton');
    expect(tituloValido('x'.repeat(200))).toHaveLength(80);
    expect(tituloValido('   ')).toBeNull();
  });

  it('cuerpo: detalle, pedido textual citado, contexto y pie', () => {
    const c = cuerpoDelIssue({
      detalle: 'El boton de WhatsApp no abre en iPhone.',
      pedido: 'anota que el boton de whatsapp\nno anda',
      contexto: 'Error nuevo en crazy-miga',
      fecha: '17/10/2026',
    });
    expect(c).toContain('El boton de WhatsApp no abre en iPhone.');
    expect(c).toContain('> anota que el boton de whatsapp');
    expect(c).toContain('**Respondia a este mensaje:**\n> Error nuevo en crazy-miga');
    expect(c.endsWith('Anotado por GerenteDico desde Telegram, 17/10/2026.')).toBe(true);
  });

  it('sin contexto no hay seccion de contexto, y nunca pasa de 6000', () => {
    const c = cuerpoDelIssue({ detalle: 'x'.repeat(9000), pedido: 'y'.repeat(9000), contexto: null, fecha: 'hoy' });
    expect(c).not.toContain('Respondia');
    expect(c.length).toBeLessThanOrEqual(6000);
  });

  it('la propuesta muestra el texto exacto y pide SI', () => {
    const t = textoDePropuesta('Arreglar boton', 'cuerpo exacto');
    expect(t).toContain('Titulo: Arreglar boton');
    expect(t).toContain('cuerpo exacto');
    expect(t).toContain('el repo es publico');
    expect(t).toMatch(/Contesta SI/);
  });

  it('fecha en hora argentina', () => {
    // 02:00 UTC del 18 todavia es el 17 en Buenos Aires
    expect(fechaArgentina(new Date('2026-10-18T02:00:00Z'))).toBe('17/10/2026');
  });
});

describe('crearIssue', () => {
  const nota = { titulo: 'Arreglar boton', cuerpo: 'cuerpo' };
  const resp = (status, body = {}) => new Response(JSON.stringify(body), { status });

  it('crea en el repo de Dico con el label', async () => {
    const llamadas = [];
    const f = async (url, init) => { llamadas.push({ url, init }); return resp(201, { number: 7, html_url: 'https://github.com/x/7' }); };
    expect(await crearIssue('tok', nota, f)).toEqual({ ok: true, number: 7, url: 'https://github.com/x/7' });
    expect(llamadas[0].url).toBe(`https://api.github.com/repos/${REPO}/issues`);
    expect(llamadas[0].init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(llamadas[0].init.body)).toEqual({ title: 'Arreglar boton', body: 'cuerpo', labels: [LABEL] });
  });

  it('si GitHub rechaza el label, reintenta sin label', async () => {
    const cuerpos = [];
    const f = async (_u, init) => {
      cuerpos.push(JSON.parse(init.body));
      return cuerpos.length === 1 ? resp(422) : resp(201, { number: 8, html_url: 'u' });
    };
    expect(await crearIssue('tok', nota, f)).toMatchObject({ ok: true, number: 8 });
    expect(cuerpos[1]).toEqual({ title: 'Arreglar boton', body: 'cuerpo' });
  });

  it('token vencido o sin permiso: lo dice, no revienta', async () => {
    expect(await crearIssue('tok', nota, async () => resp(401))).toMatchObject({ ok: false, motivo: expect.stringMatching(/vencio/) });
    expect(await crearIssue('tok', nota, async () => resp(403))).toMatchObject({ ok: false, motivo: expect.stringMatching(/permiso/) });
    expect(await crearIssue('tok', nota, async () => { throw new Error('red caida'); }))
      .toMatchObject({ ok: false, motivo: expect.stringMatching(/red caida/) });
  });
});
