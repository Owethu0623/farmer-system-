import crypto from 'node:crypto';
import { store } from './store.ts';
import {
  CropRecord,
  CropStockMovement,
  CropStockMovementType,
  SanitizedUser,
  StockPriceSetting,
} from './types.ts';

function resolveCropPlantPrice(crop: CropRecord): { price: number; source: string } {
  const setting = store.db.stockPriceSettings.find(
    (s) => s.entityType === 'crop_plant' && s.entityId === crop.id
  );
  if (setting && setting.unitPriceZar > 0) {
    return { price: setting.unitPriceZar, source: setting.priceSource };
  }
  if (crop.plantingQuantity > 0 && crop.estimatedValueZar > 0) {
    return {
      price: Number((crop.estimatedValueZar / crop.plantingQuantity).toFixed(2)),
      source: 'Derived from crop estimated value ÷ planting quantity',
    };
  }
  return { price: 0, source: 'No farmer unit price set yet (R0.00)' };
}

function resolveCropHarvestPrice(crop: CropRecord): { price: number; source: string } {
  const setting = store.db.stockPriceSettings.find(
    (s) => s.entityType === 'crop_harvest' && s.entityId === crop.id
  );
  if (setting && setting.unitPriceZar > 0) {
    return { price: setting.unitPriceZar, source: setting.priceSource };
  }
  if (crop.harvestedQuantityKg > 0 && crop.estimatedValueZar > 0) {
    return {
      price: Number((crop.estimatedValueZar / crop.harvestedQuantityKg).toFixed(2)),
      source: 'Derived from harvest revenue ÷ harvested kg',
    };
  }
  return { price: 0, source: 'No harvest price per kg set yet (R0.00)' };
}

export function computeCropStoredAndSold(crop: CropRecord): {
  storedKg: number;
  soldKg: number;
  spoilageKg: number;
  salesValueZar: number;
} {
  const movements = store.db.cropStockMovements.filter((m) => m.cropId === crop.id);
  const harvestOrStorageMoves = movements.filter(
    (m) => m.movementType === 'harvest' || m.movementType === 'storage_in'
  );
  const saleMoves = movements.filter((m) => m.movementType === 'sale');
  const spoilageMoves = movements.filter((m) => m.movementType === 'spoilage');

  const storedInFromMoves = harvestOrStorageMoves.reduce(
    (s, m) => s + Math.abs(m.quantityDelta),
    0
  );
  const baseHarvestKg = Math.max(crop.harvestedQuantityKg, storedInFromMoves);
  const soldKg = saleMoves.reduce((s, m) => s + Math.abs(m.quantityDelta), 0);
  const spoilageKg = spoilageMoves.reduce((s, m) => s + Math.abs(m.quantityDelta), 0);
  const storedKg = Math.max(0, Number((baseHarvestKg - soldKg - spoilageKg).toFixed(2)));
  const salesValueZar = Number(saleMoves.reduce((s, m) => s + m.totalValueZar, 0).toFixed(2));

  return {
    storedKg,
    soldKg: Number(soldKg.toFixed(2)),
    spoilageKg: Number(spoilageKg.toFixed(2)),
    salesValueZar,
  };
}

export function buildStockOverview(accessibleFarmIds: string[], farmFilter?: string | null) {
  const targetIds = farmFilter
    ? accessibleFarmIds.filter((id) => id === farmFilter)
    : accessibleFarmIds;

  const valuationDate = new Date().toISOString();
  const crops = store.db.crops.filter((c) => targetIds.includes(c.farmId));
  const livestock = store.db.livestockGroups.filter((g) => targetIds.includes(g.farmId));

  const cropStocks = crops.map((crop) => {
    const farm = store.db.farms.find((f) => f.id === crop.farmId);
    const field = store.db.fields.find((fl) => fl.id === crop.fieldId);
    const remainingPlants = Math.max(0, crop.plantingQuantity - crop.damagedPlants);
    const { price: plantUnitPriceZar, source: plantPriceSrc } = resolveCropPlantPrice(crop);
    const { price: harvestUnitPriceZar, source: harvestPriceSrc } = resolveCropHarvestPrice(crop);
    const { storedKg, soldKg, spoilageKg, salesValueZar } = computeCropStoredAndSold(crop);

    const initialPlantedValueZar = Number((crop.plantingQuantity * plantUnitPriceZar).toFixed(2));
    const damagedStockValueZar = Number(
      (crop.damagedPlants * plantUnitPriceZar + spoilageKg * harvestUnitPriceZar).toFixed(2)
    );
    const remainingStandingValueZar = Number((remainingPlants * plantUnitPriceZar).toFixed(2));
    const estimatedHarvestValueZar = Number(
      Math.max(crop.estimatedValueZar, crop.harvestedQuantityKg * harvestUnitPriceZar).toFixed(2)
    );
    const storedStockValueZar = Number((storedKg * harvestUnitPriceZar).toFixed(2));
    const netStockValueChangeZar = Number(
      (
        remainingStandingValueZar +
        storedStockValueZar +
        salesValueZar -
        initialPlantedValueZar
      ).toFixed(2)
    );

    return {
      cropId: crop.id,
      farmId: crop.farmId,
      farmName: farm?.name || 'Farm',
      fieldName: field?.name || 'General Farm Block',
      cropName: crop.cropName,
      cropVariety: crop.cropVariety,
      growthStage: crop.growthStage,
      originalPlantedQty: crop.plantingQuantity,
      damagedPlants: crop.damagedPlants,
      remainingPlants,
      harvestedKg: crop.harvestedQuantityKg,
      storedProductionKg: storedKg,
      soldKg,
      spoilageKg,
      plantUnitPriceZar,
      harvestUnitPriceZar,
      priceSource: `${plantPriceSrc} · Harvest: ${harvestPriceSrc}`,
      initialPlantedValueZar,
      damagedStockValueZar,
      remainingStandingValueZar,
      estimatedHarvestValueZar,
      storedStockValueZar,
      salesValueZar,
      netStockValueChangeZar,
      calculationAssumption: `Standing = ${remainingPlants.toLocaleString()} remaining plants × R${plantUnitPriceZar.toFixed(2)} + Stored = ${storedKg.toLocaleString()} kg × R${harvestUnitPriceZar.toFixed(2)}; Damaged loss = ${crop.damagedPlants.toLocaleString()} damaged plants × R${plantUnitPriceZar.toFixed(2)}.`,
      valuationDate,
    };
  });

  const livestockStocks = livestock.map((group) => {
    const farm = store.db.farms.find((f) => f.id === group.farmId);
    const field = store.db.fields.find((fl) => fl.id === group.fieldId);
    const records = store.db.livestockRecords.filter((r) => r.livestockGroupId === group.id);
    const setting = store.db.stockPriceSettings.find(
      (s) => s.entityType === 'livestock' && s.entityId === group.id
    );
    const unitPriceZar = setting ? setting.unitPriceZar : group.estimatedUnitValueZar;
    const priceSource = setting ? setting.priceSource : 'Farmer-entered livestock unit valuation';

    const births = records
      .filter((r) => r.recordType === 'Birth')
      .reduce((s, r) => s + Math.abs(r.quantityChange), 0);
    const deaths = records
      .filter((r) => r.recordType === 'Death')
      .reduce((s, r) => s + Math.abs(r.quantityChange), 0);
    const purchases = records
      .filter((r) => r.recordType === 'Purchase')
      .reduce((s, r) => s + Math.abs(r.quantityChange), 0);
    const sales = records
      .filter((r) => r.recordType === 'Sale')
      .reduce((s, r) => s + Math.abs(r.quantityChange), 0);
    const prodRecs = records.filter((r) => r.productionAmount > 0);
    const productionTotal = Number(
      prodRecs.reduce((s, r) => s + r.productionAmount, 0).toFixed(2)
    );
    const productionUnit = prodRecs[0]?.productionUnit || 'units';

    const remainingValueZar = Number((group.quantity * unitPriceZar).toFixed(2));
    const deathLossValueZar = Number((deaths * unitPriceZar).toFixed(2));
    const netCountDelta = births + purchases - deaths - sales;
    const netValueChangeZar = Number((netCountDelta * unitPriceZar).toFixed(2));

    return {
      livestockGroupId: group.id,
      farmId: group.farmId,
      farmName: farm?.name || 'Farm',
      fieldName: field?.name || null,
      animalType: group.animalType,
      groupName: group.groupName,
      breed: group.breed,
      healthStatus: group.healthStatus,
      currentQuantity: group.quantity,
      births,
      deaths,
      purchases,
      sales,
      productionTotal,
      productionUnit,
      unitPriceZar,
      priceSource,
      remainingValueZar,
      deathLossValueZar,
      netValueChangeZar,
      calculationAssumption: `Herd value = ${group.quantity.toLocaleString()} head × R${unitPriceZar.toLocaleString()} (${priceSource}). Death loss = ${deaths} head × R${unitPriceZar.toLocaleString()}.`,
      valuationDate,
    };
  });

  const cropMovements = store.db.cropStockMovements
    .filter((m) => targetIds.includes(m.farmId))
    .map((m) => {
      const crop = store.db.crops.find((c) => c.id === m.cropId);
      const farm = store.db.farms.find((f) => f.id === m.farmId);
      return {
        ...m,
        cropName: crop ? `${crop.cropName} (${crop.cropVariety})` : 'Crop',
        farmName: farm?.name || 'Farm',
      };
    });

  const livestockMovements = store.db.livestockRecords
    .filter((r) => targetIds.includes(r.farmId))
    .map((r) => {
      const grp = store.db.livestockGroups.find((g) => g.id === r.livestockGroupId);
      const farm = store.db.farms.find((f) => f.id === r.farmId);
      return {
        ...r,
        groupName: grp ? `${grp.groupName} (${grp.animalType})` : 'Livestock Group',
        farmName: farm?.name || 'Farm',
      };
    });

  const totalCropStockValueZar = Number(
    cropStocks
      .reduce((s, c) => s + c.remainingStandingValueZar + c.storedStockValueZar, 0)
      .toFixed(2)
  );
  const totalLivestockValueZar = Number(
    livestockStocks.reduce((s, l) => s + l.remainingValueZar, 0).toFixed(2)
  );
  const totalHarvestValueZar = Number(
    cropStocks.reduce((s, c) => s + c.estimatedHarvestValueZar, 0).toFixed(2)
  );
  const totalStoredProductionValueZar = Number(
    cropStocks.reduce((s, c) => s + c.storedStockValueZar, 0).toFixed(2)
  );
  const totalDamagedStockValueZar = Number(
    (
      cropStocks.reduce((s, c) => s + c.damagedStockValueZar, 0) +
      livestockStocks.reduce((s, l) => s + l.deathLossValueZar, 0)
    ).toFixed(2)
  );
  const totalRemainingStockValueZar = Number(
    (totalCropStockValueZar + totalLivestockValueZar).toFixed(2)
  );
  const netStockValueChangeZar = Number(
    (
      cropStocks.reduce((s, c) => s + c.netStockValueChangeZar, 0) +
      livestockStocks.reduce((s, l) => s + l.netValueChangeZar, 0)
    ).toFixed(2)
  );

  return {
    valuationDate,
    pricingDisclaimer:
      'Stock valuations use farmer-entered unit prices and recorded asset estimates. No live external commodity market feed (SAFEX/fresh produce exchange) is fabricated; verify local buyer prices prior to sale.',
    totals: {
      totalCropStockValueZar,
      totalLivestockValueZar,
      totalHarvestValueZar,
      totalStoredProductionValueZar,
      totalDamagedStockValueZar,
      totalRemainingStockValueZar,
      netStockValueChangeZar,
      totalPlantedUnits: cropStocks.reduce((s, c) => s + c.originalPlantedQty, 0),
      totalDamagedUnits: cropStocks.reduce((s, c) => s + c.damagedPlants, 0),
      totalRemainingUnits: cropStocks.reduce((s, c) => s + c.remainingPlants, 0),
      totalLivestockHead: livestockStocks.reduce((s, l) => s + l.currentQuantity, 0),
    },
    cropStocks,
    livestockStocks,
    cropMovements,
    livestockMovements,
  };
}

export function recordCropStockMovement(params: {
  crop: CropRecord;
  actorUserId: string;
  movementType: CropStockMovementType;
  movementDate: string;
  quantity: number;
  unit: string;
  unitPriceZar?: number;
  notes: string;
  incidentId?: string | null;
}): CropStockMovement {
  const { crop, movementType, movementDate, notes } = params;
  const qty = Math.max(0, Number(params.quantity) || 0);
  const now = new Date().toISOString();

  const plantPrice = resolveCropPlantPrice(crop).price;
  const harvestPrice = resolveCropHarvestPrice(crop).price;
  const { storedKg: currentStoredBefore } = computeCropStoredAndSold(crop);

  let quantityDelta = qty;
  let unitPriceZar = Number(params.unitPriceZar ?? 0);
  let resultingStoredKg = currentStoredBefore;

  if (movementType === 'damage') {
    const newDamaged = Math.min(crop.plantingQuantity, crop.damagedPlants + qty);
    const actualDamageDelta = Math.max(0, newDamaged - crop.damagedPlants);
    crop.damagedPlants = newDamaged;
    quantityDelta = -actualDamageDelta;
    if (unitPriceZar <= 0) unitPriceZar = plantPrice;
  } else if (movementType === 'harvest') {
    crop.harvestedQuantityKg = Number((crop.harvestedQuantityKg + qty).toFixed(2));
    resultingStoredKg = Number((currentStoredBefore + qty).toFixed(2));
    if (unitPriceZar <= 0) unitPriceZar = harvestPrice;
    if (unitPriceZar > 0) {
      crop.estimatedValueZar = Number((crop.estimatedValueZar + qty * unitPriceZar).toFixed(2));
    }
  } else if (movementType === 'storage_in') {
    resultingStoredKg = Number((currentStoredBefore + qty).toFixed(2));
    if (unitPriceZar <= 0) unitPriceZar = harvestPrice;
  } else if (movementType === 'sale' || movementType === 'spoilage') {
    const capped = Math.min(currentStoredBefore, qty);
    quantityDelta = -capped;
    resultingStoredKg = Math.max(0, Number((currentStoredBefore - capped).toFixed(2)));
    if (unitPriceZar <= 0) unitPriceZar = harvestPrice;
  } else if (movementType === 'planting') {
    crop.plantingQuantity = crop.plantingQuantity + qty;
    if (unitPriceZar <= 0) unitPriceZar = plantPrice;
  } else if (movementType === 'adjustment') {
    const rawDelta = Number(params.quantity) || 0;
    quantityDelta = rawDelta;
    if ((params.unit || '').toLowerCase().includes('kg')) {
      resultingStoredKg = Math.max(0, Number((currentStoredBefore + rawDelta).toFixed(2)));
      if (unitPriceZar <= 0) unitPriceZar = harvestPrice;
    } else {
      crop.plantingQuantity = Math.max(crop.damagedPlants, crop.plantingQuantity + Math.round(rawDelta));
      if (unitPriceZar <= 0) unitPriceZar = plantPrice;
    }
  }

  crop.updatedAt = now;

  const remainingPlants = Math.max(0, crop.plantingQuantity - crop.damagedPlants);
  const totalValueZar = Number((Math.abs(quantityDelta) * unitPriceZar).toFixed(2));

  const movement: CropStockMovement = {
    id: `csm-${crypto.randomUUID()}`,
    cropId: crop.id,
    farmId: crop.farmId,
    actorUserId: params.actorUserId,
    movementType,
    movementDate: movementDate || now.slice(0, 10),
    quantityDelta,
    unit: params.unit || (movementType === 'damage' || movementType === 'planting' ? 'plants' : 'kg'),
    unitPriceZar,
    totalValueZar,
    resultingRemainingPlants: remainingPlants,
    resultingStoredKg,
    notes: notes.trim(),
    incidentId: params.incidentId || null,
    createdAt: now,
  };

  store.db.cropStockMovements.unshift(movement);
  return movement;
}

export function updateStockUnitPrice(params: {
  user: SanitizedUser;
  farmId: string;
  entityType: 'crop_plant' | 'crop_harvest' | 'livestock';
  entityId: string;
  unitPriceZar: number;
  unitLabel: string;
  priceSource: string;
}): StockPriceSetting {
  const cleanPrice = Math.max(0, Number(params.unitPriceZar) || 0);
  const now = new Date().toISOString();

  const existing = store.db.stockPriceSettings.find(
    (s) => s.entityType === params.entityType && s.entityId === params.entityId
  );
  const previousPrice = existing ? existing.unitPriceZar : null;

  if (existing) {
    existing.unitPriceZar = cleanPrice;
    existing.unitLabel = params.unitLabel || existing.unitLabel;
    existing.priceSource = params.priceSource || 'Farmer-entered unit price';
    existing.updatedByUserId = params.user.id;
    existing.updatedAt = now;
  } else {
    const created: StockPriceSetting = {
      id: `sprice-${crypto.randomUUID()}`,
      farmId: params.farmId,
      entityType: params.entityType,
      entityId: params.entityId,
      unitLabel: params.unitLabel || 'unit',
      unitPriceZar: cleanPrice,
      priceSource: params.priceSource || 'Farmer-entered unit price',
      updatedByUserId: params.user.id,
      updatedAt: now,
    };
    store.db.stockPriceSettings.push(created);
  }

  if (params.entityType === 'livestock') {
    const grp = store.db.livestockGroups.find((g) => g.id === params.entityId);
    if (grp) {
      grp.estimatedUnitValueZar = cleanPrice;
      grp.updatedAt = now;
    }
  }

  store.logAudit(
    params.user.id,
    'STOCK_UNIT_PRICE_UPDATED',
    'StockPriceSetting',
    params.entityId,
    {
      entityType: params.entityType,
      previousPriceZar: previousPrice,
      newPriceZar: cleanPrice,
      priceSource: params.priceSource,
    },
    '127.0.0.1'
  );

  return store.db.stockPriceSettings.find(
    (s) => s.entityType === params.entityType && s.entityId === params.entityId
  )!;
}
