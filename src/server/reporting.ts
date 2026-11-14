import crypto from 'node:crypto';
import { computeBusinessPlanMetrics } from './businessPlanner.ts';
import { getActiveFarmGrantForExpert } from './expertPortal.ts';
import { buildIncidentDashboard } from './incidents.ts';
import { buildStockOverview } from './stockInventory.ts';
import { store } from './store.ts';
import {
  GeneratedReportRecord,
  ReportTypeCode,
  SanitizedUser,
} from './types.ts';

export const REPORT_TYPES: {
  code: ReportTypeCode;
  label: string;
  description: string;
  containsEstimates: boolean;
}[] = [
  {
    code: 'farm_profiles',
    label: 'Farm Profiles & Land Register',
    description: 'Registered farms, provinces, field areas, water sources, and enterprise focus.',
    containsEstimates: false,
  },
  {
    code: 'crop_production',
    label: 'Crop Production & Harvests',
    description: 'Registered crops, cultivated hectares, growth stages, harvested quantities, and field notes.',
    containsEstimates: true,
  },
  {
    code: 'livestock_production',
    label: 'Livestock Production & Herd Events',
    description: 'Herd/flock counts, breeds, health status, births, deaths, sales, and output.',
    containsEstimates: true,
  },
  {
    code: 'stock_levels',
    label: 'Agricultural Stock Levels & Movements',
    description: 'Remaining standing plants, stored crop kg, damaged quantities, and herd stock changes.',
    containsEstimates: false,
  },
  {
    code: 'stock_valuation',
    label: 'Estimated Stock Valuation',
    description: 'Clearly labelled estimated crop, stored harvest, and livestock asset values with unit price assumptions.',
    containsEstimates: true,
  },
  {
    code: 'agricultural_incidents',
    label: 'Agricultural Incidents Register',
    description: 'Reported storms, floods, pests, diseases, livestock issues, and follow-up resolution status.',
    containsEstimates: true,
  },
  {
    code: 'damage_and_losses',
    label: 'Damage & Losses Summary',
    description: 'Affected plants, livestock head, damaged hectares, and estimated financial impact.',
    containsEstimates: true,
  },
  {
    code: 'weather_observations',
    label: 'Weather Observations & Forecast Comparison',
    description: 'Distinguishes forecast snapshots from farmer-reported rain-gauge observations and QC status.',
    containsEstimates: false,
  },
  {
    code: 'ai_insights',
    label: 'AI Agricultural Insights History',
    description: 'Grounded advisory, visual scan, analytics, and weather comparison summaries (AI advisory only).',
    containsEstimates: true,
  },
  {
    code: 'business_planning',
    label: 'Farming Business Plans (Estimates vs Actuals)',
    description: 'Saved business planner assumptions, estimated startup/operating costs, and projected margins.',
    containsEstimates: true,
  },
  {
    code: 'farm_expenses',
    label: 'Actual Recorded Farm Expenses',
    description: 'Verified ledger expenses recorded across mixed operations, crop inputs, and livestock care.',
    containsEstimates: false,
  },
  {
    code: 'farm_performance',
    label: 'Integrated Farm Performance Summary',
    description: 'Combined farm hectares, production output, stock value estimates, actual expenses, and incidents.',
    containsEstimates: true,
  },
];

function withinDates(dateStr: string | null | undefined, startDate: string, endDate: string): boolean {
  if (!dateStr) return true;
  const d = dateStr.slice(0, 10);
  if (startDate && d < startDate) return false;
  if (endDate && d > endDate) return false;
  return true;
}

export function generateAndSaveReport(params: {
  user: SanitizedUser;
  accessibleFarmIds: string[];
  reportType: ReportTypeCode;
  farmId?: string;
  startDate?: string;
  endDate?: string;
  farmingCategory?: string;
  aggregateOrganisation?: boolean;
  ipAddress?: string;
}) {
  const { user, accessibleFarmIds, reportType } = params;
  const meta = REPORT_TYPES.find((r) => r.code === reportType);
  if (!meta) {
    throw new Error('Invalid report type requested.');
  }

  const startDate = params.startDate || '';
  const endDate = params.endDate || '';
  const farmingCategory = params.farmingCategory || 'all';
  const requestedFarmId = params.farmId && params.farmId !== 'all' ? params.farmId : 'all';

  if (requestedFarmId !== 'all' && !accessibleFarmIds.includes(requestedFarmId)) {
    throw new Error('You do not have permission to generate a report for that farm.');
  }

  const targetFarmIds =
    requestedFarmId !== 'all' ? [requestedFarmId] : accessibleFarmIds;

  const isOrgAggregate =
    Boolean(params.aggregateOrganisation) || user.roleCode === 'organisation_manager';

  const expertLacksFinancial =
    user.roleCode === 'agricultural_expert' &&
    targetFarmIds.some(
      (fid) => !getActiveFarmGrantForExpert(user.id, fid)?.scopes.financialSummary
    );
  const shouldRedactFinancials = isOrgAggregate || expertLacksFinancial;

  const farms = store.db.farms.filter((f) => targetFarmIds.includes(f.id));

  // Privacy-safe farm label helper: protects private farmer identity in organisation-aggregated reports
  const getSafeFarmLabel = (farmId: string, idxHint?: number) => {
    const f = farms.find((x) => x.id === farmId);
    const loc = store.db.farmLocations.find((l) => l.farmId === farmId);
    if (!f) return 'Farm Record';
    if (isOrgAggregate && f.ownerId !== user.id) {
      const idx = idxHint ?? farms.findIndex((x) => x.id === farmId) + 1;
      return `Member Farm #${idx} (${loc?.districtMunicipality || loc?.province || 'SA'})`;
    }
    return f.name;
  };

  const getSafeOwnerLabel = (ownerId: string) => {
    if (isOrgAggregate && ownerId !== user.id) {
      return 'Protected (Organisation Privacy Policy)';
    }
    const prof = store.db.userProfiles.find((p) => p.userId === ownerId);
    return prof?.fullName || 'Registered Farmer';
  };

  let columns: { key: string; label: string; align?: 'left' | 'right' }[] = [];
  let rows: Record<string, string | number>[] = [];
  let kpis: {
    label: string;
    value: string;
    dataClassification: 'Database Record' | 'Estimated Value' | 'AI Advisory';
  }[] = [];

  const matchesFarmingCat = (domain: 'crops' | 'livestock'): boolean => {
    if (!farmingCategory || farmingCategory === 'all') return true;
    const cat = farmingCategory.toLowerCase();
    if (cat === 'mixed') return true;
    return cat === domain || (domain === 'crops' && cat === 'orchards');
  };

  const stock = buildStockOverview(targetFarmIds);
  const incDash = buildIncidentDashboard(targetFarmIds);

  switch (reportType) {
    case 'farm_profiles': {
      columns = [
        { key: 'farm', label: 'Farm Reference' },
        { key: 'owner', label: 'Account Holder' },
        { key: 'province', label: 'Province' },
        { key: 'district', label: 'District' },
        { key: 'hectares', label: 'Size (ha)', align: 'right' },
        { key: 'fields', label: 'Fields', align: 'right' },
        { key: 'water', label: 'Water Supply' },
        { key: 'activities', label: 'Farming Categories' },
      ];
      rows = farms
        .filter((f) =>
          farmingCategory === 'all' ||
          f.farmingActivities.some((a) => a.toLowerCase().includes(farmingCategory.toLowerCase()))
        )
        .map((f, idx) => {
          const loc = store.db.farmLocations.find((l) => l.farmId === f.id);
          const flds = store.db.fields.filter((fl) => fl.farmId === f.id);
          return {
            farm: getSafeFarmLabel(f.id, idx + 1),
            owner: getSafeOwnerLabel(f.ownerId),
            province: loc?.province || 'Unassigned',
            district: loc?.districtMunicipality || 'Unassigned',
            hectares: f.farmSizeHectares,
            fields: flds.length,
            water: f.waterAvailability,
            activities: f.farmingActivities.join(', ') || 'Mixed',
          };
        });
      kpis = [
        { label: 'Farms Included', value: String(rows.length), dataClassification: 'Database Record' },
        {
          label: 'Total Area',
          value: `${rows.reduce((s, r) => s + Number(r.hectares || 0), 0).toFixed(1)} ha`,
          dataClassification: 'Database Record',
        },
      ];
      break;
    }

    case 'crop_production': {
      const crops = matchesFarmingCat('crops')
        ? store.db.crops.filter(
            (c) => targetFarmIds.includes(c.farmId) && withinDates(c.plantingDate, startDate, endDate)
          )
        : [];
      columns = [
        { key: 'farm', label: 'Farm' },
        { key: 'crop', label: 'Crop & Variety' },
        { key: 'plantedDate', label: 'Planted' },
        { key: 'stage', label: 'Growth Stage' },
        { key: 'areaHa', label: 'Area (ha)', align: 'right' },
        { key: 'plantedQty', label: 'Planted Qty', align: 'right' },
        { key: 'harvestedKg', label: 'Harvested (kg)', align: 'right' },
        { key: 'estValueZar', label: 'Est. Value (ZAR)', align: 'right' },
      ];
      rows = crops.map((c) => ({
        farm: getSafeFarmLabel(c.farmId),
        crop: `${c.cropName} (${c.cropVariety})`,
        plantedDate: c.plantingDate,
        stage: c.growthStage,
        areaHa: c.cultivatedAreaHectares,
        plantedQty: c.plantingQuantity,
        harvestedKg: c.harvestedQuantityKg,
        estValueZar: c.estimatedValueZar,
      }));
      kpis = [
        { label: 'Registered Crops', value: String(rows.length), dataClassification: 'Database Record' },
        {
          label: 'Harvested Output',
          value: `${rows.reduce((s, r) => s + Number(r.harvestedKg || 0), 0).toLocaleString()} kg`,
          dataClassification: 'Database Record',
        },
        {
          label: 'Est. Crop Value',
          value: `R${rows.reduce((s, r) => s + Number(r.estValueZar || 0), 0).toLocaleString()}`,
          dataClassification: 'Estimated Value',
        },
      ];
      break;
    }

    case 'livestock_production': {
      const groups = matchesFarmingCat('livestock')
        ? store.db.livestockGroups.filter(
            (g) => targetFarmIds.includes(g.farmId) && withinDates(g.registrationDate, startDate, endDate)
          )
        : [];
      columns = [
        { key: 'farm', label: 'Farm' },
        { key: 'group', label: 'Herd / Flock' },
        { key: 'typeBreed', label: 'Type & Breed' },
        { key: 'health', label: 'Health Status' },
        { key: 'quantity', label: 'Head Count', align: 'right' },
        { key: 'births', label: 'Births', align: 'right' },
        { key: 'deaths', label: 'Deaths', align: 'right' },
        { key: 'estValueZar', label: 'Est. Value (ZAR)', align: 'right' },
      ];
      rows = groups.map((g) => {
        const st = stock.livestockStocks.find((s) => s.livestockGroupId === g.id);
        return {
          farm: getSafeFarmLabel(g.farmId),
          group: g.groupName,
          typeBreed: `${g.animalType} · ${g.breed}`,
          health: g.healthStatus,
          quantity: g.quantity,
          births: st?.births ?? 0,
          deaths: st?.deaths ?? 0,
          estValueZar: st?.remainingValueZar ?? Number((g.quantity * g.estimatedUnitValueZar).toFixed(2)),
        };
      });
      kpis = [
        {
          label: 'Total Animals',
          value: `${rows.reduce((s, r) => s + Number(r.quantity || 0), 0).toLocaleString()} head`,
          dataClassification: 'Database Record',
        },
        {
          label: 'Est. Herd Value',
          value: `R${rows.reduce((s, r) => s + Number(r.estValueZar || 0), 0).toLocaleString()}`,
          dataClassification: 'Estimated Value',
        },
      ];
      break;
    }

    case 'stock_levels': {
      const filteredCropRows = matchesFarmingCat('crops') ? stock.cropStocks : [];
      const filteredLvkRows = matchesFarmingCat('livestock') ? stock.livestockStocks : [];
      columns = [
        { key: 'farm', label: 'Farm' },
        { key: 'category', label: 'Stock Category' },
        { key: 'item', label: 'Item' },
        { key: 'initialQty', label: 'Original / Baseline', align: 'right' },
        { key: 'lossQty', label: 'Damaged / Deaths', align: 'right' },
        { key: 'remainingQty', label: 'Remaining Stock', align: 'right' },
        { key: 'storedKg', label: 'Stored Harvest (kg)', align: 'right' },
      ];
      rows = [
        ...filteredCropRows.map((c) => ({
          farm: getSafeFarmLabel(c.farmId),
          category: 'Crop Stock',
          item: `${c.cropName} (${c.cropVariety})`,
          initialQty: c.originalPlantedQty,
          lossQty: c.damagedPlants,
          remainingQty: c.remainingPlants,
          storedKg: c.storedProductionKg,
        })),
        ...filteredLvkRows.map((l) => ({
          farm: getSafeFarmLabel(l.farmId),
          category: 'Livestock Stock',
          item: `${l.groupName} (${l.breed})`,
          initialQty: Math.max(0, l.currentQuantity + l.deaths + l.sales - l.births - l.purchases),
          lossQty: l.deaths,
          remainingQty: l.currentQuantity,
          storedKg: l.productionTotal,
        })),
      ];
      kpis = [
        {
          label: 'Remaining Crop Plants',
          value: filteredCropRows.reduce((s, c) => s + c.remainingPlants, 0).toLocaleString(),
          dataClassification: 'Database Record',
        },
        {
          label: 'Livestock Head',
          value: filteredLvkRows.reduce((s, l) => s + l.currentQuantity, 0).toLocaleString(),
          dataClassification: 'Database Record',
        },
      ];
      break;
    }

    case 'stock_valuation': {
      const filteredCropRows = matchesFarmingCat('crops') ? stock.cropStocks : [];
      const filteredLvkRows = matchesFarmingCat('livestock') ? stock.livestockStocks : [];
      columns = [
        { key: 'farm', label: 'Farm' },
        { key: 'item', label: 'Asset' },
        { key: 'remainingQty', label: 'Quantity', align: 'right' },
        { key: 'unitPriceZar', label: 'Unit Price (ZAR)', align: 'right' },
        { key: 'estRemainingZar', label: 'Est. Remaining Value (ZAR)', align: 'right' },
        { key: 'estDamageLossZar', label: 'Est. Loss Value (ZAR)', align: 'right' },
        { key: 'assumption', label: 'Price Source & Assumption' },
      ];
      rows = [
        ...filteredCropRows.map((c) => ({
          farm: getSafeFarmLabel(c.farmId),
          item: `${c.cropName} (Crop + Stored)`,
          remainingQty: c.remainingPlants,
          unitPriceZar: c.plantUnitPriceZar,
          estRemainingZar: Number((c.remainingStandingValueZar + c.storedStockValueZar).toFixed(2)),
          estDamageLossZar: c.damagedStockValueZar,
          assumption: c.priceSource,
        })),
        ...filteredLvkRows.map((l) => ({
          farm: getSafeFarmLabel(l.farmId),
          item: `${l.groupName} (${l.animalType})`,
          remainingQty: l.currentQuantity,
          unitPriceZar: l.unitPriceZar,
          estRemainingZar: l.remainingValueZar,
          estDamageLossZar: l.deathLossValueZar,
          assumption: l.priceSource,
        })),
      ];
      const remVal = filteredCropRows.reduce((s, c) => s + c.remainingStandingValueZar + c.storedStockValueZar, 0) +
        filteredLvkRows.reduce((s, l) => s + l.remainingValueZar, 0);
      const lossVal = filteredCropRows.reduce((s, c) => s + c.damagedStockValueZar, 0) +
        filteredLvkRows.reduce((s, l) => s + l.deathLossValueZar, 0);
      kpis = [
        {
          label: 'Est. Total Stock Value',
          value: `R${Number(remVal.toFixed(2)).toLocaleString()}`,
          dataClassification: 'Estimated Value',
        },
        {
          label: 'Est. Damaged / Loss Value',
          value: `R${Number(lossVal.toFixed(2)).toLocaleString()}`,
          dataClassification: 'Estimated Value',
        },
      ];
      break;
    }

    case 'agricultural_incidents':
    case 'damage_and_losses': {
      const incidents = incDash.incidents.filter((i) => withinDates(i.occurredAt, startDate, endDate));
      columns = [
        { key: 'date', label: 'Occurred Date' },
        { key: 'farm', label: 'Farm' },
        { key: 'type', label: 'Incident Type' },
        { key: 'title', label: 'Incident Summary' },
        { key: 'status', label: 'Status' },
        { key: 'affectedQty', label: 'Affected Qty', align: 'right' },
        { key: 'affectedHa', label: 'Affected Ha', align: 'right' },
        { key: 'estImpactZar', label: 'Est. Financial Impact (ZAR)', align: 'right' },
      ];
      rows = incidents.map((i) => ({
        date: i.occurredAt.slice(0, 10),
        farm: getSafeFarmLabel(i.farmId),
        type: i.incidentType.replace(/_/g, ' '),
        title: i.title,
        status: i.status,
        affectedQty: `${i.affectedQuantity} ${i.affectedUnit}`,
        affectedHa: i.affectedAreaHectares,
        estImpactZar: i.estimatedFinancialImpactZar,
      }));
      kpis = [
        { label: 'Incidents Reported', value: String(rows.length), dataClassification: 'Database Record' },
        {
          label: 'Active / Monitoring',
          value: String(incidents.filter((i) => i.status !== 'resolved').length),
          dataClassification: 'Database Record',
        },
        {
          label: 'Est. Financial Impact',
          value: `R${incidents.reduce((s, i) => s + i.estimatedFinancialImpactZar, 0).toLocaleString()}`,
          dataClassification: 'Estimated Value',
        },
      ];
      break;
    }

    case 'weather_observations': {
      const obs = store.db.weatherObservations.filter(
        (o) => targetFarmIds.includes(o.farmId) && withinDates(o.observationDate, startDate, endDate)
      );
      columns = [
        { key: 'date', label: 'Date' },
        { key: 'farm', label: 'Farm' },
        { key: 'source', label: 'Data Classification' },
        { key: 'reportedRainMm', label: 'Farmer Rain (mm)', align: 'right' },
        { key: 'forecastRainMm', label: 'Forecast Rain (mm)', align: 'right' },
        { key: 'tempC', label: 'Temp (°C)', align: 'right' },
        { key: 'wind', label: 'Wind' },
        { key: 'qc', label: 'QC Status' },
      ];
      rows = obs.map((o) => {
        const fc = store.db.weatherForecastRecords.find((f) => f.id === o.comparedForecastRecordId);
        return {
          date: o.observationDate,
          farm: getSafeFarmLabel(o.farmId),
          source: 'Farmer-Reported Observation',
          reportedRainMm: o.measuredRainfallMm ?? (o.rainfallOccurred ? 'Observed' : 0),
          forecastRainMm: fc ? fc.predictedRainfallMm : 'No snapshot',
          tempC: o.temperatureC ?? '—',
          wind: o.windObservation.replace(/_/g, ' '),
          qc: o.qcStatus,
        };
      });
      kpis = [
        { label: 'Farmer Observations', value: String(rows.length), dataClassification: 'Database Record' },
        {
          label: 'QC-Passed Reference',
          value: String(obs.filter((o) => o.qcStatus === 'qc_passed_reference').length),
          dataClassification: 'Database Record',
        },
      ];
      break;
    }

    case 'ai_insights': {
      const insights = store.db.aiInsightRecords.filter(
        (ai) =>
          (ai.userId === user.id || (ai.farmId && targetFarmIds.includes(ai.farmId))) &&
          withinDates(ai.createdAt, startDate, endDate)
      );
      columns = [
        { key: 'date', label: 'Date' },
        { key: 'farm', label: 'Farm Context' },
        { key: 'category', label: 'Category' },
        { key: 'title', label: 'Insight Title' },
        { key: 'summary', label: 'Summary (Advisory Only)' },
        { key: 'engine', label: 'Model Source' },
      ];
      rows = insights.map((ai) => ({
        date: ai.createdAt.slice(0, 10),
        farm: ai.farmId ? getSafeFarmLabel(ai.farmId) : 'Prospective / General',
        category: ai.category,
        title: ai.title,
        summary: ai.summary,
        engine: ai.poweredBy,
      }));
      kpis = [
        { label: 'AI Insights Logged', value: String(rows.length), dataClassification: 'AI Advisory' },
      ];
      break;
    }

    case 'business_planning': {
      const plans = store.db.businessPlans.filter(
        (p) => p.ownerId === user.id || (p.farmId && targetFarmIds.includes(p.farmId))
      );
      columns = [
        { key: 'planName', label: 'Scenario Name' },
        { key: 'scaleTier', label: 'Scale' },
        { key: 'areaHa', label: 'Area (ha)', align: 'right' },
        { key: 'estStartupZar', label: 'Est. Startup (ZAR)', align: 'right' },
        { key: 'estOperatingZar', label: 'Est. Operating (ZAR)', align: 'right' },
        { key: 'estRevenueZar', label: 'Est. Revenue (ZAR)', align: 'right' },
        { key: 'estProfitZar', label: 'Est. Operating P/L (ZAR)', align: 'right' },
      ];
      rows = plans.map((p) => {
        const calc = computeBusinessPlanMetrics(p);
        return {
          planName: isOrgAggregate && p.ownerId !== user.id ? `Member Plan (${p.province})` : p.planName,
          scaleTier: p.scaleTier.replace(/_/g, ' '),
          areaHa: p.farmSizeHectares,
          estStartupZar: calc.estimatedStartupCostsZar,
          estOperatingZar: calc.estimatedOperatingCostsZar,
          estRevenueZar: calc.estimatedRevenueZar,
          estProfitZar: calc.estimatedOperatingProfitLossZar,
        };
      });
      kpis = [
        { label: 'Saved Scenarios', value: String(rows.length), dataClassification: 'Estimated Value' },
        {
          label: 'Combined Est. Startup',
          value: `R${rows.reduce((s, r) => s + Number(r.estStartupZar || 0), 0).toLocaleString()}`,
          dataClassification: 'Estimated Value',
        },
      ];
      break;
    }

    case 'farm_expenses': {
      const mixed = store.db.mixedFarmingEntries.filter(
        (m) => targetFarmIds.includes(m.farmId) && m.expenseZar > 0 && withinDates(m.entryDate, startDate, endDate)
      );
      const cropActs = store.db.cropActivities.filter(
        (a) => targetFarmIds.includes(a.farmId) && a.valueZar > 0 && ['irrigation', 'fertiliser', 'pest', 'disease'].includes(a.activityType) && withinDates(a.activityDate, startDate, endDate)
      );
      const lvkRecs = store.db.livestockRecords.filter(
        (r) => targetFarmIds.includes(r.farmId) && r.valueZar > 0 && ['Purchase', 'Feeding', 'Veterinary', 'Vaccination'].includes(r.recordType) && withinDates(r.recordDate, startDate, endDate)
      );
      columns = [
        { key: 'date', label: 'Date' },
        { key: 'farm', label: 'Farm' },
        { key: 'ledger', label: 'Ledger Source' },
        { key: 'description', label: 'Expense Description' },
        { key: 'amountZar', label: 'Actual Expense (ZAR)', align: 'right' },
      ];
      rows = [
        ...mixed.map((m) => ({
          date: m.entryDate,
          farm: getSafeFarmLabel(m.farmId),
          ledger: 'Mixed Farming Ledger',
          description: m.title,
          amountZar: m.expenseZar,
        })),
        ...cropActs.map((a) => ({
          date: a.activityDate,
          farm: getSafeFarmLabel(a.farmId),
          ledger: 'Crop Activity Ledger',
          description: `${a.activityType}: ${a.notes || 'Input application'}`,
          amountZar: a.valueZar,
        })),
        ...lvkRecs.map((r) => ({
          date: r.recordDate,
          farm: getSafeFarmLabel(r.farmId),
          ledger: 'Livestock Ledger',
          description: `${r.recordType}: ${r.notes || 'Herd expense'}`,
          amountZar: r.valueZar,
        })),
      ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      kpis = [
        { label: 'Expense Entries', value: String(rows.length), dataClassification: 'Database Record' },
        {
          label: 'Total Actual Recorded Expenses',
          value: `R${rows.reduce((s, r) => s + Number(r.amountZar || 0), 0).toLocaleString()}`,
          dataClassification: 'Database Record',
        },
      ];
      break;
    }

    case 'farm_performance':
    default: {
      columns = [
        { key: 'farm', label: 'Farm' },
        { key: 'province', label: 'Province' },
        { key: 'hectares', label: 'Area (ha)', align: 'right' },
        { key: 'harvestKg', label: 'Harvested (kg)', align: 'right' },
        { key: 'livestockHead', label: 'Livestock Head', align: 'right' },
        { key: 'actualExpensesZar', label: 'Actual Expenses (ZAR)', align: 'right' },
        { key: 'estStockValueZar', label: 'Est. Stock Value (ZAR)', align: 'right' },
        { key: 'incidentsCount', label: 'Incidents', align: 'right' },
      ];
      rows = farms
        .filter(
          (f) =>
            farmingCategory === 'all' ||
            farmingCategory === 'mixed' ||
            f.farmingActivities.some((a) => a.toLowerCase().includes(farmingCategory.toLowerCase())) ||
            (matchesFarmingCat('crops') && stock.cropStocks.some((c) => c.farmId === f.id)) ||
            (matchesFarmingCat('livestock') && stock.livestockStocks.some((l) => l.farmId === f.id))
        )
        .map((f, idx) => {
          const loc = store.db.farmLocations.find((l) => l.farmId === f.id);
          const fCrops = matchesFarmingCat('crops')
            ? stock.cropStocks.filter((c) => c.farmId === f.id)
            : [];
          const fLvk = matchesFarmingCat('livestock')
            ? stock.livestockStocks.filter((l) => l.farmId === f.id)
            : [];
          const fMixed = store.db.mixedFarmingEntries.filter(
            (m) => m.farmId === f.id && withinDates(m.entryDate, startDate, endDate)
          );
          const fCropExp = matchesFarmingCat('crops')
            ? store.db.cropActivities.filter(
                (a) =>
                  a.farmId === f.id &&
                  ['irrigation', 'fertiliser', 'pest', 'disease'].includes(a.activityType) &&
                  withinDates(a.activityDate, startDate, endDate)
              )
            : [];
          const fLvkExp = matchesFarmingCat('livestock')
            ? store.db.livestockRecords.filter(
                (r) =>
                  r.farmId === f.id &&
                  ['Purchase', 'Feeding', 'Veterinary', 'Vaccination'].includes(r.recordType) &&
                  withinDates(r.recordDate, startDate, endDate)
              )
            : [];
          const actExp =
            fMixed.reduce((s, m) => s + m.expenseZar, 0) +
            fCropExp.reduce((s, a) => s + a.valueZar, 0) +
            fLvkExp.reduce((s, r) => s + r.valueZar, 0);
          const estVal =
            fCrops.reduce((s, c) => s + c.remainingStandingValueZar + c.storedStockValueZar, 0) +
            fLvk.reduce((s, l) => s + l.remainingValueZar, 0);

          return {
            farm: getSafeFarmLabel(f.id, idx + 1),
            province: loc?.province || 'SA',
            hectares: f.farmSizeHectares,
            harvestKg: Number(fCrops.reduce((s, c) => s + c.harvestedKg, 0).toFixed(1)),
            livestockHead: fLvk.reduce((s, l) => s + l.currentQuantity, 0),
            actualExpensesZar: Number(actExp.toFixed(2)),
            estStockValueZar: Number(estVal.toFixed(2)),
            incidentsCount: incDash.incidents.filter(
              (i) => i.farmId === f.id && withinDates(i.occurredAt, startDate, endDate)
            ).length,
          };
        });
      kpis = [
        {
          label: 'Total Actual Expenses',
          value: `R${rows.reduce((s, r) => s + Number(r.actualExpensesZar || 0), 0).toLocaleString()}`,
          dataClassification: 'Database Record',
        },
        {
          label: 'Est. Combined Stock Value',
          value: `R${rows.reduce((s, r) => s + Number(r.estStockValueZar || 0), 0).toLocaleString()}`,
          dataClassification: 'Estimated Value',
        },
      ];
      break;
    }
  }

  if (shouldRedactFinancials) {
    const privateFinancialKeys = new Set([
      'estValueZar',
      'unitPriceZar',
      'estRemainingZar',
      'estDamageLossZar',
      'estImpactZar',
      'amountZar',
      'actualExpensesZar',
      'estStockValueZar',
      'estStartupZar',
      'estOperatingZar',
      'estRevenueZar',
      'estProfitZar',
    ]);
    rows = rows.map((row) => {
      const next: Record<string, string | number> = { ...row };
      for (const k of Object.keys(next)) {
        if (privateFinancialKeys.has(k)) {
          next[k] = 'Protected (Farmer Privacy)';
        }
      }
      return next;
    });
    kpis = kpis.map((k) =>
      k.label.toLowerCase().includes('value') ||
      k.label.toLowerCase().includes('expense') ||
      k.label.toLowerCase().includes('startup') ||
      k.label.toLowerCase().includes('impact')
        ? { ...k, value: 'Protected (Privacy Scope)' }
        : k
    );
  }

  const farmLabel =
    requestedFarmId !== 'all'
      ? getSafeFarmLabel(requestedFarmId)
      : isOrgAggregate
      ? `Organisation Portfolio (${farms.length} Member Farms — Identity & Financial Privacy Protected)`
      : farms.length > 0
      ? `All Accessible Farms (${farms.length})`
      : 'Prospective / General Workspace';

  const now = new Date().toISOString();
  const reportId = `rep-${crypto.randomUUID()}`;
  const summaryHeadline = `${meta.label} · ${rows.length} record(s) · ${farmLabel}`;

  const historyItem: GeneratedReportRecord = {
    id: reportId,
    userId: user.id,
    roleCode: user.roleCode,
    reportType,
    reportTitle: meta.label,
    farmId: requestedFarmId,
    farmLabel,
    isAggregatedOrganisationReport: isOrgAggregate,
    startDate,
    endDate,
    farmingCategory,
    rowCount: rows.length,
    containsEstimatedValues: meta.containsEstimates,
    summaryHeadline,
    createdAt: now,
  };

  store.db.generatedReports.unshift(historyItem);
  if (store.db.generatedReports.length > 200) {
    store.db.generatedReports = store.db.generatedReports.slice(0, 200);
  }
  store.logAudit(
    user.id,
    'REPORT_GENERATED',
    'GeneratedReport',
    reportId,
    { reportType, farmId: requestedFarmId, isOrgAggregate, rowCount: rows.length },
    params.ipAddress || '127.0.0.1'
  );
  store.save();

  return {
    reportId,
    reportType,
    reportTitle: meta.label,
    generatedAt: now,
    generatedBy: user.profile?.fullName || user.email,
    farmLabel,
    isAggregatedOrganisationReport: isOrgAggregate,
    privacyNotice: isOrgAggregate
      ? 'Organisation Privacy Protection Active: Individual farmer identities, contact details, and private farm financial records are redacted in aggregated reports.'
      : expertLacksFinancial
      ? 'Expert Privacy Scope Active: Financial figures are redacted because financialSummary access was not granted by the farmer.'
      : 'Scoped to records owned by or explicitly shared with your account.',
    estimationNotice: meta.containsEstimates
      ? 'This report includes clearly labelled Estimated Values (stock valuations, impact estimates, business plans, or AI advisories) alongside verified database records.'
      : 'This report contains recorded database records only.',
    filters: {
      farmId: requestedFarmId,
      startDate,
      endDate,
      farmingCategory,
    },
    kpis,
    columns,
    rows,
  };
}
