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

  return { theme, setTheme, isDark };
}
