import { store } from './store.ts';
import {
  BusinessPlanScenario,
  BusinessScaleTier,
  SanitizedUser,
} from './types.ts';

export const BUSINESS_PLANNER_DISCLAIMER =
  'Planning Estimate Notice: All financial projections, yields, and margins in the Business Planner are non-guaranteed planning estimates based on user assumptions. Actual expenses logged on registered farms are shown separately from planning estimates. Field Shift never promises guaranteed yields or profits.';

export interface EnterpriseTemplateDef {
  code: string;
  name: string;
  category: string;
  productionUnit: string;
  defaultMarketChannel: string;
  scenarios: Record<
    BusinessScaleTier,
    {
      label: string;
      farmSizeHectares: number;
      productionGoals: string;
      equipmentCostZar: number;
      equipmentNotes: string;
      seedsPlantingCostZar: number;
      fertilisersCostZar: number;
      feedCostZar: number;
      waterCostZar: number;
      waterDemandM3: number;
      labourWorkers: number;
      labourCostZar: number;
      infrastructureCostZar: number;
      operatingExpensesZar: number;
      expectedProductionQty: number;
      sellingPricePerUnitZar: number;
      assumptionsNotes: string;
    }
  >;
}

export const BUSINESS_ENTERPRISE_TEMPLATES: EnterpriseTemplateDef[] = [
  {
    code: 'horticulture_veg',
    name: 'Mixed Fresh Vegetables (Spinach, Cabbage & Tomatoes)',
    category: 'Horticulture & Crops',
    productionUnit: 'kg',
    defaultMarketChannel: 'Local Fresh Produce Market, Spaza Networks & School Nutrition',
    scenarios: {
      small_scale: {
        label: 'Small-Scale Plot (1 ha)',
        farmSizeHectares: 1,
        productionGoals: 'Staggered weekly leafy greens & cabbage harvest for local buyers within 30km.',
        equipmentCostZar: 18500,
        equipmentNotes: 'Knapsack sprayer, hand implements, harvest crates, digital scale.',
        seedsPlantingCostZar: 9500,
        fertilisersCostZar: 11200,
        feedCostZar: 0,
        waterCostZar: 6800,
        waterDemandM3: 4200,
        labourWorkers: 2,
        labourCostZar: 54000,
        infrastructureCostZar: 28000,
        operatingExpensesZar: 14500,
        expectedProductionQty: 18000,
        sellingPricePerUnitZar: 8.5,
        assumptionsNotes: 'Assumes 2 crop cycles/year across 1 ha under drip irrigation; excludes land purchase.',
      },
      medium_scale: {
        label: 'Medium-Scale Farm (5 ha)',
        farmSizeHectares: 5,
        productionGoals: 'Year-round rotational cabbage, Swiss chard, and tomato supply to regional wholesalers.',
        equipmentCostZar: 95000,
        equipmentNotes: 'Walk-behind/compact tractor implements, boom sprayer, sorting tables, cold trailer.',
        seedsPlantingCostZar: 44000,
        fertilisersCostZar: 52000,
        feedCostZar: 0,
        waterCostZar: 29000,
        waterDemandM3: 19500,
        labourWorkers: 7,
        labourCostZar: 196000,
        infrastructureCostZar: 110000,
        operatingExpensesZar: 68000,
        expectedProductionQty: 95000,
        sellingPricePerUnitZar: 8.2,
        assumptionsNotes: 'Assumes municipal fresh market wholesale pricing and staggered transplanting.',
      },
      large_scale: {
        label: 'Larger Commercial Operation (20 ha)',
        farmSizeHectares: 20,
        productionGoals: 'Contract retail packhouse & municipal market delivery with cold-chain dispatch.',
        equipmentCostZar: 420000,
        equipmentNotes: 'Tractor implement suite, precision planter, boom sprayer, packline equipment.',
        seedsPlantingCostZar: 165000,
        fertilisersCostZar: 198000,
        feedCostZar: 0,
        waterCostZar: 105000,
        waterDemandM3: 76000,
        labourWorkers: 22,
        labourCostZar: 640000,
        infrastructureCostZar: 380000,
        operatingExpensesZar: 245000,
        expectedProductionQty: 400000,
        sellingPricePerUnitZar: 8.0,
        assumptionsNotes: 'Assumes established packhouse shed and bulk input discounts; subject to market price swings.',
      },
    },
  },
  {
    code: 'dryland_maize',
    name: 'Summer Maize Grain (Dryland / Supplementary)',
    category: 'Field Crops',
    productionUnit: 'tonnes',
    defaultMarketChannel: 'Regional Grain Silo / Mill & Local Feed Buyers',
    scenarios: {
      small_scale: {
        label: 'Small-Scale Grain Block (3 ha)',
        farmSizeHectares: 3,
        productionGoals: 'Household food security plus surplus grain bags for local livestock feed buyers.',
        equipmentCostZar: 14000,
        equipmentNotes: 'Hired tractor ripping/planting assumed in operating costs; hand sprayers & scales.',
        seedsPlantingCostZar: 6900,
        fertilisersCostZar: 13500,
        feedCostZar: 0,
        waterCostZar: 1200,
        waterDemandM3: 0,
        labourWorkers: 2,
        labourCostZar: 18000,
        infrastructureCostZar: 12000,
        operatingExpensesZar: 16500,
        expectedProductionQty: 12,
        sellingPricePerUnitZar: 4200,
        assumptionsNotes: 'Assumes 4.0 t/ha dryland yield and contractor tillage; rain-dependent.',
      },
      medium_scale: {
        label: 'Medium-Scale Maize Farm (15 ha)',
        farmSizeHectares: 15,
        productionGoals: 'Commercial yellow/white maize delivery to regional silo or feedlot buyers.',
        equipmentCostZar: 165000,
        equipmentNotes: 'Used 2WD utility tractor deposit/implements, planter, spreader.',
        seedsPlantingCostZar: 33000,
        fertilisersCostZar: 69000,
        feedCostZar: 0,
        waterCostZar: 4500,
        waterDemandM3: 0,
        labourWorkers: 4,
        labourCostZar: 78000,
        infrastructureCostZar: 55000,
        operatingExpensesZar: 72000,
        expectedProductionQty: 75,
        sellingPricePerUnitZar: 4150,
        assumptionsNotes: 'Assumes 5.0 t/ha target yield with basal NPK + LAN top-dressing.',
      },
      large_scale: {
        label: 'Larger Grain Operation (60 ha)',
        farmSizeHectares: 60,
        productionGoals: 'Mechanised summer grain rotation (maize/soybean) with silo hedging.',
        equipmentCostZar: 680000,
        equipmentNotes: '4WD tractor fleet financing/implements, 6-row planter, boom sprayer.',
        seedsPlantingCostZar: 126000,
        fertilisersCostZar: 270000,
        feedCostZar: 0,
        waterCostZar: 15000,
        waterDemandM3: 0,
        labourWorkers: 9,
        labourCostZar: 265000,
        infrastructureCostZar: 190000,
        operatingExpensesZar: 280000,
        expectedProductionQty: 330,
        sellingPricePerUnitZar: 4100,
        assumptionsNotes: 'Assumes 5.5 t/ha average yield; excludes combine capital purchase (contracted in operating expenses).',
      },
    },
  },
  {
    code: 'poultry_broilers',
    name: 'Poultry Broiler Production (6 Cycles / Year)',
    category: 'Livestock & Poultry',
    productionUnit: 'birds',
    defaultMarketChannel: 'Direct Community Sales, Butcheries & Caterers',
    scenarios: {
      small_scale: {
        label: 'Small-Scale Coop (250 birds/cycle · 6 cycles)',
        farmSizeHectares: 0.25,
        productionGoals: '1,500 live/dressed broilers per year across 6 six-week cycles.',
        equipmentCostZar: 9500,
        equipmentNotes: 'Tube feeders, bell drinkers, infrared brooder lamps, crates.',
        seedsPlantingCostZar: 21000,
        fertilisersCostZar: 0,
        feedCostZar: 78000,
        waterCostZar: 3200,
        waterDemandM3: 180,
        labourWorkers: 1,
        labourCostZar: 32000,
        infrastructureCostZar: 34000,
        operatingExpensesZar: 16000,
        expectedProductionQty: 1410,
        sellingPricePerUnitZar: 105,
        assumptionsNotes: 'Seeds/planting field covers day-old chicks; assumes 6% mortality buffer across 1,500 placements.',
      },
      medium_scale: {
        label: 'Medium-Scale Poultry Unit (1,000 birds/cycle)',
        farmSizeHectares: 0.5,
        productionGoals: '6,000 birds/year (minus mortality) for local supermarkets & abattoir supply.',
        equipmentCostZar: 38000,
        equipmentNotes: 'Automated nipple drinkers, gas brooders, curtains, backup generator share.',
        seedsPlantingCostZar: 82000,
        fertilisersCostZar: 0,
        feedCostZar: 298000,
        waterCostZar: 9500,
        waterDemandM3: 720,
        labourWorkers: 3,
        labourCostZar: 96000,
        infrastructureCostZar: 125000,
        operatingExpensesZar: 54000,
        expectedProductionQty: 5640,
        sellingPricePerUnitZar: 98,
        assumptionsNotes: 'Assumes strict biosecurity, wood-shavings bedding, and 1.75 feed conversion ratio.',
      },
      large_scale: {
        label: 'Larger Commercial Poultry Houses (4,000 birds/cycle)',
        farmSizeHectares: 1.5,
        productionGoals: '24,000 birds/year contract supply across two climate-controlled houses.',
        equipmentCostZar: 165000,
        equipmentNotes: 'Tunnel ventilation fans, bulk feed silos, automated feed pan lines, backup power.',
        seedsPlantingCostZar: 315000,
        fertilisersCostZar: 0,
        feedCostZar: 1140000,
        waterCostZar: 32000,
        waterDemandM3: 2800,
        labourWorkers: 7,
        labourCostZar: 270000,
        infrastructureCostZar: 490000,
        operatingExpensesZar: 195000,
        expectedProductionQty: 22600,
        sellingPricePerUnitZar: 92,
        assumptionsNotes: 'High working-capital intensity; sensitive to feed price and power reliability.',
      },
    },
  },
  {
    code: 'livestock_goats_cattle',
    name: 'Boer Goats & Beef Cattle Grazing Enterprise',
    category: 'Livestock & Veld',
    productionUnit: 'head',
    defaultMarketChannel: 'Regional Auctions, Butcheries & Direct Livestock Buyers',
    scenarios: {
      small_scale: {
        label: 'Small-Scale Flock / Herd (15 ha)',
        farmSizeHectares: 15,
        productionGoals: '25 breeding Boer ewes/nannies or 12 beef cattle on rotational veld camps.',
        equipmentCostZar: 16000,
        equipmentNotes: 'Handling neck-clamp, ear-tagger, dosing guns, portable scale.',
        seedsPlantingCostZar: 68000,
        fertilisersCostZar: 4500,
        feedCostZar: 24000,
        waterCostZar: 8500,
        waterDemandM3: 650,
        labourWorkers: 1,
        labourCostZar: 42000,
        infrastructureCostZar: 65000,
        operatingExpensesZar: 19000,
        expectedProductionQty: 26,
        sellingPricePerUnitZar: 3200,
        assumptionsNotes: 'Seeds/planting field covers initial breeding stock acquisition; annual offspring marketed.',
      },
      medium_scale: {
        label: 'Medium-Scale Livestock Farm (60 ha)',
        farmSizeHectares: 60,
        productionGoals: '75 breeding goats & 25 Nguni/Bonsmara cows with winter lick supplementation.',
        equipmentCostZar: 52000,
        equipmentNotes: 'Livestock trailer, cattle crush & neck clamp, solar borehole pump.',
        seedsPlantingCostZar: 240000,
        fertilisersCostZar: 18000,
        feedCostZar: 82000,
        waterCostZar: 19000,
        waterDemandM3: 2400,
        labourWorkers: 3,
        labourCostZar: 132000,
        infrastructureCostZar: 175000,
        operatingExpensesZar: 58000,
        expectedProductionQty: 88,
        sellingPricePerUnitZar: 3600,
        assumptionsNotes: 'Assumes rotational camp fencing and annual vaccination/dipping programme.',
      },
      large_scale: {
        label: 'Larger Commercial Ranch (200 ha)',
        farmSizeHectares: 200,
        productionGoals: '120 beef breeding herd plus 150 goats with planted pasture hay production.',
        equipmentCostZar: 210000,
        equipmentNotes: 'Hay baler/mower implements, heavy livestock trailer, digital weighbridge.',
        seedsPlantingCostZar: 890000,
        fertilisersCostZar: 65000,
        feedCostZar: 245000,
        waterCostZar: 45000,
        waterDemandM3: 7500,
        labourWorkers: 7,
        labourCostZar: 320000,
        infrastructureCostZar: 440000,
        operatingExpensesZar: 165000,
        expectedProductionQty: 245,
        sellingPricePerUnitZar: 5400,
        assumptionsNotes: 'Blended beef weaner + goat marketings; multi-year breeding herd ramp-up required.',
      },
    },
  },
];

export function getActualFarmExpenses(farmId: string | null) {
  if (!farmId) return null;
  const farm = store.db.farms.find((f) => f.id === farmId);
  if (!farm) return null;

  const mixedExpensesZar = store.db.mixedFarmingEntries
    .filter((m) => m.farmId === farmId)
    .reduce((s, m) => s + (m.expenseZar || 0), 0);

  const livestockCostsZar = store.db.livestockRecords
    .filter(
      (r) =>
        r.farmId === farmId &&
        ['Purchase', 'Feeding', 'Veterinary', 'Vaccination'].includes(r.recordType)
    )
    .reduce((s, r) => s + (r.valueZar || 0), 0);

  const cropActivityCostsZar = store.db.cropActivities
    .filter(
      (a) =>
        a.farmId === farmId && ['fertiliser', 'irrigation', 'pest', 'disease'].includes(a.activityType)
    )
    .reduce((s, a) => s + (a.valueZar || 0), 0);

  return {
    farmId,
    farmName: farm.name,
    mixedExpensesZar: Number(mixedExpensesZar.toFixed(2)),
    livestockCostsZar: Number(livestockCostsZar.toFixed(2)),
    cropActivityCostsZar: Number(cropActivityCostsZar.toFixed(2)),
    totalActualRecordedExpensesZar: Number(
      (mixedExpensesZar + livestockCostsZar + cropActivityCostsZar).toFixed(2)
    ),
  };
}

export function computeBusinessPlanMetrics(
  plan: Omit<BusinessPlanScenario, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  }
) {
  const equipment = Math.max(0, Number(plan.equipmentCostZar) || 0);
  const infrastructure = Math.max(0, Number(plan.infrastructureCostZar) || 0);
  const seeds = Math.max(0, Number(plan.seedsPlantingCostZar) || 0);
  const fertilisers = Math.max(0, Number(plan.fertilisersCostZar) || 0);
  const feed = Math.max(0, Number(plan.feedCostZar) || 0);
  const water = Math.max(0, Number(plan.waterCostZar) || 0);
  const labour = Math.max(0, Number(plan.labourCostZar) || 0);
  const otherOps = Math.max(0, Number(plan.operatingExpensesZar) || 0);

  const estimatedStartupCostsZar = Number((equipment + infrastructure).toFixed(2));
  const estimatedOperatingCostsZar = Number(
    (seeds + fertilisers + feed + water + labour + otherOps).toFixed(2)
  );
  const totalYearOneOutlayZar = Number(
    (estimatedStartupCostsZar + estimatedOperatingCostsZar).toFixed(2)
  );

  const expectedProductionQty = Math.max(0, Number(plan.expectedProductionQty) || 0);
  const sellingPrice = Math.max(0, Number(plan.sellingPricePerUnitZar) || 0);
  const estimatedRevenueZar = Number((expectedProductionQty * sellingPrice).toFixed(2));
  const estimatedOperatingProfitLossZar = Number(
    (estimatedRevenueZar - estimatedOperatingCostsZar).toFixed(2)
  );
  const estimatedNetYearOneZar = Number(
    (estimatedRevenueZar - totalYearOneOutlayZar).toFixed(2)
  );

  const breakEvenUnits =
    sellingPrice > 0 ? Math.ceil(estimatedOperatingCostsZar / sellingPrice) : null;
  const breakEvenPriceZar =
    expectedProductionQty > 0
      ? Number((estimatedOperatingCostsZar / expectedProductionQty).toFixed(2))
      : null;

  const ha = Math.max(0.05, Number(plan.farmSizeHectares) || 1);
  const costPerHectareZar = Number((estimatedOperatingCostsZar / ha).toFixed(2));
  const revenuePerHectareZar = Number((estimatedRevenueZar / ha).toFixed(2));

  const rawItems: {
    key: string;
    label: string;
    categoryType: 'startup_capex' | 'operating_cost';
    amountZar: number;
  }[] = [
    { key: 'equipment', label: 'Equipment & Implements', categoryType: 'startup_capex', amountZar: equipment },
    { key: 'infrastructure', label: 'Infrastructure & Housing', categoryType: 'startup_capex', amountZar: infrastructure },
    { key: 'seeds', label: 'Seeds / Planting / Breeding Stock', categoryType: 'operating_cost', amountZar: seeds },
    { key: 'fertilisers', label: 'Fertilisers & Soil Amendments', categoryType: 'operating_cost', amountZar: fertilisers },
    { key: 'feed', label: 'Animal Feed & Supplements', categoryType: 'operating_cost', amountZar: feed },
    { key: 'water', label: 'Water & Pumping Costs', categoryType: 'operating_cost', amountZar: water },
    { key: 'labour', label: 'Labour & Wages', categoryType: 'operating_cost', amountZar: labour },
    { key: 'operating', label: 'Other Operating Expenses (Fuel, Vet, Packaging)', categoryType: 'operating_cost', amountZar: otherOps },
  ];

  const denom = totalYearOneOutlayZar > 0 ? totalYearOneOutlayZar : 1;
  const costBreakdown = rawItems.map((item) => ({
    ...item,
    sharePercent: Number(((item.amountZar / denom) * 100).toFixed(1)),
  }));

  const actualSummary = getActualFarmExpenses(plan.farmId);
  const waterDemandM3 = Math.max(0, Number(plan.waterDemandM3) || 0);
  const labourWorkers = Math.max(0, Number(plan.labourWorkers) || 0);

  return {
    estimatedStartupCostsZar,
    estimatedOperatingCostsZar,
    totalYearOneOutlayZar,
    estimatedProductionQty: expectedProductionQty,
    productionUnit: plan.productionUnit || 'units',
    estimatedRevenueZar,
    estimatedOperatingProfitLossZar,
    estimatedNetYearOneZar,
    breakEvenUnits,
    breakEvenPriceZar,
    costPerHectareZar,
    revenuePerHectareZar,
    costBreakdown,
    resourceRequirements: {
      waterDemandM3,
      waterDemandLiters: Math.round(waterDemandM3 * 1000),
      labourWorkers,
      farmSizeHectares: ha,
      summaryText: `${ha} ha · ${labourWorkers} worker(s) · ${waterDemandM3.toLocaleString()} m³ (${Math.round(
        waterDemandM3 * 1000
      ).toLocaleString()} L) estimated seasonal water requirement.`,
    },
    actualFarmExpensesZar: actualSummary ? actualSummary.totalActualRecordedExpensesZar : null,
    actualExpensesNote: actualSummary
      ? `Linked Farm "${actualSummary.farmName}" Actual Recorded Expenses: R${actualSummary.totalActualRecordedExpensesZar.toLocaleString()} (Mixed R${actualSummary.mixedExpensesZar.toLocaleString()}, Livestock R${actualSummary.livestockCostsZar.toLocaleString()}, Crop Inputs R${actualSummary.cropActivityCostsZar.toLocaleString()}). Shown separately from estimated planning figures.`
      : 'No registered farm linked — all costs shown are estimated planning assumptions.',
    disclaimer: BUSINESS_PLANNER_DISCLAIMER,
  };
}

export function buildBusinessPlannerOverview(user: SanitizedUser, accessibleFarmIds: string[]) {
  const savedPlans = store.db.businessPlans
    .filter((p) => p.ownerId === user.id || user.roleCode === 'system_administrator')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((p) => {
      const farm = p.farmId ? store.db.farms.find((f) => f.id === p.farmId) : null;
      return {
        ...p,
        farmName: farm?.name || null,
        calculation: computeBusinessPlanMetrics(p),
      };
    });

  const farmActualExpenses = accessibleFarmIds
    .map((fid) => getActualFarmExpenses(fid))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return {
    templates: BUSINESS_ENTERPRISE_TEMPLATES,
    savedPlans,
    farmActualExpenses,
    disclaimer: BUSINESS_PLANNER_DISCLAIMER,
  };
}
