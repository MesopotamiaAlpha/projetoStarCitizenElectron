const INVENTORY_PREFERENCES_KEY = 'sc_inventory_preferences_v1';
export const INVENTORY_PREFERENCES_UPDATED_EVENT = 'sc_inventory_preferences_updated_v1';

function readPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INVENTORY_PREFERENCES_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePreferences(preferences) {
  try {
    localStorage.setItem(INVENTORY_PREFERENCES_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent(INVENTORY_PREFERENCES_UPDATED_EVENT, { detail: preferences }));
  } catch {
    // O formulário continua funcionando mesmo em ambientes sem localStorage.
  }
}

export function loadInventoryPreferences() {
  const preferences = readPreferences();
  const destination = preferences.defaultDestination;
  if (!destination || typeof destination !== 'object') return { defaultDestination: null };
  const system = String(destination.system || '').trim();
  const location_type = String(destination.location_type || '').trim();
  const location_name = String(destination.location_name || '').trim();
  if (!system || !location_type || !location_name) return { defaultDestination: null };
  return { defaultDestination: { system, location_type, location_name } };
}

export function saveInventoryDefaultDestination(destination) {
  const normalized = destination && typeof destination === 'object'
    ? {
        system: String(destination.system || '').trim(),
        location_type: String(destination.location_type || '').trim(),
        location_name: String(destination.location_name || '').trim(),
      }
    : null;
  const valid = normalized?.system && normalized?.location_type && normalized?.location_name ? normalized : null;
  writePreferences({ ...readPreferences(), defaultDestination: valid });
  return valid;
}

export function clearInventoryDefaultDestination() {
  saveInventoryDefaultDestination(null);
}

export { INVENTORY_PREFERENCES_KEY };

export default {
  loadInventoryPreferences,
  saveInventoryDefaultDestination,
  clearInventoryDefaultDestination,
};

export {};

// Compatibilidade com o padrão de módulos de dados do projeto.
