import React from 'react';
import { MarketAlertPanel } from './UexInsightsPage';

export default function MarketAlertsPage() {
  return (
    <div className="page-shell uex-market-alerts-page" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="eyebrow">UEX CORP · ALERTAS</div>
          <h1>Alertas de Compra</h1>
          <p className="page-subtitle">Configure e acompanhe ofertas do mercado UEX em uma tela dedicada, com análise manual e automática, filtros de qualidade, preço e atividade do vendedor.</p>
        </div>
      </div>
      <div className="uex-insights-scroll">
        <div className="uex-insights-panel-enter">
          <MarketAlertPanel />
        </div>
      </div>
    </div>
  );
}
