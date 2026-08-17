import {
  getNegotiationMessageSender,
  isOwnNegotiationMessage,
  normalizeUexUsername,
} from './uexNegotiations';

describe('identificação de autor nas mensagens UEX', () => {
  test('normaliza arroba, maiúsculas e espaços do username', () => {
    expect(normalizeUexUsername(' @My Pilot ')).toBe('mypilot');
  });

  test('reconhece mensagem própria pelo username configurado', () => {
    expect(isOwnNegotiationMessage({ user_username: '@MyPilot' }, ' mypilot ')).toBe(true);
    expect(isOwnNegotiationMessage({ user_username: 'Buyer' }, 'MyPilot')).toBe(false);
  });

  test('usa campos alternativos para localizar o remetente', () => {
    expect(getNegotiationMessageSender({ username: 'PilotOne' })).toBe('PilotOne');
    expect(getNegotiationMessageSender({ user_name: 'Pilot Two' })).toBe('Pilot Two');
  });

  test('usa o participante correto quando o username local não está configurado', () => {
    const sellerNegotiation = { is_listing_advertiser: 1, advertiser_username: 'SellerMe', client_username: 'Buyer' };
    const buyerNegotiation = { is_listing_advertiser: 0, advertiser_username: 'Seller', client_username: 'BuyerMe' };

    expect(isOwnNegotiationMessage({ user_username: 'SellerMe' }, '', sellerNegotiation)).toBe(true);
    expect(isOwnNegotiationMessage({ user_username: 'Buyer' }, '', sellerNegotiation)).toBe(false);
    expect(isOwnNegotiationMessage({ user_username: 'BuyerMe' }, '', buyerNegotiation)).toBe(true);
    expect(isOwnNegotiationMessage({ user_username: 'Seller' }, '', buyerNegotiation)).toBe(false);
  });
});

export {};
