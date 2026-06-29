import React, { useMemo } from 'react';
import { Shield, Package, Star, Trophy, ChevronRight, HardHat, Shirt, Dumbbell, Footprints, Backpack, AlertTriangle, Zap } from 'lucide-react';

const PIECE_ICONS  = { Helmet:HardHat, Torso:Shirt, Arms:Dumbbell, Legs:Footprints, Backpack:Backpack };
const PIECE_PT_PLU = { Helmet:'Capacetes', Torso:'Torsos', Arms:'Braços', Legs:'Pernas', Backpack:'Mochilas' };
const TYPE_COLORS  = { Light:'var(--type-light)', Médio:'var(--type-medium)', Heavy:'var(--type-heavy)', Special:'var(--type-special)' };
const TYPE_LABELS  = { Light:'Leve', Médio:'Médio', Heavy:'Pesado', Special:'Especial' };

export default function DashboardPage({ sets, stats, onNavigate }) {
  const pct = stats&&stats.totalPieces>0 ? Math.round((stats.ownedPieces/stats.totalPieces)*100) : 0;

  const byPieceTipo = useMemo(()=>
    ['Helmet','Torso','Arms','Legs','Backpack'].map(pt=>({
      type:pt,
      total: sets.flatMap(s=>(s.pieces||[]).filter(p=>p.piece_type===pt)).length,
      owned: sets.flatMap(s=>(s.pieces||[]).filter(p=>p.piece_type===pt&&p.owned)).length,
    })).filter(x=>x.total>0),
  [sets]);

  const wishlistItens = useMemo(()=>{
    const itens=[];
    sets.forEach(s=>(s.pieces||[]).forEach(p=>{ if(p.wishlist&&!p.owned) itens.push({piece:p,set:s}); }));
    return itens.slice(0,5);
  },[sets]);

  const rarePiecesFaltando = useMemo(()=>{
    const itens=[];
    sets.forEach(s=>(s.pieces||[]).forEach(p=>{
      if(!p.owned&&(s.rarity==='Raro'||s.rarity==='Legendary')) itens.push({piece:p,set:s});
    }));
    return itens.slice(0,5);
  },[sets]);

  const recentlyObtained = useMemo(()=>{
    const itens=[];
    sets.forEach(s=>(s.pieces||[]).forEach(p=>{ if(p.owned&&p.obtained_date) itens.push({piece:p,set:s}); }));
    return itens.sort((a,b)=>new Date(b.piece.obtained_date)-new Date(a.piece.obtained_date)).slice(0,4);
  },[sets]);

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">DASHBOARD</div>
          <div className="page-subtitle">
            {stats?.totalSets||0} sets · {stats?.totalPieces||0} peças catalogadas
          </div>
        </div>
        <div style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)',textAlign:'right' }}>
          <div style={{ color:'var(--accent-primary)',fontSize:13 }}>STANTON · PYRO</div>
          <div>RASTREADOR ATIVO</div>
        </div>
      </div>

      <div className="page-body">
        {/* Main stats */}
        <div className="dashboard-grid" style={{ marginBottom:20 }}>
          {[
            {value:stats?.totalPieces||0, label:'Total de Peças',   sub:`Em ${stats?.totalSets||0} sets`,  color:'var(--accent-secondary)', Icon:Shield,  cls:'blue'},
            {value:stats?.ownedPieces||0, label:'Peças Obtidas',    sub:`${pct}% do total`,                 color:'var(--accent-primary)',   Icon:Package, cls:'cyan'},
            {value:stats?.completeSets||0,label:'Sets Completos',   sub:`De ${stats?.totalSets||0} sets`,   color:'var(--accent-green)',     Icon:Trophy,  cls:'green'},
            {value:stats?.wishlistPieces||0,label:'wishlist',sub:'Peças para obter',                color:'var(--accent-gold)',      Icon:Star,    cls:'gold'},
          ].map(({value,label,sub,color,Icon,cls})=>(
            <div key={label} className={`stat-card ${cls}`}>
              <div className="stat-card-icon" style={{color}}><Icon size={40}/></div>
              <div className="stat-card-value">{value}</div>
              <div className="stat-card-label">{label}</div>
              <div className="stat-card-sub">{sub}</div>
            </div>
          ))}
        </div>

        {/* Global progress */}
        <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'18px 22px',marginBottom:20 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <Trophy size={16} style={{ color:'var(--accent-gold)' }} />
              <span style={{ fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,letterSpacing:'0.1em',color:'var(--text-primary)' }}>
                PROGRESSO GERAL
              </span>
            </div>
            <span style={{ fontFamily:'Orbitron,monospace',fontSize:20,fontWeight:800,color:pct>=75?'var(--accent-gold)':pct>=50?'var(--accent-green)':'var(--accent-primary)' }}>
              {pct}%
            </span>
          </div>
          <div style={{ height:8,background:'var(--border-subtle)',borderRadius:4,overflow:'hidden' }}>
            <div style={{ height:'100%',width:`${pct}%`,background:'linear-gradient(to right,var(--accent-secondary),var(--accent-primary))',borderRadius:4,boxShadow:'0 0 10px rgba(0,212,255,0.35)',transition:'width 1s ease' }} />
          </div>
          <div style={{ display:'flex',justifyContent:'space-between',marginTop:6,fontSize:11,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace' }}>
            <span>0</span>
            <span>{stats?.ownedPieces||0} / {stats?.totalPieces||0} peças</span>
            <span>{stats?.totalPieces||0}</span>
          </div>
        </div>

        {/* By type + by piece type */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20 }}>
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'18px' }}>
            <div className="modal-section-title">Por Tipo de Armadura</div>
            {(stats?.byTipo||[]).filter(t=>t.total_pieces>0).map(({type,total_pieces,owned_pieces})=>{
              const p=total_pieces>0?Math.round((owned_pieces/total_pieces)*100):0;
              return (
                <div key={type} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                    <span style={{ fontFamily:'Orbitron,monospace',fontSize:11,fontWeight:700,color:TYPE_COLORS[type],letterSpacing:'0.08em' }}>{TYPE_LABELS[type]||type}</span>
                    <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-secondary)' }}>{owned_pieces}/{total_pieces} · {p}%</span>
                  </div>
                  <div style={{ height:5,background:'var(--border-subtle)',borderRadius:3,overflow:'hidden' }}>
                    <div className={`type-progress-fill fill-${type.toLowerCase()}`} style={{ width:`${p}%`,height:'100%',borderRadius:3 }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'18px' }}>
            <div className="modal-section-title">Por Tipo de Peça</div>
            {byPieceTipo.map(({type,total,owned})=>{
              const p=total>0?Math.round((owned/total)*100):0;
              const Icon=PIECE_ICONS[type]||Shield;
              return (
                <div key={type} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5,alignItems:'center' }}>
                    <span style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.08em' }}>
                      <Icon size={12} style={{ color:'var(--accent-primary)' }} />{PIECE_PT_PLU[type]||type}
                    </span>
                    <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-secondary)' }}>{owned}/{total} · {p}%</span>
                  </div>
                  <div style={{ height:5,background:'var(--border-subtle)',borderRadius:3,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${p}%`,background:'linear-gradient(to right,var(--accent-secondary),var(--accent-primary))',borderRadius:3,transition:'width 0.8s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom 3-col */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:20 }}>
          {/* Recent */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'16px' }}>
            <div className="modal-section-title">Obtidas Recentemente</div>
            {recentlyObtained.length===0 ? (
              <div style={{ color:'var(--text-muted)',fontSize:12,textAlign:'center',padding:'16px 0' }}>Nenhuma peça obtida ainda</div>
            ) : recentlyObtained.map(({piece,set})=>{
              const Icon=PIECE_ICONS[piece.piece_type]||Shield;
              return (
                <div key={piece.id} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'6px 8px',background:'rgba(0,229,160,0.04)',border:'1px solid rgba(0,229,160,0.12)',borderRadius:5 }}>
                  <Icon size={13} style={{ color:'var(--accent-green)',flexShrink:0 }} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:11,fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                      {set.base_name}{set.variant_name&&set.variant_name!=='Base'?` — ${set.variant_name}`:''}
                    </div>
                    <div style={{ fontSize:10,color:'var(--text-muted)' }}>{piece.piece_type} · {piece.obtained_date?new Date(piece.obtained_date).toLocaleDateString('pt-BR'):''}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wishlist */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'16px' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
              <div className="modal-section-title" style={{ marginBottom:0 }}><Star size={11}/> Desejos</div>
              <button onClick={()=>onNavigate('collection')} style={{ background:'none',border:'none',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',gap:3,fontSize:11,fontWeight:600 }}>
                Ver <ChevronRight size={12}/>
              </button>
            </div>
            {wishlistItens.length===0 ? (
              <div style={{ color:'var(--text-muted)',fontSize:12,textAlign:'center',padding:'16px 0' }}>Lista vazia</div>
            ) : wishlistItens.map(({piece,set})=>{
              const Icon=PIECE_ICONS[piece.piece_type]||Shield;
              return (
                <div key={piece.id} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:7,padding:'5px 7px',background:'rgba(255,196,54,0.04)',border:'1px solid rgba(255,196,54,0.12)',borderRadius:5 }}>
                  <Icon size={12} style={{ color:'var(--accent-gold)',flexShrink:0 }} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:11,fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{set.base_name}</div>
                    <div style={{ fontSize:10,color:'var(--text-muted)' }}>{piece.piece_type}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Raro missing */}
          <div style={{ background:'var(--bg-card)',border:'1px solid rgba(255,196,54,0.15)',borderRadius:10,padding:'16px' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
              <div className="modal-section-title" style={{ marginBottom:0 }}><AlertTriangle size={11} style={{ color:'var(--accent-gold)' }}/> Raras Faltando</div>
              <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:10,color:'var(--accent-gold)' }}>{rarePiecesFaltando.length}</span>
            </div>
            {rarePiecesFaltando.length===0 ? (
              <div style={{ textAlign:'center',padding:'12px 0' }}>
                <Trophy size={28} style={{ color:'var(--accent-gold)',margin:'0 auto 6px',display:'block',opacity:0.7 }} />
                <div style={{ color:'var(--accent-gold)',fontSize:12,fontWeight:700 }}>Raras Completas!</div>
              </div>
            ) : rarePiecesFaltando.map(({piece,set})=>(
              <div key={piece.id} style={{ display:'flex',alignItems:'center',gap:7,marginBottom:7,padding:'5px 7px',background:'rgba(255,196,54,0.04)',border:'1px solid rgba(255,196,54,0.1)',borderRadius:5 }}>
                <Zap size={11} style={{ color:'var(--accent-gold)',flexShrink:0 }} />
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:11,fontWeight:700,color:'var(--accent-gold)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                    {set.base_name}{set.variant_name&&set.variant_name!=='Base'?` (${set.variant_name})`:''}
                  </div>
                  <div style={{ fontSize:10,color:'var(--text-muted)' }}>{piece.piece_type} · {piece.is_lootable&&!piece.is_purchasable?'LOOT':'Comprável'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick nav */}
        <div style={{ display:'flex',gap:12 }}>
          {[
            {label:'Ver Todas as Armaduras',icon:Shield,page:'all',color:'var(--accent-primary)',border:'var(--border-normal)',bg:'rgba(0,212,255,0.06)',hbg:'rgba(0,212,255,0.12)'},
            {label:'Gerenciar Coleção',icon:Package,page:'collection',color:'var(--accent-green)',border:'rgba(0,229,160,0.25)',bg:'rgba(0,229,160,0.06)',hbg:'rgba(0,229,160,0.12)'},
          ].map(({label,icon:Icon,page,color,border,bg,hbg})=>(
            <button key={page} onClick={()=>onNavigate(page)} style={{
              flex:1,padding:'14px',background:bg,border:`1px solid ${border}`,borderRadius:8,
              color,fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,letterSpacing:'0.1em',
              textTransform:'uppercase',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'all 0.2s',
            }}
              onMouseEnter={e=>e.currentTarget.style.background=hbg}
              onMouseLeave={e=>e.currentTarget.style.background=bg}
            >
              <Icon size={16}/>{label}<ChevronRight size={14}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
