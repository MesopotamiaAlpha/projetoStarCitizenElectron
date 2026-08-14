// ─────────────────────────────────────────────────────────────────────────────
// Cartões DCHS — conjuntos para Hangares Executivos
// ─────────────────────────────────────────────────────────────────────────────

export const DCHS_CARD_DEFINITIONS = [
  { code: 'DCHS-01', name: 'DCHS-01 Executive Access Protocols Comp-Board', shortName: 'Executive Access Protocols' },
  { code: 'DCHS-02', name: 'DCHS-02 Security Encryption Comp-Board', shortName: 'Security Encryption' },
  { code: 'DCHS-03', name: 'DCHS-03 Vehicle Management Comp-Board', shortName: 'Vehicle Management' },
  { code: 'DCHS-04', name: 'DCHS-04 Power Processing Comp-Board', shortName: 'Power Processing' },
  { code: 'DCHS-05', name: 'DCHS-05 Orbital Positioning Comp-Board', shortName: 'Orbital Positioning' },
  { code: 'DCHS-06', name: 'DCHS-06 Communication Comp-Board', shortName: 'Communication' },
  { code: 'DCHS-07', name: 'DCHS-07 Engineering Maintenance Comp-Board', shortName: 'Engineering Maintenance' },
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function quantityOf(item) {
  return Math.max(0, Number(item?.quantity) || 0);
}

export function getDchsCardDefinition(itemName) {
  const normalizedName = normalizeText(itemName);
  if (!normalizedName) return null;

  return DCHS_CARD_DEFINITIONS.find(card => {
    const normalizedFullName = normalizeText(card.name);
    const normalizedCode = normalizeText(card.code);
    return normalizedName === normalizedFullName
      || normalizedName.startsWith(`${normalizedCode} `)
      || normalizedName.includes(normalizedCode);
  }) || null;
}

export function calcDchsExecutiveHangars(inventoryItems = []) {
  const cards = DCHS_CARD_DEFINITIONS.map(card => {
    const matchingItems = inventoryItems.filter(item => getDchsCardDefinition(item?.name)?.code === card.code);
    const quantity = matchingItems.reduce((sum, item) => sum + quantityOf(item), 0);
    return {
      ...card,
      quantity,
      setsSupported: quantity,
      records: matchingItems.length,
    };
  });

  const quantities = cards.map(card => card.quantity);
  const completeSets = quantities.length > 0 ? Math.min(...quantities) : 0;
  const missingCards = cards.filter(card => card.quantity < completeSets + 1);
  const hasAnyCard = cards.some(card => card.quantity > 0);

  return {
    cards,
    completeSets,
    executiveHangars: completeSets,
    hasAnyCard,
    missingCards,
    totalCards: quantities.reduce((sum, quantity) => sum + quantity, 0),
  };
}
