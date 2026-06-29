import React from 'react';
import { Shield, CheckCircle2, Star, HardHat, Shirt, Dumbbell, Footprints, Backpack } from 'lucide-react';

const PIECE_ICONS = {
  Helmet: HardHat,
  Torso: Shirt,
  Arms: Dumbbell,
  Legs: Footprints,
  Backpack: Backpack,
};

const PIECE_LABELS = {
  Helmet: 'Cap.', Torso: 'Torso', Arms: 'Braços', Legs: 'Pernas', Backpack: 'Mochila',
};

const TYPE_LABELS = { Light: 'LEVE', Médio: 'MÉDIO', Heavy: 'PESADO', Special: 'ESPECIAL' };

export default function ArmorSetCard({ set, onClick }) {
  const pieces = set.pieces || [];
  const total = pieces.length;
  const owned = pieces.filter(p => p.owned).length;
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const isComplete = owned === total && total > 0;
  const typeClass = `type-${set.type?.toLowerCase()}`;
  const badgeClass = `badge-${set.type?.toLowerCase()}`;

  return (
    <div
      className={`armor-card ${typeClass} ${isComplete ? 'owned' : ''}`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Visual */}
      <div className="armor-card-image">
        <div className="armor-card-bg-gradient" />
        <div className="armor-icon-placeholder">
          <div className="armor-icon-ring" />
          <div className="armor-icon-inner">
            {isComplete ? <CheckCircle2 size={28} /> : <Shield size={28} />}
          </div>
        </div>
        {isComplete && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,229,160,0.2)', border: '1px solid rgba(0,229,160,0.5)',
            borderRadius: 4, padding: '2px 7px',
            fontFamily: 'Orbitron, monospace', fontSize: 9, fontWeight: 700,
            color: 'var(--type-light)', letterSpacing: '0.12em',
          }}>COMPLETO</div>
        )}
      </div>

      {/* Body */}
      <div className="armor-card-body">
        <div className="armor-card-header">
          <div>
            <div className="armor-card-name">{set.set_name}</div>
            <div className="armor-card-manufacturer">{set.manufacturer}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <span className={`armor-type-badge ${badgeClass}`}>{TYPE_LABELS[set.type] || set.type}</span>
            <span className={`rarity-badge rarity-${set.rarity}`}>{set.rarity}</span>
          </div>
        </div>

        {/* Pieces progress */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Peças
            </span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: owned === total ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
              {owned}/{total}
            </span>
          </div>
          {/* Piece chips */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {pieces.map(p => {
              const Icon = PIECE_ICONS[p.piece_type] || Shield;
              return (
                <div key={p.id} title={p.piece_name} style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  padding: '3px 7px', borderRadius: 4,
                  background: p.owned ? 'rgba(0,229,160,0.12)' : p.wishlist ? 'rgba(255,196,54,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${p.owned ? 'rgba(0,229,160,0.35)' : p.wishlist ? 'rgba(255,196,54,0.25)' : 'var(--border-subtle)'}`,
                  fontSize: 10, fontWeight: 700,
                  color: p.owned ? 'var(--accent-green)' : p.wishlist ? 'var(--accent-gold)' : 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  transition: 'all 0.2s',
                }}>
                  <Icon size={10} />
                  {PIECE_LABELS[p.piece_type] || p.piece_type}
                </div>
              );
            })}
          </div>
          {/* Progresso bar */}
          <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: 2,
              background: isComplete
                ? 'linear-gradient(to right, #00b37d, var(--type-light))'
                : `linear-gradient(to right, var(--accent-secondary), var(--accent-primary))`,
              boxShadow: isComplete ? '0 0 6px rgba(0,229,160,0.5)' : 'none',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        {/* Click hint */}
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)',
          fontSize: 11, color: 'var(--text-muted)', textAlign: 'center',
          letterSpacing: '0.08em', fontWeight: 600,
        }}>
          CLIQUE PARA GERENCIAR PEÇAS
        </div>
      </div>
    </div>
  );
}
