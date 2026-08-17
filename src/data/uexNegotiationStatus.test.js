import {
  getNegotiationClosedAt,
  getNegotiationClosureField,
  isNegotiationClosed,
} from './uexNegotiationStatus';

describe('status de fechamento de negociações UEX', () => {
  test('reconhece o fechamento tradicional do vendedor', () => {
    const negotiation = { date_closed: 1720000000 };

    expect(isNegotiationClosed(negotiation)).toBe(true);
    expect(getNegotiationClosedAt(negotiation)).toBe(1720000000);
    expect(getNegotiationClosureField(negotiation)).toBe('date_closed');
  });

  test('reconhece o fechamento registrado pelo lado comprador', () => {
    const negotiation = { date_closed: null, date_closed_client: 1720000123 };

    expect(isNegotiationClosed(negotiation)).toBe(true);
    expect(getNegotiationClosedAt(negotiation)).toBe(1720000123);
    expect(getNegotiationClosureField(negotiation)).toBe('date_closed_client');
  });

  test('usa a data mais recente quando os dois lados informam fechamento', () => {
    const negotiation = { date_closed: 1720000000, date_closed_client: 1720000200 };

    expect(getNegotiationClosedAt(negotiation)).toBe(1720000200);
  });

  test('normaliza milissegundos e datas ISO de registros locais', () => {
    expect(getNegotiationClosedAt({ dateClosedClient: 1720000300000 })).toBe(1720000300);
    expect(getNegotiationClosedAt({ closed_at: '2026-08-16T12:00:00.000Z' })).toBe(1786881600);
  });

  test('reconhece negociação encerrada por status textual', () => {
    const negotiation = { hash: 'closed-status', status: 'completed' };

    expect(isNegotiationClosed(negotiation)).toBe(true);
    expect(getNegotiationClosureField(negotiation)).toBe('status');
  });

  test('reconhece negociação encerrada por indicador booleano', () => {
    const negotiation = { hash: 'closed-flag', is_closed: true };

    expect(isNegotiationClosed(negotiation)).toBe(true);
    expect(getNegotiationClosureField(negotiation)).toBe('is_closed');
  });

  test('reconhece deal_value como valor final de fechamento', () => {
    const negotiation = { hash: 'closed-value', price: 100000, deal_value: 95000 };

    expect(isNegotiationClosed(negotiation)).toBe(true);
    expect(getNegotiationClosureField(negotiation)).toBe('deal_value');
  });

  test('mantém negociação ativa sem qualquer campo de fechamento', () => {
    expect(isNegotiationClosed({ hash: 'active-1', date_modified: 1720000000 })).toBe(false);
    expect(getNegotiationClosedAt({ hash: 'active-1' })).toBeNull();
    expect(getNegotiationClosureField({ hash: 'active-1' })).toBeNull();
  });
});

export {};
