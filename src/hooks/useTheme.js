// src/hooks/useTheme.js
// Dark mode hook with localStorage persistence + prefers-color-scheme fallback.
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'lnp-theme';

/**
 * Reads the user's stored or system theme preference.
 * Returns 'dark' | 'light'.
 */
function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  // Fall back to system preference
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export default function useTheme() {
  const [theme, setThemeState] = useState(getInitialTheme);

  // Apply data-theme attribute to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    // Also update body background for instant flash-free paint
    document.body.style.background = theme === 'dark' ? '#1A1210' : '#FBF7F2';
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e) => {
      // Only auto-switch if user hasn't explicitly chosen
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return; // user made an explicit choice
      } catch {}
      setThemeState(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' };
}
