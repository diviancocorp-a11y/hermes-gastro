// src/components/ui/LanguageSelector.jsx
// Dropdown for switching the app's display language.
import { useTranslation } from 'react-i18next';
import { AVAILABLE_LOCALES } from '../../lib/i18n';

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <label
        htmlFor="lang-select"
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}
      >
        🌐 Idioma
      </label>
      <select
        id="lang-select"
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1.5px solid var(--b2)',
          background: 'var(--bg)',
          color: 'var(--tx)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {AVAILABLE_LOCALES.map((loc) => (
          <option key={loc.code} value={loc.code}>
            {loc.name}
          </option>
        ))}
      </select>
    </div>
  );
}
