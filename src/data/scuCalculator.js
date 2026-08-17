import { fromCargoBase, formatCargoNumber, roundCargo, toCargoBase } from './cargoUnits';

export const SCU_CALCULATOR_UNITS = ['SCU', 'cSCU', 'mSCU', 'μSCU', 'Units'];

export function scuToBase(value, unit) {
  const amount = Number(value) || 0;
  if (unit === 'Units' || unit === 'cSCU') return roundCargo(amount);
  return toCargoBase(amount, unit);
}

export function scuFromBase(value, unit) {
  const amount = Number(value) || 0;
  if (unit === 'Units' || unit === 'cSCU') return roundCargo(amount);
  return fromCargoBase(amount, unit);
}

export function buildScuSummary(baseValue) {
  const base = roundCargo(baseValue);
  const scu = scuFromBase(base, 'SCU');
  const cscu = scuFromBase(base, 'cSCU');
  const mscu = scuFromBase(base, 'mSCU');
  const microScu = scuFromBase(base, 'μSCU');
  return {
    base,
    scu,
    cscu,
    units: cscu,
    mscu,
    microScu,
    text: `${formatCargoNumber(scu, 9)} SCU = ${formatCargoNumber(cscu, 9)} cSCU = ${formatCargoNumber(cscu, 9)} Units = ${formatCargoNumber(mscu, 9)} mSCU = ${formatCargoNumber(microScu, 9)} μSCU`,
  };
}

export function calculateScuValue(numericResult, inputUnit, outputUnit) {
  const base = scuToBase(numericResult, inputUnit);
  const output = scuFromBase(base, outputUnit);
  return {
    input: roundCargo(numericResult),
    inputUnit,
    output: roundCargo(output),
    outputUnit,
    summary: buildScuSummary(base),
  };
}
