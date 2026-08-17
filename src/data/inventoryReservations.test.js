import { getAvailableQuantity, getReservedQuantity, normalizeReservations } from '../pages/InventoryPage';

describe('Reservas do inventário', () => {
  test('normaliza reservas antigas e calcula saldo livre', () => {
    const item = { quantity: 10, reservations: JSON.stringify([{ owner: 'Ana', amount: 4 }]) };
    expect(normalizeReservations(item.reservations)).toEqual(expect.arrayContaining([
      expect.objectContaining({ person: 'Ana', quantity: 4 }),
    ]));
    expect(getReservedQuantity(item)).toBe(4);
    expect(getAvailableQuantity(item)).toBe(6);
  });

  test('soma reservas de pessoas diferentes sem ultrapassar a quantidade total', () => {
    const item = { quantity: 10, reservations: [
      { id: 'a', person: 'Ana', quantity: 3 },
      { id: 'b', person: 'Bruno', quantity: 2 },
    ] };
    expect(getReservedQuantity(item)).toBe(5);
    expect(getAvailableQuantity(item)).toBe(5);
  });

  test('limita reserva inconsistente ao total disponível', () => {
    const item = { quantity: 10, reservations: [
      { person: 'Ana', quantity: 8 },
      { person: 'Bruno', quantity: 8 },
    ] };
    expect(getReservedQuantity(item)).toBe(10);
    expect(getAvailableQuantity(item)).toBe(0);
  });

  test('registros antigos sem reservas continuam totalmente livres', () => {
    expect(normalizeReservations(undefined)).toEqual([]);
    expect(getReservedQuantity({ quantity: 10 })).toBe(0);
    expect(getAvailableQuantity({ quantity: 10 })).toBe(10);
  });
});
