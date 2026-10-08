import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  venimosDeTelegram, rgbAHex, aplicarColores, iniciarMiniApp, enlazarAtras,
} from '../lib/telegram';

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = '';
});

describe('venimosDeTelegram', () => {
  it('fuera de Telegram da false y no deja marca', () => {
    expect(venimosDeTelegram()).toBe(false);
    expect(sessionStorage.getItem('dico_tg')).toBeNull();
  });

  it('reconoce el hash con el que Telegram abre la mini app', () => {
    window.location.hash = '#tgWebAppData=query_id%3DAAA&tgWebAppVersion=8.0';
    expect(venimosDeTelegram()).toBe(true);
  });

  it('se acuerda en la sesion cuando el router ya perdio el hash', () => {
    window.location.hash = '#tgWebAppPlatform=android';
    expect(venimosDeTelegram()).toBe(true);
    window.location.hash = '';
    expect(venimosDeTelegram()).toBe(true);
  });
});

describe('rgbAHex', () => {
  it('convierte rgb y rgba opacos', () => {
    expect(rgbAHex('rgb(243, 163, 158)')).toBe('#f3a39e');
    expect(rgbAHex('rgba(0, 0, 0, 1)')).toBe('#000000');
    expect(rgbAHex('rgb(255 255 255)')).toBe('#ffffff');
  });

  it('rechaza transparente y lo que no entiende', () => {
    expect(rgbAHex('rgba(0, 0, 0, 0)')).toBeNull();
    expect(rgbAHex('transparent')).toBeNull();
    expect(rgbAHex('')).toBeNull();
    expect(rgbAHex(undefined)).toBeNull();
  });
});

describe('integracion con el cliente de Telegram', () => {
  const falso = () => ({
    ready: vi.fn(), expand: vi.fn(), disableVerticalSwipes: vi.fn(),
    setHeaderColor: vi.fn(), setBackgroundColor: vi.fn(), setBottomBarColor: vi.fn(),
    BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
  });

  it('inicia expandida y pinta con el color del negocio', () => {
    const tg = falso();
    aplicarColores(tg, '#f3a39e');
    expect(tg.setHeaderColor).toHaveBeenCalledWith('#f3a39e');
    expect(tg.setBackgroundColor).toHaveBeenCalledWith('#f3a39e');
    expect(tg.setBottomBarColor).toHaveBeenCalledWith('#f3a39e');

    iniciarMiniApp(tg);
    expect(tg.ready).toHaveBeenCalled();
    expect(tg.expand).toHaveBeenCalled();
    expect(tg.disableVerticalSwipes).toHaveBeenCalled();
  });

  it('una version de Telegram sin esos metodos no tira abajo la pagina', () => {
    const viejo = { ready: vi.fn() };
    expect(() => iniciarMiniApp(viejo)).not.toThrow();
    expect(() => aplicarColores(viejo, '#000000')).not.toThrow();
    expect(() => iniciarMiniApp(null)).not.toThrow();
    expect(viejo.ready).toHaveBeenCalled();
  });

  it('sin color no pinta nada', () => {
    const tg = falso();
    aplicarColores(tg, null);
    expect(tg.setHeaderColor).not.toHaveBeenCalled();
  });

  it('el Atras se muestra, vuelve un paso y se desengancha', () => {
    const tg = falso();
    const onBack = vi.fn();
    const soltar = enlazarAtras(tg, { visible: true, onBack });
    expect(tg.BackButton.show).toHaveBeenCalled();
    expect(tg.BackButton.onClick).toHaveBeenCalledWith(onBack);
    soltar();
    expect(tg.BackButton.offClick).toHaveBeenCalledWith(onBack);
  });

  it('sin nada para volver, el Atras se esconde y no engancha handler', () => {
    const tg = falso();
    const soltar = enlazarAtras(tg, { visible: false, onBack: vi.fn() });
    expect(tg.BackButton.hide).toHaveBeenCalled();
    expect(tg.BackButton.onClick).not.toHaveBeenCalled();
    expect(() => soltar()).not.toThrow();
  });
});
