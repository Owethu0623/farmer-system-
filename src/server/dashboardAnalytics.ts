import { buildIncidentDashboard } from './incidents.ts';
import { buildLearningCentrePayload } from './learningCentre.ts';
import { FARMING_OPPORTUNITIES, SOUTH_AFRICA_PROVINCES } from './southAfricaData.ts';
import { buildStockOverview } from './stockInventory.ts';
import { store } from './store.ts';
import { SanitizedUser } from './types.ts';
import { getFarmWeatherIntelligence } from './weather.ts';

function inDateRange(dateStr: string | null | undefined, startDate: string, endDate: string): boolean {
  if (!dateStr) return true;
  const d = dateStr.slice(0, 10);
  if (startDate && d < startDate) return false;
  if (endDate && d > endDate) return false;
  return true;
}

function matchesCategory(
  categoryFilter: string,
  domain: 'crops' | 'livestock' | 'mixed' | 'weather' | 'incidents'
): boolean {
  if (!categoryFilter || categoryFilter === 'all') return true;
  return categoryFilter === domain;
}

export async function buildExistingFarmerDashboard(params: {
  user: SanitizedUser;
  accessibleFarmIds: string[];
  farmId?: string;
  fieldId?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
}) {
  const { user, accessibleFarmIds } = params;
  const farmFilter = params.farmId && params.farmId !== 'all' ? params.farmId : 'all';
  const fieldFilter = params.fieldId && params.fieldId !== 'all' ? params.fieldId : 'all';
  const startDate = params.startDate || '';
  const endDate = params.endDate || '';
  const category = params.category || 'all';

  const targetFarmIds =
    farmFilter !== 'all' && accessibleFarmIds.includes(farmFilter)
      ? [farmFilter]
      : accessibleFarmIds;

  const farms = store.db.farms.filter((f) => targetFarmIds.includes(f.id));
  const fields = store.db.fields.filter(
    (fl) => targetFarmIds.includes(fl.farmId) && (fieldFilter === 'all' || fl.id === fieldFilter)
  );

  // Build stock overview from real ledger records
  const stockOverview = buildStockOverview(targetFarmIds);
  const incidentDash = buildIncidentDashboard(targetFarmIds);

  // Filter crops
  const includeCrops = matchesCategory(category, 'crops') || matchesCategory(category, 'mixed');
  const rawCrops = includeCrops
    ? store.db.crops.filter(
        (c) =>
          targetFarmIds.includes(c.farmId) &&
          (fieldFilter === 'all' || c.fieldId === fieldFilter) &&
          inDateRange(c.plantingDate, startDate, endDate)
      )
    : [];

  const registeredCrops = rawCrops.map((c) => {
    const farm = farms.find((f) => f.id === c.farmId);
    const field = store.db.fields.find((fl) => fl.id === c.fieldId);
    const stockRow = stockOverview.cropStocks.find((s) => s.cropId === c.id);
    return {
      id: c.id,
      farmId: c.farmId,
      farmName: farm?.name || 'Farm',
      fieldName: field?.name || 'Unassigned Field',
      cropName: c.cropName,
      cropVariety: c.cropVariety,
      growthStage: c.growthStage,
      cultivatedAreaHectares: c.cultivatedAreaHectares,
      remainingPlants: stockRow?.remainingPlants ?? Math.max(0, c.plantingQuantity - c.damagedPlants),
      damagedPlants: stockRow?.damagedPlants ?? c.damagedPlants,
      harvestedKg: stockRow?.harvestedKg ?? c.harvestedQuantityKg,
      storedKg: stockRow?.storedProductionKg ?? 0,
      expectedHarvestingDate: c.expectedHarvestingDate,
      estimatedValueZar: stockRow?.remainingStandingValueZar ?? c.estimatedValueZar,
    };
  });

  // Filter livestock
  const includeLivestock = matchesCategory(category, 'livestock') || matchesCategory(category, 'mixed');
  const rawGroups = includeLivestock
    ? store.db.livestockGroups.filter(
        (g) =>
          targetFarmIds.includes(g.farmId) &&
          (fieldFilter === 'all' || g.fieldId === fieldFilter) &&
          inDateRange(g.registrationDate, startDate, endDate)
      )
    : [];

  const livestockByAnimalMap = new Map<
    'Cattle' | 'Sheep' | 'Goats' | 'Pigs' | 'Poultry',
    { quantity: number; estimatedValueZar: number }
  >();
  for (const g of rawGroups) {
    const cur = livestockByAnimalMap.get(g.animalType) || { quantity: 0, estimatedValueZar: 0 };
    cur.quantity += g.quantity;
    cur.estimatedValueZar += Number((g.quantity * g.estimatedUnitValueZar).toFixed(2));
    livestockByAnimalMap.set(g.animalType, cur);
  }
  const byAnimalType = Array.from(livestockByAnimalMap.entries()).map(([animalType, vals]) => ({
    animalType,
    quantity: vals.quantity,
    estimatedValueZar: Number(vals.estimatedValueZar.toFixed(2)),
  }));

  const livestockGroups = rawGroups.map((g) => {
    const farm = farms.find((f) => f.id === g.farmId);
    const row = stockOverview.livestockStocks.find((s) => s.livestockGroupId === g.id);
    return {
      id: g.id,
      farmId: g.farmId,
      farmName: farm?.name || 'Farm',
      groupName: g.groupName,
      animalType: g.animalType,
      breed: g.breed,
      quantity: g.quantity,
      healthStatus: g.healthStatus,
      estimatedValueZar: row?.remainingValueZar ?? Number((g.quantity * g.estimatedUnitValueZar).toFixed(2)),
    };
  });

  // Total land & farming types
  const totalHectares = Number(farms.reduce((s, f) => s + f.farmSizeHectares, 0).toFixed(2));
  const cultivatedHectares = Number(
    rawCrops.reduce((s, c) => s + c.cultivatedAreaHectares, 0).toFixed(2)
  );
  const grazingHectares = Number(
    fields
      .filter((fl) => !rawCrops.some((c) => c.fieldId === fl.id))
      .reduce((s, fl) => s + fl.areaHectares, 0)
      .toFixed(2)
  );
  const farmingTypes = Array.from(new Set(farms.flatMap((f) => f.farmingActivities)));

  // Filtered incidents
  const filteredIncidents = incidentDash.incidents.filter(
    (inc) =>
      (fieldFilter === 'all' || inc.fieldId === fieldFilter) &&
      inDateRange(inc.occurredAt, startDate, endDate) &&
      (category === 'all' ||
        category === 'incidents' ||
        (category === 'crops' && Boolean(inc.cropId)) ||
        (category === 'livestock' && Boolean(inc.livestockGroupId)) ||
        (category === 'weather' &&
          ['heavy_rainfall', 'flooding', 'storm_damage', 'drought'].includes(inc.incidentType)))
  );
  const activeIncidentsCount = filteredIncidents.filter((i) => i.status !== 'resolved').length;

  // Weather summary & warnings for primary target farm
  const focusFarm = farms[0] || null;
  let weatherSummary = {
    farmName: focusFarm?.name || 'No farm selected',
    locationLabel: 'South Africa',
    forecastSummary: 'Select or register a farm with coordinates to retrieve local weather.',
    latestTemperatureC: null as number | null,
    latestRainForecastMm: null as number | null,
    latestFarmerReport: null as (typeof store.db.weatherObservations)[number] | null,
    activeWarnings: [] as {
      id: string;
      title: string;
      severity: 'info' | 'warning' | 'critical';
      source: string;
      detail: string;
    }[],
  };

  if (focusFarm) {
    const loc = store.db.farmLocations.find((l) => l.farmId === focusFarm.id);
    const farmObs = store.db.weatherObservations
      .filter((o) => o.farmId === focusFarm.id && inDateRange(o.observationDate, startDate, endDate))
      .sort((a, b) => b.observationDate.localeCompare(a.observationDate));

    try {
      const w = await getFarmWeatherIntelligence(focusFarm.id);
      const todayDaily = w.daily[0] || null;
      const rain7d = Number(
        w.daily
          .slice(0, 7)
          .reduce((s, d) => s + d.precipitationMm, 0)
          .toFixed(1)
      );
      weatherSummary = {
        farmName: focusFarm.name,
        locationLabel: loc ? `${loc.townOrVillage}, ${loc.province}` : 'South Africa',
        forecastSummary: w.serviceAvailable
          ? `${w.current?.weatherDescription || 'Forecast loaded'} · 7-day rain ${rain7d} mm`
          : w.unavailableReason || 'Live weather feed temporarily unavailable — using stored snapshots.',
        latestTemperatureC: w.current?.temperatureC ?? todayDaily?.tempMaxC ?? null,
        latestRainForecastMm: todayDaily?.precipitationMm ?? null,
        latestFarmerReport: farmObs[0] || null,
        activeWarnings: w.warnings.map((warn) => ({
          id: warn.id,
          title: warn.title,
          severity:
            warn.severity === 'High'
              ? ('critical' as const)
              : warn.severity === 'Moderate'
              ? ('warning' as const)
              : ('info' as const),
          source: 'Forecast Threshold Rule',
          detail: warn.whatIsHappening,
        })),
      };
    } catch {
      const latestFc = store.db.weatherForecastRecords
        .filter((r) => r.farmId === focusFarm.id)
        .sort((a, b) => b.forecastDate.localeCompare(a.forecastDate))[0];
      weatherSummary = {
        farmName: focusFarm.name,
        locationLabel: loc ? `${loc.townOrVillage}, ${loc.province}` : 'South Africa',
        forecastSummary: latestFc
          ? `Stored forecast (${latestFc.forecastDate}): ${latestFc.weatherDescription}`
          : 'No forecast snapshot cached yet.',
        latestTemperatureC: latestFc?.predictedTempMaxC ?? null,
        latestRainForecastMm: latestFc?.predictedRainfallMm ?? null,
        latestFarmerReport: farmObs[0] || null,
        activeWarnings: [],
      };
    }

    // Add active severe incident warnings alongside weather warnings
    for (const inc of filteredIncidents.filter((i) => i.status === 'active').slice(0, 3)) {
      weatherSummary.activeWarnings.push({
        id: `warn-inc-${inc.id}`,
        title: `Active Incident: ${inc.title}`,
        severity: inc.estimatedFinancialImpactZar >= 10000 ? 'critical' : 'warning',
        source: 'Farm Incident Ledger',
        detail: `${inc.affectedQuantity} ${inc.affectedUnit} affected · Status: ${inc.status}`,
      });
    }
  }

  // Upcoming activities derived from crop harvest schedules, active incident follow-ups, and weather/soil checks
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingActivities: {
    id: string;
    dueDate: string;
    farmName: string;
    category: 'harvest' | 'incident_follow_up' | 'weather_check' | 'soil_sampling';
    title: string;
    detail: string;
  }[] = [];

  for (const crop of registeredCrops) {
    if (crop.growthStage !== 'harvested' && crop.expectedHarvestingDate) {
      upcomingActivities.push({
        id: `up-crop-${crop.id}`,
        dueDate: crop.expectedHarvestingDate,
        farmName: crop.farmName,
        category: 'harvest',
        title: `Expected Harvest: ${crop.cropName} (${crop.cropVariety})`,
        detail: `${crop.fieldName} · ${crop.remainingPlants.toLocaleString()} standing plants · Stage: ${crop.growthStage}`,
      });
    }
  }

  for (const inc of filteredIncidents.filter((i) => i.status !== 'resolved')) {
    upcomingActivities.push({
      id: `up-inc-${inc.id}`,
      dueDate: inc.occurredAt.slice(0, 10),
      farmName: inc.farmName || 'Farm',
      category: 'incident_follow_up',
      title: `Incident Follow-Up: ${inc.title}`,
      detail: inc.recommendedActions[0] || 'Inspect affected block and record follow-up progress.',
    });
  }

  for (const f of farms) {
    const hasLab = store.db.soilReports.some((r) => r.farmId === f.id);
    if (!hasLab) {
      upcomingActivities.push({
        id: `up-soil-${f.id}`,
        dueDate: todayIso,
        farmName: f.name,
        category: 'soil_sampling',
        title: `Submit Composite Soil Sample (${f.name})`,
        detail: 'No laboratory soil analysis uploaded yet for this farm.',
      });
    }
  }

  upcomingActivities.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Crop & Livestock Stock Values (strictly filtered & labeled as Estimated)
  const cropIdsSet = new Set(rawCrops.map((c) => c.id));
  const groupIdsSet = new Set(rawGroups.map((g) => g.id));
  const filteredCropStocks = stockOverview.cropStocks.filter((s) => cropIdsSet.has(s.cropId));
  const filteredLivestockStocks = stockOverview.livestockStocks.filter((s) =>
    groupIdsSet.has(s.livestockGroupId)
  );

  const estimatedCropStockValueZar = Number(
    filteredCropStocks
      .reduce((s, c) => s + c.remainingStandingValueZar + c.storedStockValueZar, 0)
      .toFixed(2)
  );
  const estimatedLivestockValueZar = Number(
    filteredLivestockStocks.reduce((s, l) => s + l.remainingValueZar, 0).toFixed(2)
  );
  const estimatedTotalStockValueZar = Number(
    (estimatedCropStockValueZar + estimatedLivestockValueZar).toFixed(2)
  );

  // Actual Expenses (from real database ledgers)
  const mixedEntries = store.db.mixedFarmingEntries.filter(
    (e) => targetFarmIds.includes(e.farmId) && inDateRange(e.entryDate, startDate, endDate)
  );
  const cropActs = store.db.cropActivities.filter(
    (a) =>
      targetFarmIds.includes(a.farmId) &&
      (fieldFilter === 'all' || a.fieldId === fieldFilter) &&
      inDateRange(a.activityDate, startDate, endDate)
  );
  const lvkRecs = store.db.livestockRecords.filter(
    (r) =>
      targetFarmIds.includes(r.farmId) &&
      groupIdsSet.has(r.livestockGroupId) &&
      inDateRange(r.recordDate, startDate, endDate)
  );

  const mixedExpensesZar = Number(mixedEntries.reduce((s, e) => s + e.expenseZar, 0).toFixed(2));
  const cropActivityExpensesZar = Number(
    cropActs
      .filter((a) => ['irrigation', 'fertiliser', 'pest', 'disease'].includes(a.activityType))
      .reduce((s, a) => s + a.valueZar, 0)
      .toFixed(2)
  );
  const livestockExpensesZar = Number(
    lvkRecs
      .filter((r) => ['Purchase', 'Feeding', 'Veterinary', 'Vaccination'].includes(r.recordType))
      .reduce((s, r) => s + r.valueZar, 0)
      .toFixed(2)
  );
  const totalActualExpensesZar = Number(
    (mixedExpensesZar + cropActivityExpensesZar + livestockExpensesZar).toFixed(2)
  );

  const estimatedPlannedBudgetZar = Number(
    store.db.businessPlans
      .filter((p) => p.farmId && targetFarmIds.includes(p.farmId))
      .reduce(
        (s, p) =>
          s +
          p.seedsPlantingCostZar +
          p.fertilisersCostZar +
          p.feedCostZar +
          p.waterCostZar +
          p.labourCostZar +
          p.operatingExpensesZar,
        0
      )
      .toFixed(2)
  );

  // Farm Comparisons
  const farmsSummary = farms.map((f) => {
    const loc = store.db.farmLocations.find((l) => l.farmId === f.id);
    const fFields = store.db.fields.filter((fl) => fl.farmId === f.id);
    const fCrops = stockOverview.cropStocks.filter((c) => c.farmId === f.id);
    const fLvk = stockOverview.livestockStocks.filter((l) => l.farmId === f.id);
    const fMixed = store.db.mixedFarmingEntries.filter((m) => m.farmId === f.id);
    const fCropActs = store.db.cropActivities.filter(
      (a) => a.farmId === f.id && ['irrigation', 'fertiliser', 'pest', 'disease'].includes(a.activityType)
    );
    const fLvkCosts = store.db.livestockRecords.filter(
      (r) => r.farmId === f.id && ['Purchase', 'Feeding', 'Veterinary', 'Vaccination'].includes(r.recordType)
    );
    const estVal =
      fCrops.reduce((s, c) => s + c.remainingStandingValueZar + c.storedStockValueZar, 0) +
      fLvk.reduce((s, l) => s + l.remainingValueZar, 0);
    const actExp =
      fMixed.reduce((s, m) => s + m.expenseZar, 0) +
      fCropActs.reduce((s, a) => s + a.valueZar, 0) +
      fLvkCosts.reduce((s, r) => s + r.valueZar, 0);

    return {
      id: f.id,
      name: f.name,
      province: loc?.province || 'South Africa',
      district: loc?.districtMunicipality || '',
      totalHectares: f.farmSizeHectares,
      fieldCount: fFields.length,
      farmingTypes: f.farmingActivities,
      cropsCount: fCrops.length,
      livestockCount: fLvk.reduce((s, l) => s + l.currentQuantity, 0),
      estimatedStockValueZar: Number(estVal.toFixed(2)),
      actualExpensesZar: Number(actExp.toFixed(2)),
      activeIncidentsCount: incidentDash.incidents.filter(
        (i) => i.farmId === f.id && i.status !== 'resolved'
      ).length,
    };
  });

  // Recent AI Insights
  const recentAiInsights = store.db.aiInsightRecords
    .filter((ai) => (ai.userId === user.id || (ai.farmId && targetFarmIds.includes(ai.farmId))) && inDateRange(ai.createdAt, startDate, endDate))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
    .map((ai) => ({
      ...ai,
      farmName: ai.farmId ? farms.find((f) => f.id === ai.farmId)?.name || 'Farm' : null,
    }));

  // Recommended Next Actions derived directly from database conditions
  const recommendedNextActions: {
    id: string;
    priority: 'high' | 'medium' | 'normal';
    title: string;
    reason: string;
    actionTab: 'farms' | 'crops' | 'livestock' | 'soil' | 'weather' | 'visual' | 'stock' | 'incidents' | 'planner' | 'learning' | 'advisor';
    actionLabel: string;
  }[] = [];

  if (activeIncidentsCount > 0) {
    recommendedNextActions.push({
      id: 'act-incidents',
      priority: 'high',
      title: `Follow up on ${activeIncidentsCount} unresolved farm incident${activeIncidentsCount === 1 ? '' : 's'}`,
      reason: 'Active damage or health incidents need field inspection and status updates.',
      actionTab: 'incidents',
      actionLabel: 'Open Incidents',
    });
  }
  if (weatherSummary.activeWarnings.length > 0) {
    recommendedNextActions.push({
      id: 'act-weather',
      priority: 'high',
      title: 'Review active weather alerts & log rain-gauge observation',
      reason: `${weatherSummary.activeWarnings.length} active alert(s) detected for ${weatherSummary.farmName}.`,
      actionTab: 'weather',
      actionLabel: 'Check Weather',
    });
  }
  if (farms.some((f) => !store.db.soilReports.some((s) => s.farmId === f.id))) {
    recommendedNextActions.push({
      id: 'act-soil',
      priority: 'medium',
      title: 'Add laboratory soil test results for unverified farms',
      reason: 'Soil pH and NPK lab reports unlock precise lime and fertiliser guidance.',
      actionTab: 'soil',
      actionLabel: 'Soil & Land',
    });
  }
  if (farms.some((f) => !store.db.farmBoundaries.some((b) => b.farmId === f.id))) {
    recommendedNextActions.push({
      id: 'act-boundary',
      priority: 'medium',
      title: 'Draw your farm boundary polygon on the map',
      reason: 'Saved polygon boundaries calculate verified hectares and field layout.',
      actionTab: 'farms',
      actionLabel: 'Open Farm Map',
    });
  }
  recommendedNextActions.push({
    id: 'act-stock',
    priority: 'normal',
    title: 'Verify unit prices in Stock & Valuation',
    reason: 'Review market unit prices so estimated crop and herd values reflect current buyer rates.',
    actionTab: 'stock',
    actionLabel: 'Review Stock',
  });

  // Analytics datasets
  const cropPerformance = filteredCropStocks.map((c) => ({
    label: `${c.cropName} (${c.farmName})`,
    plantedQty: c.originalPlantedQty,
    remainingQty: c.remainingPlants,
    damagedQty: c.damagedPlants,
    harvestedKg: c.harvestedKg,
    estimatedValueZar: Number((c.remainingStandingValueZar + c.storedStockValueZar).toFixed(2)),
  }));

  const livestockPerformance = byAnimalType.map((cat) => {
    const matchedIds = new Set(
      rawGroups.filter((g) => g.animalType === cat.animalType).map((g) => g.id)
    );
    const recs = lvkRecs.filter((r) => matchedIds.has(r.livestockGroupId));
    return {
      animalType: cat.animalType,
      headCount: cat.quantity,
      birthsAndPurchases: recs
        .filter((r) => r.recordType === 'Birth' || r.recordType === 'Purchase')
        .reduce((s, r) => s + Math.abs(r.quantityChange), 0),
      deathsAndSales: recs
        .filter((r) => r.recordType === 'Death' || r.recordType === 'Sale')
        .reduce((s, r) => s + Math.abs(r.quantityChange), 0),
      estimatedValueZar: cat.estimatedValueZar,
    };
  });

  // Monthly Production Trends (YYYY-MM)
  const trendMap = new Map<string, { harvestKg: number; livestockUnits: number; mixedFeedKg: number }>();
  const touchMonth = (dateStr: string) => {
    const m = dateStr.slice(0, 7) || '2026-09';
    if (!trendMap.has(m)) trendMap.set(m, { harvestKg: 0, livestockUnits: 0, mixedFeedKg: 0 });
    return trendMap.get(m)!;
  };
  for (const a of cropActs.filter((x) => x.activityType === 'harvest')) {
    touchMonth(a.activityDate).harvestKg += a.quantity;
  }
  for (const r of lvkRecs.filter((x) => x.recordType === 'Production' || x.recordType === 'Birth')) {
    touchMonth(r.recordDate).livestockUnits += r.productionAmount || Math.abs(r.quantityChange);
  }
  for (const m of mixedEntries.filter((x) => x.entryCategory === 'feed_production')) {
    touchMonth(m.entryDate).mixedFeedKg += m.productionQuantity;
  }
  const productionTrends = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, vals]) => ({
      period,
      harvestKg: Number(vals.harvestKg.toFixed(1)),
      livestockUnits: Number(vals.livestockUnits.toFixed(1)),
      mixedFeedKg: Number(vals.mixedFeedKg.toFixed(1)),
    }));

  // Stock Changes
  const stockChanges = [
    ...stockOverview.cropMovements
      .filter((m) => cropIdsSet.has(m.cropId) && inDateRange(m.movementDate, startDate, endDate))
      .map((m) => ({
        id: m.id,
        date: m.movementDate,
        itemLabel: m.cropName || 'Crop Stock',
        movementType: `Crop ${m.movementType}`,
        deltaLabel: `${m.quantityDelta >= 0 ? '+' : ''}${m.quantityDelta.toLocaleString()} ${m.unit}`,
        estimatedValueDeltaZar: m.totalValueZar,
      })),
    ...lvkRecs
      .filter((r) => r.quantityChange !== 0)
      .map((r) => {
        const grp = rawGroups.find((g) => g.id === r.livestockGroupId);
        return {
          id: r.id,
          date: r.recordDate,
          itemLabel: grp?.groupName || 'Livestock Group',
          movementType: `Livestock ${r.recordType}`,
          deltaLabel: `${r.quantityChange >= 0 ? '+' : ''}${r.quantityChange} head`,
          estimatedValueDeltaZar: r.valueZar,
        };
      }),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  // Damage & loss breakdown
  const typeImpactMap = new Map<string, { count: number; estimatedImpactZar: number }>();
  for (const inc of filteredIncidents) {
    const label = inc.incidentType.replace(/_/g, ' ');
    const cur = typeImpactMap.get(label) || { count: 0, estimatedImpactZar: 0 };
    cur.count += 1;
    cur.estimatedImpactZar += inc.estimatedFinancialImpactZar;
    typeImpactMap.set(label, cur);
  }

  // Weather impact summary
  const farmForecasts = store.db.weatherForecastRecords.filter(
    (fc) => targetFarmIds.includes(fc.farmId) && inDateRange(fc.forecastDate, startDate, endDate)
  );
  const farmObservations = store.db.weatherObservations.filter(
    (ob) => targetFarmIds.includes(ob.farmId) && inDateRange(ob.observationDate, startDate, endDate)
  );
  const recentWeatherDates = Array.from(
    new Set([...farmForecasts.map((f) => f.forecastDate), ...farmObservations.map((o) => o.observationDate)])
  )
    .sort()
    .slice(-7);

  const recentDays = recentWeatherDates.map((d) => {
    const fc = farmForecasts.find((f) => f.forecastDate === d);
    const ob = farmObservations.find((o) => o.observationDate === d);
    return {
      date: d,
      forecastRainMm: fc?.predictedRainfallMm ?? 0,
      reportedRainMm: ob ? ob.measuredRainfallMm ?? (ob.rainfallOccurred ? 5 : 0) : null,
    };
  });

  const rainDiffs = farmObservations
    .filter((o) => o.measuredRainfallMm !== null && o.comparedForecastRecordId)
    .map((o) => {
      const fc = farmForecasts.find((f) => f.id === o.comparedForecastRecordId);
      return fc ? Math.abs((o.measuredRainfallMm || 0) - fc.predictedRainfallMm) : null;
    })
    .filter((n): n is number => n !== null);

  const announcements = store.db.systemAnnouncements.filter(
    (a) => a.isActive && (a.targetRole === 'all' || a.targetRole === user.roleCode)
  );

  return {
    mode: 'existing_farmer' as const,
    filtersApplied: {
      farmId: farmFilter,
      fieldId: fieldFilter,
      startDate,
      endDate,
      category,
    },
    overview: {
      registeredFarmsCount: farms.length,
      totalHectares,
      cultivatedHectares,
      grazingHectares,
      farmingTypes,
      registeredCropsCount: registeredCrops.length,
      totalRemainingPlants: filteredCropStocks.reduce((s, c) => s + c.remainingPlants, 0),
      totalDamagedPlants: filteredCropStocks.reduce((s, c) => s + c.damagedPlants, 0),
      totalStoredCropKg: Number(
        filteredCropStocks.reduce((s, c) => s + c.storedProductionKg, 0).toFixed(1)
      ),
      totalLivestockQuantity: rawGroups.reduce((s, g) => s + g.quantity, 0),
      activeIncidentsCount,
      activeWarningsCount: weatherSummary.activeWarnings.length,
      estimatedCropStockValueZar,
      estimatedLivestockValueZar,
      estimatedTotalStockValueZar,
      actualRecordedExpensesZar: totalActualExpensesZar,
      estimationNotice:
        'Database records (counts, hectares, actual expenses) are shown alongside clearly labelled Estimated Stock Values calculated from recorded quantities and configured unit prices.',
    },
    farmsSummary,
    registeredCrops,
    livestockSummary: {
      byAnimalType,
      groups: livestockGroups,
    },
    weatherSummary,
    upcomingActivities: upcomingActivities.slice(0, 8),
    recentIncidents: filteredIncidents.slice(0, 6),
    recentAiInsights,
    recommendedNextActions,
    analytics: {
      cropPerformance,
      livestockPerformance,
      productionTrends,
      stockChanges,
      expenseSummaries: {
        mixedExpensesZar,
        cropActivityExpensesZar,
        livestockExpensesZar,
        totalActualExpensesZar,
        estimatedPlannedBudgetZar,
        byCategory: [
          { label: 'Mixed Operations & Inputs', amountZar: mixedExpensesZar },
          { label: 'Crop Input Activities', amountZar: cropActivityExpensesZar },
          { label: 'Livestock Feed, Vet & Purchases', amountZar: livestockExpensesZar },
        ],
      },
      damageAndLoss: {
        totalIncidents: filteredIncidents.length,
        activeIncidents: activeIncidentsCount,
        affectedPlants: filteredIncidents
          .filter((i) => Boolean(i.cropId))
          .reduce((s, i) => s + i.affectedQuantity, 0),
        affectedLivestock: filteredIncidents
          .filter((i) => Boolean(i.livestockGroupId))
          .reduce((s, i) => s + i.affectedQuantity, 0),
        affectedHectares: Number(
          filteredIncidents.reduce((s, i) => s + i.affectedAreaHectares, 0).toFixed(2)
        ),
        estimatedFinancialImpactZar: Number(
          filteredIncidents.reduce((s, i) => s + i.estimatedFinancialImpactZar, 0).toFixed(2)
        ),
        byIncidentType: Array.from(typeImpactMap.entries()).map(([typeLabel, vals]) => ({
          typeLabel,
          count: vals.count,
          estimatedImpactZar: Number(vals.estimatedImpactZar.toFixed(2)),
        })),
      },
      weatherImpact: {
        storedForecastDays: farmForecasts.length,
        farmerObservationsCount: farmObservations.length,
        avgRainfallVarianceMm:
          rainDiffs.length > 0
            ? Number((rainDiffs.reduce((s, v) => s + v, 0) / rainDiffs.length).toFixed(1))
            : null,
        weatherIncidentsCount: filteredIncidents.filter((i) =>
          ['heavy_rainfall', 'flooding', 'storm_damage', 'drought'].includes(i.incidentType)
        ).length,
        recentDays,
      },
    },
    announcements,
  };
}

export function buildProspectiveFarmerDashboard(params: {
  user: SanitizedUser;
  provinceFilter?: string;
  categoryFilter?: string;
}) {
  const { user } = params;
  const pd = user.profile?.prospectiveData;
  const userProvince = params.provinceFilter || user.profile?.province || 'Free State';
  const catFilter = params.categoryFilter || 'all';

  const opportunities = FARMING_OPPORTUNITIES.filter((opp) => {
    if (catFilter !== 'all') {
      const hay = `${opp.title} ${opp.summary}`.toLowerCase();
      if (!hay.includes(catFilter.toLowerCase())) return false;
    }
    return true;
  });

  const savedLocations = store.db.savedProspectiveLocations
    .filter((l) => l.userId === user.id)
    .map((l) => {
      const prov = SOUTH_AFRICA_PROVINCES.find((p) => p.name === l.province);
      return {
        ...l,
        climateZone: prov?.climateZone || 'South African Mixed Zone',
        annualRainfallMm: prov?.annualRainfallMm || '450 - 800 mm',
        suitabilitySummary: prov
          ? `Suitable commodities: ${prov.keyCommodities.slice(0, 4).join(', ')}`
          : 'Confirm municipal water and soil test before leasing.',
      };
    });

  const provincesToRecommend = Array.from(
    new Set([userProvince, ...savedLocations.map((s) => s.province)])
  );
  const landSuitabilityRecommendations = provincesToRecommend
    .map((pName) => SOUTH_AFRICA_PROVINCES.find((p) => p.name === pName))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      province: p.name,
      climateZone: p.climateZone,
      annualRainfallMm: p.annualRainfallMm,
      keyCommodities: p.keyCommodities,
      soilAndWaterGuidance: `In ${p.name} (${p.climateZone}), verify seasonal rainfall (${p.annualRainfallMm}) and submit a 0–20 cm composite soil test before committing input capital.`,
    }));

  const intendedHa = pd?.intendedLandSizeHectares || 2;
  const suggestedActivities = [
    {
      id: 'sug-1',
      title: 'Drip-Irrigated Leafy Vegetables & Cabbage',
      category: 'Horticulture',
      whyItFits: `Matches ${intendedHa} ha starter scale with rapid 60–90 day cash turnover.`,
      estimatedCycle: '65 - 90 days',
      estimatedStarterScaleHa: Math.min(2, intendedHa),
    },
    {
      id: 'sug-2',
      title: 'Smallholder Broiler Poultry (250-Bird Cycles)',
      category: 'Poultry',
      whyItFits: 'Requires minimal land area (<0.25 ha) with predictable 6-week turnaround when biosecurity is maintained.',
      estimatedCycle: '42 days per cycle',
      estimatedStarterScaleHa: 0.25,
    },
    {
      id: 'sug-3',
      title: 'Seasonal Dryland Maize + Legume Intercrop',
      category: 'Field Crops',
      whyItFits: `Strong fit for ${userProvince} summer rainfall areas when paired with soil pH correction.`,
      estimatedCycle: '120 - 150 days',
      estimatedStarterScaleHa: Math.max(2, intendedHa),
    },
  ];

  const farmingPlans = store.db.businessPlans
    .filter((p) => p.ownerId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((p) => {
      const startup = p.equipmentCostZar + p.infrastructureCostZar;
      const operating =
        p.seedsPlantingCostZar +
        p.fertilisersCostZar +
        p.feedCostZar +
        p.waterCostZar +
        p.labourCostZar +
        p.operatingExpensesZar;
      const rev = p.expectedProductionQty * p.sellingPricePerUnitZar;
      return {
        ...p,
        farmName: null,
        calculation: {
          estimatedStartupCostsZar: Number(startup.toFixed(2)),
          estimatedOperatingCostsZar: Number(operating.toFixed(2)),
          totalYearOneOutlayZar: Number((startup + operating).toFixed(2)),
          estimatedProductionQty: p.expectedProductionQty,
          productionUnit: p.productionUnit,
          estimatedRevenueZar: Number(rev.toFixed(2)),
          estimatedOperatingProfitLossZar: Number((rev - operating).toFixed(2)),
          estimatedNetYearOneZar: Number((rev - startup - operating).toFixed(2)),
          breakEvenUnits: p.sellingPricePerUnitZar > 0 ? Math.ceil(operating / p.sellingPricePerUnitZar) : null,
          breakEvenPriceZar:
            p.expectedProductionQty > 0 ? Number((operating / p.expectedProductionQty).toFixed(2)) : null,
          costPerHectareZar: Number((operating / Math.max(0.1, p.farmSizeHectares)).toFixed(2)),
          revenuePerHectareZar: Number((rev / Math.max(0.1, p.farmSizeHectares)).toFixed(2)),
          costBreakdown: [],
          resourceRequirements: {
            waterDemandM3: p.waterDemandM3,
            waterDemandLiters: Math.round(p.waterDemandM3 * 1000),
            labourWorkers: p.labourWorkers,
            farmSizeHectares: p.farmSizeHectares,
            summaryText: `${p.farmSizeHectares} ha · ${p.labourWorkers} worker(s)`,
          },
          actualFarmExpensesZar: null,
          actualExpensesNote: 'Prospective scenario — estimated planning budget only.',
          disclaimer: 'Estimated non-guaranteed planning assumptions.',
        },
      };
    });

  const startupTotals = farmingPlans.map((p) => p.calculation.estimatedStartupCostsZar);
  const estimatedLowestStartupZar =
    startupTotals.length > 0 ? Math.min(...startupTotals) : 46500;

  const learningPayload = buildLearningCentrePayload({
    user,
    languageCode: user.preferredLanguageCode,
    includeDrafts: false,
  });

  const recommendedNextSteps = [
    {
      id: 'next-loc',
      title: 'Bookmark candidate farm locations and verify water access',
      detail: `${savedLocations.length} location(s) saved. Confirm borehole yield or municipal water before signing a lease.`,
      completed: savedLocations.length > 0,
      actionTab: 'advisor' as const,
      actionLabel: 'Ask Land Advisor',
    },
    {
      id: 'next-plan',
      title: 'Model startup capital and seasonal costs across 3 scales',
      detail: `${farmingPlans.length} saved business scenario(s). Adjust input costs and selling prices in Business Planner.`,
      completed: farmingPlans.length > 0,
      actionTab: 'planner' as const,
      actionLabel: 'Open Business Planner',
    },
    {
      id: 'next-learn',
      title: 'Complete foundational Soil Preparation & Beginner Farming lessons',
      detail: `${learningPayload.learnerStats.completedCount} of ${learningPayload.learnerStats.totalPublished} official guides completed (${learningPayload.learnerStats.overallPercent}%).`,
      completed: learningPayload.learnerStats.completedCount > 0,
      actionTab: 'learning' as const,
      actionLabel: 'Open Learning Centre',
    },
  ];

  const recentAiInsights = store.db.aiInsightRecords
    .filter((ai) => ai.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  const announcements = store.db.systemAnnouncements.filter(
    (a) => a.isActive && (a.targetRole === 'all' || a.targetRole === user.roleCode)
  );

  return {
    mode: 'prospective_farmer' as const,
    overview: {
      savedLocationsCount: savedLocations.length,
      farmingPlansCount: farmingPlans.length,
      estimatedLowestStartupZar,
      learningCompletedCount: learningPayload.learnerStats.completedCount,
      learningTotalCount: learningPayload.learnerStats.totalPublished,
      learningProgressPercent: learningPayload.learnerStats.overallPercent,
      estimationNotice:
        'Startup costs and revenue scenarios shown for prospective farmers are non-guaranteed estimates grounded in your planning assumptions.',
    },
    opportunities,
    savedLocations,
    landSuitabilityRecommendations,
    suggestedActivities,
    farmingPlans,
    learningProgress: {
      ...learningPayload.learnerStats,
      recentMaterials: learningPayload.materials.slice(0, 6),
    },
    recommendedNextSteps,
    recentAiInsights,
    announcements,
  };
}
