import { normalizeUrl } from '../pages/UsefulLinksPage';

describe('Links Úteis', () => {
  test('adiciona protocolo HTTPS quando o usuário informa apenas o domínio', () => {
    expect(normalizeUrl('uexcorp.space/account')).toBe('https://uexcorp.space/account');
    expect(normalizeUrl('https://scmdb.net/?page=fab')).toBe('https://scmdb.net/?page=fab');
  });

  test('mantém URL HTTP explícita', () => {
    expect(normalizeUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  test('não cria URL para valor vazio', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl('   ')).toBe('');
  });
});
