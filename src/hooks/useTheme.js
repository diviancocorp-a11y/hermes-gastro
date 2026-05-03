// src/hooks/useTheme.js
// Theme hook - Nona Pato uses light theme only (artesanal terracotta/crema palette).
import { useState, useEffect, useCallback } from 'react';

const THEME = 'light'; // Nona Pato brand theme

export default function useTheme() {
  const [theme] = useState(THEME);

  // Ensure light theme is applied to document
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', THEME);
    document.body.style.background = '#FBF7F2';
  }, []);

  const setTheme = useCallback(() => {
    // Theme is fixed to light - no-op for compatibility
  }, []);

  const toggleTheme = useCallback(() => {
    // No-op: dark mode removed in Fase 1D cleanup. ThemeToggle component
    // queda visible pero inerte hasta su eliminación en próxima iter.
  }, []);

  // isDark always false - dark mode was removed (Fase 1D)
  const isDark = false;

  return { theme, setTheme, toggleTheme, isDark };
}
