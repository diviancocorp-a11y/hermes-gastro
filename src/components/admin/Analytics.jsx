// src/components/admin/Analytics.jsx
// Analytics dashboard. Cada widget va envuelto en AnaCard del sistema visual v2.
import SalesChart from './analytics/SalesChart';
import TopProducts from './analytics/TopProducts';
import CohortAnalysis from './analytics/CohortAnalysis';
import TicketByChannel from './analytics/TicketByChannel';
import SalesHeatmap from './analytics/SalesHeatmap';
import CheckoutFunnel from './analytics/CheckoutFunnel';
import AnaCard from './shared/cards/AnaCard';

export default function Analytics({ sales, orders, recipes, calculateRecipeCost }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
      <SalesChart sales={sales} Wrapper={AnaCard} />
      <TopProducts sales={sales} recipes={recipes} calculateRecipeCost={calculateRecipeCost} Wrapper={AnaCard} />
      <CohortAnalysis orders={orders} Wrapper={AnaCard} />
      <TicketByChannel orders={orders} Wrapper={AnaCard} />
      <SalesHeatmap orders={orders} Wrapper={AnaCard} />
      <CheckoutFunnel orders={orders} Wrapper={AnaCard} />
    </div>
  );
}
