// Telefono para WhatsApp segun el pais del tenant. waPhoneAr le antepone 549 a
// todo, incluso a un numero venezolano (Cochi, el primer dia).
import { describe, it, expect } from 'vitest';
import { waPhone, waPhoneAr } from '@dico/core/lib/utils.jsx';

describe('waPhone', () => {
  it('Venezuela: el 0 de larga distancia sale y se antepone 58, nunca 549', () => {
    expect(waPhone('0414-1234567', 'VE')).toBe('584141234567');
    expect(waPhone('04141234567', 've')).toBe('584141234567');
    expect(waPhone('4141234567', 'VE')).toBe('584141234567');
    expect(waPhone('0212 555 6789', 'VE')).toBe('582125556789');
  });
  it('si el numero ya trae codigo de pais se respeta', () => {
    expect(waPhone('584141234567', 'VE')).toBe('584141234567');
    expect(waPhone('+58 414 123 4567', 'VE')).toBe('584141234567');
    expect(waPhone('00584141234567', 'VE')).toBe('584141234567');
    // un numero argentino que un cliente de un negocio venezolano escribe completo
    expect(waPhone('+54 9 11 5555-0000', 'VE')).toBe('5491155550000');
  });
  it('un numero que ya es internacional de otro pais no se prefija', () => {
    // largo > maximo nacional del pais: ya trae su codigo (aca, Argentina)
    expect(waPhone('5490000000000', 'VE')).toBe('5490000000000');
    expect(waPhone('04141234567', 'VE')).toBe('584141234567');
    expect(waPhone('4141234567', 'VE')).toBe('584141234567');
    expect(waPhone('5491155550000', 'UY')).toBe('5491155550000');
    expect(waPhone('98765432', 'UY')).toBe('59898765432');
  });
  it('Argentina, sin pais o pais desconocido: identico a waPhoneAr de hoy', () => {
    for (const raw of ['3814123456', '03814123456', '5493814123456', '+54 9 381 412-3456', '54 381 4123456', '+54 11 5412 3456', '1155550000', '']) {
      expect(waPhone(raw, 'AR')).toBe(waPhoneAr(raw));
      expect(waPhone(raw)).toBe(waPhoneAr(raw));
      expect(waPhone(raw, null)).toBe(waPhoneAr(raw));
      expect(waPhone(raw, 'ZZ')).toBe(waPhoneAr(raw));
    }
    expect(waPhone('3814123456', 'AR')).toBe('5493814123456');
  });
  it('vacio o sin digitos devuelve null', () => {
    expect(waPhone('', 'VE')).toBeNull();
    expect(waPhone(null, 'VE')).toBeNull();
    expect(waPhone('abc', 'CL')).toBeNull();
  });
  it('otros paises usan su codigo', () => {
    expect(waPhone('09 8765 4321', 'CL')).toBe('56987654321');
    expect(waPhone('3001234567', 'CO')).toBe('573001234567');
  });
});
