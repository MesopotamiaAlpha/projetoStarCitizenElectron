import {
  addManualMaterial, calcShoppingList, loadQueue, materialKey, qualityRequirementLabel,
  removeManualMaterial, saveQueue, updateQueuedQty,
} from './materialQueue';
import { applyBlueprintCraft, getBlueprintRequirements, planBlueprintCraft } from './materialCraft';
import { findExactVaultMatches, loadVault, saveVault } from './oreVault';

beforeEach(() => {
  window.localStorage.clear();
});

function queueWith(...blueprints) {
  saveQueue({ queuedBlueprints: blueprints, collectedMaterials: {} });
}

function bp(ingredients, extra = {}) {
  return { bpId: 'bp-1', bpName: 'Item de Teste', quantity: 1, ingredients, ...extra };
}

const iron = (quantity, extra = {}) => ({ material_name: 'Iron', quantity, unit: 'cSCU', ...extra });
const copper = (quantity, extra = {}) => ({ material_name: 'Copper', quantity, unit: 'cSCU', ...extra });
const stock = (id, ore_name, quantity, extra = {}) => ({ id, ore_name, quantity, unit: 'cSCU', quality: '500', ...extra });
const listItem = (name) => calcShoppingList(loadQueue(), loadVault().entries).find(item => item.material_name === name);
const vaultQuantity = id => (loadVault().entries.find(entry => entry.id === id) || { quantity: 0 }).quantity;

describe('craft parcial a partir do Baú', () => {
  test('parcial tira o disponível do Baú, guarda o progresso e o material não volta a faltar tudo', () => {
    queueWith(bp([iron(100)]));
    saveVault({ entries: [stock('a', 'Iron', 60)] });

    const plan = planBlueprintCraft(loadQueue().queuedBlueprints[0], loadVault().entries);
    expect(plan.complete).toBe(false);
    expect(plan.lines[0]).toMatchObject({ available: 60, use: 60, missing_after: 40 });

    const result = applyBlueprintCraft('bp-1', { mode: 'partial' });
    expect(result.stillInQueue).toBe(true);
    expect(vaultQuantity('a')).toBe(0);
    expect(loadQueue().queuedBlueprints[0].applied).toEqual({ [materialKey('Iron', 0)]: 60 });

    // Necessário caiu de 100 para 40 (60 já aplicados); Baú vazio => faltam 40.
    expect(listItem('Iron')).toMatchObject({ needed_total: 40, collected: 0, remaining: 40, applied_total: 60 });
  });

  test('continua depois: ao cadastrar o restante, conclui e o item sai da fila', () => {
    queueWith(bp([iron(100)]));
    saveVault({ entries: [stock('a', 'Iron', 60)] });
    applyBlueprintCraft('bp-1', { mode: 'partial' });

    saveVault({ entries: [stock('b', 'Iron', 55)] });
    const plan = planBlueprintCraft(loadQueue().queuedBlueprints[0], loadVault().entries);
    expect(plan.complete).toBe(true);
    expect(plan.lines[0]).toMatchObject({ remaining: 40, use: 40 });

    const result = applyBlueprintCraft('bp-1', { mode: 'finish' });
    expect(result.discarded).toEqual([]);
    expect(loadQueue().queuedBlueprints).toHaveLength(0);
    expect(vaultQuantity('b')).toBe(15); // sobra 55 - 40
  });

  test('concluir com material faltando cancela o restante e informa o que foi descartado', () => {
    queueWith(bp([iron(100), copper(50)]));
    saveVault({ entries: [stock('a', 'Iron', 100), stock('c', 'Copper', 20)] });

    const result = applyBlueprintCraft('bp-1', { mode: 'finish' });
    expect(result.stillInQueue).toBe(false);
    expect(result.used.map(u => [u.material_name, u.amount])).toEqual([['Iron', 100], ['Copper', 20]]);
    expect(result.discarded).toHaveLength(1);
    expect(result.discarded[0]).toMatchObject({ material_name: 'Copper', amount: 30 });
    expect(loadQueue().queuedBlueprints).toHaveLength(0);
    expect(loadVault().entries).toHaveLength(0);
  });

  test('o usuário pode limitar quanto tirar de cada material (e nunca acima do disponível/necessário)', () => {
    queueWith(bp([iron(100)]));
    saveVault({ entries: [stock('a', 'Iron', 60)] });
    const key = materialKey('Iron', 0);

    expect(planBlueprintCraft(loadQueue().queuedBlueprints[0], loadVault().entries, { amounts: { [key]: 25 } }).lines[0].use).toBe(25);
    expect(planBlueprintCraft(loadQueue().queuedBlueprints[0], loadVault().entries, { amounts: { [key]: 999 } }).lines[0].use).toBe(60);
    expect(planBlueprintCraft(loadQueue().queuedBlueprints[0], loadVault().entries, { amounts: { [key]: -5 } }).lines[0].use).toBe(0);

    applyBlueprintCraft('bp-1', { mode: 'partial', amounts: { [key]: 25 } });
    expect(vaultQuantity('a')).toBe(35);
    expect(listItem('Iron')).toMatchObject({ needed_total: 75, collected: 35, remaining: 40 });
  });

  test('respeita as unidades de carga (exigência em SCU, estoque em cSCU e mSCU)', () => {
    queueWith(bp([{ material_name: 'Iron', quantity: 1, unit: 'SCU' }]));
    saveVault({ entries: [stock('a', 'Iron', 60), { id: 'b', ore_name: 'Iron', quantity: 500, unit: 'mSCU', quality: '500' }] });

    const plan = planBlueprintCraft(loadQueue().queuedBlueprints[0], loadVault().entries);
    expect(plan.complete).toBe(true);
    expect(plan.lines[0]).toMatchObject({ unit: 'SCU', remaining: 1, use: 1 });

    applyBlueprintCraft('bp-1', { mode: 'finish' });
    expect(vaultQuantity('a')).toBe(0);   // 60 cSCU = 0,6 SCU
    expect(vaultQuantity('b')).toBe(100); // 500 mSCU - 0,4 SCU (400 mSCU)
  });

  test('exigências de qualidade mais altas reservam o estoque primeiro', () => {
    queueWith(bp([iron(50), iron(50, { quality_min: 800 })]));
    saveVault({ entries: [stock('low', 'Iron', 50, { quality: '300' }), stock('high', 'Iron', 50, { quality: '900' })] });

    const plan = planBlueprintCraft(loadQueue().queuedBlueprints[0], loadVault().entries);
    expect(plan.complete).toBe(true);
    const byId = Object.fromEntries(plan.usages.map(u => [u.id, u.amount]));
    expect(byId).toEqual({ high: 50, low: 50 });
  });

  test('operadores ≤ e = só usam minério da qualidade certa', () => {
    queueWith(bp([iron(100, { quality_min: 500, quality_operator: '<=' })]));
    saveVault({ entries: [stock('q400', 'Iron', 30, { quality: '400' }), stock('q500', 'Iron', 30, { quality: '500' }), stock('q900', 'Iron', 100, { quality: '900' })] });

    const plan = planBlueprintCraft(loadQueue().queuedBlueprints[0], loadVault().entries);
    expect(plan.usages.map(u => u.id).sort()).toEqual(['q400', 'q500']);
    expect(plan.lines[0]).toMatchObject({ available: 60, missing_after: 40 });

    queueWith(bp([iron(10, { quality_min: 800, quality_operator: '=' })]));
    saveVault({ entries: [stock('q799', 'Iron', 10, { quality: '799' }), stock('q800', 'Iron', 10, { quality: '800' }), stock('q801', 'Iron', 10, { quality: '801' })] });
    expect(planBlueprintCraft(loadQueue().queuedBlueprints[0], loadVault().entries).usages.map(u => u.id)).toEqual(['q800']);
  });

  test('erros: item fora da fila, nada a aplicar, nada a concluir', () => {
    queueWith(bp([iron(100)]));
    saveVault({ entries: [] });
    expect(() => applyBlueprintCraft('nao-existe')).toThrow(/não está mais na fila/);
    expect(() => applyBlueprintCraft('bp-1', { mode: 'partial' })).toThrow(/Não há minério elegível/);
    expect(() => applyBlueprintCraft('bp-1', { mode: 'finish' })).toThrow(/remova-o da fila/);
    expect(loadQueue().queuedBlueprints).toHaveLength(1); // nada mudou
  });

  test('material 100% aplicado sai da lista; o restante do item continua', () => {
    queueWith(bp([iron(40), copper(60)]));
    saveVault({ entries: [stock('a', 'Iron', 40)] });
    applyBlueprintCraft('bp-1', { mode: 'partial' });

    expect(listItem('Iron')).toBeUndefined();
    expect(listItem('Copper')).toMatchObject({ needed_total: 60, remaining: 60 });
    const requirements = getBlueprintRequirements(loadQueue().queuedBlueprints[0]);
    expect(requirements.find(r => r.material_name === 'Iron')).toMatchObject({ applied: 40, remaining: 0 });
  });

  test('concluir um item que só tinha progresso aplicado (nada novo no Baú) é permitido', () => {
    queueWith(bp([iron(40)]));
    saveVault({ entries: [stock('a', 'Iron', 40)] });
    applyBlueprintCraft('bp-1', { mode: 'partial' });

    const result = applyBlueprintCraft('bp-1', { mode: 'finish' });
    expect(result.discarded).toEqual([]);
    expect(loadQueue().queuedBlueprints).toHaveLength(0);
  });

  test('reduzir a quantidade do item na fila não deixa o aplicado passar da necessidade', () => {
    queueWith(bp([iron(100)], { quantity: 2 }));
    saveVault({ entries: [stock('a', 'Iron', 150)] });
    applyBlueprintCraft('bp-1', { mode: 'partial', amounts: { [materialKey('Iron', 0)]: 150 } });
    expect(listItem('Iron')).toMatchObject({ needed_total: 50 });

    updateQueuedQty('bp-1', 1);
    expect(listItem('Iron')).toBeUndefined(); // 150 aplicados cobrem os 100 da nova quantidade
  });

  test('registra o histórico do craft parcial no item', () => {
    queueWith(bp([iron(100)]));
    saveVault({ entries: [stock('a', 'Iron', 30)] });
    applyBlueprintCraft('bp-1', { mode: 'partial' });
    const log = loadQueue().queuedBlueprints[0].craftLog;
    expect(log).toHaveLength(1);
    expect(log[0].used[0]).toMatchObject({ material_name: 'Iron', amount: 30, unit: 'cSCU' });
  });
});

describe('material manual do Tracking', () => {
  test('soma entradas iguais, separa por qualidade/unidade e ignora quantidades inválidas', () => {
    addManualMaterial('  Iron ', 100, 'cSCU');
    addManualMaterial('Iron', 20, 'cscu');            // mesma unidade (alias) => soma
    addManualMaterial('Iron', 5, 'SCU');              // outra unidade => entrada separada
    addManualMaterial('Iron', 10, 'cSCU', 800, '>='); // outra exigência => entrada separada
    addManualMaterial('', 10, 'cSCU');                // sem nome
    addManualMaterial('Copper', 0, 'cSCU');           // quantidade zero
    addManualMaterial('Copper', -3, 'cSCU');          // negativa

    const manual = loadQueue().manualMaterials;
    expect(manual).toHaveLength(3);
    expect(manual[0]).toMatchObject({ material_name: 'Iron', quantity: 120, unit: 'cSCU', quality_min: 0 });
    expect(manual[2]).toMatchObject({ quality_min: 800, quality_operator: '>=' });
  });

  test('aparece no Tracking como necessidade manual e é abatido pelo Baú', () => {
    addManualMaterial('Iron', 100, 'cSCU', 800, '>=');
    saveVault({ entries: [stock('a', 'Iron', 30, { quality: '850' }), stock('b', 'Iron', 500, { quality: '400' })] });

    const item = listItem('Iron');
    expect(item).toMatchObject({ is_manual: true, has_manual: true, needed_total: 100, collected: 30, remaining: 70, manual_total: 100 });
    expect(item.usedBy).toEqual([]);
  });

  test('manual somado a uma blueprint não é "só manual", mas mostra a parte manual', () => {
    queueWith(bp([iron(100)]));
    addManualMaterial('Iron', 50, 'cSCU');
    const item = listItem('Iron');
    expect(item).toMatchObject({ is_manual: false, has_manual: true, needed_total: 150, manual_total: 50 });
  });

  test('remover por qualidade não leva junto as outras exigências do mesmo material', () => {
    addManualMaterial('Iron', 100, 'cSCU');
    addManualMaterial('Iron', 10, 'cSCU', 800, '>=');
    removeManualMaterial('Iron', 800, '>=');
    expect(loadQueue().manualMaterials.map(m => m.quality_min)).toEqual([0]);

    addManualMaterial('Iron', 10, 'SCU');
    removeManualMaterial('Iron', 0, 'gte', 'SCU'); // só a unidade pedida
    expect(loadQueue().manualMaterials.map(m => m.unit)).toEqual(['cSCU']);
  });

  test('uso antigo (só o nome) continua removendo tudo daquele material', () => {
    addManualMaterial('Iron', 100, 'cSCU');
    addManualMaterial('Iron', 10, 'cSCU', 800, '>=');
    addManualMaterial('Copper', 10, 'cSCU');
    removeManualMaterial('iron');
    expect(loadQueue().manualMaterials.map(m => m.material_name)).toEqual(['Copper']);
  });
});

describe('qualidade: rótulos e busca no Baú', () => {
  test('rótulo mostra ≥, ≤ e = corretamente', () => {
    expect(qualityRequirementLabel(800, '>=')).toBe('Q≥800');
    expect(qualityRequirementLabel(800, '<=')).toBe('Q≤800');
    expect(qualityRequirementLabel(800, '=')).toBe('Q=800');
    expect(qualityRequirementLabel(0, '>=')).toBe('Qualidade livre');
  });

  test('findExactVaultMatches respeita o operador de qualidade', () => {
    saveVault({ entries: [stock('q400', 'Iron', 1, { quality: '400' }), stock('q800', 'Iron', 1, { quality: '800' }), stock('q900', 'Iron', 1, { quality: '900' })] });
    const ids = (min, op) => findExactVaultMatches('Iron', min, op).map(e => e.id).sort();
    expect(ids(800, '>=')).toEqual(['q800', 'q900']);
    expect(ids(800, '<=')).toEqual(['q400', 'q800']);
    expect(ids(800, '=')).toEqual(['q800']);
    expect(ids(800)).toEqual(['q800', 'q900']); // padrão continua ≥
    expect(ids(0)).toEqual(['q400', 'q800', 'q900']);
  });
});
