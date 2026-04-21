// src/components/ui/ThemeToggle.jsx
// Toggle switch for dark/light mode.
import useTheme from '../../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
        {isDark ? '🌙' : '☀️'} Modo {isDark ? 'oscuro' : 'claro'}
      </span>
      <button
        onClick={toggleTheme}
        role="switch"
        aria-checked={isDark}
        aria-label={`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}
        style={{
          position: 'relative',
          width: 48,
          height: 26,
          borderRadius: 13,
          background: isDark ? 'var(--ac)' : 'var(--b2)',
          border: '1.5px solid',
          borderColor: isDark ? 'var(--ac)' : 'var(--t3)',
          cursor: 'pointer',
          transition: 'background 0.2s, border-color 0.2s',
          padding: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: isDark ? 24 : 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: isDark ? '#fff' : 'var(--t3)',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  );
}
