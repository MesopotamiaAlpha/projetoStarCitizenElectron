'use strict';

const http = require('http');
const os = require('os');
const crypto = require('crypto');
const DEFAULT_PORT = 47821;
const MAX_BODY_BYTES = 256 * 1024;

function getLanAddresses() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces || []) {
      if (item && item.family === 'IPv4' && !item.internal) addresses.push(item.address);
    }
  }
  return [...new Set(addresses)];
}

function safeJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.setEncoding('utf8');
    req.on('data', chunk => { size += Buffer.byteLength(chunk); if (size > MAX_BODY_BYTES) { reject(new Error('Payload excede o limite permitido.')); req.destroy(); return; } body += chunk; });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('JSON inválido.')); } });
    req.on('error', reject);
  });
}

function htmlPage() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#08111f"><title>Companheiro Emoto Mobile</title><style>
:root{color-scheme:dark;--bg:#07101d;--panel:#0d1b2d;--panel2:#11243a;--line:#28425c;--text:#edf6ff;--muted:#a9bdd2;--cyan:#38bdf8;--green:#34d399;--gold:#fbbf24}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% -10%,#123452 0,#07101d 42%,#050a13 100%);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;min-height:100vh}.app{max-width:980px;margin:auto;padding:18px 14px 86px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.brand{font-weight:800;letter-spacing:.08em}.brand small{display:block;color:var(--cyan);font-size:10px;letter-spacing:.16em}.status{border:1px solid #275070;border-radius:999px;padding:7px 10px;color:var(--green);font-size:12px}.hero{background:linear-gradient(135deg,rgba(56,189,248,.15),rgba(13,27,45,.92));border:1px solid #2a5575;border-radius:18px;padding:20px;margin-bottom:14px}.hero h1{font-size:clamp(24px,6vw,38px);margin:0 0 6px}.hero p{color:var(--muted);margin:0}.nav{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.nav button,.action{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:11px;padding:12px 8px;font-weight:700;cursor:pointer}.nav button.active{border-color:var(--cyan);color:var(--cyan);background:#102d45}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{background:rgba(13,27,45,.9);border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0}.metric{font-size:28px;font-weight:800;color:var(--cyan);font-variant-numeric:tabular-nums}.label{color:var(--muted);font-size:12px;margin-top:3px}.toolbar{display:flex;gap:8px;margin:14px 0}.toolbar input{flex:1;min-width:0;background:#081522;border:1px solid var(--line);border-radius:10px;color:var(--text);padding:12px;font-size:16px}.list{display:grid;gap:9px}.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.row strong{display:block;overflow-wrap:anywhere}.row span{color:var(--muted);font-size:12px}.badge{white-space:nowrap;color:var(--green);font-weight:800}.material-head{background:rgba(13,27,45,.72);border:1px solid var(--line);border-radius:14px;padding:12px}.material-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.material-stat{background:#081522;border:1px solid var(--line);border-radius:10px;padding:9px;text-align:center}.material-stat b{display:block;color:var(--cyan);font-size:22px}.material-stat span{display:block;color:var(--muted);font-size:11px}.blueprint-queue{margin:10px 0;padding:11px 13px;background:rgba(162,155,254,.08);border:1px solid rgba(162,155,254,.25);border-radius:11px;color:var(--muted);font-size:12px}.material-card{background:rgba(13,27,45,.9);border:1px solid var(--line);border-radius:14px;padding:14px}.material-card.is-complete{border-color:rgba(52,211,153,.42);background:rgba(15,46,47,.68)}.material-card-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.material-card-top strong{display:block;font-size:16px;overflow-wrap:anywhere}.material-card-top span{display:block;color:var(--muted);font-size:12px;margin-top:3px}.material-status{font-size:11px;color:var(--gold);white-space:nowrap}.is-complete .material-status{color:var(--green)}.material-values{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:12px 0}.material-values div{background:#081522;border:1px solid var(--line);border-radius:9px;padding:8px;min-width:0}.material-values small{display:block;color:var(--muted);font-size:10px}.material-values strong{display:block;color:var(--text);font-size:13px;overflow-wrap:anywhere;margin-top:3px}.material-values .available{color:var(--green)}.material-values .missing{color:var(--gold)}.is-complete .material-values .missing{color:var(--green)}.progress{height:8px;background:#07101d;border-radius:99px;overflow:hidden;border:1px solid var(--line)}.progress i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--green));border-radius:inherit;transition:width .3s ease}.progress-label{display:flex;justify-content:space-between;gap:8px;margin-top:6px;color:var(--muted);font-size:10px}.progress-label span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.empty{color:var(--muted);padding:24px;text-align:center}.bottom{position:fixed;bottom:0;left:0;right:0;background:rgba(5,10,19,.96);border-top:1px solid var(--line);padding:10px 14px;text-align:center;color:var(--muted);font-size:12px}@media(max-width:620px){.grid{grid-template-columns:repeat(2,1fr)}.nav{grid-template-columns:repeat(3,1fr)}.hero{padding:16px}.app{padding-left:10px;padding-right:10px}.material-values{grid-template-columns:1fr}.material-stats{gap:5px}.material-stat b{font-size:19px}.progress-label{font-size:9px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style></head><body><main class="app"><header class="top"><div class="brand">EMOTO<small>COMPANHEIRO MOBILE</small></div><div class="status">SERVIDOR LOCAL</div></header><section class="hero"><h1>Centro de Operações</h1><p>Consulte seus dados do Companheiro Emoto pelo celular. O computador continua guardando o banco e executando as operações protegidas.</p></section><nav class="nav"><button data-view="summary" class="active">Resumo</button><button data-view="inventory">Inventário</button><button data-view="armors">Armaduras</button><button data-view="wikelo">Wikelo</button><button data-view="missions">Missões</button><button data-view="uex">UEX</button><button data-view="negotiations">Negociações</button><button data-view="alerts">Alertas</button><button data-view="blueprints">Blueprints</button><button data-view="materials">Materiais</button><button data-view="mining">Mineração</button><button data-view="miningGroup">Mineração Grupo</button><button data-view="orevault">Baú Minério</button><button data-view="hangar">Hangar</button><button data-view="clan">Cofre Clã</button><button data-view="notes">Notas</button></nav><section id="content"><div class="empty">Carregando dados...</div></section></main><div class="bottom">Acesso local protegido por token temporário · Versão 3.0.0</div><script>
const token=new URLSearchParams(location.search).get('token')||sessionStorage.getItem('emoto_mobile_token')||'';if(token)sessionStorage.setItem('emoto_mobile_token',token);const headers=token?{'X-Emoto-Token':token}:{}, content=document.querySelector('#content');let current='summary';
async function api(path){const response=await fetch(path,{headers});if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Não foi possível carregar os dados.');return response.json()}
async function mutate(path,payload){const response=await fetch(path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(payload||{})});if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Não foi possível salvar a alteração.');return response.json()}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
async function openChat(hash){content.innerHTML='<div class="card empty">Carregando conversa...</div>';try{const data=await api('/api/mobile/negotiations/'+encodeURIComponent(hash)+'/messages');const messages=data.messages||[];content.innerHTML='<div class="toolbar"><button class="action" id="backNegotiations">← Voltar</button></div><div class="list">'+(messages.length?messages.map(message=>'<article class="card"><strong>'+esc(message.sender_name||message.username||message.author||'Mensagem')+'</strong><span>'+esc(message.created_at||message.sent_at||'')+'</span><p>'+esc(message.message||message.content||message.text||'')+'</p></article>').join(''):'<div class="empty">Nenhuma mensagem encontrada.</div>')+'</div>';document.querySelector('#backNegotiations').addEventListener('click',()=>load('negotiations'))}catch(error){content.innerHTML='<div class="card empty">'+esc(error.message)+'</div>'}}
function renderSummary(data){content.innerHTML='<div class="grid">'+[['Armaduras',data.armors,'sets registrados'],['Peças',data.pieces,'peças cadastradas'],['Possuídas',data.owned,'peças em sua coleção'],['Inventário',data.inventory,'registros de itens'],['Quantidade',data.inventoryQuantity,'unidades no inventário'],['Servidor',data.server,'status']].map(x=>'<article class="card"><div class="metric">'+esc(x[1])+'</div><div class="label">'+esc(x[0])+'</div><div class="label">'+esc(x[2])+'</div></article>').join('')+'</div><div class="card" style="margin-top:10px"><strong>Próximos módulos</strong><p class="label">A versão mobile preserva o acesso ao desktop para backup, monitor Game.log, UEX e operações de arquivos.</p></div>'}
function getActions(item,type){
if(type==='inventory')return '<div style="display:flex;gap:5px;margin-top:8px"><button class="action" data-adjust="1" data-id="'+esc(item.id)+'" data-delta="-1" aria-label="Reduzir quantidade">−</button><button class="action" data-adjust="1" data-id="'+esc(item.id)+'" data-delta="1" aria-label="Aumentar quantidade">+</button></div>';
if(type==='missions')return '<div style="display:flex;gap:5px;margin-top:8px"><button class="action" data-mission-status="completed" data-id="'+esc(item.id||item.guid)+'">Concluir</button><button class="action" data-mission-status="ended" data-id="'+esc(item.id||item.guid)+'">Encerrar</button></div>';
if(type==='alerts')return '<div style="margin-top:8px"><button class="action" data-alert-dismiss="1" data-id="'+esc(item.id||item.key||item.groupKey)+'">Dispensar alerta</button></div>';
if(type==='negotiations')return '<div style="margin-top:8px"><button class="action" data-chat="'+esc(item.hash||item.id||'')+'">Abrir conversa</button></div>';
if(type==='wikelo')return '<div style="margin-top:8px"><button class="action" data-wikelo="1" data-mission-id="'+esc(item.missionId||item.mission_id||item.id||'')+'" data-item-id="'+esc(item.itemId||item.item_id||item.requirementId||'')+'" data-collected="'+esc(item.collected||0)+'">Registrar +1</button></div>';
return '';
}
function renderMaterialTracking(data){const items=Array.isArray(data?.items)?data.items:[];const summary=data?.summary||{};const q=document.querySelector('#materialSearch')?.value?.toLowerCase()||'';const filtered=items.filter(item=>JSON.stringify(item).toLowerCase().includes(q));content.innerHTML='<div class="material-head"><div class="material-stats"><div class="material-stat"><b>'+esc(summary.missing??0)+'</b><span>faltando</span></div><div class="material-stat"><b>'+esc(summary.complete??0)+'</b><span>completos</span></div><div class="material-stat"><b>'+esc(items.length)+'</b><span>materiais</span></div></div><div class="toolbar"><input id="materialSearch" placeholder="Pesquisar material..." value="'+esc(q)+'"><button class="action" id="materialRefresh">Atualizar</button></div></div><div class="blueprint-queue">'+((data?.queuedBlueprints||[]).length?'<strong>Blueprints na fila:</strong> '+data.queuedBlueprints.map(bp=>esc(bp.bpName)+' × '+esc(bp.quantity)).join(' · '):'Nenhuma blueprint na fila')+'</div><div class="list">'+(filtered.length?filtered.map(item=>{const pct=Math.max(0,Math.min(100,Number(item.progress)||0));const done=item.complete||item.remaining<=0;const unit=esc(item.unit||'un');const quality=item.quality_min>0?'Q≥ '+esc(item.quality_min):'Qualidade livre';return '<article class="material-card '+(done?'is-complete':'')+'"><div class="material-card-top"><div><strong>'+esc(item.material_name||'Material')+'</strong><span>'+quality+' · '+unit+'</span></div><b class="material-status">'+(done?'COMPLETO':'FALTA')+'</b></div><div class="material-values"><div><small>Necessário</small><strong>'+esc(item.needed_total??0)+' '+unit+'</strong></div><div><small>Disponível</small><strong class="available">'+esc(item.collected??0)+' '+unit+'</strong></div><div><small>Faltante</small><strong class="missing">'+esc(item.remaining??0)+' '+unit+'</strong></div></div><div class="progress"><i style="width:'+pct+'%"></i></div><div class="progress-label"><span>'+pct.toFixed(0)+'% separado</span><span>'+esc((item.usedBy||[]).map(row=>{const bpName=String(row.bpName||'').trim();if(!bpName)return '';const q=Number(row.quality_min)||0;return bpName+' ('+(q>0?'Q≥'+q:'Qualidade livre')+')'}).filter(Boolean).slice(0,5).join(' · '))+'</span></div></article>'}).join(''):'<div class="empty">Nenhum material encontrado.</div>')+'</div>';const input=document.querySelector('#materialSearch');if(input)input.addEventListener('input',()=>renderMaterialTracking(data));document.querySelector('#materialRefresh').addEventListener('click',()=>load('materials'))}
function renderList(items,type){const q=document.querySelector('#search')?.value?.toLowerCase()||'';const filtered=(Array.isArray(items)?items:[]).filter(item=>JSON.stringify(item).toLowerCase().includes(q));content.innerHTML='<div class="toolbar"><input id="search" placeholder="Pesquisar..." value="'+esc(q)+'"><button class="action" id="refresh">Atualizar</button></div><div class="list">'+(filtered.length?filtered.map(item=>{const name=type==='inventory'?item.name:(type==='armors'?item.base_name+' · '+(item.variant_name||'Base'):(item.title||item.name||item.mission_title||item.item_name||'Registro'));const detail=type==='inventory'?[(item.category||''),(item.system||''),(item.location_name||'')].filter(Boolean).join(' · '):(type==='armors'?((item.pieces||0)+' peças · '+(item.type||'')):[item.status,item.state,item.category].filter(Boolean).join(' · '));const qty=type==='inventory'?(item.quantity??0):(type==='armors'?((item.owned_pieces??0)+' possuídas'):(item.progress!==undefined?item.progress:(item.collected!==undefined?item.collected:'')));const actions=getActions(item,type);return '<article class="card row"><div style="min-width:0"><strong>'+esc(name)+'</strong><span>'+esc(detail)+'</span>'+actions+'</div><div class="badge">'+esc(qty)+'</div></article>'}).join(''):'<div class="empty">Nenhum registro encontrado.</div>')+'</div>';const input=document.querySelector('#search');if(input)input.addEventListener('input',()=>renderList(items,type));document.querySelector('#refresh').addEventListener('click',()=>load(type));document.querySelectorAll('[data-adjust]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await mutate('/api/mobile/inventory/'+encodeURIComponent(button.dataset.id),{delta:Number(button.dataset.delta)});await load(type)}catch(error){alert(error.message);button.disabled=false}}));document.querySelectorAll('[data-mission-status]').forEach(button=>button.addEventListener('click',async()=>{if(!confirm('Confirmar alteração do status desta missão?'))return;button.disabled=true;try{await mutate('/api/mobile/missions/'+encodeURIComponent(button.dataset.id)+'/status',{status:button.dataset.missionStatus});await load(type)}catch(error){alert(error.message);button.disabled=false}}));document.querySelectorAll('[data-alert-dismiss]').forEach(button=>button.addEventListener('click',async()=>{if(!confirm('Dispensar este alerta?'))return;button.disabled=true;try{await mutate('/api/mobile/alerts/'+encodeURIComponent(button.dataset.id)+'/dismiss');await load(type)}catch(error){alert(error.message);button.disabled=false}}));document.querySelectorAll('[data-chat]').forEach(button=>button.addEventListener('click',()=>openChat(button.dataset.chat)));document.querySelectorAll('[data-wikelo]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await mutate('/api/mobile/wikelo/'+encodeURIComponent(button.dataset.missionId)+'/items/'+encodeURIComponent(button.dataset.itemId),{collected:Number(button.dataset.collected||0)+1});await load(type)}catch(error){alert(error.message);button.disabled=false}}))}
async function load(view=current){current=view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));content.innerHTML='<div class="empty">Carregando...</div>';try{if(view==='summary')renderSummary(await api('/api/mobile/summary'));if(view==='inventory')renderList(await api('/api/mobile/inventory'),'inventory');if(view==='armors')renderList(await api('/api/mobile/armors'),'armors');if(view==='wikelo')renderList((await api('/api/mobile/wikelo')).missions||[],'wikelo');if(view==='missions')renderList((await api('/api/mobile/missions')).missions||[],'missions');if(view==='uex')renderList((await api('/api/mobile/uex')).items||[],'uex');if(view==='negotiations')renderList((await api('/api/mobile/negotiations')).negotiations||[],'negotiations');if(view==='alerts')renderList((await api('/api/mobile/alerts')).alerts||[],'alerts');if(view==='blueprints')renderList((await api('/api/mobile/blueprints')).items||[],'blueprints');if(view==='materials')renderMaterialTracking(await api('/api/mobile/materials'));if(view==='mining')renderList((await api('/api/mobile/mining')).items||[],'mining');if(view==='miningGroup')renderList((await api('/api/mobile/mining-group')).items||[],'miningGroup');if(view==='orevault')renderList((await api('/api/mobile/orevault')).items||[],'orevault');if(view==='hangar')renderList((await api('/api/mobile/hangar')).items||[],'hangar');if(view==='clan')renderList((await api('/api/mobile/clan')).items||[],'clan');if(view==='notes')renderList((await api('/api/mobile/notes')).items||[],'notes')}catch(e){content.innerHTML='<div class="card empty">'+esc(e.message)+'</div>'}}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>load(b.dataset.view)));try{const events=new EventSource('/api/mobile/events?token='+encodeURIComponent(token));events.addEventListener('state-updated',()=>load(current));events.addEventListener('inventory-updated',()=>{if(current==='inventory')load(current)});events.addEventListener('armor-updated',()=>{if(current==='armors')load(current)});window.addEventListener('beforeunload',()=>events.close())}catch{}load();
</script></body></html>`;
}

function createMobileServer({ queryAll, queryOne, getDataRoot, getRendererState = () => ({}), requestRendererAction, updateInventoryQuantity, updateArmorQuantity, getVersion = () => '3.0.0' }) {
  let server = null;
  let rendererState = {};
  const eventClients = new Set();

  function broadcast(type, payload = {}) {
    const message = `event: ${type}\\ndata: ${JSON.stringify(payload)}\\n\\n`;
    for (const client of eventClients) { try { client.write(message); } catch { eventClients.delete(client); } }
  }
  let token = null;
  let port = DEFAULT_PORT;
  const startedAt = null;

  function status() {
    const addresses = getLanAddresses();
    const externalState = getRendererState?.() || {};
    rendererState = externalState && typeof externalState === 'object' ? externalState : rendererState;
    return { running: Boolean(server), port: server ? port : null, token: server ? token : null, addresses, urls: server ? addresses.map(address => `http://${address}:${port}/?token=${encodeURIComponent(token)}`) : [], startedAt: server ? server.__startedAt : null, syncedAt: rendererState.syncedAt || null, version: getVersion() };
  }

  function authorized(req, url) {
    const supplied = String(req.headers['x-emoto-token'] || url.searchParams.get('token') || '');
    if (!token || !supplied || supplied.length !== token.length) return false;
    const suppliedBuffer = Buffer.from(supplied);
    const tokenBuffer = Buffer.from(token);
    return suppliedBuffer.length === tokenBuffer.length && crypto.timingSafeEqual(suppliedBuffer, tokenBuffer);
  }

  async function handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const latestState = getRendererState?.();
    if (latestState && typeof latestState === 'object') rendererState = latestState;
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Emoto-Token', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }); return res.end(); }
    if (url.pathname === '/' || url.pathname === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(htmlPage()); }
    if (url.pathname === '/favicon.ico') { res.writeHead(204, { 'Cache-Control': 'public, max-age=3600' }); return res.end(); }
    if (url.pathname === '/api/mobile/status') return authorized(req, url) ? safeJson(res, 200, status()) : safeJson(res, 401, { error: 'Token inválido ou ausente.' });
    if (!authorized(req, url)) return safeJson(res, 401, { error: 'Token inválido ou ausente.' });
    if (url.pathname === '/api/mobile/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
      res.write(`event: connected\\ndata: ${JSON.stringify({ syncedAt: rendererState.syncedAt || null })}\\n\\n`);
      eventClients.add(res);
      req.on('close', () => eventClients.delete(res));
      return;
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/mobile/missions/') && url.pathname.endsWith('/status')) {
      const id = decodeURIComponent(url.pathname.split('/').slice(-2, -1)[0] || '');
      const payload = await readJsonBody(req);
      if (!id || typeof requestRendererAction !== 'function') return safeJson(res, 400, { error: 'Missão inválida.' });
      const result = await requestRendererAction('mission-set-status', { id, status: String(payload.status || '').trim() });
      if (!result?.success) return safeJson(res, 400, result || { error: 'Não foi possível atualizar a missão.' });
      broadcast('state-updated', { syncedAt: new Date().toISOString() });
      return safeJson(res, 200, result);
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/mobile/wikelo/') && url.pathname.includes('/items/')) {
      const parts = url.pathname.split('/');
      const missionId = decodeURIComponent(parts[4] || '');
      const itemId = decodeURIComponent(parts[6] || '');
      const payload = await readJsonBody(req);
      if (!missionId || !itemId || typeof requestRendererAction !== 'function') return safeJson(res, 400, { error: 'Item Wikelo inválido.' });
      const result = await requestRendererAction('wikelo-update-item', { missionId, itemId, collected: payload.collected });
      if (!result?.success) return safeJson(res, 400, result || { error: 'Não foi possível atualizar o progresso Wikelo.' });
      broadcast('state-updated', { syncedAt: new Date().toISOString() });
      return safeJson(res, 200, result);
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/mobile/alerts/') && url.pathname.endsWith('/dismiss')) {
      const id = decodeURIComponent(url.pathname.split('/').slice(-2, -1)[0] || '');
      if (!id || typeof requestRendererAction !== 'function') return safeJson(res, 400, { error: 'Alerta inválido.' });
      const result = await requestRendererAction('alert-dismiss', { id });
      if (!result?.success) return safeJson(res, 400, result || { error: 'Não foi possível dispensar o alerta.' });
      broadcast('state-updated', { syncedAt: new Date().toISOString() });
      return safeJson(res, 200, result);
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/mobile/inventory/')) {
      const id = Number(url.pathname.split('/').pop());
      const payload = await readJsonBody(req);
      if (!Number.isInteger(id) || typeof updateInventoryQuantity !== 'function') return safeJson(res, 400, { error: 'Registro de inventário inválido.' });
      const result = await updateInventoryQuantity(id, payload);
      if (!result?.success) return safeJson(res, 400, result || { error: 'Não foi possível alterar o inventário.' });
      broadcast('inventory-updated', result);
      return safeJson(res, 200, result);
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/mobile/armors/')) {
      const id = Number(url.pathname.split('/').pop());
      const payload = await readJsonBody(req);
      if (!Number.isInteger(id) || typeof updateArmorQuantity !== 'function') return safeJson(res, 400, { error: 'Peça de armadura inválida.' });
      const result = await updateArmorQuantity(id, payload);
      if (!result?.success) return safeJson(res, 400, result || { error: 'Não foi possível alterar a armadura.' });
      broadcast('armor-updated', result);
      return safeJson(res, 200, result);
    }
    if (req.method !== 'GET') return safeJson(res, 405, { error: 'Método não permitido.' });
    if (url.pathname === '/api/mobile/summary') {
      const armors = queryOne('SELECT COUNT(*) AS c FROM armor_sets')?.c || 0;
      const pieces = queryOne('SELECT COUNT(*) AS c FROM armor_pieces')?.c || 0;
      const owned = queryOne('SELECT COUNT(*) AS c FROM user_pieces WHERE owned=1')?.c || 0;
      const inventory = queryOne('SELECT COUNT(*) AS c FROM inventory_items')?.c || 0;
      const inventoryQuantity = queryOne('SELECT COALESCE(SUM(quantity),0) AS c FROM inventory_items')?.c || 0;
      return safeJson(res, 200, { armors, pieces, owned, inventory, inventoryQuantity, server: 'online' });
    }
    if (url.pathname === '/api/mobile/inventory') return safeJson(res, 200, queryAll('SELECT id,name,category,subcategory,system,location_type,location_name,quantity,unit,grade,value_auec FROM inventory_items ORDER BY name LIMIT 2000'));
    if (url.pathname === '/api/mobile/armors') return safeJson(res, 200, queryAll(`SELECT s.id,s.base_name,s.variant_name,s.type,COUNT(p.id) AS pieces,COALESCE(SUM(CASE WHEN u.owned=1 THEN 1 ELSE 0 END),0) AS owned_pieces FROM armor_sets s LEFT JOIN armor_pieces p ON p.set_id=s.id LEFT JOIN user_pieces u ON u.piece_id=p.id GROUP BY s.id ORDER BY lower(s.base_name),lower(s.variant_name) LIMIT 2000`));
    if (url.pathname === '/api/mobile/wikelo') return safeJson(res, 200, { missions: Array.isArray(rendererState.wikeloMissions) ? rendererState.wikeloMissions : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/missions') return safeJson(res, 200, { missions: Array.isArray(rendererState.missions) ? rendererState.missions : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/uex') return safeJson(res, 200, { items: Array.isArray(rendererState.uexItems) ? rendererState.uexItems : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/negotiations') {
      if (typeof requestRendererAction !== 'function') return safeJson(res, 503, { error: 'Consulta UEX indisponível.' });
      const result = await requestRendererAction('uex-fetch-negotiations');
      return result?.success ? safeJson(res, 200, { negotiations: result.negotiations || [] }) : safeJson(res, 502, result || { error: 'Não foi possível consultar negociações.' });
    }
    if (url.pathname.startsWith('/api/mobile/negotiations/') && url.pathname.endsWith('/messages')) {
      if (typeof requestRendererAction !== 'function') return safeJson(res, 503, { error: 'Consulta UEX indisponível.' });
      const hash = decodeURIComponent(url.pathname.split('/').slice(-2, -1)[0] || '');
      const result = await requestRendererAction('uex-fetch-messages', { hash });
      return result?.success ? safeJson(res, 200, { messages: result.messages || [] }) : safeJson(res, 502, result || { error: 'Não foi possível consultar mensagens.' });
    }
    if (url.pathname === '/api/mobile/alerts') return safeJson(res, 200, { alerts: Array.isArray(rendererState.alerts) ? rendererState.alerts : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/blueprints') return safeJson(res, 200, { items: Array.isArray(rendererState.blueprints) ? rendererState.blueprints : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/materials') {
      const tracking = rendererState.materialTracking && typeof rendererState.materialTracking === 'object' ? rendererState.materialTracking : null;
      return safeJson(res, 200, tracking ? { ...tracking, syncedAt: tracking.syncedAt || rendererState.syncedAt || null } : { items: Array.isArray(rendererState.materials) ? rendererState.materials : [], summary: { materials: 0, complete: 0, missing: 0, neededCount: 0, remainingCount: 0 }, queuedBlueprints: [], syncedAt: rendererState.syncedAt || null });
    }
    if (url.pathname === '/api/mobile/mining') return safeJson(res, 200, { items: Array.isArray(rendererState.mining) ? rendererState.mining : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/mining-group') return safeJson(res, 200, { items: Array.isArray(rendererState.miningGroup) ? rendererState.miningGroup : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/orevault') return safeJson(res, 200, { items: Array.isArray(rendererState.oreVault) ? rendererState.oreVault : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/hangar') return safeJson(res, 200, { items: Array.isArray(rendererState.hangar) ? rendererState.hangar : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/clan') return safeJson(res, 200, { items: Array.isArray(rendererState.clanVault) ? rendererState.clanVault : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/notes') return safeJson(res, 200, { items: Array.isArray(rendererState.notes) ? rendererState.notes : [], syncedAt: rendererState.syncedAt || null });
    if (url.pathname === '/api/mobile/data-root') return safeJson(res, 200, { dataRoot: getDataRoot() });
    return safeJson(res, 404, { error: 'Rota não encontrada.' });
  }

  return {
    start(requestedPort = DEFAULT_PORT) {
      if (server) return status();
      port = Number(requestedPort) || DEFAULT_PORT;
      token = crypto.randomBytes(24).toString('hex');
      server = http.createServer((req, res) => { handle(req, res).catch(error => safeJson(res, 500, { error: error.message || 'Erro interno.' })); });
      return new Promise((resolve, reject) => {
        const onError = error => { server = null; token = null; reject(error); };
        server.once('error', onError);
        server.listen(port, '0.0.0.0', () => { server.removeListener('error', onError); server.__startedAt = new Date().toISOString(); resolve(status()); });
      });
    },
    stop() { for (const client of eventClients) { try { client.end(); } catch {} } eventClients.clear(); if (server) server.close(); server = null; token = null; return status(); },
    status,
    rotateToken() { if (!server) return status(); token = crypto.randomBytes(24).toString('hex'); return status(); },
    setRendererState(next) { rendererState = next && typeof next === 'object' ? next : {}; broadcast('state-updated', { syncedAt: rendererState.syncedAt || null }); return { success: true, syncedAt: rendererState.syncedAt || null }; },
  };
}

module.exports = { createMobileServer, DEFAULT_PORT };
