// src/test/theme.test.js
import { describe, it, expect } from 'vitest';
import { DEFAULT_THEME, applyTheme, clearAppliedTheme } from '../services/theme';

describe('theme service', () => {
  it('DEFAULT_THEME has all required keys', () => {
    for (const k of ['color_bg', 'color_accent', 'font_heading', 'font_body', 'radius_base', 'radius_sm', 'radius_lg']) {
      expect(DEFAULT_THEME[k]).toBeDefined();
    }
  });

  it('applyTheme sin argumento aplica el default en :root', () => {
    applyTheme();
    const s = document.documentElement.style;
    expect(s.getPropertyValue('--bg')).toBe(DEFAULT_THEME.color_bg);
    expect(s.getPropertyValue('--ac')).toBe(DEFAULT_THEME.color_accent);
    expect(s.getPropertyValue('--r')).toBe(`${DEFAULT_THEME.radius_base}px`);
  });

  it('clearAppliedTheme releases root variables and font link', () => {
    applyTheme(DEFAULT_THEME);
    expect(document.documentElement.style.getPropertyValue('--bg')).toBeTruthy();
    expect(document.getElementById('theme-font-link')).not.toBeNull();

    clearAppliedTheme();

    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--font-body')).toBe('');
    expect(document.getElementById('theme-font-link')).toBeNull();
  });
});
