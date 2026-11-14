import crypto from 'node:crypto';
import { recordCropStockMovement } from './stockInventory.ts';
import { store } from './store.ts';
import {
  FarmIncident,
  IncidentFollowUp,
  IncidentStatus,
  IncidentType,
  SanitizedUser,
} from './types.ts';

export function buildIncidentDashboard(
  accessibleFarmIds: string[],
  farmFilter?: string | null,
  redactFinancialFarmIds?: Set<string>
) {
  const targetIds = farmFilter
    ? accessibleFarmIds.filter((id) => id === farmFilter)
    : accessibleFarmIds;

  const incidents = store.db.farmIncidents
    .filter((i) => targetIds.includes(i.farmId))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((inc) => {
      const farm = store.db.farms.find((f) => f.id === inc.farmId);
      const field = inc.fieldId ? store.db.fields.find((fl) => fl.id === inc.fieldId) : null;
      const crop = inc.cropId ? store.db.crops.find((c) => c.id === inc.cropId) : null;
      const livestock = inc.livestockGroupId
        ? store.db.livestockGroups.find((g) => g.id === inc.livestockGroupId)
        : null;
      const hideFinancial = Boolean(redactFinancialFarmIds?.has(inc.farmId));
      return {
        ...inc,
        estimatedFinancialImpactZar: hideFinancial ? 0 : inc.estimatedFinancialImpactZar,
        farmName: farm?.name || 'Farm',
        fieldName: field?.name || null,
        cropName: crop ? `${crop.cropName} (${crop.cropVariety})` : null,
        livestockGroupName: livestock ? `${livestock.groupName} (${livestock.animalType})` : null,
      };
    });

  const activeCount = incidents.filter((i) => i.status === 'active').length;
  const monitoringCount = incidents.filter((i) => i.status === 'monitoring').length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;
  const totalFinancialImpactZar = Number(
    incidents.reduce((s, i) => s + i.estimatedFinancialImpactZar, 0).toFixed(2)
  );
  const totalAffectedCropPlants = incidents
    .filter((i) => i.cropId && i.affectedUnit.toLowerCase().includes('plant'))
    .reduce((s, i) => s + i.affectedQuantity, 0);
  const totalAffectedLivestockHead = incidents
    .filter((i) => i.livestockGroupId && i.affectedUnit.toLowerCase().includes('head'))
    .reduce((s, i) => s + i.affectedQuantity, 0);
  const totalAffectedHectares = Number(
    incidents.reduce((s, i) => s + i.affectedAreaHectares, 0).toFixed(2)
  );

  const incidentIds = new Set(incidents.map((i) => i.id));
  const targetFarmSet = new Set(targetIds);
  const auditHistory = store.db.auditLogs
    .filter((log) => {
      const d = log.details || {};
      const logFarmId = typeof d.farmId === 'string' ? d.farmId : null;
      if (log.entityType === 'FarmIncident') {
        return (log.entityId && incidentIds.has(log.entityId)) || (logFarmId && targetFarmSet.has(logFarmId));
      }
      if (log.action === 'CROP_STOCK_MOVEMENT' && logFarmId && targetFarmSet.has(logFarmId)) {
        return true;
      }
      return false;
    })
    .slice(0, 50);

  return {
    summary: {
      totalIncidents: incidents.length,
      activeCount,
      monitoringCount,
      resolvedCount,
      totalFinancialImpactZar,
      totalAffectedCropPlants,
      totalAffectedLivestockHead,
      totalAffectedHectares,
    },
    incidents,
    auditHistory,
  };
}

export function createFarmIncident(params: {
  user: SanitizedUser;
  farmId: string;
  fieldId?: string | null;
  cropId?: string | null;
  livestockGroupId?: string | null;
  visualAnalysisId?: string | null;
  incidentType: IncidentType;
  title: string;
  occurredAt: string;
  description: string;
  mediaFileName?: string | null;
  mediaType?: 'image' | 'video' | null;
  mediaPreviewDataUrl?: string | null;
  affectedQuantity: number;
  affectedUnit: string;
  affectedAreaHectares: number;
  estimatedFinancialImpactZar: number;
  recommendedActions: string[];
  status?: IncidentStatus;
  ipAddress?: string;
}): FarmIncident {
  const now = new Date().toISOString();
  const incId = `inc-${crypto.randomUUID()}`;
  const qty = Math.max(0, Number(params.affectedQuantity) || 0);
  const areaHa = Math.max(0, Number(params.affectedAreaHectares) || 0);
  const impactZar = Math.max(0, Number(params.estimatedFinancialImpactZar) || 0);

  let originalRecordedQuantity: number | null = null;
  let remainingRecordedQuantity: number | null = null;

  // Validated crop damage tracking preserving original planted quantity
  if (params.cropId && qty > 0) {
    const crop = store.db.crops.find(
      (c) => c.id === params.cropId && c.farmId === params.farmId
    );
    if (crop) {
      originalRecordedQuantity = crop.plantingQuantity;
      const beforeRemaining = Math.max(0, crop.plantingQuantity - crop.damagedPlants);
      const appliedDamage = Math.min(beforeRemaining, qty);

      // Update crop stock movement & damaged count cleanly without overwriting original plantingQuantity
      recordCropStockMovement({
        crop,
        actorUserId: params.user.id,
        movementType: 'damage',
        movementDate: params.occurredAt.slice(0, 10),
        quantity: appliedDamage,
        unit: 'plants',
        notes: `Incident (${params.incidentType}): ${params.title}`,
        incidentId: incId,
      });

      remainingRecordedQuantity = Math.max(0, crop.plantingQuantity - crop.damagedPlants);

      // Also append immutable CropActivity snapshot
      store.db.cropActivities.unshift({
        id: `cact-${crypto.randomUUID()}`,
        cropId: crop.id,
        farmId: crop.farmId,
        fieldId: crop.fieldId,
        actorUserId: params.user.id,
        activityType:
          params.incidentType === 'pest_outbreak'
            ? 'pest'
            : params.incidentType === 'crop_disease'
            ? 'disease'
            : 'damage',
        activityDate: params.occurredAt.slice(0, 10),
        quantity: appliedDamage,
        unit: 'plants',
        valueZar: impactZar,
        notes: `${params.title}: ${params.description}`,
        snapshot: {
          originalPlantedQty: crop.plantingQuantity,
          previousRemainingPlants: beforeRemaining,
          newDamagedQty: appliedDamage,
          remainingRecordedQuantity,
        },
        createdAt: now,
      });
    }
  }

  // Validated livestock incident tracking preserving original herd/flock records
  if (params.livestockGroupId) {
    const group = store.db.livestockGroups.find(
      (g) => g.id === params.livestockGroupId && g.farmId === params.farmId
    );
    if (group) {
      originalRecordedQuantity = group.quantity;
      if (params.incidentType === 'livestock_death' && qty > 0) {
        const lossCount = Math.min(group.quantity, Math.round(qty));
        group.quantity = Math.max(0, group.quantity - lossCount);
        group.updatedAt = now;
        remainingRecordedQuantity = group.quantity;

        store.db.livestockRecords.unshift({
          id: `lrec-${crypto.randomUUID()}`,
          livestockGroupId: group.id,
          farmId: group.farmId,
          actorUserId: params.user.id,
          recordType: 'Death',
          recordDate: params.occurredAt.slice(0, 10),
          quantityChange: -lossCount,
          productionAmount: 0,
          productionUnit: '',
          valueZar: impactZar || lossCount * group.estimatedUnitValueZar,
          notes: `Incident (${params.title}): ${params.description}`,
          createdAt: now,
        });
      } else if (params.incidentType === 'livestock_illness') {
        if (group.healthStatus === 'Healthy') {
          group.healthStatus = 'Under Observation';
          group.updatedAt = now;
        }
        remainingRecordedQuantity = group.quantity;
        store.db.livestockRecords.unshift({
          id: `lrec-${crypto.randomUUID()}`,
          livestockGroupId: group.id,
          farmId: group.farmId,
          actorUserId: params.user.id,
          recordType: 'Veterinary',
          recordDate: params.occurredAt.slice(0, 10),
          quantityChange: 0,
          productionAmount: 0,
          productionUnit: '',
          valueZar: impactZar,
          notes: `Health Incident (${params.title}): ${params.description}`,
          createdAt: now,
        });
      }
    }
  }

  const incident: FarmIncident = {
    id: incId,
    farmId: params.farmId,
    fieldId: params.fieldId || null,
    cropId: params.cropId || null,
    livestockGroupId: params.livestockGroupId || null,
    visualAnalysisId: params.visualAnalysisId || null,
    ownerId: params.user.id,
    incidentType: params.incidentType,
    title: params.title.trim(),
    occurredAt: params.occurredAt || now,
    description: params.description.trim(),
    mediaFileName: params.mediaFileName || null,
    mediaType: params.mediaType || null,
    mediaPreviewDataUrl: params.mediaPreviewDataUrl || null,
    affectedQuantity: qty,
    affectedUnit: params.affectedUnit || 'units',
    affectedAreaHectares: areaHa,
    originalRecordedQuantity,
    remainingRecordedQuantity,
    estimatedFinancialImpactZar: impactZar,
    recommendedActions: params.recommendedActions.filter(Boolean),
    status: params.status || 'active',
    followUps: [],
    createdAt: now,
    updatedAt: now,
  };

  store.db.farmIncidents.unshift(incident);

  if (params.visualAnalysisId) {
    const va = store.db.visualAnalyses.find((v) => v.id === params.visualAnalysisId);
    if (va) va.linkedIncidentId = incId;
  }

  store.logAudit(
    params.user.id,
    'FARM_INCIDENT_RECORDED',
    'FarmIncident',
    incId,
    {
      farmId: params.farmId,
      incidentType: params.incidentType,
      affectedQuantity: qty,
      originalRecordedQuantity,
      remainingRecordedQuantity,
      estimatedFinancialImpactZar: impactZar,
    },
    params.ipAddress || '127.0.0.1'
  );

  return incident;
}

export function addIncidentFollowUp(params: {
  incident: FarmIncident;
  user: SanitizedUser;
  followUpDate: string;
  statusAfter: IncidentStatus;
  actionTaken: string;
  notes: string;
  ipAddress?: string;
}): IncidentFollowUp {
  const now = new Date().toISOString();
  const followUp: IncidentFollowUp = {
    id: `fu-${crypto.randomUUID()}`,
    incidentId: params.incident.id,
    actorUserId: params.user.id,
    actorName: params.user.profile?.fullName || params.user.email,
    followUpDate: params.followUpDate || now.slice(0, 10),
    statusAfter: params.statusAfter,
    actionTaken: params.actionTaken.trim(),
    notes: params.notes.trim(),
    createdAt: now,
  };

  params.incident.followUps.unshift(followUp);
  params.incident.status = params.statusAfter;
  params.incident.updatedAt = now;

  store.logAudit(
    params.user.id,
    'INCIDENT_FOLLOW_UP_ADDED',
    'FarmIncident',
    params.incident.id,
    { farmId: params.incident.farmId, statusAfter: params.statusAfter, actionTaken: followUp.actionTaken },
    params.ipAddress || '127.0.0.1'
  );

  return followUp;
}
