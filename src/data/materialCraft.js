// Craft de um item da Fila (parcial ou final) consumindo minério do Baú.
//
// Modelo: cada item da fila pode ter `applied`, um mapa { chaveDoMaterial → quantidade
// em cSCU/unidade-base } com o que JÁ foi tirado do Baú para ele em crafts parciais.
// O Tracking (calcShoppingList) desconta essa quantidade da necessidade, então tirar
// minério do Baú não faz o material "voltar a faltar".
//
//   • parcial  → tira do Baú o que está disponível agora, registra em `applied`
//                e mantém o item na fila para continuar depois.
//   • concluir → tira do Baú o que está disponível, remove o item da fila e
//                cancela o restante que faltava.
import {
  loadQueue, saveQueue, materialKey, getIngredientQualityMin, getIngredientQualityOperator, toBase, fromBase,
} from './materialQueue';
import { loadVault, deductOreEntries, qualityMeetsRequirement } from './oreVault';
import { normalizeCargoUnit, isCargoUnit, roundCargo } from './cargoUnits';

const EPS = 1e-9;
const MAX_CRAFT_LOG = 20;

function stockName(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Necessidade total, já aplicada e restante de cada material de um item da fila.
export function getBlueprintRequirements(bp) {
  const map = new Map();
  for (const ing of bp?.ingredients || []) {
    const qualityMin = getIngredientQualityMin(ing);
    const qualityOperator = getIngredientQualityOperator(ing);
    const key = materialKey(ing.material_name, qualityMin, qualityOperator);
    if (!map.has(key)) {
      map.set(key, {
        key,
        material_name: ing.material_name,
        quality_min: qualityMin,
        quality_operator: qualityOperator,
        unit: normalizeCargoUnit(ing.unit || 'un') || 'un',
        total_base: 0,
      });
    }
    const req = map.get(key);
    if (!isCargoUnit(req.unit) && isCargoUnit(ing.unit)) req.unit = normalizeCargoUnit(ing.unit);
    req.total_base += toBase((Number(ing.quantity) || 0) * (Number(bp.quantity) || 1), ing.unit || 'un');
  }

  const applied = bp?.applied && typeof bp.applied === 'object' ? bp.applied : {};
  return [...map.values()].map(req => {
    const totalBase = roundCargo(req.total_base);
    const appliedBase = Math.min(totalBase, Math.max(0, Number(applied[req.key]) || 0));
    const remainingBase = roundCargo(Math.max(0, totalBase - appliedBase));
    return {
      ...req,
      total_base: totalBase,
      applied_base: appliedBase,
      remaining_base: remainingBase,
      total: fromBase(totalBase, req.unit),
      applied: fromBase(appliedBase, req.unit),
      remaining: fromBase(remainingBase, req.unit),
    };
  });
}

function entryMatchesRequirement(entry, req) {
  if (!String(entry?.id ?? '').trim()) return false;
  if (stockName(entry.ore_name) !== stockName(req.material_name)) return false;
  if (!((Number(entry.quantity) || 0) > 0)) return false;
  if (!qualityMeetsRequirement(entry.quality, req.quality_min, req.quality_operator)) return false;
  const entryUnit = normalizeCargoUnit(entry.unit || 'un');
  return isCargoUnit(req.unit) && isCargoUnit(entryUnit) ? true : entryUnit === req.unit;
}

/**
 * Calcula, sem alterar nada, o que seria tirado do Baú para este item.
 * `amounts` (opcional) limita quanto usar de cada material: { [chave]: quantidade na unidade do material }.
 * Sem `amounts`, usa o máximo disponível (até o que falta).
 */
export function planBlueprintCraft(bp, vaultEntries = [], { amounts = {} } = {}) {
  const requirements = getBlueprintRequirements(bp);
  const entries = Array.isArray(vaultEntries) ? vaultEntries : [];
  const reserved = new Map();
  const usages = [];
  const byKey = new Map();

  const availableOf = entry => Math.max(
    0,
    toBase(Number(entry.quantity) || 0, entry.unit) - (reserved.get(String(entry.id)) || 0),
  );

  // Exigências de qualidade mais altas reservam estoque primeiro, para que um
  // minério Q≥800 não seja gasto antes de atender uma exigência mais específica.
  const order = [...requirements].sort((a, b) =>
    b.quality_min - a.quality_min || String(a.quality_operator).localeCompare(String(b.quality_operator)));

  for (const req of order) {
    const matches = entries.filter(entry => entryMatchesRequirement(entry, req));
    const availableBase = roundCargo(matches.reduce((sum, entry) => sum + availableOf(entry), 0));
    const asked = amounts && amounts[req.key] !== undefined && amounts[req.key] !== null
      ? toBase(Number(amounts[req.key]) || 0, req.unit)
      : req.remaining_base;
    const useBase = roundCargo(Math.max(0, Math.min(asked, req.remaining_base, availableBase)));

    let left = useBase;
    for (const entry of matches) {
      if (left <= EPS) break;
      const take = Math.min(availableOf(entry), left);
      if (take <= EPS) continue;
      const id = String(entry.id);
      reserved.set(id, (reserved.get(id) || 0) + take);
      usages.push({ id, amount: fromBase(roundCargo(take), entry.unit) });
      left -= take;
    }

    byKey.set(req.key, {
      ...req,
      available_base: availableBase,
      use_base: useBase,
      missing_after_base: roundCargo(Math.max(0, req.remaining_base - useBase)),
    });
  }

  const lines = requirements.map(req => {
    const line = byKey.get(req.key);
    return {
      ...line,
      available: fromBase(line.available_base, line.unit),
      use: fromBase(line.use_base, line.unit),
      missing_after: fromBase(line.missing_after_base, line.unit),
    };
  });

  return {
    lines,
    usages,
    // true quando, com o que está no Baú agora, nada ficaria faltando.
    complete: lines.every(line => line.missing_after_base <= EPS),
    hasUsage: usages.length > 0,
    hasApplied: lines.some(line => line.applied_base > EPS),
  };
}

function describeLine(line, amount) {
  return {
    material_name: line.material_name,
    quality_min: line.quality_min,
    quality_operator: line.quality_operator,
    unit: line.unit,
    amount,
  };
}

/**
 * Aplica o craft de um item da fila.
 *  mode 'partial' → tira do Baú o disponível e mantém o item na fila (progresso salvo).
 *  mode 'finish'  → tira do Baú o disponível, remove o item e cancela o que faltava.
 * Lança Error (sem alterar nada) quando não há o que fazer.
 */
export function applyBlueprintCraft(bpId, { mode = 'partial', amounts } = {}) {
  const queue = loadQueue();
  const index = queue.queuedBlueprints.findIndex(item => String(item.bpId) === String(bpId));
  if (index < 0) throw new Error('Este item não está mais na fila de craft.');

  const bp = queue.queuedBlueprints[index];
  const plan = planBlueprintCraft(bp, loadVault().entries, { amounts });
  const finishing = mode === 'finish';

  if (!finishing && !plan.hasUsage) {
    throw new Error('Não há minério elegível no Baú para aplicar neste item.');
  }
  if (finishing && !plan.hasUsage && !plan.hasApplied) {
    throw new Error('Não há minério aplicado nem disponível no Baú. Para descartar o item, remova-o da fila.');
  }

  const used = plan.lines.filter(line => line.use_base > EPS).map(line => describeLine(line, line.use));
  const discarded = finishing
    ? plan.lines.filter(line => line.missing_after_base > EPS).map(line => describeLine(line, line.missing_after))
    : [];

  const snapshot = JSON.parse(JSON.stringify(queue));
  if (finishing) {
    queue.queuedBlueprints = queue.queuedBlueprints.filter((_, i) => i !== index);
  } else {
    const applied = { ...(bp.applied && typeof bp.applied === 'object' ? bp.applied : {}) };
    for (const line of plan.lines) {
      if (line.use_base > EPS) applied[line.key] = roundCargo((Number(applied[line.key]) || 0) + line.use_base);
    }
    const at = new Date().toISOString();
    queue.queuedBlueprints[index] = {
      ...bp,
      applied,
      craftLog: [...(Array.isArray(bp.craftLog) ? bp.craftLog : []), { at, used }].slice(-MAX_CRAFT_LOG),
    };
  }

  // A fila é gravada primeiro: se falhar, nada mudou. Se o Baú falhar depois,
  // a fila volta ao estado anterior.
  if (!saveQueue(queue)) throw new Error('Não foi possível salvar a fila de craft (armazenamento indisponível).');
  try {
    if (plan.usages.length) deductOreEntries(plan.usages);
  } catch (error) {
    saveQueue(snapshot);
    throw error;
  }

  return { mode, plan, used, discarded, bpName: bp.bpName, stillInQueue: !finishing };
}
