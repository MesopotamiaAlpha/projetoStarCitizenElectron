import React, { useState, useMemo } from 'react';
import { Search, Shield } from 'lucide-react';
import ArmorSetCard from '../components/ArmorSetCard';
import ArmorSetModal from '../components/ArmorSetModal';

const TYPE_LABELS = { Light:'Leve', Médio:'Médio', Heavy:'Pesado', Special:'Especial' };
const SORT_OPTIONS = [
  { value:'name',     label:'Nome (A-Z)' },
  { value:'progress', label:'Progresso (maior)' },
  { value:'rarity',   label:'Raridade' },
  { value:'type',     label:'Tipo' },
];
const RARITY_ORDER = { Comum:1, Incomum:2, Raro:3, Legendary:4 };

export default function TodosArmorsPage({ sets, onTogglePiece, onTogglePieceWishlist, onupdatePieceNotes }) {
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTipoFilter]   = useState('all');
  const [rarityFilter, setRaridadeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy,       setOrdenarBy]       = useState('name');
  const [selectedSet,  setSelectedSet]  = useState(null);
  const [groupByBase,  setGroupByBase]  = useState(false);

  const filtered = useMemo(() => {
    let result = [...sets];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.base_name?.toLowerCase().includes(q) ||
        s.variant_name?.toLowerCase().includes(q) ||
        s.manufacturer?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
      );
    }
    if (typeFilter   !== 'all') result = result.filter(s => s.type   === typeFilter);
    if (rarityFilter !== 'all') result = result.filter(s => s.rarity === rarityFilter);
    if (statusFilter === 'complete') result = result.filter(s => {
      const p=s.pieces||[]; return p.length>0 && p.every(x=>x.owned);
    });
    if (statusFilter === 'partial') result = result.filter(s => {
      const p=s.pieces||[]; const o=p.filter(x=>x.owned).length; return o>0 && o<p.length;
    });
    if (statusFilter === 'none')     result = result.filter(s => (s.pieces||[]).every(x=>!x.owned));
    if (statusFilter === 'wishlist') result = result.filter(s => (s.pieces||[]).some(x=>x.wishlist));

    result.sort((a,b) => {
      switch (sortBy) {
        case 'progress': {
          const pa=a.pieces||[], pb=b.pieces||[];
          const pA=pa.length>0?pa.filter(x=>x.owned).length/pa.length:0;
          const pB=pb.length>0?pb.filter(x=>x.owned).length/pb.length:0;
          return pB-pA;
        }
        case 'rarity': return (RARITY_ORDER[b.rarity]||0)-(RARITY_ORDER[a.rarity]||0);
        case 'type': { const o={Light:1,Médio:2,Heavy:3,Special:4}; return (o[a.type]||5)-(o[b.type]||5); }
        default: {
          const c=(a.base_name||'').localeCompare(b.base_name||'');
          return c!==0?c:(a.variant_name||'').localeCompare(b.variant_name||'');
        }
      }
    });
    return result;
  }, [sets, search, typeFilter, rarityFilter, statusFilter, sortBy]);

  // When grouped, show one card per base_name+type, with aggregated piece progress
  const displayItens = useMemo(() => {
    if (!groupByBase) return filtered.map(s => ({ key: String(s.id), set: s, grouped: false }));
    const map = new Map();
    for (const s of filtered) {
      const k = `${s.type}||${s.base_name}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    return [...map.entries()].map(([k, variants]) => {
      const rep = variants[0];
      // Merge all pieces across variants for the group card
      const allPieces = variants.flatMap(v => v.pieces||[]);
      return {
        key: k,
        grouped: variants.length > 1,
        variantCount: variants.length,
        set: { ...rep, set_name: rep.base_name, variant_name: `${variants.length} variante${variants.length>1?'s':''}`, pieces: allPieces },
        originalSet: rep,
      };
    });
  }, [filtered, groupByBase]);

  const totalPieces = sets.reduce((a,s)=>a+(s.pieces||[]).length, 0);
  const ownedPieces = sets.reduce((a,s)=>a+(s.pieces||[]).filter(p=>p.owned).length, 0);

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">TODAS AS ARMADURAS</div>
          <div className="page-subtitle">
            {sets.length} sets · {totalPieces} peças · {ownedPieces} obtidas
          </div>
        </div>
        <button
          className={`filter-chip ${groupByBase?'active':''}`}
          onClick={() => setGroupByBase(g=>!g)}
          style={{ display:'flex',alignItems:'center',gap:6 }}
        >
          {groupByBase ? 'Ver Variantes' : 'Agrupar por Nome'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding:'12px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0 }}>
        <div className="filters-bar" style={{ marginBottom:10 }}>
          <div style={{ position:'relative',flex:1 }}>
            <Search size={14} style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }} />
            <input className="search-input" style={{ paddingLeft:36 }}
              placeholder="Buscar por nome, variante, fabricante..."
              value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={sortBy} onChange={e=>setOrdenarBy(e.target.value)}>
            {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="filter-select" value={rarityFilter} onChange={e=>setRaridadeFilter(e.target.value)}>
            <option value="all">Qualquer Raridade</option>
            <option value="Comum">Comum</option>
            <option value="Incomum">Incomum</option>
            <option value="Raro">Raro</option>
            <option value="Legendary">Lendário</option>
          </select>
        </div>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center' }}>
          {['all','Light','Médio','Heavy','Special'].map(t=>(
            <button key={t}
              className={`filter-chip ${t!=='all'?`type-${t.toLowerCase()}`:''} ${typeFilter===t?'active':''}`}
              onClick={()=>setTipoFilter(t)}>
              {t==='all'?'Todos os Tipos':TYPE_LABELS[t]}
            </button>
          ))}
          <span style={{ width:1,height:20,background:'var(--border-subtle)',margin:'0 2px' }} />
          {[
            {val:'all',label:'Todos'},{val:'complete',label:'✓ Completo'},
            {val:'partial',label:'◑ Parcial'},{val:'none',label:'○ Sem peças'},
            {val:'wishlist',label:'★ Na Lista'},
          ].map(o=>(
            <button key={o.val}
              className={`filter-chip ${statusFilter===o.val?'active':''}`}
              onClick={()=>setStatusFilter(o.val)}>{o.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:'6px 32px',background:'var(--bg-base)',flexShrink:0 }}>
        <div className="results-info">
          Exibindo <span>{filtered.length}</span> de {sets.length} sets
          {groupByBase && <span style={{ marginLeft:8,color:'var(--text-muted)' }}>({displayItens.length} grupos)</span>}
        </div>
      </div>

      <div className="page-body">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Shield size={64} className="empty-state-icon" />
            <div className="empty-state-title">NENHUMA ARMADURA ENCONTRADA</div>
            <div className="empty-state-text">Ajuste os filtros para encontrar o que procura.</div>
          </div>
        ) : (
          <div className="armor-grid">
            {displayItens.map(item => (
              <ArmorSetCard
                key={item.key}
                set={item.set}
                onClick={() => setSelectedSet(item.originalSet || item.set)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedSet && (
        <ArmorSetModal
          set={selectedSet}
          sets={sets}
          onClose={() => setSelectedSet(null)}
          onTogglePiece={onTogglePiece}
          onTogglePieceWishlist={onTogglePieceWishlist}
          onupdatePieceNotes={onupdatePieceNotes}
        />
      )}
    </div>
  );
}
