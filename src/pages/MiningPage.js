import React, { useState, useMemo } from 'react';
import { Pickaxe, Gem, MapPin, Star, BarChart3, RefreshCw, Plus, Trash2, Edit3, Save, X, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useDataset, DATASETS } from '../data/dataStore';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { loadUexMiningDB, getUexMiningStats } from '../data/uexMiningDB';
import { buildLocationTree, getUexLocationsStats } from '../data/uexLocationsDB';

export const DEFAULT_MINEABLE_ORES = [
  { name:'Quantainium', value:7950, rarity:'Raro', locations:['Yela Asteroid Belt','Aaron Halo','Cellin','Daymar'], color:'#34d399', hazardous:true, notes:'Instável — pode explodir. Use laser em baixa potência. Vale a pena pelo alto valor.' },
  { name:'Bexalite', value:4800, rarity:'Raro', locations:['Aberdeen','Daymar','Yela','Aaron Halo'], color:'#a29bfe', hazardous:false, notes:'Alta pureza. Excelente valor por SCU. Prioridade após Quantainium.' },
  { name:'Taranite', value:5800, rarity:'Incomum', locations:['microTech','Calliope','Clio','Euterpe'], color:'#74b9ff', hazardous:false, notes:'Encontrado em alta concentração nas luas de microTech.' },
  { name:'Laranite', value:4200, rarity:'Incomum', locations:['Hurston','Arial','Ita','Magda'], color:'#fd79a8', hazardous:false, notes:'Abundante em Hurston e suas luas. Boa relação risco/recompensa.' },
  { name:'Hephaestanite', value:2650, rarity:'Incomum', locations:['Cellin','Daymar','Aberdeen'], color:'#e17055', hazardous:false, notes:'Luas de Crusader. Frequentemente em veios mistos com outros minérios.' },
  { name:'Dolivine', value:3450, rarity:'Incomum', locations:['Daymar','Yela','Cellin'], color:'#55efc4', hazardous:false, notes:'Crusader e suas luas. Boa opção para mineração superficial.' },
  { name:'Gold', value:5400, rarity:'Incomum', locations:['Hurston','Aberdeen','Ita'], color:'#fbbf24', hazardous:false, notes:'Planeta Hurston e luas. Veios maiores do que a média.' },
  { name:'Diamond', value:7200, rarity:'Raro', locations:['microTech','Calliope','Clio'], color:'#dfe6e9', hazardous:false, notes:'Luas geladas de microTech. Difícil de encontrar mas extremamente valioso.' },
  { name:'Titanium', value:1140, rarity:'Comum', locations:['Daymar','Aberdeen','Yela','Cellin','Arial'], color:'#b2bec3', hazardous:false, notes:'Abundante em quase todas as luas rochosas. Essencial para crafting.' },
  { name:'Tungsten', value:4600, rarity:'Incomum', locations:['Hurston','Arial','Magda','Ita'], color:'#636e72', hazardous:false, notes:'Luas de Hurston. Pesado — planeje a carga com cuidado.' },
  { name:'Copper', value:5530, rarity:'Comum', locations:['Yela','Daymar','Aberdeen','Cellin'], color:'#fdcb6e', hazardous:false, notes:'Amplamente encontrado. Ótimo para crafting e venda.' },
  { name:'Iron', value:912, rarity:'Comum', locations:['Hurston','Aberdeen','Arial','Ita','Magda'], color:'#b2bec3', hazardous:false, notes:'Muito comum. Use apenas como complemento de carga.' },
  { name:'Aluminum', value:3850, rarity:'Comum', locations:['Cellin','Daymar','Yela'], color:'#a29bfe', hazardous:false, notes:'Luas de Crusader. Mining rápida em campos rasos.' },
  { name:'Corundum', value:1450, rarity:'Comum', locations:['microTech','Calliope','Clio','Euterpe'], color:'#fd79a8', hazardous:false, notes:'Luas de microTech. Bom complemento quando buscando Taranite.' },
  { name:'Quartz', value:2960, rarity:'Comum', locations:['Daymar','Yela','Aberdeen'], color:'#dfe6e9', hazardous:false, notes:'Crusader luas. Encontrado em grandes veios cristalinos.' },
  { name:'Borase', value:3200, rarity:'Incomum', locations:['Arial','Ita','Aberdeen'], color:'#00cec9', hazardous:false, notes:'Luas de Hurston. Veios médios, boa pureza.' },
  { name:'Agricium', value:2800, rarity:'Incomum', locations:['Cellin','Daymar'], color:'#00b894', hazardous:false, notes:'Crusader luas. Frequentemente junto com Dolivine.' },
  { name:'Inert Material', value:0, rarity:'Comum', locations:['Em toda parte'], color:'#636e72', hazardous:false, notes:'Sem valor de venda. Necessário para crafting de munição e consumíveis.' },
];

// NOTA: DEFAULT_SHIP_LASERS e DEFAULT_MINING_MODULES são derivados mais abaixo,
// a partir de MINING_LASERS_DB / MINING_MODULES_DB (fonte única verificada contra a UEX API,
// categoria "Utility, Mining Laser Heads" e "Utility, Mining Modules").

// Naves de mineração dedicadas e ativas no jogo (Vulture é nave de salvage, Orion e Expanse
// removidos: Orion não possui cabeça de mineração size 3 disponível na UEX e Expanse/Cutlass Blue
// não são naves de mineração de verdade — foram removidas por não corresponderem à realidade do jogo).
export const DEFAULT_MINING_SHIPS = [
  { name:'Prospector', cargo:48, lasers:1, crew:1, notes:'MISC. Mineradora solo padrão. 4 contêineres de 12 SCU (48 SCU). Aceita qualquer cabeça size 1.' },
  { name:'MOLE',       cargo:96, lasers:3, crew:4, notes:'Argo. Mineradora de grupo — 1 piloto + 3 operadores. 3 lasers size 2 simultâneos, carrega até 8 módulos de 12 SCU (96 SCU) por vez.' },
  { name:'Golem',      cargo:32, lasers:1, crew:1, notes:'Drake. Mineradora solo de entrada, com o laser Pitman (size 1) dedicado à nave. 2 contêineres de 16 SCU (32 SCU).' },
];

export const DEFAULT_MINING_LOCATIONS = {
  'Yela Asteroid Belt': { system:'Stanton',type:'Asteroid Belt', best:['Quantainium','Copper','Titanium'], danger:'Médio', notes:'Melhor local para Quantainium. Densa concentração de asteroides.' },
  'Aaron Halo': { system:'Stanton',type:'Asteroid Belt', best:['Quantainium','Bexalite','Gold'], danger:'Alto', notes:'Maior asteroid belt de Stanton. Alto risco de PVP.' },
  'Daymar': { system:'Stanton',type:'Moon', best:['Titanium','Copper','Quartz','Dolivine'], danger:'Baixo', notes:'Lua de Crusader. Superfície acessível, boa para iniciantes.' },
  'Cellin': { system:'Stanton',type:'Moon', best:['Titanium','Hephaestanite','Aluminum','Agricium'], danger:'Baixo', notes:'Lua de Crusader. Terreno variado com bons depósitos.' },
  'Aberdeen': { system:'Stanton',type:'Moon', best:['Bexalite','Copper','Iron'], danger:'Médio', notes:'Lua de Hurston. Bom para Bexalite.' },
  'Calliope': { system:'Stanton',type:'Moon', best:['Taranite','Diamond','Corundum'], danger:'Baixo', notes:'Lua gelada de microTech. Excelente para minérios premium.' },
  'Clio': { system:'Stanton',type:'Moon', best:['Taranite','Diamond','Corundum'], danger:'Baixo', notes:'Lua gelada de microTech. Similar a Calliope.' },
  'Euterpe': { system:'Stanton',type:'Moon', best:['Taranite','Corundum'], danger:'Baixo', notes:'Menor lua de microTech. Menos concorrência.' },
  'Arial': { system:'Stanton',type:'Moon', best:['Laranite','Borase','Tungsten'], danger:'Baixo', notes:'Lua de Hurston com concentração de Laranite.' },
  'Ita': { system:'Stanton',type:'Moon', best:['Laranite','Gold','Iron'], danger:'Baixo', notes:'Lua de Hurston. Menor atmosfera — mais fácil de voar.' },
};

// ── Mesclagem com dados sincronizados da UEX API ──────────────────────────────
const ORE_PALETTE = ['#34d399','#a29bfe','#74b9ff','#fd79a8','#e17055','#55efc4','#fbbf24','#dfe6e9','#b2bec3','#636e72','#fdcb6e','#00cec9','#ff7675','#fab1a0'];
function pickColor(name='') {
  let h = 0; for (let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) >>> 0;
  return ORE_PALETTE[h % ORE_PALETTE.length];
}

// Atualiza preços dos minérios já cadastrados e adiciona os que a UEX conhece mas
// ainda não estão na lista curada manualmente.
function mergeOresWithUex(base) {
  const db = loadUexMiningDB();
  if (!db.minerals?.length) return base;
  const byName = {};
  base.forEach(o => { byName[o.name.toLowerCase()] = { ...o }; });
  db.minerals.forEach(m => {
    if (!m.name) return;
    const key = m.name.toLowerCase();
    const price = Number(m.price_sell) || 0;
    if (byName[key]) {
      byName[key] = { ...byName[key], value: price>0 ? price : byName[key].value, synced:true };
    } else {
      byName[key] = {
        name: m.name,
        value: price,
        rarity: 'A Definir',
        locations: [],
        color: pickColor(m.name),
        hazardous: !!m.is_explosive,
        notes: 'Minério sincronizado da API UEX — ainda sem local/raridade cadastrados manualmente.',
        synced: true,
      };
    }
  });
  return Object.values(byName);
}

// Adiciona planetas/luas sincronizados que ainda não têm um card de local cadastrado à mão.
function mergeLocationsWithUex(base) {
  const tree = buildLocationTree({});
  if (Object.keys(tree).length === 0) return base;
  const merged = { ...base };
  Object.entries(tree).forEach(([system, types]) => {
    (types['Planeta / Lua'] || []).forEach(name => {
      if (merged[name]) return; // já cadastrado manualmente, não sobrescreve
      merged[name] = {
        system, type:'Planeta/Lua (UEX)', best: [], danger:'Desconhecido',
        notes: 'Local sincronizado da API UEX. Adicione os melhores minérios e o nível de perigo conforme sua experiência de mineração.',
        synced: true,
      };
    });
  });
  return merged;
}
// ── Banco de dados completo de lasers e módulos de mineração ─────────────────
// Nomes, fabricantes, tamanhos e preços verificados contra a UEX API / uexcorp.space
// (categoria "Utility, Mining Laser Heads", id_category=29 — Star Citizen 4.8.3).
// Só existem cabeças size 1 e size 2 no jogo atualmente — não há size 3, por isso
// nenhuma nave com laser size 3 (como a Orion) está incluída na Guia.
// Potência/Alcance/Extração/Instabilidade são ESTIMATIVAS COMPARATIVAS da comunidade
// para ajudar a comparar cabeças entre si — a API da UEX não expõe esses números de
// balanceamento de jogo, então não devem ser lidos como valores oficiais exatos.
const MINING_LASERS_DB = [
  // Size 1 — Prospector / Golem
  { name:'Klein-S1',    manufacturer:'Shubin',   size:1, tier:'Iniciante',     price:10200,  power:1200, range:20, extr:0.8, instab:0.15, notes:'A opção mais barata e simples do tamanho 1. Ótima para começar.' },
  { name:'Pitman',      manufacturer:'Exclusivo do Golem', size:1, tier:'Iniciante', price:null, power:1000, range:18, extr:0.7, instab:0.10, notes:'Vem de fábrica na Golem, calibrado para reduzir acidentes. Não é vendido separadamente.' },
  { name:'Arbor MH1',   manufacturer:'Greycat',  size:1, tier:'Intermediário', price:10800,  power:1600, range:30, extr:1.0, instab:0.10, notes:'Altíssima estabilidade — favorito para minérios voláteis como Quantainium.' },
  { name:'Hofstede-S1', manufacturer:'Shubin',   size:1, tier:'Intermediário', price:12100,  power:2000, range:25, extr:1.2, instab:0.20, notes:'Boa relação custo-benefício, equilibrado entre potência e alcance.' },
  { name:'Helix I',     manufacturer:'Thermyte', size:1, tier:'Intermediário', price:55100,  power:2400, range:35, extr:1.4, instab:0.25, notes:'Um dos mais populares — melhor alcance da categoria size 1.' },
  { name:'Lancet MH1',  manufacturer:'Greycat',  size:1, tier:'Avançado',      price:22300,  power:2600, range:32, extr:1.5, instab:0.22, notes:'Grande raio de extração, bom equilíbrio geral.' },
  { name:'Impact I',    manufacturer:'Thermyte', size:1, tier:'Avançado',      price:54900,  power:3200, range:26, extr:1.8, instab:0.35, notes:'Maior potência de extração size 1 — mais instável, cuidado com Quantainium.' },
  // Size 2 — MOLE
  { name:'Klein-S2',    manufacturer:'Shubin',   size:2, tier:'Iniciante',     price:20200,  power:2200, range:24, extr:1.5, instab:0.18, notes:'Versão size 2 do Klein — opção econômica para equipar o MOLE.' },
  { name:'Arbor MH2',   manufacturer:'Greycat',  size:2, tier:'Intermediário', price:20400,  power:2800, range:34, extr:1.8, instab:0.12, notes:'Excelente estabilidade também no tamanho 2 — seguro para operações em grupo.' },
  { name:'Hofstede-S2', manufacturer:'Shubin',   size:2, tier:'Intermediário', price:21600,  power:3400, range:28, extr:2.0, instab:0.22, notes:'Equilibrado, boa escolha padrão para o MOLE.' },
  { name:'Lancet MH2',  manufacturer:'Greycat',  size:2, tier:'Avançado',      price:89300,  power:4600, range:36, extr:2.6, instab:0.25, notes:'Muito usado em operações de grupo de alto rendimento.' },
  { name:'Helix II',    manufacturer:'Thermyte', size:2, tier:'Avançado',      price:102600, power:4200, range:40, extr:2.4, instab:0.28, notes:'Um dos mais caros do jogo — maior alcance size 2.' },
  { name:'Impact II',   manufacturer:'Thermyte', size:2, tier:'Avançado',      price:54900,  power:5400, range:30, extr:3.0, instab:0.40, notes:'Maior potência de extração size 2 — maior instabilidade também.' },
];

export const DEFAULT_SHIP_LASERS = MINING_LASERS_DB.map(l => ({
  name: l.size===2 ? `${l.name} (Size 2)` : l.name,
  tier: l.tier, power: l.power, range: l.range, extraction: l.extr, instability: l.instab,
  notes: `${l.manufacturer} · ${l.notes}`,
}));

// Módulos de mineração verificados contra a UEX API (categoria "Utility, Mining Modules",
// id_category=30). Efeitos descritos de forma qualitativa — a UEX não expõe os percentuais
// exatos de balanceamento, e estes mudam com frequência a cada patch.
const MINING_MODULES_DB = [
  // Potência (aumentam extração/potência)
  { name:'Rieger',    manufacturer:'Shubin',   type:'Potência', slot:'Passivo', price:5700,  effect:'Aumenta a potência de extração do laser.', notes:'Primeiro tier da linha Rieger.' },
  { name:'Rieger-C2', manufacturer:'Shubin',   type:'Potência', slot:'Passivo', price:17100, effect:'Aumenta a potência de extração — tier intermediário.', notes:'Mais forte que o Rieger padrão.' },
  { name:'Rieger-C3', manufacturer:'Shubin',   type:'Potência', slot:'Passivo', price:57000, effect:'Maior potência de extração da linha Rieger.', notes:'Tier avançado, mais caro.' },
  { name:'Surge',     manufacturer:'Thermyte', type:'Potência', slot:'Ativo',   price:1400,  effect:'Aumento temporário de potência sob demanda.', notes:'Efeito ativo/burst, não permanente.' },
  { name:'Stampede',  manufacturer:'Thermyte', type:'Potência', slot:'Passivo', price:1300,  effect:'Aumenta a taxa de carregamento da janela ótima.', notes:'Ajuda a manter a extração na zona ideal.' },
  // Filtragem (reduzem Inert Material / aumentam pureza)
  { name:'FLTR',      manufacturer:'Greycat',  type:'Filtragem', slot:'Passivo', price:5700,  effect:'Reduz o Inert Material extraído, aumentando a pureza.', notes:'Primeiro tier da linha FLTR.' },
  { name:'FLTR-L',    manufacturer:'Greycat',  type:'Filtragem', slot:'Passivo', price:17100, effect:'Filtragem avançada — mais pureza que o FLTR padrão.', notes:'Tier intermediário.' },
  { name:'FLTR-XL',   manufacturer:'Greycat',  type:'Filtragem', slot:'Passivo', price:57000, effect:'Maior nível de filtragem da linha FLTR.', notes:'Tier avançado, mais caro.' },
  // Segurança / Estabilidade
  { name:'Lifeline',  manufacturer:'Greycat',  type:'Segurança', slot:'Passivo', price:760,   effect:'Reduz a instabilidade do laser.', notes:'Recomendado ao minerar Quantainium.' },
  { name:'Rime',      manufacturer:'Greycat',  type:'Segurança', slot:'Passivo', price:1000,  effect:'Reduz o superaquecimento do laser.', notes:'Ajuda em sessões de mineração longas.' },
  { name:'Torpid',    manufacturer:'Greycat',  type:'Segurança', slot:'Passivo', price:1900,  effect:'Reduz instabilidade, mas também reduz a resistência que o laser quebra.', notes:'Troca potência por segurança.' },
  { name:'XTR',       manufacturer:'Greycat',  type:'Segurança', slot:'Passivo', price:1900,  effect:'Reduz a instabilidade da rocha durante a extração.', notes:'Primeiro tier da linha XTR.' },
  { name:'XTR-L',     manufacturer:'Greycat',  type:'Segurança', slot:'Passivo', price:5700,  effect:'Redução de instabilidade — tier intermediário.', notes:'Mais forte que o XTR padrão.' },
  { name:'XTR-XL',    manufacturer:'Greycat',  type:'Segurança', slot:'Passivo', price:20000, effect:'Maior redução de instabilidade da linha XTR.', notes:'Tier avançado.' },
  // Fragmentação (reduzem resistência da rocha)
  { name:'Brandt',    manufacturer:'Shubin',   type:'Fragmentação', slot:'Passivo', price:2100, effect:'Reduz a resistência da rocha, facilitando a fratura.', notes:'Bom para rochas muito duras.' },
  { name:'Forel',     manufacturer:'Shubin',   type:'Fragmentação', slot:'Passivo', price:1900, effect:'Reduz resistência e favorece a formação de cristais/gemas.', notes:'Bom para rochas cristalizadas.' },
  { name:'Vaux',      manufacturer:'Shubin',   type:'Fragmentação', slot:'Passivo', price:1900, effect:'Reduz a resistência da rocha.', notes:'Primeiro tier da linha Vaux.' },
  { name:'Vaux-C2',   manufacturer:'Shubin',   type:'Fragmentação', slot:'Passivo', price:5700, effect:'Redução de resistência — tier intermediário.', notes:'Mais forte que o Vaux padrão.' },
  { name:'Vaux-C3',   manufacturer:'Shubin',   type:'Fragmentação', slot:'Passivo', price:20000,effect:'Maior redução de resistência da linha Vaux.', notes:'Tier avançado.' },
  // Foco / Controle
  { name:'Focus',     manufacturer:'Thermyte', type:'Foco', slot:'Passivo', price:3800,  effect:'Reduz o tamanho da zona de extração para mais controle e precisão.', notes:'Primeiro tier da linha Focus.' },
  { name:'Focus II',  manufacturer:'Thermyte', type:'Foco', slot:'Passivo', price:11400, effect:'Controle de zona mais refinado — tier intermediário.', notes:'Ideal para minérios instáveis como Quantainium.' },
  { name:'Focus III', manufacturer:'Thermyte', type:'Foco', slot:'Passivo', price:40000, effect:'Controle máximo de precisão na extração.', notes:'Tier avançado, para mineradores experientes.' },
  { name:'Optimum',   manufacturer:'Greycat',  type:'Foco', slot:'Passivo', price:3000,  effect:'Aumenta o tamanho da janela de carga ótima.', notes:'Facilita manter a extração na faixa ideal.' },
];

export const DEFAULT_MINING_MODULES = MINING_MODULES_DB.map(m => ({
  name: m.name, type: m.type, effect: m.effect, best_for: `${m.manufacturer} · ${m.notes}`,
}));

const MODULE_TYPE_COLORS = {
  Potência:'var(--accent-red)', Filtragem:'var(--accent-green)',
  Segurança:'var(--accent-primary)', Fragmentação:'var(--accent-gold)', Foco:'#a29bfe',
};

// Slots correspondem ao que cada nave realmente aceita no jogo.
const SHIP_CONFIGS = {
  'Prospector': { lasers:[{ id:'l1', size:1, label:'Laser Principal' }], moduleSlots:2, desc:'1 laser size 1 · 2 módulos' },
  'MOLE':       { lasers:[{ id:'l1', size:2, label:'Laser Centro' },{ id:'l2', size:2, label:'Laser Esquerda' },{ id:'l3', size:2, label:'Laser Direita' }], moduleSlots:3, desc:'3 lasers size 2 · 3 módulos' },
  'Golem':      { lasers:[{ id:'l1', size:1, label:'Laser Pitman (fixo)' }], moduleSlots:1, desc:'1 laser size 1 (Pitman) · 1 módulo' },
};

const BUILDS_KEY = 'sc_mining_builds_v1';
function loadBuilds()   { try { return JSON.parse(localStorage.getItem(BUILDS_KEY))||[]; } catch { return []; } }
function saveBuilds(d)  { localStorage.setItem(BUILDS_KEY, JSON.stringify(d)); }
function localISO()     { const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function ptDate(iso)    { return iso ? new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'; }

// ── Build Editor ───────────────────────────────────────────────────────────────
function BuildEditor({ build, onSave, onCancel }) {
  const [name,    setName]    = useState(build?.name    || '');
  const [ship,    setShip]    = useState(build?.ship    || 'Prospector');
  const [notes,   setNotes]   = useState(build?.notes   || '');
  const [lasers,  setLasers]  = useState(build?.lasers  || {});
  const [modules, setModules] = useState(build?.modules || []);
  const [active,  setActive]  = useState(build?.active  || false);
  const [error,   setError]   = useState('');

  const cfg = SHIP_CONFIGS[ship] || SHIP_CONFIGS['Prospector'];
  const IS = { width:'100%', padding:'7px 10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none' };
  const SS = { ...IS, appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 7px center', paddingRight:26 };
  const LS = { fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:3 };

  function setLaser(slotId, laserName) { setLasers(p=>({...p,[slotId]:laserName})); }
  function addModule(mod) {
    if (modules.length >= cfg.moduleSlots) return;
    setModules(p=>[...p, mod]);
  }
  function removeModule(idx) { setModules(p=>p.filter((_,i)=>i!==idx)); }

  function handleSave() {
    if (!name.trim()) { setError('Nome da build obrigatório.'); return; }
    onSave({ id:build?.id||Date.now(), name:name.trim(), ship, lasers, modules, notes, active, created_at:build?.created_at||localISO(), updated_at:localISO() });
  }

  const lasersBySize = (size) => MINING_LASERS_DB.filter(l=>l.size===size);
  const usedModuleNames = modules.map(m=>m.name);

  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:10, padding:18, marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontFamily:'Michroma,sans-serif', fontSize:13, fontWeight:700, color:'var(--accent-primary)', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:7 }}>
          <Pickaxe size={15}/> {build?.id ? 'EDITAR BUILD' : 'NOVA BUILD DE MINERAÇÃO'}
        </div>
        <button onClick={onCancel} style={{ background:'none', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-secondary)', cursor:'pointer', padding:'4px 8px' }}><X size={13}/></button>
      </div>

      {/* Nome + Nave + Ativa */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr auto', gap:9, marginBottom:12 }}>
        <div>
          <label style={LS}>Nome da Build *</label>
          <input style={IS} value={name} onChange={e=>setName(e.target.value)} placeholder="ex: Quant Hunter, Farm de Laranite..."/>
        </div>
        <div>
          <label style={LS}>Nave</label>
          <select style={SS} value={ship} onChange={e=>{setShip(e.target.value);setLasers({});setModules([]);}}>
            {Object.keys(SHIP_CONFIGS).map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:2 }}>
          <button onClick={()=>setActive(!active)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', background:active?'rgba(255,200,0,0.1)':'transparent', border:`1px solid ${active?'rgba(255,200,0,0.4)':'var(--border-subtle)'}`, borderRadius:5, color:active?'var(--accent-gold)':'var(--text-muted)', cursor:'pointer', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap' }}>
            <Star size={12}/> {active ? 'Build Ativa ★' : 'Marcar Ativa'}
          </button>
        </div>
      </div>
      <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:14, padding:'5px 10px', background:'rgba(255,255,255,0.03)', borderRadius:5 }}>
        <strong style={{ color:'var(--accent-primary)' }}>{ship}:</strong> {cfg.desc}
      </div>

      {/* Lasers */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>🔫 Lasers de Mineração</div>
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${cfg.lasers.length},1fr)`, gap:10 }}>
          {cfg.lasers.map(slot => {
            const available = lasersBySize(slot.size);
            const selected  = MINING_LASERS_DB.find(l=>l.name===lasers[slot.id]);
            return (
              <div key={slot.id} style={{ padding:'10px 12px', background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.15)', borderRadius:8 }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--accent-primary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
                  {slot.label} (Size {slot.size})
                </div>
                <select style={SS} value={lasers[slot.id]||''} onChange={e=>setLaser(slot.id,e.target.value)}>
                  <option value="">— Sem laser —</option>
                  {available.map(l=><option key={l.name} value={l.name}>{l.name} · {l.tier}</option>)}
                </select>
                {selected && (
                  <div style={{ marginTop:6, fontSize:10, color:'var(--text-muted)', lineHeight:1.4 }}>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                      <span>⚡ {selected.power} MW</span>
                      <span>📏 {selected.range}m</span>
                      <span style={{ color: selected.instab>0.3?'var(--accent-red)':'var(--accent-green)' }}>⚡ Instab: {Math.round(selected.instab*100)}%</span>
                    </div>
                    <div style={{ color:'var(--text-secondary)', fontStyle:'italic' }}>{selected.notes}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Módulos */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
          🔧 Módulos ({modules.length}/{cfg.moduleSlots} slots)
        </div>
        {/* Módulos equipados */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
          {modules.map((m,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:`${MODULE_TYPE_COLORS[m.type]||'var(--accent-primary)'}18`, border:`1px solid ${MODULE_TYPE_COLORS[m.type]||'var(--accent-primary)'}44` }}>
              <span style={{ fontSize:11, fontWeight:700, color:MODULE_TYPE_COLORS[m.type]||'var(--accent-primary)' }}>{m.name}</span>
              <span style={{ fontSize:9, color:'var(--text-muted)' }}>{m.effect}</span>
              <button onClick={()=>removeModule(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex', alignItems:'center' }}><X size={10}/></button>
            </div>
          ))}
          {modules.length === 0 && <span style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>Nenhum módulo equipado</span>}
        </div>
        {/* Adicionar módulo */}
        {modules.length < cfg.moduleSlots && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:5 }}>
            {MINING_MODULES_DB.filter(m=>!usedModuleNames.includes(m.name)).map(m => (
              <button key={m.name} onClick={()=>addModule(m)} style={{
                textAlign:'left', padding:'6px 10px', background:'rgba(255,255,255,0.02)',
                border:`1px solid ${MODULE_TYPE_COLORS[m.type]||'var(--border-subtle)'}33`,
                borderRadius:6, cursor:'pointer', transition:'all 0.15s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.background=`${MODULE_TYPE_COLORS[m.type]||'var(--accent-primary)'}10`;}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.02)';}}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:5 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:MODULE_TYPE_COLORS[m.type]||'var(--accent-primary)' }}>{m.name}</span>
                  <span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:`${MODULE_TYPE_COLORS[m.type]||'var(--accent-primary)'}22`, color:MODULE_TYPE_COLORS[m.type]||'var(--accent-primary)', fontWeight:700 }}>{m.type}</span>
                </div>
                <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:2 }}>{m.effect}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notas */}
      <div style={{ marginBottom:12 }}>
        <label style={LS}>Notas / Estratégia</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Melhor para Quantainium, usar em Yela, rodar com tripulação..."
          style={{ width:'100%', minHeight:44, padding:'7px 10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', resize:'vertical', boxSizing:'border-box' }}/>
      </div>

      {error && <div style={{ color:'var(--accent-red)', fontSize:12, marginBottom:8 }}>{error}</div>}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={{ padding:'7px 16px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:6, color:'var(--text-secondary)', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>Cancelar</button>
        <button onClick={handleSave} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 16px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:6, color:'var(--accent-green)', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>
          <Save size={12}/> {build?.id?'Salvar':'Criar Build'}
        </button>
      </div>
    </div>
  );
}

// ── Build Card ─────────────────────────────────────────────────────────────────
function BuildCard({ build, onEdit, onDelete, onToggleActive }) {
  const [expanded, setExpanded] = useState(false);
  const [delConf,  setDelConf]  = useState(false);
  const cfg = SHIP_CONFIGS[build.ship] || SHIP_CONFIGS['Prospector'];

  const laserList = cfg.lasers.map(slot => ({
    slot, laser: MINING_LASERS_DB.find(l=>l.name===build.lasers?.[slot.id])
  }));

  return (
    <div style={{
      background: build.active ? 'rgba(255,200,0,0.05)' : 'var(--bg-card)',
      border: `1px solid ${build.active ? 'rgba(255,200,0,0.4)' : 'var(--border-subtle)'}`,
      borderRadius:9, overflow:'hidden', marginBottom:8, transition:'all 0.2s',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer' }} onClick={()=>setExpanded(!expanded)}>
        <Pickaxe size={16} style={{ color:build.active?'var(--accent-gold)':'var(--accent-primary)', flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:2 }}>
            <span style={{ fontFamily:'"Exo 2",sans-serif', fontSize:14, fontWeight:700, color:build.active?'var(--accent-gold)':'var(--text-primary)' }}>{build.name}</span>
            {build.active && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, background:'rgba(255,200,0,0.15)', color:'var(--accent-gold)', border:'1px solid rgba(255,200,0,0.4)', fontWeight:700 }}>★ ATIVA</span>}
            <span style={{ fontSize:10, color:'var(--text-muted)' }}>🚀 {build.ship}</span>
          </div>
          <div style={{ display:'flex', gap:8, fontSize:10, color:'var(--text-muted)', flexWrap:'wrap' }}>
            {laserList.map(({slot,laser}) => laser && (
              <span key={slot.id} style={{ display:'flex', alignItems:'center', gap:3 }}>
                🔫 {laser.name}
              </span>
            ))}
            {(build.modules||[]).map((m,i) => (
              <span key={i} style={{ color:MODULE_TYPE_COLORS[m.type]||'var(--text-muted)' }}>· {m.name}</span>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:5, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>onToggleActive(build.id)} title={build.active?'Desmarcar como ativa':'Marcar como ativa'}
            style={{ width:28,height:28,borderRadius:5,border:`1px solid ${build.active?'rgba(255,200,0,0.4)':'var(--border-normal)'}`,background:build.active?'rgba(255,200,0,0.12)':'transparent',color:build.active?'var(--accent-gold)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <Star size={12}/>
          </button>
          <button onClick={()=>onEdit(build)} style={{ width:28,height:28,borderRadius:5,border:'1px solid var(--border-normal)',background:'rgba(56,189,248,0.06)',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <Edit3 size={11}/>
          </button>
          {delConf ? (
            <>
              <button onClick={()=>onDelete(build.id)} style={{ padding:'3px 7px',background:'rgba(251,113,133,0.15)',border:'1px solid rgba(251,113,133,0.4)',borderRadius:3,color:'var(--accent-red)',cursor:'pointer',fontSize:10,fontWeight:700 }}>Sim</button>
              <button onClick={()=>setDelConf(false)} style={{ padding:'3px 7px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:3,color:'var(--text-secondary)',cursor:'pointer',fontSize:10 }}>Não</button>
            </>
          ) : (
            <button onClick={()=>setDelConf(true)} style={{ width:28,height:28,borderRadius:5,border:'1px solid rgba(251,113,133,0.2)',background:'rgba(251,113,133,0.06)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <Trash2 size={11}/>
            </button>
          )}
          {expanded ? <ChevronUp size={13} style={{ color:'var(--text-muted)' }}/> : <ChevronDown size={13} style={{ color:'var(--text-muted)' }}/>}
        </div>
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <div style={{ padding:'0 14px 14px', borderTop:'1px solid var(--border-subtle)', background:'rgba(0,0,0,0.08)' }}>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${cfg.lasers.length},1fr)`, gap:10, margin:'12px 0' }}>
            {laserList.map(({slot,laser}) => (
              <div key={slot.id} style={{ padding:'10px 12px', background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.12)', borderRadius:7 }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--accent-primary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{slot.label}</div>
                {laser ? (
                  <>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>{laser.name}</div>
                    <div style={{ display:'flex', gap:8, fontSize:10, color:'var(--text-muted)', flexWrap:'wrap', marginBottom:3 }}>
                      <span>⚡ {laser.power} MW</span>
                      <span>📏 {laser.range}m</span>
                      <span>Extr: {laser.extr}x</span>
                      <span style={{ color:laser.instab>0.3?'var(--accent-red)':'var(--accent-green)' }}>Instab: {Math.round(laser.instab*100)}%</span>
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-secondary)', fontStyle:'italic' }}>{laser.notes}</div>
                  </>
                ) : (
                  <div style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>Sem laser</div>
                )}
              </div>
            ))}
          </div>
          {(build.modules||[]).length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Módulos Equipados</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {build.modules.map((m,i) => (
                  <div key={i} style={{ padding:'5px 10px', borderRadius:20, background:`${MODULE_TYPE_COLORS[m.type]||'var(--accent-primary)'}14`, border:`1px solid ${MODULE_TYPE_COLORS[m.type]||'var(--accent-primary)'}33` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:MODULE_TYPE_COLORS[m.type]||'var(--accent-primary)' }}>{m.name}</div>
                    <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:1 }}>{m.effect}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {build.notes && (
            <div style={{ padding:'7px 10px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)', borderRadius:5, fontSize:11, color:'var(--text-secondary)', fontStyle:'italic' }}>
              📝 {build.notes}
            </div>
          )}
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:8 }}>
            Criada: {ptDate(build.created_at)}{build.updated_at && build.updated_at!==build.created_at ? ` · Atualizada: ${ptDate(build.updated_at)}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba de Builds ─────────────────────────────────────────────────────────────
function BuildsTab() {
  const [builds,    setBuilds]    = useState(() => loadBuilds());
  const [showForm,  setShowForm]  = useState(false);
  const [editBuild, setEditBuild] = useState(null);
  const [filterShip,setFilterShip]= useState('all');

  function persist(updated) { setBuilds(updated); saveBuilds(updated); }

  function handleSave(build) {
    const updated = builds.some(b=>b.id===build.id)
      ? builds.map(b=>b.id===build.id?build:b)
      : [build, ...builds];
    persist(updated);
    setShowForm(false); setEditBuild(null);
  }

  function handleDelete(id) { persist(builds.filter(b=>b.id!==id)); }

  function handleToggleActive(id) {
    persist(builds.map(b => b.id===id ? {...b, active:!b.active} : b));
  }

  const filtered = filterShip==='all' ? builds : builds.filter(b=>b.ship===filterShip);
  const activeBuild = builds.find(b=>b.active);

  const SS2 = { padding:'5px 22px 5px 8px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 5px center' };

  return (
    <div>
      {(showForm || editBuild) && (
        <BuildEditor
          build={editBuild}
          onSave={handleSave}
          onCancel={()=>{setShowForm(false);setEditBuild(null);}}
        />
      )}

      {/* Build ativa em destaque */}
      {activeBuild && !showForm && !editBuild && (
        <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(255,200,0,0.07)', border:'1px solid rgba(255,200,0,0.3)', borderRadius:8, display:'flex', alignItems:'center', gap:10 }}>
          <Star size={16} style={{ color:'var(--accent-gold)', flexShrink:0 }}/>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-gold)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Build Ativa Agora</div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{activeBuild.name} — {activeBuild.ship}</div>
          </div>
        </div>
      )}

      {/* Controles */}
      <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
        {!showForm && !editBuild && (
          <button onClick={()=>setShowForm(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.35)', borderRadius:7, color:'var(--accent-green)', fontFamily:'"Exo 2",sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer' }}>
            <Plus size={14}/> Nova Build
          </button>
        )}
        <select style={SS2} value={filterShip} onChange={e=>setFilterShip(e.target.value)}>
          <option value="all">Todas as naves</option>
          {Object.keys(SHIP_CONFIGS).map(s=><option key={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft:'auto', fontFamily:'Share Tech Mono,monospace', fontSize:11, color:'var(--text-muted)' }}>{filtered.length} build{filtered.length!==1?'s':''}</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'50px 20px', color:'var(--text-muted)' }}>
          <Pickaxe size={44} style={{ display:'block', margin:'0 auto 12px', opacity:0.15 }}/>
          <div style={{ fontFamily:'Michroma,sans-serif', fontSize:13, fontWeight:700, marginBottom:8 }}>
            {builds.length===0 ? 'NENHUMA BUILD SALVA' : 'NENHUMA BUILD PARA ESTA NAVE'}
          </div>
          <div style={{ fontSize:12, lineHeight:1.6 }}>
            {builds.length===0 ? 'Clique em "Nova Build" para configurar sua primeira nave de mineração.' : 'Tente selecionar "Todas as naves".'}
          </div>
        </div>
      ) : (
        filtered.map(b => (
          <BuildCard key={b.id} build={b}
            onEdit={b=>{setEditBuild(b);setShowForm(false);}}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />
        ))
      )}
    </div>
  );
}

export default function MiningPage() {
  const mergedOres      = useMemo(() => mergeOresWithUex(DEFAULT_MINEABLE_ORES), []);
  const mergedLocations = useMemo(() => mergeLocationsWithUex(DEFAULT_MINING_LOCATIONS), []);
  const { data: MINEABLE_ORES } = useDataset(DATASETS.MINING_ORES.key, mergedOres);
  const { data: SHIP_LASERS } = useDataset(DATASETS.MINING_LASERS.key, DEFAULT_SHIP_LASERS);
  const { data: MINING_SHIPS } = useDataset(DATASETS.MINING_SHIPS.key, DEFAULT_MINING_SHIPS);
  const { data: MODULES } = useDataset(DATASETS.MINING_MODULES.key, DEFAULT_MINING_MODULES);
  const { data: LOCATIONS } = useDataset(DATASETS.MINING_LOCATIONS.key, mergedLocations);
  const miningStats    = getUexMiningStats();
  const locationsStats = getUexLocationsStats();
  const [activeTab, setActiveTab] = useState('locations');
  const [selectedLaser, setSelectedLaser] = useState(null);
  const [selectedShip, setSelectedShip] = useState(null);
  const [filterRaridade, setFilterRaridade] = useState('all');
  const [sortOre, setOrdenarOre] = useState('value');
  const [selectedLocalização, setSelectedLocalização] = useState(null);

  const sortedOres = useMemo(() => {
    let ores = [...MINEABLE_ORES].filter(o => filterRaridade==='all' || o.rarity===filterRaridade);
    ores.sort((a,b) => sortOre==='name' ? a.name.localeCompare(b.name) : b.value-a.value);
    return ores;
  }, [filterRaridade, sortOre]);

  const SS = { padding:'7px 28px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center' };

  const TABS = [
    { id:'locations', label:'Locais de Mineração' },
    { id:'ores',      label:'Minérios & Valores' },
    { id:'lasers',    label:'Lasers de Mining' },
    { id:'ships',     label:'Naves & Módulos' },
    { id:'builds',    label:'Builds de Nave' },
  ];

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">GUIA DE MINERAÇÃO</div>
          <div className="page-subtitle">Locais, minérios, lasers, naves e módulos para maximizar seu lucro</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding:'0 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',display:'flex',gap:0,flexShrink:0 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            padding:'12px 18px',background:activeTab===t.id?'rgba(56,189,248,0.1)':'transparent',
            border:'none',borderBottom:`2px solid ${activeTab===t.id?'var(--accent-primary)':'transparent'}`,
            color:activeTab===t.id?'var(--accent-primary)':'var(--text-secondary)',
            fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,letterSpacing:'0.06em',
            textTransform:'uppercase',cursor:'pointer',transition:'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      <div className="page-body">

        {(miningStats.updatedAt || locationsStats.updatedAt) && (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginBottom:16,padding:'10px 14px',background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:8 }}>
            <div style={{ fontSize:11,color:'var(--text-secondary)' }}>
              <strong style={{ color:'var(--accent-green)' }}>Dados sincronizados da UEX:</strong>{' '}
              {miningStats.updatedAt ? `${miningStats.count} minérios (${ptDate(miningStats.updatedAt)})` : 'minérios ainda não sincronizados'}
              {' · '}
              {locationsStats.updatedAt ? `${locationsStats.counts.planets + locationsStats.counts.moons} planetas/luas (${ptDate(locationsStats.updatedAt)})` : 'locais ainda não sincronizados'}
            </div>
            <div style={{ fontSize:10,color:'var(--text-muted)' }}>Sincronize em UEX API (Live) → Mineração / Localizações</div>
          </div>
        )}
        {!miningStats.updatedAt && !locationsStats.updatedAt && (
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16,padding:'10px 14px',background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:8,fontSize:11,color:'var(--text-secondary)' }}>
            💡 Esta guia ainda está usando apenas dados curados manualmente. Visite <strong style={{ color:'var(--accent-gold)' }}>UEX API (Live)</strong> → abas Mineração/Localizações para trazer preços e locais atualizados da comunidade.
          </div>
        )}

        {/* LOCATIONS TAB */}
        {activeTab==='locations' && (
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
            {Object.entries(LOCATIONS).map(([loc,data])=>(
              <div key={loc} style={{
                background:'var(--bg-card)',border:`1px solid ${selectedLocalização===loc?'var(--border-bright)':'var(--border-subtle)'}`,
                borderRadius:8,padding:'14px',cursor:'pointer',transition:'all 0.2s',
              }} onClick={()=>setSelectedLocalização(selectedLocalização===loc?null:loc)}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
                  <div>
                    <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                      <span style={{ fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{loc}</span>
                      {data.synced && <span style={{ fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:3,background:'rgba(52,211,153,0.1)',color:'var(--accent-green)',border:'1px solid rgba(52,211,153,0.25)' }}>UEX</span>}
                    </div>
                    <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>{data.system} · {data.type}</div>
                  </div>
                  <span style={{
                    fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:4,letterSpacing:'0.08em',
                    background:data.danger==='Alto'?'rgba(251,113,133,0.12)':data.danger==='Médio'?'rgba(251,191,36,0.1)':data.danger==='Desconhecido'?'rgba(122,144,176,0.1)':'rgba(52,211,153,0.1)',
                    color:data.danger==='Alto'?'var(--accent-red)':data.danger==='Médio'?'var(--accent-gold)':data.danger==='Desconhecido'?'var(--text-muted)':'var(--accent-green)',
                    border:`1px solid ${data.danger==='Alto'?'rgba(251,113,133,0.3)':data.danger==='Médio'?'rgba(251,191,36,0.25)':data.danger==='Desconhecido'?'rgba(122,144,176,0.25)':'rgba(52,211,153,0.25)'}`,
                  }}>⚠ {data.danger}</span>
                </div>
                <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginBottom:8 }}>
                  {data.best.map(ore=>{
                    const oreData=MINEABLE_ORES.find(o=>o.name===ore);
                    return (
                      <span key={ore} style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:3,background:`${oreData?.color||'#7a90b0'}18`,border:`1px solid ${oreData?.color||'#7a90b0'}44`,color:oreData?.color||'#7a90b0' }}>
                        {ore}
                      </span>
                    );
                  })}
                </div>
                {selectedLocalização===loc && (
                  <div style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,borderTop:'1px solid var(--border-subtle)',paddingTop:8,marginTop:4 }}>
                    {data.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ORES TAB */}
        {activeTab==='ores' && (
          <div>
            <div style={{ display:'flex',gap:10,marginBottom:16 }}>
              <select style={SS} value={filterRaridade} onChange={e=>setFilterRaridade(e.target.value)}>
                <option value="all">Todas Raridades</option>
                <option value="Comum">Comum</option>
                <option value="Incomum">Incomum</option>
                <option value="Raro">Raro</option>
              </select>
              <select style={SS} value={sortOre} onChange={e=>setOrdenarOre(e.target.value)}>
                <option value="value">Valor (maior)</option>
                <option value="name">Nome (A-Z)</option>
              </select>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12 }}>
              {sortedOres.map(ore=>(
                <div key={ore.name} style={{ background:'var(--bg-card)',border:`1px solid ${ore.color}33`,borderRadius:8,padding:'14px',borderLeft:`3px solid ${ore.color}` }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
                    <div>
                      <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
                        <span style={{ fontFamily:'"Exo 2",sans-serif',fontSize:14,fontWeight:700,color:ore.color }}>{ore.name}</span>
                        {ore.synced && <ProvenanceBadge category="mining_ore" name={ore.name}/>}
                      </div>
                      <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2 }}>{ore.rarity}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:'Michroma,sans-serif',fontSize:14,fontWeight:800,color:'var(--accent-gold)' }}>
                        {ore.value.toLocaleString()}
                      </div>
                      <div style={{ fontSize:9,color:'var(--text-muted)' }}>aUEC/unidade</div>
                    </div>
                  </div>
                  {ore.hazardous && (
                    <div style={{ fontSize:10,color:'var(--accent-red)',fontWeight:700,background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.2)',borderRadius:4,padding:'3px 8px',marginBottom:8 }}>
                      ⚠️ INSTÁVEL — Risco de explosão
                    </div>
                  )}
                  <div style={{ fontSize:11,color:'var(--text-secondary)',lineHeight:1.5,marginBottom:6 }}>{ore.notes}</div>
                  <div style={{ fontSize:10,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:4 }}>
                    <MapPin size={10}/> {ore.locations.join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LASERS TAB */}
        {activeTab==='lasers' && (
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            <div style={{ display:'flex',alignItems:'flex-start',gap:8,padding:'10px 14px',background:'rgba(56,189,248,0.05)',border:'1px solid rgba(56,189,248,0.15)',borderRadius:8,fontSize:11,color:'var(--text-secondary)',marginBottom:4 }}>
              💡 Nomes, fabricantes, tamanhos e preços verificados contra a UEX API. Os valores de Potência/Alcance/Extração/Instabilidade são estimativas comparativas — a UEX não expõe números oficiais de balanceamento de jogo.
            </div>
            {SHIP_LASERS.map(laser=>(
              <div key={laser.name} style={{
                background:'var(--bg-card)',border:`1px solid ${selectedLaser===laser.name?'var(--border-bright)':'var(--border-subtle)'}`,
                borderRadius:8,padding:'14px',cursor:'pointer',transition:'all 0.2s',
              }} onClick={()=>setSelectedLaser(selectedLaser===laser.name?null:laser.name)}>
                <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                  <Pickaxe size={20} style={{ color:'var(--accent-gold)',flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
                      <span style={{ fontFamily:'"Exo 2",sans-serif',fontSize:14,fontWeight:700,color:'var(--text-primary)' }}>{laser.name}</span>
                      <span style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:3,background:laser.tier==='Avançado'?'rgba(251,113,133,0.1)':laser.tier==='Intermediário'?'rgba(56,189,248,0.1)':laser.tier==='Craftado'?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.05)',color:laser.tier==='Avançado'?'var(--accent-red)':laser.tier==='Intermediário'?'var(--accent-primary)':laser.tier==='Craftado'?'var(--accent-green)':'var(--text-muted)',border:'1px solid var(--border-subtle)' }}>{laser.tier}</span>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8 }}>
                      {[['Potência',`${laser.power.toLocaleString()} MW`,'var(--accent-red)'],['Alcance',`${laser.range}m`,'var(--accent-primary)'],['Extração',`${laser.extraction}x`,'var(--accent-green)'],['Instab.',`${(laser.instability*100).toFixed(0)}%`,laser.instability>0.3?'var(--accent-red)':'var(--accent-green)']].map(([l,v,c])=>(
                        <div key={l} style={{ background:'var(--bg-panel)',borderRadius:5,padding:'5px 8px' }}>
                          <div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>{l}</div>
                          <div style={{ fontSize:12,color:c,fontFamily:'Share Tech Mono,monospace',fontWeight:700 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {selectedLaser===laser.name && (
                  <div style={{ marginTop:10,paddingTop:10,borderTop:'1px solid var(--border-subtle)',fontSize:12,color:'var(--text-secondary)',lineHeight:1.6 }}>
                    {laser.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SHIPS & MODULES TAB */}
        {activeTab==='builds' && <BuildsTab/>}
      {activeTab==='ships' && (
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
            <div>
              <div className="modal-section-title">Naves de Mining</div>
              {MINING_SHIPS.map(ship=>(
                <div key={ship.name} style={{ background:'var(--bg-card)',border:`1px solid ${selectedShip===ship.name?'var(--border-bright)':'var(--border-subtle)'}`,borderRadius:8,padding:'14px',marginBottom:10,cursor:'pointer',transition:'all 0.2s' }}
                  onClick={()=>setSelectedShip(selectedShip===ship.name?null:ship.name)}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:selectedShip===ship.name?8:0 }}>
                    <span style={{ fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{ship.name}</span>
                    <div style={{ display:'flex',gap:8 }}>
                      <span style={{ fontSize:11,color:'var(--accent-gold)',fontFamily:'Share Tech Mono,monospace' }}>{ship.cargo} SCU</span>
                      <span style={{ fontSize:11,color:'var(--accent-primary)',fontFamily:'Share Tech Mono,monospace' }}>{ship.lasers} laser{ship.lasers>1?'s':''}</span>
                      <span style={{ fontSize:11,color:'var(--text-muted)' }}>{ship.crew} crew</span>
                    </div>
                  </div>
                  {selectedShip===ship.name && (
                    <div style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,borderTop:'1px solid var(--border-subtle)',paddingTop:8 }}>{ship.notes}</div>
                  )}
                </div>
              ))}
            </div>
            <div>
              <div className="modal-section-title">Módulos de Mining</div>
              {MODULES.map(mod=>(
                <div key={mod.name} style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'12px',marginBottom:8 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
                    <span style={{ fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{mod.name}</span>
                    <span style={{ fontSize:10,color:'var(--accent-primary)',background:'rgba(56,189,248,0.08)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3,fontWeight:700 }}>{mod.type}</span>
                  </div>
                  <div style={{ fontSize:12,color:'var(--accent-green)',marginBottom:4 }}>{mod.effect}</div>
                  <div style={{ fontSize:11,color:'var(--text-muted)' }}>Ideal para: {mod.best_for}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}