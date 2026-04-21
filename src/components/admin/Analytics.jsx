// src/components/admin/Analytics.jsx
// Analytics dashboard tab: composes all analytics widgets.
import SalesChart from './analytics/SalesChart';
import TopProducts from './analytics/TopProducts';
import CohortAnalysis from './analytics/CohortAnalysis';
import TicketByChannel from './analytics/TicketByChannel';
import SalesHeatmap from './analytics/SalesHeatmap';
import CheckoutFunnel from './analytics/CheckoutFunnel';

export default function Analytics({ sales, orders, recipes, calculateRecipeCost }) {
  return (
    <>
      <div className="s" style={{ paddingTop: 4 }}>
        <div className="st">📊 Analytics</div>
      </div>
      <div className="s" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SalesChart sales={sales} />
        <TopProducts sales={sales} recipes={recipes} calculateRecipeCost={calculateRecipeCost} />
        <CohortAnalysis orders={orders} />
        <TicketByChannel orders={orders} />
        <SalesHeatmap orders={orders} />
        <CheckoutFunnel orders={orders} />
      </div>
    </>
  );
}
