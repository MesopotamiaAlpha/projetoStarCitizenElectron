// Shared localStorage-backed override store for static reference data.
// Each "dataset" has a key, a default array (from the page's own constants),
// and consumers call useDataset(key, DEFAULT) to get { data, save, reset, isCustom }.

import { useState, useCallback } from 'react';

const PREFIX = 'sc_data_override_';

export const DATASETS = {
  TRADE_COMMODITIES: { key:'trade_commodities', label:'Commodities (Trade Hub)' },
  MINING_ORES:       { key:'mining_ores',       label:'Minérios (Mineração)' },
  MINING_LASERS:     { key:'mining_lasers',      label:'Lasers de Mineração' },
  MINING_SHIPS:      { key:'mining_ships',       label:'Naves de Mineração' },
  MINING_MODULES:    { key:'mining_modules',     label:'Módulos de Mineração' },
  MINING_LOCATIONS:  { key:'mining_locations',   label:'Locais de Mineração' },
  DPS_SHIPS:         { key:'dps_ships',          label:'Naves (DPS Calculator)' },
  DPS_WEAPONS:       { key:'dps_weapons',        label:'Armas (DPS Calculator)' },
  CARGO_SHIPS:       { key:'cargo_ships',        label:'Naves (Cargo Loader)' },
  CARGO_GOODS:       { key:'cargo_goods',        label:'Mercadorias (Cargo Loader)' },
  CARGO_PACKING:     { key:'cargo_packing',      label:'Métodos de Empacotamento' },
  MARKET_LOCATIONS:  { key:'market_locations',   label:'Locais de Mercado (Market Finder)' },
};

export function loadDataset(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return fallback;
}

export function saveDataset(key, data) {
  localStorage.setItem(PREFIX + key, JSON.stringify(data));
}

export function resetDateset(key) {
  localStorage.removeItem(PREFIX + key);
}

export function isOverridden(key) {
  return localStorage.getItem(PREFIX + key) !== null;
}

// Hook for consuming pages
export function useDataset(key, fallback) {
  const [data, setDate] = useState(() => loadDataset(key, fallback));

  const save = useCallback((newData) => {
    saveDataset(key, newData);
    setDate(newData);
  }, [key]);

  const reset = useCallback(() => {
    resetDateset(key);
    setDate(fallback);
  }, [key, fallback]);

  return { data, save, reset, isCustom: isOverridden(key) };
}
