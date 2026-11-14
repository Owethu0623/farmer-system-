import crypto from 'node:crypto';
import { BUSINESS_ENTERPRISE_TEMPLATES, computeBusinessPlanMetrics } from './businessPlanner.ts';
import { getActiveFarmGrantForExpert } from './expertPortal.ts';
import { createFarmIncident } from './incidents.ts';
import { resolveMaterialForUser } from './learningCentre.ts';
import { validateSafeMediaDataUrl } from './privacy.ts';
import { buildStockOverview, recordCropStockMovement } from './stockInventory.ts';
import { store } from './store.ts';
import {
  BusinessPlanScenario,
  BusinessScaleTier,
  CropActivityType,
  CropGrowthStage,
  CropStockMovementType,
  IncidentType,
  LivestockRecordType,
  MixedEntryCategory,
  RainfallIntensity,
  SanitizedUser,
  WindObservationLevel,
} from './types.ts';
import { submitFarmerWeatherObservation } from './weatherFeedback.ts';

export interface OfflineMutationInput {
  clientMutationId: string;
  mutationType:
    | 'crop_activity'
    | 'livestock_record'
    | 'mixed_entry'
    | 'farm_incident'
    | 'weather_observation'
    | 'crop_stock_movement'
    | 'business_plan_upsert'
    | 'crop_update';
  createdAt: string;
  baseUpdatedAt?: string | null;
  forceOverwrite?: boolean;
  payload: Record<string, unknown>;
}

export interface OfflineSyncItemResult {
  clientMutationId: string;
  mutationType: string;
  status: 'synced' | 'already_synced' | 'conflict' | 'error';
  serverEntityId: string | null;
  message: string;
  serverUpdatedAt?: string | null;
  serverSummary?: string | null;
}

export function buildOfflineBundle(params: {
  user: SanitizedUser;
  accessibleFarmIds: string[];
  requestedFarmIds?: string[];
}) {
  const { user, accessibleFarmIds, requestedFarmIds } = params;

  if (user.roleCode === 'organisation_manager') {
    throw new Error(
      'Organisation accounts access anonymised portfolio aggregates rather than offline farm bundles.'
    );
  }

  const targetFarmIds =
    Array.isArray(requestedFarmIds) && requestedFarmIds.length > 0
      ? requestedFarmIds.filter((id) => accessibleFarmIds.includes(id))
      : accessibleFarmIds;

  const targetSet = new Set(targetFarmIds);
  const downloadedAt = new Date().toISOString();

  const farms = store.db.farms
    .filter((f) => targetSet.has(f.id))
    .map((farm) => {
      const ownerProfile = store.db.userProfiles.find((p) => p.userId === farm.ownerId);
      return {
        ...farm,
        ownerName: ownerProfile?.fullName || 'Registered Farmer',
        location: store.db.farmLocations.find((l) => l.farmId === farm.id) || null,
        boundary: store.db.farmBoundaries.find((b) => b.farmId === farm.id) || null,
        fields: store.db.fields.filter((fl) => fl.farmId === farm.id),
      };
    });

  const hasExpertScope = (
    farmId: string,
    scope: 'overview' | 'crops' | 'livestock' | 'incidents' | 'weather' | 'financialSummary'
  ) => {
    if (user.roleCode !== 'agricultural_expert') return true;
    return Boolean(getActiveFarmGrantForExpert(user.id, farmId)?.scopes[scope]);
  };

  const crops = store.db.crops
    .filter((c) => targetSet.has(c.farmId) && hasExpertScope(c.farmId, 'crops'))
    .map((c) => {
      const farm = store.db.farms.find((f) => f.id === c.farmId);
      const field = store.db.fields.find((fl) => fl.id === c.fieldId);
      const hideFinancial = !hasExpertScope(c.farmId, 'financialSummary');
      return {
        ...c,
        estimatedValueZar: hideFinancial ? 0 : c.estimatedValueZar,
        farmName: farm?.name || 'Farm',
        fieldName: field?.name || 'General Farm Block',
        remainingPlants: Math.max(0, c.plantingQuantity - c.damagedPlants),
        activityCount: store.db.cropActivities.filter((a) => a.cropId === c.id).length,
      };
    });

  const cropActivities = store.db.cropActivities
    .filter((a) => targetSet.has(a.farmId) && hasExpertScope(a.farmId, 'crops'))
    .slice(0, 120)
    .map((a) =>
      hasExpertScope(a.farmId, 'financialSummary') ? a : { ...a, valueZar: 0 }
    );

  const livestockGroups = store.db.livestockGroups
    .filter((g) => targetSet.has(g.farmId) && hasExpertScope(g.farmId, 'livestock'))
    .map((g) => {
      const farm = store.db.farms.find((f) => f.id === g.farmId);
      const field = store.db.fields.find((fl) => fl.id === g.fieldId);
      const hideFinancial = !hasExpertScope(g.farmId, 'financialSummary');
      return {
        ...g,
        estimatedUnitValueZar: hideFinancial ? 0 : g.estimatedUnitValueZar,
        farmName: farm?.name || 'Farm',
        fieldName: field?.name || null,
        totalValueZar: hideFinancial ? 0 : Number((g.quantity * g.estimatedUnitValueZar).toFixed(2)),
        recordCount: store.db.livestockRecords.filter((r) => r.livestockGroupId === g.id).length,
      };
    });

  const livestockRecords = store.db.livestockRecords
    .filter((r) => targetSet.has(r.farmId) && hasExpertScope(r.farmId, 'livestock'))
    .slice(0, 120)
    .map((r) =>
      hasExpertScope(r.farmId, 'financialSummary') ? r : { ...r, valueZar: 0 }
    );

  const rawStockOverview = buildStockOverview(targetFarmIds, null);
  const allFinancialAllowed = targetFarmIds.every((fid) =>
    hasExpertScope(fid, 'financialSummary')
  );
  const stockOverview = allFinancialAllowed
    ? rawStockOverview
    : {
        ...rawStockOverview,
        pricingDisclaimer:
          'Financial valuation figures are redacted where the farmer has not granted financialSummary permission.',
        totals: {
          ...rawStockOverview.totals,
          totalCropStockValueZar: 0,
          totalLivestockValueZar: 0,
          totalHarvestValueZar: 0,
          totalStoredProductionValueZar: 0,
          totalDamagedStockValueZar: 0,
          totalRemainingStockValueZar: 0,
          netStockValueChangeZar: 0,
        },
        cropStocks: rawStockOverview.cropStocks
          .filter((row) => hasExpertScope(row.farmId, 'crops'))
          .map((row) =>
            hasExpertScope(row.farmId, 'financialSummary')
              ? row
              : {
                  ...row,
                  plantUnitPriceZar: 0,
                  harvestUnitPriceZar: 0,
                  priceSource: 'Redacted (Farmer financialSummary scope not granted)',
                  initialPlantedValueZar: 0,
                  damagedStockValueZar: 0,
                  remainingStandingValueZar: 0,
                  estimatedHarvestValueZar: 0,
                  storedStockValueZar: 0,
                  salesValueZar: 0,
                  netStockValueChangeZar: 0,
                }
          ),
        livestockStocks: rawStockOverview.livestockStocks
          .filter((row) => hasExpertScope(row.farmId, 'livestock'))
          .map((row) =>
            hasExpertScope(row.farmId, 'financialSummary')
              ? row
              : {
                  ...row,
                  unitPriceZar: 0,
                  priceSource: 'Redacted (Farmer financialSummary scope not granted)',
                  remainingValueZar: 0,
                  deathLossValueZar: 0,
                  netValueChangeZar: 0,
                }
          ),
      };

  const incidents = store.db.farmIncidents
    .filter((inc) => targetSet.has(inc.farmId) && hasExpertScope(inc.farmId, 'incidents'))
    .slice(0, 80)
    .map((inc) => ({
      ...inc,
      estimatedFinancialImpactZar: hasExpertScope(inc.farmId, 'financialSummary')
        ? inc.estimatedFinancialImpactZar
        : 0,
      // Omit large embedded data URLs inside bulk offline pack to keep browser storage fast
      mediaPreviewDataUrl: null,
      farmName: store.db.farms.find((f) => f.id === inc.farmId)?.name || 'Farm',
    }));

  const weatherSnapshots = farms.map((farm) => {
    const canWeather = hasExpertScope(farm.id, 'weather');
    const forecasts = canWeather
      ? store.db.weatherForecastRecords
          .filter((w) => w.farmId === farm.id)
          .sort((a, b) => b.forecastDate.localeCompare(a.forecastDate))
          .slice(0, 7)
      : [];
    const recentObservations = canWeather
      ? store.db.weatherObservations
          .filter((o) => o.farmId === farm.id)
          .sort((a, b) => b.observationDate.localeCompare(a.observationDate))
          .slice(0, 10)
      : [];
    return {
      farmId: farm.id,
      farmName: farm.name,
      snapshotFetchedAt: forecasts[0]?.fetchedAt || downloadedAt,
      forecasts,
      recentObservations,
    };
  });

  const businessPlans = store.db.businessPlans
    .filter((bp) => bp.ownerId === user.id || (bp.farmId && targetSet.has(bp.farmId) && hasExpertScope(bp.farmId, 'financialSummary')))
    .map((bp) => ({
      ...bp,
      farmName: bp.farmId
        ? store.db.farms.find((f) => f.id === bp.farmId)?.name || null
        : null,
      calculation: computeBusinessPlanMetrics(bp),
    }));

  const learningGuides = store.db.learningMaterials
    .filter((m) => m.status === 'published')
    .slice(0, 12)
    .map((m) => resolveMaterialForUser(m, user, user.preferredLanguageCode));

  return {
    bundleVersion: 1,
    userId: user.id,
    downloadedAt,
    staleAfterHours: 24,
    weatherStaleAfterHours: 6,
    internetRequiredNotice:
      'Live weather forecasts, external satellite/ARC feeds, and online Gemini AI analysis require an active internet connection. Cached snapshots below are clearly timestamped.',
    farms,
    crops,
    cropActivities,
    livestockGroups,
    livestockRecords,
    stockOverview,
    incidents,
    weatherSnapshots,
    businessPlans,
    businessPlanTemplates: BUSINESS_ENTERPRISE_TEMPLATES,
    learningGuides,
  };
}

export function processOfflineSyncBatch(params: {
  user: SanitizedUser;
  canModifyFarm: (user: SanitizedUser, farmId: string) => boolean;
  mutations: OfflineMutationInput[];
  ipAddress?: string;
}): { results: OfflineSyncItemResult[]; syncedAt: string } {
  const { user, canModifyFarm, mutations } = params;
  const results: OfflineSyncItemResult[] = [];
  const now = new Date().toISOString();
  const maxMediaMb = store.db.systemConfig.application.maxMediaUploadMb || 15;

  for (const item of mutations) {
    const cid = String(item?.clientMutationId || '').trim();
    if (!cid) {
      results.push({
        clientMutationId: 'missing-id',
        mutationType: String(item?.mutationType || 'unknown'),
        status: 'error',
        serverEntityId: null,
        message: 'Missing clientMutationId; cannot guarantee duplicate prevention.',
      });
      continue;
    }

    const alreadyProcessed = store.db.processedSyncIds.find(
      (p) => p.clientMutationId === cid && p.userId === user.id
    );
    if (alreadyProcessed) {
      results.push({
        clientMutationId: cid,
        mutationType: item.mutationType,
        status: 'already_synced',
        serverEntityId: alreadyProcessed.serverEntityId,
        message: `Already synchronised at ${alreadyProcessed.syncedAt}. Duplicate skipped safely.`,
      });
      continue;
    }

    const p = item.payload || {};
    try {
      let serverEntityId: string | null = null;
      let message = 'Synchronised cleanly.';

      if (item.mutationType === 'crop_activity') {
        const cropId = String(p.cropId || '');
        const crop = store.db.crops.find((c) => c.id === cropId);
        if (!crop) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'error',
            serverEntityId: null,
            message: 'Target crop record was not found on the server.',
          });
          continue;
        }
        if (!canModifyFarm(user, crop.farmId)) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'error',
            serverEntityId: null,
            message: 'Permission denied to modify this farm.',
          });
          continue;
        }
        if (
          item.baseUpdatedAt &&
          !item.forceOverwrite &&
          crop.updatedAt > item.baseUpdatedAt &&
          p.activityType === 'stage_update'
        ) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'conflict',
            serverEntityId: crop.id,
            serverUpdatedAt: crop.updatedAt,
            serverSummary: `${crop.cropName} was updated on the server (${crop.growthStage}) at ${crop.updatedAt}.`,
            message: 'Newer server crop state detected; confirm overwrite or keep server version.',
          });
          continue;
        }

        const actType = String(p.activityType || 'irrigation') as CropActivityType;
        const validTypes: CropActivityType[] = [
          'stage_update',
          'irrigation',
          'fertiliser',
          'pest',
          'disease',
          'damage',
          'harvest',
        ];
        if (!validTypes.includes(actType)) {
          throw new Error('Invalid crop activity type.');
        }
        const qty = Math.max(0, Number(p.quantity) || 0);
        const val = Math.max(0, Number(p.valueZar) || 0);
        const actDate = String(p.activityDate || now.slice(0, 10)).slice(0, 10);

        if (
          actType === 'stage_update' &&
          typeof p.newGrowthStage === 'string' &&
          ['planted', 'germination', 'vegetative', 'flowering', 'fruiting', 'mature', 'harvested'].includes(
            p.newGrowthStage
          )
        ) {
          crop.growthStage = p.newGrowthStage as CropGrowthStage;
          if (p.newGrowthStage === 'harvested') crop.status = 'harvested';
        }
        if (actType === 'damage' && qty > 0) {
          recordCropStockMovement({
            crop,
            actorUserId: user.id,
            movementType: 'damage',
            movementDate: actDate,
            quantity: qty,
            unit: String(p.unit || 'plants'),
            notes: `[Offline Sync] ${String(p.notes || 'Crop damage logged offline').trim()}`,
          });
        } else if (actType === 'harvest' && qty > 0) {
          recordCropStockMovement({
            crop,
            actorUserId: user.id,
            movementType: 'harvest',
            movementDate: actDate,
            quantity: qty,
            unit: String(p.unit || 'kg'),
            unitPriceZar: val > 0 ? Number((val / qty).toFixed(2)) : undefined,
            notes: `[Offline Sync] ${String(p.notes || 'Harvest logged offline').trim()}`,
          });
          crop.growthStage = 'harvested';
          crop.status = 'harvested';
        }
        crop.updatedAt = now;

        const actId = `cact-${crypto.randomUUID()}`;
        store.db.cropActivities.unshift({
          id: actId,
          cropId: crop.id,
          farmId: crop.farmId,
          fieldId: crop.fieldId,
          actorUserId: user.id,
          activityType: actType,
          activityDate: actDate,
          quantity: qty,
          unit: String(p.unit || 'units'),
          valueZar: val,
          notes: `${String(p.notes || '').trim()} [Captured offline ${item.createdAt.slice(0, 10)}]`.trim(),
          snapshot: null,
          createdAt: now,
        });
        serverEntityId = actId;
        message = `Synced crop activity (${actType}) for ${crop.cropName}.`;
      } else if (item.mutationType === 'crop_update') {
        const cropId = String(p.cropId || '');
        const crop = store.db.crops.find((c) => c.id === cropId);
        if (!crop) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'error',
            serverEntityId: null,
            message: 'Target crop record not found.',
          });
          continue;
        }
        if (!canModifyFarm(user, crop.farmId)) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'error',
            serverEntityId: null,
            message: 'Permission denied.',
          });
          continue;
        }
        if (item.baseUpdatedAt && !item.forceOverwrite && crop.updatedAt > item.baseUpdatedAt) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'conflict',
            serverEntityId: crop.id,
            serverUpdatedAt: crop.updatedAt,
            serverSummary: `${crop.cropName} (Stage: ${crop.growthStage}, Harvested: ${crop.harvestedQuantityKg} kg) was updated on the server at ${crop.updatedAt}.`,
            message: 'Server has a newer crop update. Choose Keep Server or Overwrite.',
          });
          continue;
        }
        const prevDamaged = crop.damagedPlants;
        const prevHarvested = crop.harvestedQuantityKg;
        if (
          typeof p.growthStage === 'string' &&
          ['planted', 'germination', 'vegetative', 'flowering', 'fruiting', 'mature', 'harvested'].includes(
            p.growthStage
          )
        ) {
          crop.growthStage = p.growthStage as CropGrowthStage;
          if (p.growthStage === 'harvested') crop.status = 'harvested';
        }
        if (p.damagedPlants !== undefined) {
          crop.damagedPlants = Math.max(0, Math.min(crop.plantingQuantity, Number(p.damagedPlants) || 0));
        }
        if (p.harvestedQuantityKg !== undefined) {
          crop.harvestedQuantityKg = Math.max(0, Number(p.harvestedQuantityKg) || 0);
        }
        crop.updatedAt = now;
        if (crop.damagedPlants !== prevDamaged) {
          const dmgDelta = crop.damagedPlants - prevDamaged;
          store.db.cropStockMovements.unshift({
            id: `csm-${crypto.randomUUID()}`,
            cropId: crop.id,
            farmId: crop.farmId,
            actorUserId: user.id,
            movementType: dmgDelta > 0 ? 'damage' : 'adjustment',
            movementDate: now.slice(0, 10),
            quantityDelta: -dmgDelta,
            unit: 'plants',
            unitPriceZar: 0,
            totalValueZar: 0,
            resultingRemainingPlants: Math.max(0, crop.plantingQuantity - crop.damagedPlants),
            resultingStoredKg: null,
            notes: `Damaged plants updated via offline crop edit (${prevDamaged} -> ${crop.damagedPlants}).`,
            incidentId: null,
            createdAt: now,
          });
        }
        if (crop.harvestedQuantityKg !== prevHarvested) {
          const kgDelta = Number((crop.harvestedQuantityKg - prevHarvested).toFixed(2));
          store.db.cropStockMovements.unshift({
            id: `csm-${crypto.randomUUID()}`,
            cropId: crop.id,
            farmId: crop.farmId,
            actorUserId: user.id,
            movementType: kgDelta > 0 ? 'harvest' : 'adjustment',
            movementDate: now.slice(0, 10),
            quantityDelta: kgDelta,
            unit: 'kg',
            unitPriceZar: 0,
            totalValueZar: 0,
            resultingRemainingPlants: null,
            resultingStoredKg: crop.harvestedQuantityKg,
            notes: `Harvested kg updated via offline crop edit (${prevHarvested} -> ${crop.harvestedQuantityKg} kg).`,
            incidentId: null,
            createdAt: now,
          });
        }
        serverEntityId = crop.id;
        message = `Updated ${crop.cropName} from offline edit.`;
      } else if (item.mutationType === 'livestock_record') {
        const groupId = String(p.livestockGroupId || '');
        const group = store.db.livestockGroups.find((g) => g.id === groupId);
        if (!group) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'error',
            serverEntityId: null,
            message: 'Target livestock group not found on server.',
          });
          continue;
        }
        if (!canModifyFarm(user, group.farmId)) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'error',
            serverEntityId: null,
            message: 'Permission denied to update livestock on this farm.',
          });
          continue;
        }
        if (item.baseUpdatedAt && !item.forceOverwrite && group.updatedAt > item.baseUpdatedAt) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'conflict',
            serverEntityId: group.id,
            serverUpdatedAt: group.updatedAt,
            serverSummary: `${group.groupName} currently has ${group.quantity} head (updated ${group.updatedAt}).`,
            message: 'Livestock herd was updated on the server after your offline download.',
          });
          continue;
        }
        const recType = String(p.recordType || 'Feeding') as LivestockRecordType;
        const validRecs: LivestockRecordType[] = [
          'Birth',
          'Death',
          'Purchase',
          'Sale',
          'Transfer',
          'Feeding',
          'Veterinary',
          'Vaccination',
          'Production',
        ];
        if (!validRecs.includes(recType)) {
          throw new Error('Invalid livestock record type.');
        }
        const absCount = Math.max(0, Number(p.count) || 0);
        let quantityChange = 0;
        if (recType === 'Birth' || recType === 'Purchase') {
          quantityChange = absCount;
        } else if (recType === 'Death' || recType === 'Sale' || recType === 'Transfer') {
          quantityChange = -Math.min(group.quantity, absCount);
        }
        group.quantity = Math.max(0, group.quantity + quantityChange);
        group.updatedAt = now;

        const recId = `lrec-${crypto.randomUUID()}`;
        store.db.livestockRecords.unshift({
          id: recId,
          livestockGroupId: group.id,
          farmId: group.farmId,
          actorUserId: user.id,
          recordType: recType,
          recordDate: String(p.recordDate || now.slice(0, 10)).slice(0, 10),
          quantityChange,
          productionAmount: Math.max(0, Number(p.productionAmount) || 0),
          productionUnit: String(p.productionUnit || ''),
          valueZar: Math.max(0, Number(p.valueZar) || 0),
          notes: `${String(p.notes || '').trim()} [Captured offline]`.trim(),
          createdAt: now,
        });
        serverEntityId = recId;
        message = `Synced livestock ${recType} record for ${group.groupName}.`;
      } else if (item.mutationType === 'mixed_entry') {
        const farmId = String(p.farmId || '');
        if (!canModifyFarm(user, farmId)) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'error',
            serverEntityId: null,
            message: 'Permission denied for selected farm.',
          });
          continue;
        }
        const validCats: MixedEntryCategory[] = [
          'feed_production',
          'shared_land',
          'water_management',
          'combined_expense',
          'combined_production',
        ];
        const cat = String(p.entryCategory || 'combined_production') as MixedEntryCategory;
        if (!validCats.includes(cat) || !String(p.title || '').trim()) {
          throw new Error('Mixed farming category and title are required.');
        }
        const mixId = `mix-${crypto.randomUUID()}`;
        store.db.mixedFarmingEntries.unshift({
          id: mixId,
          farmId,
          ownerId: user.id,
          entryCategory: cat,
          title: String(p.title).trim(),
          entryDate: String(p.entryDate || now.slice(0, 10)).slice(0, 10),
          relatedCropId: p.relatedCropId ? String(p.relatedCropId) : null,
          relatedLivestockId: p.relatedLivestockId ? String(p.relatedLivestockId) : null,
          expenseZar: Math.max(0, Number(p.expenseZar) || 0),
          productionQuantity: Math.max(0, Number(p.productionQuantity) || 0),
          productionUnit: String(p.productionUnit || ''),
          waterLiters: Math.max(0, Number(p.waterLiters) || 0),
          notes: `${String(p.notes || '').trim()} [Captured offline]`.trim(),
          createdAt: now,
        });
        serverEntityId = mixId;
        message = `Synced mixed farming entry "${String(p.title).trim()}".`;
      } else if (item.mutationType === 'farm_incident') {
        const farmId = String(p.farmId || '');
        if (!canModifyFarm(user, farmId)) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'error',
            serverEntityId: null,
            message: 'Permission denied to log incidents for this farm.',
          });
          continue;
        }
        const mediaCheck = validateSafeMediaDataUrl(
          typeof p.mediaPreviewDataUrl === 'string' ? p.mediaPreviewDataUrl : null,
          maxMediaMb,
          false
        );
        if (!mediaCheck.valid) {
          throw new Error(mediaCheck.error || 'Unsafe offline incident media.');
        }
        const inc = createFarmIncident({
          user,
          farmId,
          fieldId: p.fieldId ? String(p.fieldId) : null,
          cropId: p.cropId ? String(p.cropId) : null,
          livestockGroupId: p.livestockGroupId ? String(p.livestockGroupId) : null,
          incidentType: String(p.incidentType || 'storm_damage') as IncidentType,
          title: String(p.title || 'Offline Captured Farm Incident').trim(),
          occurredAt: String(p.occurredAt || item.createdAt || now),
          description: `${String(p.description || 'Captured offline').trim()} [Synced from offline log]`,
          mediaFileName: p.mediaFileName ? String(p.mediaFileName) : null,
          mediaType: p.mediaType === 'image' ? 'image' : null,
          mediaPreviewDataUrl: mediaCheck.sanitizedUrl || null,
          affectedQuantity: Number(p.affectedQuantity) || 0,
          affectedUnit: String(p.affectedUnit || 'units'),
          affectedAreaHectares: Number(p.affectedAreaHectares) || 0,
          estimatedFinancialImpactZar: Number(p.estimatedFinancialImpactZar) || 0,
          recommendedActions: Array.isArray(p.recommendedActions)
            ? p.recommendedActions.map(String)
            : [],
          status: ['active', 'monitoring', 'resolved'].includes(String(p.status))
            ? (String(p.status) as 'active' | 'monitoring' | 'resolved')
            : 'active',
          ipAddress: params.ipAddress,
        });
        serverEntityId = inc.id;
        message = `Synced incident "${inc.title}".`;
      } else if (item.mutationType === 'weather_observation') {
        const farmId = String(p.farmId || '');
        if (!canModifyFarm(user, farmId)) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'error',
            serverEntityId: null,
            message: 'Permission denied to log weather observations for this farm.',
          });
          continue;
        }
        const createdObs = submitFarmerWeatherObservation({
          user,
          farmId,
          observationDate: String(p.observationDate || now.slice(0, 10)).slice(0, 10),
          rainfallOccurred: Boolean(p.rainfallOccurred),
          rainfallIntensity: (String(p.rainfallIntensity || 'none') as RainfallIntensity),
          measuredRainfallMm:
            p.measuredRainfallMm === null || p.measuredRainfallMm === undefined || p.measuredRainfallMm === ''
              ? null
              : Number(p.measuredRainfallMm),
          temperatureC:
            p.temperatureC === null || p.temperatureC === undefined || p.temperatureC === ''
              ? null
              : Number(p.temperatureC),
          windObservation: String(p.windObservation || 'light_breeze') as WindObservationLevel,
          windSpeedEstimateKmh:
            p.windSpeedEstimateKmh === null || p.windSpeedEstimateKmh === undefined
              ? null
              : Number(p.windSpeedEstimateKmh),
          notes: `${String(p.notes || '').trim()} [Farmer observation captured offline]`.trim(),
        });
        serverEntityId = createdObs.id;
        message = `Synced farmer weather observation for ${createdObs.observationDate}.`;
      } else if (item.mutationType === 'crop_stock_movement') {
        const cropId = String(p.cropId || '');
        const crop = store.db.crops.find((c) => c.id === cropId);
        if (!crop || !canModifyFarm(user, crop.farmId)) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'error',
            serverEntityId: null,
            message: 'Crop not found or access denied.',
          });
          continue;
        }
        const move = recordCropStockMovement({
          crop,
          actorUserId: user.id,
          movementType: String(p.movementType || 'adjustment') as CropStockMovementType,
          movementDate: String(p.movementDate || now.slice(0, 10)).slice(0, 10),
          quantity: Number(p.quantity) || 0,
          unit: String(p.unit || 'kg'),
          unitPriceZar: p.unitPriceZar !== undefined ? Number(p.unitPriceZar) : undefined,
          notes: `${String(p.notes || '').trim()} [Offline stock log]`.trim(),
        });
        serverEntityId = move.id;
        message = `Synced stock movement (${move.movementType}) for ${crop.cropName}.`;
      } else if (item.mutationType === 'business_plan_upsert') {
        const existingId = p.id ? String(p.id) : null;
        const existingPlan = existingId
          ? store.db.businessPlans.find((bp) => bp.id === existingId && bp.ownerId === user.id)
          : null;
        if (
          existingPlan &&
          item.baseUpdatedAt &&
          !item.forceOverwrite &&
          existingPlan.updatedAt > item.baseUpdatedAt
        ) {
          results.push({
            clientMutationId: cid,
            mutationType: item.mutationType,
            status: 'conflict',
            serverEntityId: existingPlan.id,
            serverUpdatedAt: existingPlan.updatedAt,
            serverSummary: `Business plan "${existingPlan.planName}" was updated online at ${existingPlan.updatedAt}.`,
            message: 'Server has a newer version of this business plan.',
          });
          continue;
        }
        const targetPlan: BusinessPlanScenario = existingPlan || {
          id: `bplan-${crypto.randomUUID()}`,
          ownerId: user.id,
          farmId: p.farmId ? String(p.farmId) : null,
          planName: String(p.planName || 'Offline Farm Business Plan').trim(),
          farmingType: String(p.farmingType || 'horticulture_veg'),
          scaleTier: (['small_scale', 'medium_scale', 'large_scale'].includes(String(p.scaleTier))
            ? String(p.scaleTier)
            : 'small_scale') as BusinessScaleTier,
          province: String(p.province || user.profile?.province || 'KwaZulu-Natal'),
          district: String(p.district || user.profile?.district || 'uMgungundlovu District'),
          farmSizeHectares: Math.max(0.1, Number(p.farmSizeHectares) || 1),
          productionGoals: String(p.productionGoals || 'Seasonal commercial output'),
          marketChannel: String(p.marketChannel || 'Regional fresh produce market'),
          equipmentCostZar: Math.max(0, Number(p.equipmentCostZar) || 0),
          equipmentNotes: String(p.equipmentNotes || ''),
          seedsPlantingCostZar: Math.max(0, Number(p.seedsPlantingCostZar) || 0),
          fertilisersCostZar: Math.max(0, Number(p.fertilisersCostZar) || 0),
          feedCostZar: Math.max(0, Number(p.feedCostZar) || 0),
          waterCostZar: Math.max(0, Number(p.waterCostZar) || 0),
          waterDemandM3: Math.max(0, Number(p.waterDemandM3) || 0),
          labourWorkers: Math.max(0, Number(p.labourWorkers) || 1),
          labourCostZar: Math.max(0, Number(p.labourCostZar) || 0),
          infrastructureCostZar: Math.max(0, Number(p.infrastructureCostZar) || 0),
          operatingExpensesZar: Math.max(0, Number(p.operatingExpensesZar) || 0),
          expectedProductionQty: Math.max(0, Number(p.expectedProductionQty) || 0),
          productionUnit: String(p.productionUnit || 'kg'),
          sellingPricePerUnitZar: Math.max(0, Number(p.sellingPricePerUnitZar) || 0),
          assumptionsNotes: String(p.assumptionsNotes || 'Created offline; planning estimate only.'),
          createdAt: now,
          updatedAt: now,
        };
        if (existingPlan) {
          targetPlan.planName = String(p.planName || targetPlan.planName).trim();
          targetPlan.farmSizeHectares = Math.max(0.1, Number(p.farmSizeHectares ?? targetPlan.farmSizeHectares));
          targetPlan.operatingExpensesZar = Math.max(0, Number(p.operatingExpensesZar ?? targetPlan.operatingExpensesZar));
          targetPlan.expectedProductionQty = Math.max(0, Number(p.expectedProductionQty ?? targetPlan.expectedProductionQty));
          targetPlan.sellingPricePerUnitZar = Math.max(0, Number(p.sellingPricePerUnitZar ?? targetPlan.sellingPricePerUnitZar));
          targetPlan.updatedAt = now;
        } else {
          store.db.businessPlans.unshift(targetPlan);
        }
        serverEntityId = targetPlan.id;
        message = `Synced farming business plan "${targetPlan.planName}".`;
      } else {
        throw new Error(`Unsupported offline mutation type: ${item.mutationType}`);
      }

      store.db.processedSyncIds.unshift({
        clientMutationId: cid,
        userId: user.id,
        mutationType: item.mutationType,
        serverEntityId,
        syncedAt: now,
      });
      if (store.db.processedSyncIds.length > 2000) {
        store.db.processedSyncIds = store.db.processedSyncIds.slice(0, 2000);
      }

      results.push({
        clientMutationId: cid,
        mutationType: item.mutationType,
        status: 'synced',
        serverEntityId,
        message,
      });
    } catch (err: unknown) {
      results.push({
        clientMutationId: cid,
        mutationType: String(item.mutationType),
        status: 'error',
        serverEntityId: null,
        message: err instanceof Error ? err.message : 'Synchronisation failed for this record.',
      });
    }
  }

  store.logAudit(
    user.id,
    'OFFLINE_SYNC_BATCH_PROCESSED',
    'OfflineSync',
    null,
    {
      total: mutations.length,
      synced: results.filter((r) => r.status === 'synced').length,
      duplicatesSkipped: results.filter((r) => r.status === 'already_synced').length,
      conflicts: results.filter((r) => r.status === 'conflict').length,
      errors: results.filter((r) => r.status === 'error').length,
    },
    params.ipAddress || '127.0.0.1'
  );
  store.save();

  return { results, syncedAt: now };
}
