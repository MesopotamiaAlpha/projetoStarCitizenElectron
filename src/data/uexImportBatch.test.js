export function buildBulkImportEntries(queue = [], catalog = [], importedAt = new Date().toISOString()) {
  const existingIds = new Set((Array.isArray(catalog) ? catalog : []).map(item => String(item?.id ?? '')));
  const seenIds = new Set();
  return (Array.isArray(queue) ? queue : [])
    .filter(listing => {
      const id = String(listing?.id ?? '');
      if (!listing || !id || existingIds.has(id) || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    })
    .map(listing => ({
      ...listing,
      id: listing.id,
      internal_stock: listing.in_stock || 0,
      notes: listing.notes || '',
      imported_at: importedAt,
    }));
}

export function mergeBulkImportCatalog(catalog = [], queue = [], importedAt) {
  const current = Array.isArray(catalog) ? catalog : [];
  const entries = buildBulkImportEntries(queue, current, importedAt);
  return { entries, catalog: [...current, ...entries] };
}
