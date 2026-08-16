// Conversões de carga do Star Citizen.
// A unidade-base interna é cSCU para manter compatibilidade com o Tracking
// existente, que já persistia coletas SCU/cSCU nessa unidade.

export const CARGO_UNITS = ['SCU', 'cSCU', 'mSCU', 'μSCU'];

const UNIT_ALIASES = {
  scu: 'SCU',
  cscu: 'cSCU',
  mscu: 'mSCU',
  μscu: 'μSCU',
  µscu: 'μSCU',
  uscu: 'μSCU',
  'micro scu': 'μSCU',
  'micro-scu': 'μSCU',
};

// Fator para cSCU: 1 SCU = 100 cSCU = 1.000 mSCU = 1.000.000 μSCU.
const TO_CSCU = {
  SCU: 100,
  cSCU: 1,
  mSCU: 0.1,
  μSCU: 0.0001,
};

export function normalizeCargoUnit(unit) {
  const raw = String(unit || '').trim();
  return UNIT_ALIASES[raw.toLowerCase()] || raw;
}

export function isCargoUnit(unit) {
  return Object.prototype.hasOwnProperty.call(TO_CSCU, normalizeCargoUnit(unit));
}

export function areCargoUnitsCompatible(first, second) {
  const a = normalizeCargoUnit(first);
  const b = normalizeCargoUnit(second);
  return isCargoUnit(a) && isCargoUnit(b);
}

function cleanNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Arredondamento controlado: evita resíduos binários como 12.910999999999998
// sem limitar a precisão necessária para μSCU.
export function roundCargo(value, decimals = 9) {
  const n = cleanNumber(value);
  const factor = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

export function toCargoBase(amount, unit) {
  const normalized = normalizeCargoUnit(unit);
  const factor = TO_CSCU[normalized];
  if (factor === undefined) return cleanNumber(amount);
  return roundCargo(cleanNumber(amount) * factor);
}

export function fromCargoBase(amount, unit) {
  const normalized = normalizeCargoUnit(unit);
  const factor = TO_CSCU[normalized];
  if (factor === undefined || factor === 0) return cleanNumber(amount);
  return roundCargo(cleanNumber(amount) / factor);
}

export function cargoToScu(amount, unit) {
  return fromCargoBase(toCargoBase(amount, unit), 'SCU');
}

export function cargoToCscu(amount, unit) {
  return toCargoBase(amount, unit);
}

export function parseCargoInput(value, unit = '') {
  const raw = String(value ?? '').trim().replace(/\s+/g, '');
  if (!raw) return 0;

  // Quando os dois separadores aparecem, o último é tratado como decimal.
  if (raw.includes(',') && raw.includes('.')) {
    const decimalSeparator = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    const normalized = raw.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
    return Number(normalized) || 0;
  }

  // No padrão brasileiro, 12.911 cSCU costuma representar 12.911 unidades,
  // isto é, doze mil novecentos e onze cSCU. Mantemos 0.001 como fração.
  if (raw.includes('.') && isCargoUnit(unit)) {
    const parts = raw.split('.');
    const looksLikeThousands = parts.length > 1
      && parts[0] !== '0'
      && parts.slice(1).every(part => part.length === 3);
    if (looksLikeThousands) return Number(parts.join('')) || 0;
  }

  return Number(raw.replace(',', '.')) || 0;
}

export function normalizeCargoQuantity(value, unit) {
  const normalized = normalizeCargoUnit(unit);
  if (isCargoUnit(normalized)) return roundCargo(parseCargoInput(value, normalized));
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function cargoInputStep(unit) {
  const normalized = normalizeCargoUnit(unit);
  if (normalized === 'SCU') return '0.000001';
  if (normalized === 'cSCU') return '0.0001';
  if (normalized === 'mSCU') return '0.001';
  if (normalized === 'μSCU') return '1';
  return '1';
}

export function formatCargoNumber(value, maximumFractionDigits = 6) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export function cargoEquivalentTotal(entries = [], preferredUnit = '') {
  if (!entries.length) return { total: 0, unit: normalizeCargoUnit(preferredUnit) || 'un' };
  const units = entries.map(entry => normalizeCargoUnit(entry.unit || 'un'));
  const allCargo = units.every(isCargoUnit);
  const unit = normalizeCargoUnit(preferredUnit || units[0]);
  if (!allCargo) {
    return {
      total: entries.reduce((sum, entry) => sum + cleanNumber(entry.quantity), 0),
      unit,
    };
  }
  const base = entries.reduce((sum, entry) => sum + toCargoBase(entry.quantity, entry.unit), 0);
  return { total: fromCargoBase(base, unit), unit };
}

/**
 * Analisa uma quantidade digitada no Baú sem bloquear o usuário.
 * A intenção é detectar o erro comum de informar uma fração de SCU em SCU
 * ou uma quantidade grande de cSCU/mSCU que provavelmente foi pensada em SCU.
 */
export function analyzeCargoQuantityInput(value, unit) {
  const normalizedUnit = normalizeCargoUnit(unit);
  if (!isCargoUnit(normalizedUnit)) return { applicable: false };
  const parsed = parseCargoInput(value, normalizedUnit);
  if (!Number.isFinite(parsed) || parsed <= 0) return { applicable: true, valid: false };

  const scu = cargoToScu(parsed, normalizedUnit);
  const cscu = cargoToCscu(parsed, normalizedUnit);
  const units = cscu;
  const result = {
    applicable: true,
    valid: true,
    unit: normalizedUnit,
    input: roundCargo(parsed),
    scu: roundCargo(scu),
    cscu: roundCargo(cscu),
    units: roundCargo(units),
    formula: `${formatCargoNumber(parsed, 9)} ${normalizedUnit} = ${formatCargoNumber(cscu, 9)} cSCU = ${formatCargoNumber(scu, 9)} SCU = ${formatCargoNumber(units, 9)} Units`,
    severity: 'info',
    warning: '',
    suggestedUnit: '',
    suggestedValue: '',
  };

  if (normalizedUnit === 'SCU' && !Number.isInteger(parsed)) {
    result.severity = 'warning';
    result.warning = `A quantidade é menor que 1 SCU e parece mais clara em cSCU. ${formatCargoNumber(parsed, 9)} SCU correspondem a ${formatCargoNumber(cscu, 9)} cSCU.`;
    result.suggestedUnit = 'cSCU';
    result.suggestedValue = String(roundCargo(cscu));
  } else if (normalizedUnit === 'cSCU' && parsed >= 100) {
    result.severity = 'warning';
    result.warning = `${formatCargoNumber(parsed, 9)} cSCU equivalem a ${formatCargoNumber(scu, 9)} SCU. Confira se você não pretendia informar a quantidade diretamente em SCU.`;
    result.suggestedUnit = 'SCU';
    result.suggestedValue = String(roundCargo(scu));
  } else if (normalizedUnit === 'mSCU' && parsed >= 1000) {
    result.severity = 'warning';
    result.warning = `${formatCargoNumber(parsed, 9)} mSCU equivalem a ${formatCargoNumber(scu, 9)} SCU. Confira a unidade escolhida.`;
    result.suggestedUnit = 'SCU';
    result.suggestedValue = String(roundCargo(scu));
  } else if (normalizedUnit === 'μSCU' && parsed >= 1000000) {
    result.severity = 'warning';
    result.warning = `${formatCargoNumber(parsed, 9)} μSCU equivalem a ${formatCargoNumber(scu, 9)} SCU. Confira a unidade escolhida.`;
    result.suggestedUnit = 'SCU';
    result.suggestedValue = String(roundCargo(scu));
  }

  return result;
}
