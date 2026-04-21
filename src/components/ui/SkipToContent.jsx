// src/components/ui/SkipToContent.jsx
// Accessible skip-to-content link, visible only on keyboard focus.
export default function SkipToContent({ target = '#main-content' }) {
  return (
    <a
      href={target}
      className="skip-to-content"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        zIndex: 9999,
        background: '#C45D3E',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '0 0 8px 0',
        fontSize: 14,
        fontWeight: 600,
        textDecoration: 'none',
      }}
      onFocus={(e) => {
        Object.assign(e.target.style, {
          left: '0', width: 'auto', height: 'auto', overflow: 'visible',
        });
      }}
      onBlur={(e) => {
        Object.assign(e.target.style, {
          left: '-9999px', width: '1px', height: '1px', overflow: 'hidden',
        });
      }}
    >
      Saltar al contenido
    </a>
  );
}
