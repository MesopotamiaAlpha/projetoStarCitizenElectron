import React from 'react';
import { BellRing, CircleDollarSign, ListChecks, PackageSearch } from 'lucide-react';

const ACTIONS = [
  { key: 'missions', label: 'Missões ativas', icon: ListChecks, color: 'var(--accent-secondary)', target: 'missions' },
  { key: 'pendingMaterials', label: 'Materiais pendentes', icon: PackageSearch, color: 'var(--accent-primary)', target: 'materials' },
  { key: 'activeAlertMatches', label: 'Ofertas monitoradas', icon: BellRing, color: 'var(--accent-gold)', target: 'uexalerts' },
  { key: 'todayRevenue', label: 'Receita de hoje', icon: CircleDollarSign, color: 'var(--accent-green)', target: 'uexsales', currency: true },
];

function formatValue(value, action) {
  const number = Math.max(0, Number(value) || 0);
  if (action.currency) return `${number.toLocaleString('pt-BR')} aUEC`;
  return number.toLocaleString('pt-BR');
}

function formatCaption(value, action) {
  const number = Math.max(0, Number(value) || 0);
  if (action.currency) return number > 0 ? 'Receita registrada hoje' : 'Nenhuma receita registrada hoje';
  return number > 0 ? `${number.toLocaleString('pt-BR')} pendência${number === 1 ? '' : 's'} para revisar` : 'Nenhuma pendência identificada';
}

export default function OperationalStatusBar({ overview, activeMissionsCount = 0, onNavigate }) {
  const values = {
    missions: activeMissionsCount,
    pendingMaterials: overview?.pendingMaterials,
    activeAlertMatches: overview?.activeAlertMatches,
    todayRevenue: overview?.todayRevenue,
  };

  return (
    <section className="operational-status-bar" aria-label="Centro operacional">
      <div className="operational-status-heading">
        <span className="operational-status-eyebrow">CENTRO OPERACIONAL</span>
        <span className="operational-status-caption">Ações que merecem atenção agora</span>
      </div>
      <div className="operational-status-actions">
        {ACTIONS.map(action => {
          const Icon = action.icon;
          const content = (
            <>
              <span className="operational-status-icon" style={{ color: action.color }}><Icon size={16} /></span>
              <span className="operational-status-copy">
                <strong>{formatValue(values[action.key], action)}</strong>
                <small>{action.label} · {formatCaption(values[action.key], action)}</small>
              </span>
              <span className="operational-status-arrow" aria-hidden="true">›</span>
            </>
          );
              const ariaLabel = `${action.label}: ${formatValue(values[action.key], action)}. ${formatCaption(values[action.key], action)}.`;
          return onNavigate ? (
            <button key={action.key} type="button" className="operational-status-action" onClick={() => onNavigate(action.target)} aria-label={`Abrir ${action.label}. ${ariaLabel}`}>
              {content}
            </button>
          ) : <div key={action.key} className="operational-status-action" role="status" aria-label={ariaLabel}>{content}</div>;
        })}
      </div>
    </section>
  );
}
