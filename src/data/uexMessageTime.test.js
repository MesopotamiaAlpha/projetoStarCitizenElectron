import { formatRelativeMessageTime } from './uexMessageTime';

describe('tempo relativo das mensagens UEX', () => {
  const now = Date.parse('2026-08-16T12:00:00.000Z');

  test('mostra agora para mensagens recentes', () => {
    expect(formatRelativeMessageTime(now - 20 * 1000, now)).toBe('agora');
  });

  test('mostra minutos e horas', () => {
    expect(formatRelativeMessageTime(now - 5 * 60 * 1000, now)).toBe('há 5 minutos');
    expect(formatRelativeMessageTime(now - 60 * 60 * 1000, now)).toBe('há 1 hora');
    expect(formatRelativeMessageTime(now - 3 * 60 * 60 * 1000, now)).toBe('há 3 horas');
  });

  test('mostra dias, semanas, meses e anos', () => {
    expect(formatRelativeMessageTime(now - 2 * 24 * 60 * 60 * 1000, now)).toBe('há 2 dias');
    expect(formatRelativeMessageTime(now - 14 * 24 * 60 * 60 * 1000, now)).toBe('há 2 semanas');
    expect(formatRelativeMessageTime(now - 60 * 24 * 60 * 60 * 1000, now)).toBe('há 2 meses');
    expect(formatRelativeMessageTime(now - 365 * 24 * 60 * 60 * 1000, now)).toBe('há 1 ano');
  });

  test('aceita timestamp Unix em segundos e data ISO', () => {
    expect(formatRelativeMessageTime((now - 10 * 60 * 1000) / 1000, now)).toBe('há 10 minutos');
    expect(formatRelativeMessageTime('2026-08-16T11:55:00.000Z', now)).toBe('há 5 minutos');
  });

  test('trata horário ausente sem inventar uma data', () => {
    expect(formatRelativeMessageTime(null, now)).toBe('horário não informado');
  });
});

export {};
