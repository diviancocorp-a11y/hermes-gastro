// Catálogo Pro — iconos lineales 1.5px, geométricos, sin emoji.
// Heredan currentColor. Portado de primitives.jsx del prototipo.

export default function Icon({ name, size = 20, stroke = 1.5, style = {} }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "block", ...style },
  };
  switch (name) {
    case "bag": return <svg {...common}><path d="M6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>;
    case "cart": return <svg {...common}><path d="M3 4h2l2 12h11"/><path d="M7 8h13l-1.5 7H7"/><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></svg>;
    case "user": return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case "filter": return <svg {...common}><path d="M4 6h16M7 12h10M10 18h4"/></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "arrow-left": return <svg {...common}><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg>;
    case "arrow-right": return <svg {...common}><path d="M5 12h14m0 0-6-6m6 6-6 6"/></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case "minus": return <svg {...common}><path d="M5 12h14"/></svg>;
    case "check": return <svg {...common}><path d="m4 12 5 5L20 6"/></svg>;
    case "x": return <svg {...common}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case "heart": return <svg {...common}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/></svg>;
    case "heart-fill": return <svg {...common} fill="currentColor" stroke="none"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "pin": return <svg {...common}><path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case "home": return <svg {...common}><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></svg>;
    case "truck": return <svg {...common}><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>;
    case "cash": return <svg {...common}><rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.5"/></svg>;
    case "card": return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>;
    case "bank": return <svg {...common}><path d="M3 10 12 4l9 6"/><path d="M5 10v8m4-8v8m6-8v8m4-8v8"/><path d="M3 20h18"/></svg>;
    case "gift": return <svg {...common}><path d="M3 9h18v4H3z"/><path d="M5 13v8h14v-8"/><path d="M12 9v12"/><path d="M9 9a3 3 0 0 1 0-6c1.5 0 3 3 3 6 0-3 1.5-6 3-6a3 3 0 0 1 0 6"/></svg>;
    case "ticket": return <svg {...common}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z"/></svg>;
    case "sparkle": return <svg {...common}><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>;
    case "menu-dots": return <svg {...common}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>;
    case "bell": return <svg {...common}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>;
    case "circle": return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
    case "dot": return <svg {...common} viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="currentColor" stroke="none"/></svg>;
    case "chevron-right": return <svg {...common}><path d="m9 6 6 6-6 6"/></svg>;
    case "chevron-down": return <svg {...common}><path d="m6 9 6 6 6-6"/></svg>;
    case "upload": return <svg {...common}><path d="M12 17V5m0 0-4 4m4-4 4 4"/><path d="M4 19h16"/></svg>;
    default: return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
  }
}
