import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PlantillaEditor from '../components/admin/platform/PlantillaEditor';
import { COCHI_SETTINGS, COCHI_PRODUCTS } from './fixtures/cochi-plantilla';


const montar = (props = {}) => {
  const onSave = vi.fn(async (v) => ({ ...COCHI_SETTINGS, ...v }));
  const r = render(
    <PlantillaEditor
      settings={COCHI_SETTINGS} productos={COCHI_PRODUCTS} onSave={onSave}
      onSubirImagen={vi.fn()} showToast={vi.fn()} {...props}
    />,
  );
  return { onSave, ...r };
};
const guardar = () => screen.getByRole('button', { name: /Sin cambios|Guardar cambios|Guardando/ });
const colorPrincipal = () => screen.getByLabelText('Color principal');

afterEach(() => cleanup());

// La vista previa es un iframe del mismo origen: se verifica lo que se le postea.
const espiarIframe = () => {
  const iframe = document.querySelector('iframe[title="Vista previa a 390 px"]');
  const post = vi.fn();
  Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
  return { iframe, post };
};

describe('PlantillaEditor', () => {
  it('con la config de Cochi arranca sin cambios y con guardar deshabilitado', () => {
    montar();
    expect(colorPrincipal().value).toBe('#eb140c');
    expect(guardar().disabled).toBe(true);
    expect(guardar().textContent).toBe('Sin cambios');
  });

  it('cambiar el color principal habilita guardar y manda una config valida', async () => {
    const { onSave } = montar();
    fireEvent.change(colorPrincipal(), { target: { value: '#112233' } });
    expect(guardar().disabled).toBe(false);
    fireEvent.click(guardar());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const valores = onSave.mock.calls[0][0];
    expect(valores.catalog_template).toBe('pop');
    expect(valores.catalog_template_config.marca.primario).toBe('#112233');
    expect(valores.catalog_template_config.marca.fondo).toBe('#f5f0dc');
    await waitFor(() => expect(guardar().textContent).toBe('Sin cambios'));
  });

  it('un hex invalido marca el campo, enlaza el error y no guarda', () => {
    const { onSave } = montar();
    fireEvent.change(colorPrincipal(), { target: { value: '#12' } });
    const campo = colorPrincipal();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    const err = document.getElementById(`${campo.id}-err`);
    expect(err.textContent).toMatch(/#RRGGBB/);
    expect(campo.getAttribute('aria-describedby')).toContain(err.id);
    expect(guardar().disabled).toBe(true);
    fireEvent.submit(campo.closest('form'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('un texto de contraste bajo muestra el aviso por escrito', () => {
    montar();
    fireEvent.change(colorPrincipal(), { target: { value: '#f5f0dc' } });
    expect(screen.getAllByText(/Contraste bajo/).length).toBeGreaterThan(0);
  });

  it('el rechazo del servidor se muestra arriba del boton guardar', async () => {
    const onSave = vi.fn(async () => ({ __error: 'new row violates check constraint "settings_catalog_template_config_check"' }));
    montar({ onSave });
    fireEvent.change(colorPrincipal(), { target: { value: '#112233' } });
    fireEvent.click(guardar());
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toMatch(/El servidor no aceptó la configuración/);
    expect(guardar().disabled).toBe(false);
  });

  it('subir una seccion cambia el orden y habilita guardar', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Subir Cinta de frases' }));
    expect(guardar().disabled).toBe(false);
  });
});

describe('vista previa en iframe', () => {
  it('postea el borrador valido al iframe, y conserva el ultimo valido si el borrador se rompe', () => {
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    montar();
    const { iframe, post } = espiarIframe();
    expect(iframe.getAttribute('src')).toBe('/admin/vista-previa-plantilla');
    fireEvent.change(colorPrincipal(), { target: { value: '#112233' } });
    fireEvent.load(iframe);
    const ult = () => post.mock.calls.at(-1);
    expect(ult()[0].tipo).toBe('plantilla-vista');
    expect(ult()[0].config.marca.primario).toBe('#112233');
    expect(ult()[1]).toBe(window.location.origin);
    fireEvent.change(colorPrincipal(), { target: { value: '#12' } });
    fireEvent.load(iframe);
    expect(ult()[0].config.marca.primario).toBe('#112233');
    expect(screen.getByText(/última versión válida/)).toBeTruthy();
    post.mockClear();
    window.dispatchEvent(new MessageEvent('message', { data: { tipo: 'plantilla-vista-lista' }, origin: window.location.origin, source: iframe.contentWindow }));
    expect(post).toHaveBeenCalled();
  });
});
