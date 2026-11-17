'use strict';

const MAX_UEX_ENDPOINT_LENGTH = 320;

function normalizeUexEndpoint(endpoint) {
  const value = String(endpoint || '').trim().replace(/^\/+/, '');
  if (!value) throw new Error('Endpoint UEX não informado.');
  if (value.length > MAX_UEX_ENDPOINT_LENGTH) throw new Error('Endpoint UEX excede o limite permitido.');
  if (/^https?:\/\//i.test(value)) throw new Error('Endpoint UEX inválido ou não permitido.');

  const [pathPart, ...queryParts] = value.split('?');
  const queryPart = queryParts.join('?');
  const pathSegments = pathPart.split('/');
  const validPath = pathSegments.length > 0
    && pathSegments.every(segment => /^[A-Za-z0-9_-]+$/.test(segment))
    && !pathSegments.some(segment => segment === '.' || segment === '..');
  const validQuery = !queryPart || /^[A-Za-z0-9_.%:+!~*'(),&=/-]+$/.test(queryPart);

  if (!validPath || !validQuery) {
    throw new Error('Endpoint UEX inválido ou não permitido.');
  }
  return value;
}

module.exports = {
  MAX_UEX_ENDPOINT_LENGTH,
  normalizeUexEndpoint,
};
