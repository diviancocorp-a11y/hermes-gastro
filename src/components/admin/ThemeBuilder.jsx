import { useState, useEffect, useCallback } from 'react';
import {
  fetchActiveTheme, applyTheme, deriveDarkPalette, saveTheme,
  activateTheme, refreshTheme, DEFAULT_THEME,
  PRESET_PALETTES, PRESET_FONTS,
} from '../../services/theme';

const COLOR_FIELDS = [
  { key: 'color_bg', label: 'Fondo' },
  { key: 'color_bg2', label: 'Fondo secundario' },
  { key: 'color_bg3', label: 'Fondo terciario' },
  { key: 'color_tx', label: 'Texto principal' },
  { key: 'color_t2', label: 'Texto secundario' },
  { key: 'color_t3', label: 'Texto terciario' },
  { key: 'color_accent', label: 'Acento (primario)' },
  { key: 'color_accent_light', label: 'Acento claro' },
];

export default function ThemeBuilder({ msg, onClose }) {
  const [theme, setTheme] = useState({ ...DEFAULT_THEME });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState('light');

  const load = useCallback(async () => {
    const t = await fetchActiveTheme();
    setTheme({ ...DEFAULT_THEME, ...t });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (key, val) => setTheme(prev => ({ ...prev, [key]: val }));

  // Live preview: apply on every change
  useEffect(() => {
    if (!loading) applyTheme(theme);
  }, [theme, loading]);

  const applyPresetPalette = (preset) => {
    const dark = deriveDarkPalette(preset);
    setTheme(prev => ({ ...prev, ...preset, ...dark }));
  };

  const applyPresetFont = (preset) => {
    setTheme(prev => ({ ...prev, ...preset }));
  };

  const autoDark = () => {
    const dark = deriveDarkPalette(theme);
    setTheme(prev => ({ ...prev, ...dark }));
    msg('Paleta oscura generada automáticamente');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveTheme(theme);
      if (saved?.id && !theme.id) setTheme(prev => ({ ...prev, id: saved.id }));
      if (theme.id) await activateTheme(theme.id);
      await refreshTheme();
      msg('Tema guardado y aplicado');
    } catch (err) {
      msg('Error al guardar tema');
      console.error(err);
    }
    setSaving(false);
  };

  const handleReset = () => {
    const dark = deriveDarkPalette(DEFAULT_THEME);
    setTheme({ ...DEFAULT_THEME, ...dark, id: theme.id });
    msg('Restaurado a valores por defecto');
  };

  if (loading) {
    return (
      <div className="ov" onClick={e => e.target.classList.contains("ov") && onClose()}>
        <div className="ov-c" style={{ maxWidth: 560 }}>
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>Cargando tema...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ov" onClick={e => e.target.classList.contains("ov") && onClose()}>
      <div className="ov-c" style={{ maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1, paddingBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>🎨 Constructor de Tema</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="abtn" onClick={handleReset} style={{ padding: '4px 10px', fontSize: 12 }}>Resetear</button>
            <button className="abtn" onClick={onClose} style={{ padding: '4px 12px', fontSize: 13 }}>✕</button>
          </div>
        </div>

        {/* ── Preset Palettes ── */}
        <Section title="Paletas predefinidas">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESET_PALETTES.map(p => (
              <button key={p.name} onClick={() => applyPresetPalette(p)}
                style={{
                  padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--br, #ddd)',
                  background: theme.color_accent === p.color_accent ? 'var(--al)' : 'var(--b3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: p.color_accent, display: 'inline-block', border: '1px solid rgba(0,0,0,.1)' }} />
                {p.name}
              </button>
            ))}
          </div>
        </Section>

        {/* ── Color Palette (Light) ── */}
        <Section title="Colores (modo claro)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {COLOR_FIELDS.map(f => (
              <ColorInput key={f.key} label={f.label} value={theme[f.key]} onChange={v => set(f.key, v)} />
            ))}
          </div>
        </Section>

        {/* ── Dark palette ── */}
        <Section title="Colores (modo oscuro)">
          <button onClick={autoDark}
            style={{ marginBottom: 10, padding: '6px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--br,#ddd)', background: 'var(--b3)', cursor: 'pointer' }}>
            🌙 Auto-generar desde paleta clara
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { key: 'dark_bg', label: 'Fondo' }, { key: 'dark_bg2', label: 'Fondo 2' },
              { key: 'dark_bg3', label: 'Fondo 3' }, { key: 'dark_tx', label: 'Texto' },
              { key: 'dark_t2', label: 'Texto 2' }, { key: 'dark_t3', label: 'Texto 3' },
              { key: 'dark_accent', label: 'Acento' }, { key: 'dark_accent_light', label: 'Acento claro' },
            ].map(f => (
              <ColorInput key={f.key} label={f.label} value={theme[f.key]} onChange={v => set(f.key, v)} />
            ))}
          </div>
        </Section>

        {/* ── Typography ── */}
        <Section title="Tipografía">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {PRESET_FONTS.map(f => (
              <button key={f.name} onClick={() => applyPresetFont(f)}
                style={{
                  padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--br, #ddd)',
                  background: theme.font_body === f.font_body ? 'var(--al)' : 'var(--b3)',
                  cursor: 'pointer', fontFamily: f.font_body,
                }}>
                {f.name}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <TextInput label="Fuente títulos" value={theme.font_heading} onChange={v => set('font_heading', v)} />
            <TextInput label="Fuente cuerpo" value={theme.font_body} onChange={v => set('font_body', v)} />
          </div>
          <TextInput label="URL Google Fonts" value={theme.font_url} onChange={v => set('font_url', v)} style={{ marginTop: 8 }} />
        </Section>

        {/* ── Border Radii ── */}
        <Section title="Bordes redondeados">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <RangeInput label="Pequeño (sm)" value={theme.radius_sm} min={0} max={30} onChange={v => set('radius_sm', v)} />
            <RangeInput label="Base" value={theme.radius_base} min={0} max={40} onChange={v => set('radius_base', v)} />
            <RangeInput label="Grande (lg)" value={theme.radius_lg} min={0} max={50} onChange={v => set('radius_lg', v)} />
          </div>
          {/* Preview boxes */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {[theme.radius_sm, theme.radius_base, theme.radius_lg].map((r, i) => (
              <div key={i} style={{ width: 60, height: 40, borderRadius: `${r}px`, background: 'var(--ac)', opacity: 0.8 }} />
            ))}
          </div>
        </Section>

        {/* ── Live Preview ── */}
        <Section title="Vista previa">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => { setPreviewMode('light'); document.documentElement.setAttribute('data-theme', 'light'); }}
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--br,#ddd)', background: 'var(--ac)', color: '#fff', cursor: 'pointer' }}>☀️ Claro</button>
          </div>
          <PreviewCard theme={theme} />
        </Section>

        {/* ── Save ── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, position: 'sticky', bottom: 0, background: 'var(--bg)', paddingTop: 12, paddingBottom: 4 }}>
          <button className="abtn" onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '12px', fontSize: 15, fontWeight: 600, background: 'var(--ac)', color: '#fff', borderRadius: `${theme.radius_base}px`, border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando...' : '💾 Guardar tema'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper components ──────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>{title}</div>
      {children}
    </div>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
        style={{ width: 32, height: 32, border: '1px solid var(--br,#ddd)', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'monospace' }}>{value}</div>
      </div>
    </label>
  );
}

function TextInput({ label, value, onChange, style }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{label}</span>
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--br,#ddd)', fontSize: 13, background: 'var(--b3)', color: 'var(--tx)' }} />
    </label>
  );
}

function RangeInput({ label, value, min, max, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', minWidth: 80 }}>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--ac)' }} />
      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--t3)', minWidth: 32, textAlign: 'right' }}>{value}px</span>
    </label>
  );
}

function PreviewCard({ theme }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--br,#ddd)', borderRadius: `${theme.radius_base}px`, padding: 16 }}>
      <div style={{ fontFamily: `'${theme.font_heading}', serif`, fontSize: 18, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>
        Título de ejemplo
      </div>
      <div style={{ fontFamily: `'${theme.font_body}', sans-serif`, fontSize: 14, color: 'var(--t2)', marginBottom: 12 }}>
        Este es un texto de prueba para ver cómo se ve la tipografía y los colores en contexto real.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ padding: '8px 16px', borderRadius: `${theme.radius_sm}px`, background: 'var(--ac)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: `'${theme.font_body}', sans-serif` }}>
          Botón primario
        </button>
        <button style={{ padding: '8px 16px', borderRadius: `${theme.radius_sm}px`, background: 'var(--al)', color: 'var(--ac)', border: '1px solid var(--ac)', fontSize: 13, fontWeight: 600, fontFamily: `'${theme.font_body}', sans-serif` }}>
          Botón secundario
        </button>
      </div>
    </div>
  );
}
