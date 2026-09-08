'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeUexEndpoint } = require('./uexEndpoint.cjs');

test('aceita a rota de médias por qualidade com item_name codificado', () => {
  const endpoint = normalizeUexEndpoint('marketplace_prices_averages?item_name=Arclight%20II%20Knife&operation=sell&quality_tier=5');
  assert.equal(endpoint, 'marketplace_prices_averages?item_name=Arclight%20II%20Knife&operation=sell&quality_tier=5');
});

test('aceita nomes UEX com caracteres especiais mantidos pelo encodeURIComponent', () => {
  const endpoint = normalizeUexEndpoint("marketplace_prices_averages?item_name=Gallant%20-%20Energy%20Rifle%20(Cousin%20Crows)%20O'Brien~&currency=UEC");
  assert.match(endpoint, /item_name=Gallant%20-%20Energy/);
  assert.match(endpoint, /\(Cousin%20Crows\)/);
  assert.match(endpoint, /O'Brien~/);
  assert.match(endpoint, /currency=UEC/);
});

test('normaliza barras iniciais sem liberar URL externa', () => {
  assert.equal(normalizeUexEndpoint('/marketplace_prices_averages?item_name=Iron'), 'marketplace_prices_averages?item_name=Iron');
  assert.throws(() => normalizeUexEndpoint('https://example.com/marketplace_prices_averages'), /inválido ou não permitido/);
  assert.throws(() => normalizeUexEndpoint('marketplace_prices_averages/../items'), /inválido ou não permitido/);
});

test('rejeita caracteres de controle e esquemas embutidos', () => {
  assert.throws(() => normalizeUexEndpoint('marketplace_prices_averages?item_name=Iron\nX'), /inválido ou não permitido/);
  assert.throws(() => normalizeUexEndpoint('javascript:alert(1)'), /inválido ou não permitido/);
});
