export function filterInventoryItems(items, {
  system = null,
  location = null,
  search = '',
  category = 'all',
  sortBy = 'name',
} = {}) {
  let result = Array.isArray(items) ? [...items] : [];
  if (system) result = result.filter(item => item?.system === system);
  if (location && location !== '__all_in_system') result = result.filter(item => item?.location_name === location);

  const query = String(search || '').trim().toLocaleLowerCase();
  if (query) {
    result = result.filter(item => [
      item?.name,
      item?.category,
      item?.location_name,
      item?.manufacturer,
      item?.notes,
    ].some(value => String(value || '').toLocaleLowerCase().includes(query)));
  }

  if (category !== 'all') result = result.filter(item => item?.category === category);

  result.sort((a, b) => {
    switch (sortBy) {
      case 'value': return (Number(b?.value_auec) || 0) * (Number(b?.quantity) || 0) - (Number(a?.value_auec) || 0) * (Number(a?.quantity) || 0);
      case 'qty': return (Number(b?.quantity) || 0) - (Number(a?.quantity) || 0);
      case 'category': return String(a?.category || '').localeCompare(String(b?.category || ''));
      default: return String(a?.name || '').localeCompare(String(b?.name || ''));
    }
  });

  return result;
}
