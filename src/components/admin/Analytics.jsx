// src/components/admin/Analytics.jsx
// Analytics dashboard. Cada widget va envuelto en AnaCard del sistema visual v2.
import { useMemo } from 'react';
import SalesChart from './analytics/SalesChart';
import TopProducts from './analytics/TopProducts';
import CohortAnalysis from './analytics/CohortAnalysis';
import TicketByChannel from './analytics/TicketByChannel';
import SalesHeatmap from './analytics/SalesHeatmap';
import CheckoutFunnel from './analytics/CheckoutFunnel';
import AnaCard from './shared/cards/AnaCard';
import AnimatedStatCard from './shared/cards/AnimatedStatCard';
import { formatInt } from '../../lib/utils';

export default function Analytics({ sales, orders, recipes, calculateRecipeCost }) {
  // Card animado de cabecera: ventas de los ultimos 14 dias + delta real
  // contra los 14 anteriores (hover resalta dias sobre el promedio).
  const last14 = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, value: 0 });
    }
    let prevTotal = 0;
    const firstIso = days[0].iso;
    const prevStart = new Date(now); prevStart.setDate(prevStart.getDate() - 27);
    const prevStartIso = prevStart.toISOString().slice(0, 10);
    (sales || []).forEach(s => {
      const d = (s.date || '').slice(0, 10);
      const hit = days.find(x => x.iso === d);
      if (hit) hit.value += s.total || 0;
      else if (d >= prevStartIso && d < firstIso) prevTotal += s.total || 0;
    });
    const total = days.reduce((a, x) => a + x.value, 0);
    const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
    return { days, total, delta };
  }, [sales]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
      <AnimatedStatCard
        title="Ventas últimos 14 días"
        description="Pasá el dedo o el mouse para ver el detalle"
        value={`$${formatInt(last14.total)}`}
        deltaPct={last14.delta}
        bars={last14.days}
        mainColor="var(--ag-c-sales)"
        secondaryColor="var(--ag-c-stock)"
      />
      <SalesChart sales={sales} Wrapper={AnaCard} />
      <TopProducts sales={sales} recipes={recipes} calculateRecipeCost={calculateRecipeCost} Wrapper={AnaCard} />
      <CohortAnalysis orders={orders} Wrapper={AnaCard} />
      <TicketByChannel orders={orders} Wrapper={AnaCard} />
      <SalesHeatmap orders={orders} Wrapper={AnaCard} />
      <CheckoutFunnel orders={orders} Wrapper={AnaCard} />
    </div>
  );
}
