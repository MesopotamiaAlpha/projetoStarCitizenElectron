'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createMobileServer } = require('./mobileServer');

function requestRaw(port, pathname, token = '') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, headers: token ? { 'X-Emoto-Token': token } : {} }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body, contentType: res.headers['content-type'] || '' }));
    });
    req.on('error', reject);
    req.end();
  });
}

function request(port, pathname, token = '', options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method: options.method || 'GET', headers: { ...(token ? { 'X-Emoto-Token': token } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null }));
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

test('servidor mobile exige token e entrega dados somente autenticado', async t => {
  const queries = {
    'SELECT COUNT(*) AS c FROM armor_sets': [{ c: 3 }],
    'SELECT COUNT(*) AS c FROM armor_pieces': [{ c: 12 }],
    'SELECT COUNT(*) AS c FROM user_pieces WHERE owned=1': [{ c: 4 }],
    'SELECT COUNT(*) AS c FROM inventory_items': [{ c: 8 }],
    'SELECT COALESCE(SUM(quantity),0) AS c FROM inventory_items': [{ c: 41 }],
    'SELECT id,name,category,subcategory,system,location_type,location_name,quantity,unit,grade,value_auec FROM inventory_items ORDER BY name LIMIT 2000': [{ id: 1, name: 'Gold', quantity: 2 }],
    'SELECT s.id,s.base_name,s.variant_name,s.type,COUNT(p.id) AS pieces,COALESCE(SUM(CASE WHEN u.owned=1 THEN 1 ELSE 0 END),0) AS owned_pieces FROM armor_sets s LEFT JOIN armor_pieces p ON p.set_id=s.id LEFT JOIN user_pieces u ON u.piece_id=p.id GROUP BY s.id ORDER BY lower(s.base_name),lower(s.variant_name) LIMIT 2000': [{ id: 1, base_name: 'Calico', pieces: 4, owned_pieces: 1 }],
  };
  let rendererState = { wikeloMissions: [{ title: 'Asgard', status: 'active' }], missions: [{ title: 'Delivery', status: 'completed' }], uexItems: [{ name: 'Gold', quantity: 3 }], alerts: [{ name: 'Pure Caranite', status: 'new' }], blueprints: [{ name: 'Coverall' }], materials: [{ name: 'Lindinium' }], materialTracking: { items: [{ material_name: 'Lindinium', needed_total: 110, collected: 78.4, remaining: 31.6, quality_min: 800, unit: 'cSCU', progress: 71.27, complete: false }], queuedBlueprints: [{ bpName: 'Coverall', quantity: 1 }], summary: { materials: 1, complete: 0, missing: 1, neededCount: 110, remainingCount: 31.6 } }, mining: [{ name: 'Prospector Build' }], miningGroup: [{ name: 'Session 1' }], oreVault: [{ name: 'Feynmaline' }], hangar: [{ name: 'Avenger' }], clanVault: [{ name: 'Shared Crate' }], notes: [{ title: 'Reminder' }] };
  const requestedActions = [];
  const server = createMobileServer({ queryAll: sql => queries[sql] || [], queryOne: sql => (queries[sql] || [])[0] || null, getDataRoot: () => 'C:\\CompanheiroEmoto', getRendererState: () => rendererState, requestRendererAction: async (action, payload) => { requestedActions.push({ action, payload }); if (action === 'uex-fetch-negotiations') return { success: true, negotiations: [{ hash: 'neg-1', item_name: 'Gold' }] }; if (action === 'uex-fetch-messages') return { success: true, messages: [{ content: 'Olá' }] }; return { success: true, action, payload }; }, updateInventoryQuantity: async (id, payload) => ({ success: true, id, quantity: 7 + Number(payload.delta || 0) }), updateArmorQuantity: async (id, payload) => ({ success: true, pieceId: id, quantity: 2 + Number(payload.delta || 0) }) });
  const status = await server.start(47891);
  t.after(() => server.stop());
  assert.equal(status.running, true);
  assert.ok(status.token);
  const favicon = await requestRaw(47891, '/favicon.ico');
  assert.equal(favicon.status, 204);
  const portal = await requestRaw(47891, '/');
  assert.equal(portal.status, 200);
  assert.match(portal.contentType, /text\/html/);
  assert.match(portal.body, /Companheiro Emoto Mobile/);
  const unauthorized = await request(47891, '/api/mobile/summary');
  assert.equal(unauthorized.status, 401);
  assert.equal((await request(47891, '/api/mobile/inventory/1', status.token, { method: 'POST', body: { delta: 1 } })).body.quantity, 8);
  assert.equal((await request(47891, '/api/mobile/armors/3', status.token, { method: 'POST', body: { delta: -1 } })).body.quantity, 1);
  assert.equal((await request(47891, '/api/mobile/missions/m1/status', status.token, { method: 'POST', body: { status: 'completed' } })).status, 200);
  assert.equal((await request(47891, '/api/mobile/wikelo/m1/items/i1', status.token, { method: 'POST', body: { collected: 4 } })).status, 200);
  assert.equal((await request(47891, '/api/mobile/alerts/a1/dismiss', status.token, { method: 'POST' })).status, 200);
  assert.deepEqual(requestedActions.map(entry => entry.action), ['mission-set-status', 'wikelo-update-item', 'alert-dismiss']);
  const summary = await request(47891, '/api/mobile/summary', status.token);
  assert.equal(summary.status, 200);
  assert.deepEqual(summary.body, { armors: 3, pieces: 12, owned: 4, inventory: 8, inventoryQuantity: 41, server: 'online' });
  const inventory = await request(47891, '/api/mobile/inventory', status.token);
  assert.equal(inventory.body[0].name, 'Gold');
  assert.equal((await request(47891, '/api/mobile/wikelo', status.token)).body.missions[0].title, 'Asgard');
  assert.equal((await request(47891, '/api/mobile/missions', status.token)).body.missions[0].status, 'completed');
  assert.equal((await request(47891, '/api/mobile/uex', status.token)).body.items[0].name, 'Gold');
  assert.equal((await request(47891, '/api/mobile/negotiations', status.token)).body.negotiations[0].hash, 'neg-1');
  assert.equal((await request(47891, '/api/mobile/negotiations/neg-1/messages', status.token)).body.messages[0].content, 'Olá');
  assert.equal((await request(47891, '/api/mobile/alerts', status.token)).body.alerts[0].name, 'Pure Caranite');
  assert.equal((await request(47891, '/api/mobile/blueprints', status.token)).body.items[0].name, 'Coverall');
  const materials = (await request(47891, '/api/mobile/materials', status.token)).body;
  assert.equal(materials.items[0].material_name, 'Lindinium');
  assert.equal(materials.items[0].remaining, 31.6);
  assert.equal(materials.summary.missing, 1);
  assert.equal((await request(47891, '/api/mobile/mining', status.token)).body.items[0].name, 'Prospector Build');
  assert.equal((await request(47891, '/api/mobile/mining-group', status.token)).body.items[0].name, 'Session 1');
  assert.equal((await request(47891, '/api/mobile/orevault', status.token)).body.items[0].name, 'Feynmaline');
  assert.equal((await request(47891, '/api/mobile/hangar', status.token)).body.items[0].name, 'Avenger');
  assert.equal((await request(47891, '/api/mobile/clan', status.token)).body.items[0].name, 'Shared Crate');
  assert.equal((await request(47891, '/api/mobile/notes', status.token)).body.items[0].title, 'Reminder');
  rendererState = { wikeloMissions: [{ title: 'Updated' }] };
  assert.equal((await request(47891, '/api/mobile/wikelo', status.token)).body.missions[0].title, 'Updated');
  const rotated = server.rotateToken();
  assert.notEqual(rotated.token, status.token);
  assert.equal((await request(47891, '/api/mobile/summary', status.token)).status, 401);
  assert.equal((await request(47891, '/api/mobile/summary', rotated.token)).status, 200);
  assert.equal(server.stop().running, false);
});
