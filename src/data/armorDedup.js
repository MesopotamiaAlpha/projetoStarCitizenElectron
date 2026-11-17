function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeArmorIdentity(value, variant = 'Base') {
  return `${normalizeText(value)}||${normalizeText(variant || 'Base')}`;
}

export function getArmorIdentity(set) {
  const rawBase = String(set?.base_name || set?.set_name || set?.name || '').trim();
  const rawVariant = String(set?.variant_name || 'Base').trim();
  // Algumas importações chegam como `Novikov "Ascension"` + variante Base,
  // enquanto outros registros chegam como `Novikov` + variante `Ascension`.
  // Canonicalizar os dois formatos evita duplicatas sem alterar o texto exibido.
  const embeddedVariant = rawVariant.toLocaleLowerCase() === 'base'
    ? rawBase.match(/^(.+?)\s+["“]([^"”]+)["”]\s*$/)
    : null;
  const base = embeddedVariant ? embeddedVariant[1].trim() : rawBase;
  const variant = embeddedVariant ? embeddedVariant[2].trim() : rawVariant;
  return normalizeArmorIdentity(base, variant);
}

export function getDuplicateArmorGroups(sets = []) {
  const groups = new Map();
  (Array.isArray(sets) ? sets : []).forEach(set => {
    const key = getArmorIdentity(set);
    if (!key || key.startsWith('||')) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(set);
  });
  return [...groups.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([key, entries]) => ({ key, label: `${entries[0].base_name || entries[0].set_name} · ${entries[0].variant_name || 'Base'}`, entries }));
}
