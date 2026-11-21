// Craft de um item da Fila (parcial ou final) consumindo estoque do Baú de Minério e do
// Inventário de Itens.
//
// Modelo: cada item da fila pode ter `applied`, um mapa { chaveDoMaterial → quantidade
// em cSCU/unidade-base } com o que JÁ foi retirado do estoque para ele em crafts parciais.
// O Tracking (calcShoppingList) desconta essa quantidade da necessidade, então tirar
// material do estoque não faz o material "voltar a faltar".
//
//   • parcial  → tira o disponível agora, registra em `applied` e mantém o item na fila.
//   • concluir → tira o disponível, remove o item da fila e cancela o restante que faltava.
//
// Origem do material: o Baú é usado primeiro; o que faltar vem do Inventário de Itens
// (só materiais sem exigência de qualidade — o inventário não registra qualidade).
import {
  loadQueue, saveQueue, materialKey, getIngredientQualityMin, getIngredientQualityOperator, toBase, fromBase,
} from './materialQueue';
import { loadVault, deductOreEntries, qualityMeetsRequirement } from './oreVault';
import { normalizeCargoUnit, isCargoUnit, roundCargo } from './cargoUnits';
import {
  normalizeInventoryStockItems, inventoryStockEntries, buildInventoryUpdatePayload, getInventoryApi, loadInventoryStock,
} from './inventoryStock';
import { publishInventoryUpdate } from './inventoryEvents';

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

function vaultEntryMatches(entry, req) {
  if (!String(entry?.id ?? '').trim()) return false;
  if (stockName(entry.ore_name) !== stockName(req.material_name)) return false;
  if (!((Number(entry.quantity) || 0) > 0)) return false;
  if (!qualityMeetsRequirement(entry.quality, req.quality_min, req.quality_operator)) return false;
  const entryUnit = normalizeCargoUnit(entry.unit || 'un');
  return isCargoUnit(req.unit) && isCargoUnit(entryUnit) ? true : entryUnit === req.unit;
}

/**
 * Calcula, sem alterar nada, o que seria tirado do estoque para este item.
 * `amounts` (opcional) limita quanto usar de cada material: { [chave]: quantidade na unidade do material }.
 * Sem `amounts`, usa o máximo disponível (até o que falta). `inventoryItems` = linhas do Inventário de Itens.
 */
export function planBlueprintCraft(bp, vaultEntries = [], { amounts = {}, inventoryItems = [] } = {}) {
  const requirements = getBlueprintRequirements(bp);
  const entries = Array.isArray(vaultEntries) ? vaultEntries : [];
  const inventory = normalizeInventoryStockItems(inventoryItems);
  const reserved = new Map();
  const reservedInventory = new Map();
  const usages = [];
  const inventoryUsages = [];
  const byKey = new Map();

  const vaultAvailableOf = entry => Math.max(
    0,
    toBase(Number(entry.quantity) || 0, entry.unit) - (reserved.get(String(entry.id)) || 0),
  );
  const inventoryAvailableOf = entry => Math.max(0, entry.availableBase - (reservedInventory.get(String(entry.id)) || 0));

  // Exigências de qualidade mais altas reservam estoque primeiro, para que um
  // minério Q≥800 não seja gasto antes de atender uma exigência mais específica.
  const order = [...requirements].sort((a, b) =>
    b.quality_min - a.quality_min || String(a.quality_operator).localeCompare(String(b.quality_operator)));

  for (const req of order) {
    const vaultMatches = entries.filter(entry => vaultEntryMatches(entry, req));
    const inventoryMatches = inventoryStockEntries(inventory, req);
    const vaultAvailableBase = roundCargo(vaultMatches.reduce((sum, entry) => sum + vaultAvailableOf(entry), 0));
    const inventoryAvailableBase = roundCargo(inventoryMatches.reduce((sum, entry) => sum + inventoryAvailableOf(entry), 0));
    const availableBase = roundCargo(vaultAvailableBase + inventoryAvailableBase);

    const asked = amounts && amounts[req.key] !== undefined && amounts[req.key] !== null
      ? toBase(Number(amounts[req.key]) || 0, req.unit)
      : req.remaining_base;
    let useBase = roundCargo(Math.max(0, Math.min(asked, req.remaining_base, availableBase)));
    // Itens por contagem (Yormandi Eye, gemas…) não se consomem pela metade.
    if (!isCargoUnit(req.unit)) useBase = Math.floor(useBase + EPS);

    // O Baú é usado primeiro; o que faltar vem do Inventário.
    const useVaultBase = Math.min(useBase, vaultAvailableBase);
    const useInventoryBase = roundCargo(useBase - useVaultBase);

    let left = useVaultBase;
    for (const entry of vaultMatches) {
      if (left <= EPS) break;
      const take = Math.min(vaultAvailableOf(entry), left);
      if (take <= EPS) continue;
      const id = String(entry.id);
      reserved.set(id, (reserved.get(id) || 0) + take);
      usages.push({ id, amount: fromBase(roundCargo(take), entry.unit) });
      left -= take;
    }

    left = useInventoryBase;
    for (const entry of inventoryMatches) {
      if (left <= EPS) break;
      const take = Math.min(inventoryAvailableOf(entry), left);
      if (take <= EPS) continue;
      const id = String(entry.id);
      reservedInventory.set(id, (reservedInventory.get(id) || 0) + take);
      const amount = roundCargo(fromBase(roundCargo(take), entry.unit));
      const already = inventoryUsages.find(usage => String(usage.id) === id);
      if (already) {
        already.amount = roundCargo(already.amount + amount);
        already.afterQuantity = roundCargo(Math.max(0, already.beforeQuantity - already.amount));
      } else {
        inventoryUsages.push({
          id: entry.id, name: entry.name, unit: entry.unit, amount,
          beforeQuantity: entry.quantity, afterQuantity: roundCargo(Math.max(0, entry.quantity - amount)),
        });
      }
      left -= take;
    }

    byKey.set(req.key, {
      ...req,
      vault_available_base: vaultAvailableBase,
      inventory_available_base: inventoryAvailableBase,
      available_base: availableBase,
      use_vault_base: useVaultBase,
      use_inventory_base: useInventoryBase,
      use_base: useBase,
      missing_after_base: roundCargo(Math.max(0, req.remaining_base - useBase)),
    });
  }

  const lines = requirements.map(req => {
    const line = byKey.get(req.key);
    return {
      ...line,
      vault_available: fromBase(line.vault_available_base, line.unit),
      inventory_available: fromBase(line.inventory_available_base, line.unit),
      available: fromBase(line.available_base, line.unit),
      use_vault: fromBase(line.use_vault_base, line.unit),
      use_inventory: fromBase(line.use_inventory_base, line.unit),
      use: fromBase(line.use_base, line.unit),
      missing_after: fromBase(line.missing_after_base, line.unit),
    };
  });

  return {
    lines,
    usages,            // baixas no Baú de Minério
    inventoryUsages,   // baixas no Inventário de Itens
    // true quando, com o estoque de agora, nada ficaria faltando.
    complete: lines.every(line => line.missing_after_base <= EPS),
    hasUsage: usages.length > 0 || inventoryUsages.length > 0,
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

async function revertInventory(updated, api) {
  for (const entry of [...updated].reverse()) {
    try { await api.inventoryUpdate(buildInventoryUpdatePayload(entry.row, entry.beforeQuantity)); } catch { /* melhor esforço */ }
  }
}

/**
 * Aplica o craft de um item da fila.
 *  mode 'partial' → tira do estoque o disponível e mantém o item na fila (progresso salvo).
 *  mode 'finish'  → tira do estoque o disponível, remove o item e cancela o que faltava.
 * Assíncrona porque o Inventário de Itens é gravado via IPC. Lança Error (sem alterar nada)
 * quando não há o que fazer ou quando alguma gravação falha (o que já foi gravado é revertido).
 */
export async function applyBlueprintCraft(bpId, { mode = 'partial', amounts, inventoryApi = getInventoryApi() } = {}) {
  const queue = loadQueue();
  const index = queue.queuedBlueprints.findIndex(item => String(item.bpId) === String(bpId));
  if (index < 0) throw new Error('Este item não está mais na fila de craft.');

  const bp = queue.queuedBlueprints[index];
  // O inventário é lido de novo agora: o que a tela mostrava pode ter mudado.
  const inventory = await loadInventoryStock({ api: inventoryApi });
  const plan = planBlueprintCraft(bp, loadVault().entries, { amounts, inventoryItems: inventory.items });
  const finishing = mode === 'finish';

  if (!finishing && !plan.hasUsage) {
    throw new Error('Não há material elegível no Baú ou no Inventário para aplicar neste item.');
  }
  if (finishing && !plan.hasUsage && !plan.hasApplied) {
    throw new Error('Não há material aplicado nem disponível. Para descartar o item, remova-o da fila.');
  }

  const used = plan.lines.filter(line => line.use_base > EPS).map(line => ({
    ...describeLine(line, line.use),
    fromVault: line.use_vault,
    fromInventory: line.use_inventory,
  }));
  const discarded = finishing
    ? plan.lines.filter(line => line.missing_after_base > EPS).map(line => describeLine(line, line.missing_after))
    : [];

  // 1) Inventário primeiro (tem reversão). Se algo falhar, nada mais foi tocado.
  const updatedInventory = [];
  if (plan.inventoryUsages.length) {
    if (!inventoryApi?.inventoryUpdate) throw new Error('A API do Inventário de Itens não está disponível.');
    try {
      for (const usage of plan.inventoryUsages) {
        const row = inventory.rows.find(item => String(item.id) === String(usage.id));
        if (!row) throw new Error(`Registro de Inventário ${usage.id} não encontrado durante a baixa.`);
        await inventoryApi.inventoryUpdate(buildInventoryUpdatePayload(row, usage.afterQuantity));
        updatedInventory.push({ row, beforeQuantity: usage.beforeQuantity });
      }
    } catch (error) {
      await revertInventory(updatedInventory, inventoryApi);
      throw error;
    }
  }

  // 2) Fila e Baú. A fila é gravada primeiro: se falhar, nada mudou. Se o Baú falhar depois,
  // a fila volta ao estado anterior; em qualquer falha o Inventário também é revertido.
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
  try {
    if (!saveQueue(queue)) throw new Error('Não foi possível salvar a fila de craft (armazenamento indisponível).');
    try {
      if (plan.usages.length) deductOreEntries(plan.usages);
    } catch (error) {
      saveQueue(snapshot);
      throw error;
    }
  } catch (error) {
    await revertInventory(updatedInventory, inventoryApi);
    throw error;
  }

  // 3) Avisa as outras telas (Inventário, Vendas…) para relerem o estoque.
  if (updatedInventory.length) {
    try {
      const refreshed = await inventoryApi.inventoryGetAll();
      publishInventoryUpdate(Array.isArray(refreshed) ? refreshed : []);
    } catch { /* a baixa já foi concluída; a tela se atualiza na próxima leitura */ }
  }

  return { mode, plan, used, discarded, bpName: bp.bpName, stillInQueue: !finishing };
}
