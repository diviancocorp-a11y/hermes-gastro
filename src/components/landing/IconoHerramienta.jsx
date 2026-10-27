const TRAZOS = {
  catalogo: 'M7 2h10v20H7zM10 18h4',
  mesas: 'M3 8h18M5 4h14v4H5zM6 8l-2 13M18 8l2 13',
  cocina: 'M7 14a5 5 0 0 1-1-10 6 6 0 0 1 12 0 5 5 0 0 1-1 10v6H7zM7 17h10',
  receta: 'M7 4H4v18h16V4h-3M8 2h8v4H8zM8 10h8M8 14h8M8 18h5',
  stock: 'M3 7l9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5M12 12v10M7 5l10 5',
  caja: 'M4 11h16v10H4zM7 3h10v8H7zM10 6h4M7 15h2M12 15h2M17 15h0M7 18h10',
  equipo: 'M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 22v-3a8 8 0 0 1 16 0v3',
  resultados: 'M3 21h18M5 17v-5h3v5M11 17V7h3v10M17 17V3h3v14',
  agenda: 'M3 5h18v17H3zM7 2v6M17 2v6M3 10h18M7 14h3M14 14h3M7 18h3',
  variantes: 'M3 3h8l10 10-8 8L3 11zM7 7h.01',
};

export default function IconoHerramienta({ nombre }) {
  const n = nombre.toLowerCase();
  const tipo = /agenda|reserva/.test(n) ? 'agenda' : /catálogo|pedidos/.test(n) ? 'catalogo'
    : /mesa/.test(n) ? 'mesas' : /cocina/.test(n) ? 'cocina' : /receta|plato/.test(n) ? 'receta'
      : /caja|cobro|ventas/.test(n) ? 'caja' : /personal|fichaje/.test(n) ? 'equipo'
        : /talles|colores/.test(n) ? 'variantes' : /stock|insumo|consumo|producto|mínimo/.test(n) ? 'stock' : 'resultados';
  return <svg className="rn-icono-herramienta" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={TRAZOS[tipo]} /></svg>;
}
