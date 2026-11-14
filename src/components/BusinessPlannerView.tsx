import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  AuthUser,
  BusinessEnterpriseTemplate,
  BusinessPlanCalculation,
  BusinessPlanScenarioItem,
  BusinessPlannerOverviewPayload,
  BusinessScaleTier,
  FarmItem,
  LanguageCode,
  ProvinceInfo,
} from '../types';
import { SpeakButton } from './AccessibilityControls';

interface BusinessPlannerViewProps {
  user: AuthUser;
  farms: FarmItem[];
  provinces: ProvinceInfo[];
  languageCode: LanguageCode;
  isSpeaking: boolean;
  speechSupported: boolean;
  onSpeak: (txt: string) => void;
  onStopSpeaking: () => void;
}

interface PlannerDraft {
  id: string | null;
  farmId: string;
  planName: string;
  farmingType: string;
  scaleTier: BusinessScaleTier;
  province: string;
  district: string;
  farmSizeHectares: number;
  productionGoals: string;
  marketChannel: string;
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
  productionUnit: string;
  sellingPricePerUnitZar: number;
  assumptionsNotes: string;
}

const SCALE_TIERS: { code: BusinessScaleTier; label: string }[] = [
  { code: 'small_scale', label: 'Small-Scale' },
  { code: 'medium_scale', label: 'Medium-Scale' },
  { code: 'large_scale', label: 'Larger Operation' },
];

function computeLocalMetrics(
  draft: PlannerDraft,
  disclaimer: string,
  actualExpenseZar: number | null
): BusinessPlanCalculation {
  const startup = Math.max(0, draft.equipmentCostZar) + Math.max(0, draft.infrastructureCostZar);
  const operating =
    Math.max(0, draft.seedsPlantingCostZar) +
    Math.max(0, draft.fertilisersCostZar) +
    Math.max(0, draft.feedCostZar) +
    Math.max(0, draft.waterCostZar) +
    Math.max(0, draft.labourCostZar) +
    Math.max(0, draft.operatingExpensesZar);
  const totalOutlay = startup + operating;
  const qty = Math.max(0, draft.expectedProductionQty);
  const price = Math.max(0, draft.sellingPricePerUnitZar);
  const revenue = Number((qty * price).toFixed(2));
  const operatingProfitLoss = Number((revenue - operating).toFixed(2));
  const netYearOne = Number((revenue - totalOutlay).toFixed(2));
  const ha = Math.max(0.05, draft.farmSizeHectares || 1);

  const items: {
    key: string;
    label: string;
    categoryType: 'startup_capex' | 'operating_cost';
    amountZar: number;
  }[] = [
    { key: 'equipment', label: 'Equipment & Tools (Capex)', categoryType: 'startup_capex', amountZar: Math.max(0, draft.equipmentCostZar) },
    { key: 'infrastructure', label: 'Infrastructure & Structures (Capex)', categoryType: 'startup_capex', amountZar: Math.max(0, draft.infrastructureCostZar) },
    { key: 'seeds', label: 'Seeds / Planting / Starter Stock', categoryType: 'operating_cost', amountZar: Math.max(0, draft.seedsPlantingCostZar) },
    { key: 'fertilisers', label: 'Fertilisers & Soil Amendments', categoryType: 'operating_cost', amountZar: Math.max(0, draft.fertilisersCostZar) },
    { key: 'feed', label: 'Animal Feed & Supplements', categoryType: 'operating_cost', amountZar: Math.max(0, draft.feedCostZar) },
    { key: 'water', label: 'Water & Pumping Supply', categoryType: 'operating_cost', amountZar: Math.max(0, draft.waterCostZar) },
    { key: 'labour', label: `Labour (${draft.labourWorkers} workers)`, categoryType: 'operating_cost', amountZar: Math.max(0, draft.labourCostZar) },
    { key: 'operating', label: 'Other Operating Expenses', categoryType: 'operating_cost', amountZar: Math.max(0, draft.operatingExpensesZar) },
  ];

  const denom = Math.max(1, totalOutlay);
  const costBreakdown = items.map((it) => ({
    ...it,
    sharePercent: Number(((it.amountZar / denom) * 100).toFixed(1)),
  }));

  return {
    estimatedStartupCostsZar: Number(startup.toFixed(2)),
    estimatedOperatingCostsZar: Number(operating.toFixed(2)),
    totalYearOneOutlayZar: Number(totalOutlay.toFixed(2)),
    estimatedProductionQty: qty,
    productionUnit: draft.productionUnit || 'units',
    estimatedRevenueZar: revenue,
    estimatedOperatingProfitLossZar: operatingProfitLoss,
    estimatedNetYearOneZar: netYearOne,
    breakEvenUnits: price > 0 ? Math.ceil(operating / price) : null,
    breakEvenPriceZar: qty > 0 ? Number((operating / qty).toFixed(2)) : null,
    costPerHectareZar: Number((operating / ha).toFixed(2)),
    revenuePerHectareZar: Number((revenue / ha).toFixed(2)),
    costBreakdown,
    resourceRequirements: {
      waterDemandM3: Math.max(0, draft.waterDemandM3),
      waterDemandLiters: Math.max(0, Math.round(draft.waterDemandM3 * 1000)),
      labourWorkers: Math.max(0, draft.labourWorkers),
      farmSizeHectares: ha,
      summaryText: `${ha} ha · ${Math.max(0, draft.labourWorkers)} worker(s) · ${Math.max(0, draft.waterDemandM3).toLocaleString()} m³ est. seasonal water`,
    },
    actualFarmExpensesZar: actualExpenseZar,
    actualExpensesNote:
      actualExpenseZar !== null
        ? 'Actual recorded expenses shown from linked farm logs — kept strictly separate from planning estimates.'
        : 'Prospective / unlinked scenario — no registered farm expense ledger linked yet.',
    disclaimer,
  };
}

function buildDraftFromTemplate(
  tpl: BusinessEnterpriseTemplate,
  tier: BusinessScaleTier,
  province: string,
  district: string,
  farmId = ''
): PlannerDraft {
  const sc = tpl.scenarios[tier];
  return {
    id: null,
    farmId,
    planName: `${tpl.name.split('(')[0].trim()} — ${SCALE_TIERS.find((t) => t.code === tier)?.label || tier}`,
    farmingType: tpl.code,
    scaleTier: tier,
    province,
    district,
    farmSizeHectares: sc.farmSizeHectares,
    productionGoals: sc.productionGoals,
    marketChannel: tpl.defaultMarketChannel,
    equipmentCostZar: sc.equipmentCostZar,
    equipmentNotes: sc.equipmentNotes,
    seedsPlantingCostZar: sc.seedsPlantingCostZar,
    fertilisersCostZar: sc.fertilisersCostZar,
    feedCostZar: sc.feedCostZar,
    waterCostZar: sc.waterCostZar,
    waterDemandM3: sc.waterDemandM3,
    labourWorkers: sc.labourWorkers,
    labourCostZar: sc.labourCostZar,
    infrastructureCostZar: sc.infrastructureCostZar,
    operatingExpensesZar: sc.operatingExpensesZar,
    expectedProductionQty: sc.expectedProductionQty,
    productionUnit: tpl.productionUnit,
    sellingPricePerUnitZar: sc.sellingPricePerUnitZar,
    assumptionsNotes: sc.assumptionsNotes,
  };
}

function planToDraft(p: BusinessPlanScenarioItem): PlannerDraft {
  return {
    id: p.id,
    farmId: p.farmId || '',
    planName: p.planName,
    farmingType: p.farmingType,
    scaleTier: p.scaleTier,
    province: p.province,
    district: p.district,
    farmSizeHectares: p.farmSizeHectares,
    productionGoals: p.productionGoals,
    marketChannel: p.marketChannel,
    equipmentCostZar: p.equipmentCostZar,
    equipmentNotes: p.equipmentNotes,
    seedsPlantingCostZar: p.seedsPlantingCostZar,
    fertilisersCostZar: p.fertilisersCostZar,
    feedCostZar: p.feedCostZar,
    waterCostZar: p.waterCostZar,
    waterDemandM3: p.waterDemandM3,
    labourWorkers: p.labourWorkers,
    labourCostZar: p.labourCostZar,
    infrastructureCostZar: p.infrastructureCostZar,
    operatingExpensesZar: p.operatingExpensesZar,
    expectedProductionQty: p.expectedProductionQty,
    productionUnit: p.productionUnit,
    sellingPricePerUnitZar: p.sellingPricePerUnitZar,
    assumptionsNotes: p.assumptionsNotes,
  };
}

function formatZar(val: number): string {
  const sign = val < 0 ? '-' : '';
  return `${sign}R${Math.abs(Math.round(val)).toLocaleString()}`;
}

export const BusinessPlannerView: React.FC<BusinessPlannerViewProps> = ({
  user,
  farms,
  provinces,
  languageCode,
  isSpeaking,
  speechSupported,
  onSpeak,
  onStopSpeaking,
}) => {
  const [overview, setOverview] = useState<BusinessPlannerOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverCalc, setServerCalc] = useState<BusinessPlanCalculation | null>(null);

  const defaultProvince = user.profile?.province || provinces[0]?.name || 'KwaZulu-Natal';
  const defaultDistrict = user.profile?.district || provinces[0]?.districts?.[0]?.name || '';

  const [draft, setDraft] = useState<PlannerDraft>({
    id: null,
    farmId: farms[0]?.id || '',
    planName: 'First-Season Horticulture Scenario',
    farmingType: 'horticulture_veg',
    scaleTier: 'small_scale',
    province: defaultProvince,
    district: defaultDistrict,
    farmSizeHectares: 1,
    productionGoals: 'Staggered weekly vegetable production for local buyers.',
    marketChannel: 'Local Fresh Produce Market & Direct Buyers',
    equipmentCostZar: 18500,
    equipmentNotes: 'Knapsack sprayer, hand tools, crates, scale.',
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
    productionUnit: 'kg',
    sellingPricePerUnitZar: 8.5,
    assumptionsNotes: 'Subject to seasonal rainfall, input price shifts, and buyer agreements.',
  });

  const loadPlanner = useCallback(async (selectFirst = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<BusinessPlannerOverviewPayload>('/api/business-planner');
      setOverview(data);
      if (selectFirst) {
        if (data.savedPlans.length > 0) {
          setDraft(planToDraft(data.savedPlans[0]));
        } else if (data.templates.length > 0) {
          setDraft(
            buildDraftFromTemplate(
              data.templates[0],
              'small_scale',
              defaultProvince,
              defaultDistrict,
              farms[0]?.id || ''
            )
          );
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load business planner.');
    } finally {
      setLoading(false);
    }
  }, [defaultDistrict, defaultProvince, farms]);

  useEffect(() => {
    loadPlanner(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced server calculation confirmation for current assumptions
  useEffect(() => {
    const timer = setTimeout(() => {
      apiRequest<BusinessPlanCalculation>('/api/business-planner/calculate', {
        method: 'POST',
        body: JSON.stringify(draft),
      })
        .then(setServerCalc)
        .catch(() => {});
    }, 220);
    return () => clearTimeout(timer);
  }, [draft]);

  const linkedActualExpense = useMemo(() => {
    if (!draft.farmId || !overview) return null;
    return overview.farmActualExpenses.find((f) => f.farmId === draft.farmId) || null;
  }, [draft.farmId, overview]);

  const liveCalc = useMemo(() => {
    const local = computeLocalMetrics(
      draft,
      overview?.disclaimer ||
        'All projections are non-guaranteed planning estimates based on your assumptions.',
      linkedActualExpense ? linkedActualExpense.totalActualRecordedExpensesZar : null
    );
    // Prefer instant local reactivity, keeping server confirmation aligned
    if (
      serverCalc &&
      serverCalc.estimatedOperatingCostsZar === local.estimatedOperatingCostsZar &&
      serverCalc.estimatedRevenueZar === local.estimatedRevenueZar
    ) {
      return serverCalc;
    }
    return local;
  }, [draft, linkedActualExpense, overview?.disclaimer, serverCalc]);

  const activeTemplate = useMemo(
    () =>
      overview?.templates.find((t) => t.code === draft.farmingType) ||
      overview?.templates[0] ||
      null,
    [overview?.templates, draft.farmingType]
  );

  // Build side-by-side comparison across Small, Medium, Large + Active Custom Draft
  const comparisonRows = useMemo(() => {
    if (!activeTemplate) return [];
    const disclaimer = overview?.disclaimer || '';
    const baseTiers = SCALE_TIERS.map((t) => {
      const presetDraft = buildDraftFromTemplate(
        activeTemplate,
        t.code,
        draft.province,
        draft.district,
        ''
      );
      return {
        key: t.code,
        label: t.label,
        isCurrent: false,
        ha: presetDraft.farmSizeHectares,
        workers: presetDraft.labourWorkers,
        qty: presetDraft.expectedProductionQty,
        unit: presetDraft.productionUnit,
        calc: computeLocalMetrics(presetDraft, disclaimer, null),
      };
    });

    return [
      ...baseTiers,
      {
        key: 'custom_current',
        label: `Your Draft (${draft.scaleTier.replace('_', ' ')})`,
        isCurrent: true,
        ha: draft.farmSizeHectares,
        workers: draft.labourWorkers,
        qty: draft.expectedProductionQty,
        unit: draft.productionUnit,
        calc: liveCalc,
      },
    ];
  }, [activeTemplate, draft, liveCalc, overview?.disclaimer]);

  const maxChartValue = useMemo(() => {
    const vals = comparisonRows.flatMap((r) => [
      r.calc.estimatedStartupCostsZar,
      r.calc.estimatedOperatingCostsZar,
      r.calc.estimatedRevenueZar,
    ]);
    return Math.max(1000, ...vals);
  }, [comparisonRows]);

  const handleApplyTemplate = (tplCode: string, tier: BusinessScaleTier) => {
    const tpl = overview?.templates.find((t) => t.code === tplCode);
    if (!tpl) return;
    const next = buildDraftFromTemplate(
      tpl,
      tier,
      draft.province,
      draft.district,
      draft.farmId
    );
    next.id = draft.id;
    setDraft(next);
    setNotice(`Loaded ${tpl.name} (${tier.replace('_', '-')} preset). Adjust any figure below.`);
  };

  const handleSelectProvince = (provName: string) => {
    const p = provinces.find((x) => x.name === provName);
    setDraft((prev) => ({
      ...prev,
      province: provName,
      district: p?.districts?.[0]?.name || prev.district,
    }));
  };

  const handleSelectFarmLink = (farmId: string) => {
    const f = farms.find((x) => x.id === farmId);
    setDraft((prev) => ({
      ...prev,
      farmId,
      province: f?.location?.province || prev.province,
      district: f?.location?.districtMunicipality || prev.district,
    }));
  };

  const handleSavePlan = async (saveAsNew = false) => {
    if (!draft.planName.trim()) {
      setError('Please enter a plan name before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = { ...draft, farmId: draft.farmId || null };
      let saved: BusinessPlanScenarioItem;
      if (draft.id && !saveAsNew) {
        saved = await apiRequest<BusinessPlanScenarioItem>(
          `/api/business-planner/plans/${draft.id}`,
          { method: 'PUT', body: JSON.stringify(payload) }
        );
        setNotice(`Updated scenario "${saved.planName}".`);
      } else {
        saved = await apiRequest<BusinessPlanScenarioItem>('/api/business-planner/plans', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setNotice(`Saved new scenario "${saved.planName}".`);
      }
      setDraft(planToDraft(saved));
      await loadPlanner(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save business plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/business-planner/plans/${planId}`, { method: 'DELETE' });
      if (draft.id === planId) {
        setDraft((prev) => ({ ...prev, id: null }));
      }
      setNotice('Saved scenario deleted.');
      await loadPlanner(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to delete scenario.');
    }
  };

  const triggerDownload = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const rows: string[][] = [
      ['Field Shift Agricultural Business Plan Export (ESTIMATED VALUES - NON-GUARANTEED)'],
      ['Plan Name', draft.planName],
      ['Farming Enterprise', activeTemplate?.name || draft.farmingType],
      ['Scale Tier', draft.scaleTier],
      ['Location', `${draft.district ? `${draft.district}, ` : ''}${draft.province}`],
      ['Farm Size (ha)', String(draft.farmSizeHectares)],
      ['Production Goals', draft.productionGoals],
      ['Market Channel', draft.marketChannel],
      [''],
      ['COST & REVENUE LINE ITEMS (ESTIMATED)', 'Category', 'Amount (ZAR)', 'Share (%)'],
      ...liveCalc.costBreakdown.map((c) => [
        c.label,
        c.categoryType === 'startup_capex' ? 'Estimated Startup Capex' : 'Estimated Operating Cost',
        String(c.amountZar),
        `${c.sharePercent}%`,
      ]),
      [''],
      ['SUMMARY ESTIMATES', 'Value'],
      ['Estimated Startup Costs (ZAR)', String(liveCalc.estimatedStartupCostsZar)],
      ['Estimated Operating Costs (ZAR)', String(liveCalc.estimatedOperatingCostsZar)],
      ['Total Year-1 Outlay (ZAR)', String(liveCalc.totalYearOneOutlayZar)],
      ['Expected Production', `${draft.expectedProductionQty} ${draft.productionUnit}`],
      ['Assumed Selling Price / Unit (ZAR)', String(draft.sellingPricePerUnitZar)],
      ['Estimated Potential Revenue (ZAR)', String(liveCalc.estimatedRevenueZar)],
      ['Estimated Operating Profit/Loss (ZAR)', String(liveCalc.estimatedOperatingProfitLossZar)],
      ['Estimated Net Year-1 Position after Capex (ZAR)', String(liveCalc.estimatedNetYearOneZar)],
      ['Break-Even Output', liveCalc.breakEvenUnits !== null ? `${liveCalc.breakEvenUnits} ${draft.productionUnit}` : 'N/A'],
      ['Break-Even Price / Unit (ZAR)', liveCalc.breakEvenPriceZar !== null ? String(liveCalc.breakEvenPriceZar) : 'N/A'],
      [''],
      ['ACTUAL RECORDED FARM EXPENSES (SEPARATE FROM ESTIMATES)', linkedActualExpense ? linkedActualExpense.farmName : 'None linked', linkedActualExpense ? String(linkedActualExpense.totalActualRecordedExpensesZar) : 'N/A'],
      ['Disclaimer', liveCalc.disclaimer],
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const slug = draft.planName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'business-plan';
    triggerDownload(`fieldshift-${slug}.csv`, csv, 'text/csv;charset=utf-8');
    setNotice('Downloaded CSV schedule.');
  };

  const handleDownloadHtmlReport = () => {
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Field Shift Business Plan — ${draft.planName}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #17201B; max-width: 900px; margin: 32px auto; padding: 0 20px; line-height: 1.5; }
  h1, h2 { color: #143326; }
  .notice { background: #FFF8EB; border: 1px solid #E2C693; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin: 16px 0; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .kpi { border: 1px solid #D4DDD2; border-radius: 8px; padding: 12px; }
  .kpi small { color: #4A5A50; display: block; font-size: 11px; }
  .kpi strong { font-size: 18px; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th, td { border-bottom: 1px solid #E2E6DF; padding: 8px 6px; text-align: left; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
  <h1>Field Shift Farming Business Plan</h1>
  <p><strong>Scenario:</strong> ${draft.planName} · <strong>Scale:</strong> ${draft.scaleTier.replace('_', ' ')} · <strong>Location:</strong> ${draft.district ? `${draft.district}, ` : ''}${draft.province}</p>
  <div class="notice">
    <strong>Important Planning Disclaimer:</strong> ${liveCalc.disclaimer}
  </div>
  <div class="grid">
    <div class="kpi"><small>Est. Startup Capex</small><strong>${formatZar(liveCalc.estimatedStartupCostsZar)}</strong></div>
    <div class="kpi"><small>Est. Operating Costs</small><strong>${formatZar(liveCalc.estimatedOperatingCostsZar)}</strong></div>
    <div class="kpi"><small>Est. Potential Revenue</small><strong>${formatZar(liveCalc.estimatedRevenueZar)}</strong></div>
    <div class="kpi"><small>Est. Operating Margin</small><strong>${formatZar(liveCalc.estimatedOperatingProfitLossZar)}</strong></div>
  </div>
  <h2>Enterprise Inputs & Resource Requirements</h2>
  <p><strong>Farming Type:</strong> ${activeTemplate?.name || draft.farmingType} (${draft.farmSizeHectares} ha)</p>
  <p><strong>Production Goals:</strong> ${draft.productionGoals}</p>
  <p><strong>Market Channel:</strong> ${draft.marketChannel}</p>
  <p><strong>Equipment Plan:</strong> ${draft.equipmentNotes}</p>
  <p><strong>Resources:</strong> ${liveCalc.resourceRequirements.summaryText}</p>
  <h2>Estimated Cost Structure</h2>
  <table>
    <thead><tr><th>Line Item</th><th>Cost Type</th><th class="num">Estimated ZAR</th><th class="num">Share</th></tr></thead>
    <tbody>
      ${liveCalc.costBreakdown
        .map(
          (c) =>
            `<tr><td>${c.label}</td><td>${c.categoryType === 'startup_capex' ? 'Startup Capex' : 'Operating'}</td><td class="num">${formatZar(c.amountZar)}</td><td class="num">${c.sharePercent}%</td></tr>`
        )
        .join('')}
    </tbody>
  </table>
  <h2>Scale Scenario Comparison (${activeTemplate?.name || draft.farmingType})</h2>
  <table>
    <thead><tr><th>Scenario</th><th class="num">Hectares</th><th class="num">Est. Startup</th><th class="num">Est. Operating</th><th class="num">Est. Revenue</th><th class="num">Est. Operating P/L</th></tr></thead>
    <tbody>
      ${comparisonRows
        .map(
          (r) =>
            `<tr><td>${r.label}</td><td class="num">${r.ha} ha</td><td class="num">${formatZar(r.calc.estimatedStartupCostsZar)}</td><td class="num">${formatZar(r.calc.estimatedOperatingCostsZar)}</td><td class="num">${formatZar(r.calc.estimatedRevenueZar)}</td><td class="num">${formatZar(r.calc.estimatedOperatingProfitLossZar)}</td></tr>`
        )
        .join('')}
    </tbody>
  </table>
  <h2>Actual Farm Expenses vs Planning Estimates</h2>
  <p>${
    linkedActualExpense
      ? `Linked Farm: <strong>${linkedActualExpense.farmName}</strong> — Total Actual Recorded Expenses to Date: <strong>${formatZar(linkedActualExpense.totalActualRecordedExpensesZar)}</strong> (Mixed ops: ${formatZar(linkedActualExpense.mixedExpensesZar)}, Livestock: ${formatZar(linkedActualExpense.livestockCostsZar)}, Crop activities: ${formatZar(linkedActualExpense.cropActivityCostsZar)}). Kept strictly separate from projected estimates.`
      : 'No existing registered farm ledger linked to this scenario yet.'
  }</p>
  <p><small>Generated by Field Shift on ${new Date().toLocaleDateString()} · Assumptions: ${draft.assumptionsNotes}</small></p>
</body>
</html>`;
    const slug = draft.planName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'business-plan';
    triggerDownload(`fieldshift-report-${slug}.html`, html, 'text/html;charset=utf-8');
    setNotice('Downloaded printable HTML business plan report.');
  };

  const numField = (key: keyof PlannerDraft, val: string) => {
    const n = Number(val);
    setDraft((prev) => ({ ...prev, [key]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  };

  const selectedProvObj = provinces.find((p) => p.name === draft.province);

  const spokenSummary = `Farming business plan ${draft.planName} for ${draft.farmSizeHectares} hectares in ${draft.province}. Estimated startup costs are ${Math.round(liveCalc.estimatedStartupCostsZar)} rand. Estimated operating costs are ${Math.round(liveCalc.estimatedOperatingCostsZar)} rand. Based on ${draft.expectedProductionQty} ${draft.productionUnit} at ${draft.sellingPricePerUnitZar} rand per unit, potential revenue is ${Math.round(liveCalc.estimatedRevenueZar)} rand, giving an estimated operating balance of ${Math.round(liveCalc.estimatedOperatingProfitLossZar)} rand. These are planning estimates only and not guaranteed outcomes.`;

  return (
    <div className="space-y-6">
      {/* Header & Exports */}
      <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#2D6A4F]">
            <Briefcase className="w-4 h-4" />
            <span>Prospective & Existing Farmers · Financial Scenario Modeller</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#143326]">
            Farming Business Planner
          </h1>
          <p className="text-sm text-[#4A5A50]">
            Model startup capital, input costs, labour, water needs, and potential revenue across small-, medium-, and larger-scale scenarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SpeakButton
            text={spokenSummary}
            languageCode={languageCode}
            isSpeaking={isSpeaking}
            onSpeak={onSpeak}
            onStop={onStopSpeaking}
            supported={speechSupported}
            label="Listen Summary"
          />
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#D4DDD2] bg-white hover:bg-[#EDF2EC] text-sm font-semibold text-[#143326] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#1B4332]" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadHtmlReport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-sm font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {/* Mandatory Non-Guarantee & Actuals vs Estimates Governance Notice */}
      <div className="bg-[#FFF9ED] border border-[#E7CFA1] rounded-xl px-4 py-3 text-xs sm:text-sm text-[#614210] flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#9B6A16]" />
        <div className="space-y-1">
          <p className="font-semibold">
            Planning Estimates Only — Never Guaranteed Profits or Yields
          </p>
          <p>
            {overview?.disclaimer ||
              'All calculations below represent estimated planning assumptions entered or adjusted by you. Yields, rainfall, input inflation, and market prices vary. Actual expenses logged on registered farms are tracked separately below.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] text-[#143326] rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Template Quick-Loader + Saved Scenarios */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-[#143326]">
              1. Choose Enterprise Baseline & Scale Tier
            </h2>
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-[#4A5A50]" />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#35443B] mb-1">
                Farming Type Preset
              </label>
              <select
                value={draft.farmingType}
                onChange={(e) => handleApplyTemplate(e.target.value, draft.scaleTier)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm font-medium text-[#143326]"
              >
                {(overview?.templates || []).map((tpl) => (
                  <option key={tpl.code} value={tpl.code}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#35443B] mb-1">
                Operation Scale Preset
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-[#F6F7F4] p-1 rounded-xl border border-[#E2E6DF]">
                {SCALE_TIERS.map((tier) => (
                  <button
                    key={tier.code}
                    type="button"
                    onClick={() => handleApplyTemplate(draft.farmingType, tier.code)}
                    className={`px-2 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      draft.scaleTier === tier.code
                        ? 'bg-[#1B4332] text-white'
                        : 'text-[#35443B] hover:bg-white'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {activeTemplate && (
            <p className="text-xs text-[#4A5A50]">
              Category: <span className="font-semibold text-[#143326]">{activeTemplate.category}</span> ·
              Output Unit: <span className="font-mono font-semibold text-[#143326]">{activeTemplate.productionUnit}</span> ·
              Typical Market: {activeTemplate.defaultMarketChannel}
            </p>
          )}
        </div>

        {/* Saved Scenarios Manager */}
        <div className="lg:col-span-5 bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-[#143326]">
              Saved Scenarios ({overview?.savedPlans.length || 0})
            </h2>
            <button
              type="button"
              onClick={() => {
                setDraft((prev) => ({
                  ...prev,
                  id: null,
                  planName: `${prev.planName.replace(/\s*\(Copy\)$/i, '')} (New)`,
                }));
                setNotice('Started fresh unsaved scenario draft from current inputs.');
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Draft</span>
            </button>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {(overview?.savedPlans || []).length === 0 ? (
              <p className="text-xs text-[#4A5A50]">
                No saved business plans yet. Adjust the inputs below and save your first scenario.
              </p>
            ) : (
              overview?.savedPlans.map((p) => {
                const isSelected = draft.id === p.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
                      isSelected
                        ? 'bg-[#EDF5EF] border-[#1B4332]'
                        : 'bg-[#F6F7F4] border-[#E2E6DF]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(planToDraft(p));
                        setNotice(`Loaded saved plan "${p.planName}".`);
                      }}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <p className="font-semibold text-[#143326] truncate">{p.planName}</p>
                      <p className="text-[#4A5A50] font-mono tabular-nums">
                        {p.farmSizeHectares} ha · Est. Rev {formatZar(p.calculation.estimatedRevenueZar)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(p.id)}
                      aria-label={`Delete ${p.planName}`}
                      className="p-1.5 rounded-lg text-[#8E2424] hover:bg-[#FDF2F2] cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Top Financial KPI Summary Strip (Estimated Figures) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
          <p className="text-xs text-[#4A5A50]">Est. Startup Costs (Capex)</p>
          <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
            {formatZar(liveCalc.estimatedStartupCostsZar)}
          </p>
          <p className="text-xs text-[#4A5A50] mt-1">Equipment + infrastructure</p>
        </div>
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
          <p className="text-xs text-[#4A5A50]">Est. Operating Costs</p>
          <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
            {formatZar(liveCalc.estimatedOperatingCostsZar)}
          </p>
          <p className="text-xs text-[#4A5A50] font-mono tabular-nums mt-1">
            {formatZar(liveCalc.costPerHectareZar)} / ha
          </p>
        </div>
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
          <p className="text-xs text-[#4A5A50]">Est. Potential Revenue</p>
          <p className="font-mono text-xl font-bold tabular-nums text-[#1B4332] mt-1">
            {formatZar(liveCalc.estimatedRevenueZar)}
          </p>
          <p className="text-xs text-[#4A5A50] font-mono tabular-nums mt-1">
            {draft.expectedProductionQty.toLocaleString()} {draft.productionUnit}
          </p>
        </div>
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
          <p className="text-xs text-[#4A5A50]">Est. Operating Profit / Loss</p>
          <p
            className={`font-mono text-xl font-bold tabular-nums mt-1 ${
              liveCalc.estimatedOperatingProfitLossZar >= 0 ? 'text-[#1B4332]' : 'text-[#8E2424]'
            }`}
          >
            {formatZar(liveCalc.estimatedOperatingProfitLossZar)}
          </p>
          <p className="text-xs text-[#4A5A50] font-mono tabular-nums mt-1">
            Net Yr 1 (after capex): {formatZar(liveCalc.estimatedNetYearOneZar)}
          </p>
        </div>
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-4 col-span-2 lg:col-span-1">
          <p className="text-xs text-[#4A5A50]">Est. Break-Even Point</p>
          <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
            {liveCalc.breakEvenUnits !== null
              ? `${liveCalc.breakEvenUnits.toLocaleString()} ${draft.productionUnit}`
              : '—'}
          </p>
          <p className="text-xs text-[#4A5A50] font-mono tabular-nums mt-1">
            Min price:{' '}
            {liveCalc.breakEvenPriceZar !== null
              ? `R${liveCalc.breakEvenPriceZar}/${draft.productionUnit}`
              : '—'}
          </p>
        </div>
      </div>

      {/* Main Editor + Live Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: All 14 Required Planner Inputs */}
        <section className="lg:col-span-7 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-[#143326]">
                2. Adjust Farm Assumptions (Live Recalculation)
              </h2>
              <p className="text-xs text-[#4A5A50]">
                Every input below updates financial totals, break-even metrics, and charts immediately.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.id && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSavePlan(true)}
                  className="px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white hover:bg-[#EDF2EC] text-xs font-semibold text-[#143326] cursor-pointer"
                >
                  Save As Copy
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSavePlan(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : draft.id ? 'Update Saved Plan' : 'Save Scenario'}</span>
              </button>
            </div>
          </div>

          {/* Farm Identity, Location, Size & Goals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#35443B] mb-1">
                Scenario Name
              </label>
              <input
                type="text"
                value={draft.planName}
                onChange={(e) => setDraft((p) => ({ ...p, planName: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#35443B] mb-1">
                Province
              </label>
              <select
                value={draft.province}
                onChange={(e) => handleSelectProvince(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
              >
                {provinces.map((p) => (
                  <option key={p.code} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#35443B] mb-1">
                District / Municipality
              </label>
              <input
                type="text"
                list="planner-districts"
                value={draft.district}
                onChange={(e) => setDraft((p) => ({ ...p, district: e.target.value }))}
                placeholder="e.g. uMgungundlovu"
                className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
              />
              {selectedProvObj && (
                <datalist id="planner-districts">
                  {selectedProvObj.districts.map((d) => (
                    <option key={d.name} value={d.name} />
                  ))}
                </datalist>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#35443B] mb-1">
                Link Registered Farm (Optional — compares Actuals)
              </label>
              <select
                value={draft.farmId}
                onChange={(e) => handleSelectFarmLink(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
              >
                <option value="">Prospective / Unlinked Scenario</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.farmSizeHectares} ha)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#35443B] mb-1">
                Farm / Plot Size (Hectares)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.05"
                value={draft.farmSizeHectares}
                onChange={(e) => numField('farmSizeHectares', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#35443B] mb-1">
                Production Goals & Target Market Channel
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={draft.productionGoals}
                  onChange={(e) => setDraft((p) => ({ ...p, productionGoals: e.target.value }))}
                  placeholder="Production goals..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                />
                <input
                  type="text"
                  value={draft.marketChannel}
                  onChange={(e) => setDraft((p) => ({ ...p, marketChannel: e.target.value }))}
                  placeholder="Market channel..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>
            </div>
          </div>

          {/* Startup Capex Inputs */}
          <div className="pt-3 border-t border-[#E2E6DF] space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#2D6A4F] font-semibold">
              Estimated Startup Capital (Equipment & Infrastructure)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Equipment & Tools Cost (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={draft.equipmentCostZar}
                  onChange={(e) => numField('equipmentCostZar', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Infrastructure (Fencing, Sheds, Irrigation) (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={draft.infrastructureCostZar}
                  onChange={(e) => numField('infrastructureCostZar', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Equipment Requirements Notes
                </label>
                <input
                  type="text"
                  value={draft.equipmentNotes}
                  onChange={(e) => setDraft((p) => ({ ...p, equipmentNotes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>
            </div>
          </div>

          {/* Seasonal Operating Inputs */}
          <div className="pt-3 border-t border-[#E2E6DF] space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#2D6A4F] font-semibold">
              Estimated Seasonal / Annual Operating Costs
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Seeds & Planting Materials (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="250"
                  value={draft.seedsPlantingCostZar}
                  onChange={(e) => numField('seedsPlantingCostZar', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Fertilisers & Lime (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="250"
                  value={draft.fertilisersCostZar}
                  onChange={(e) => numField('fertilisersCostZar', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Animal Feed & Licks (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="250"
                  value={draft.feedCostZar}
                  onChange={(e) => numField('feedCostZar', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Water & Pumping Cost (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="250"
                  value={draft.waterCostZar}
                  onChange={(e) => numField('waterCostZar', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Est. Water Requirement (m³)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={draft.waterDemandM3}
                  onChange={(e) => numField('waterDemandM3', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Other Operating Expenses (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="250"
                  value={draft.operatingExpensesZar}
                  onChange={(e) => numField('operatingExpensesZar', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Labour Workers Needed
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.labourWorkers}
                  onChange={(e) => numField('labourWorkers', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Total Annual / Seasonal Labour Cost (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={draft.labourCostZar}
                  onChange={(e) => numField('labourCostZar', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>
            </div>
          </div>

          {/* Expected Production & Selling Prices */}
          <div className="pt-3 border-t border-[#E2E6DF] space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#2D6A4F] font-semibold">
              Estimated Output & Assumed Selling Price
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Expected Production Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={draft.expectedProductionQty}
                  onChange={(e) => numField('expectedProductionQty', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Production Unit
                </label>
                <input
                  type="text"
                  value={draft.productionUnit}
                  onChange={(e) => setDraft((p) => ({ ...p, productionUnit: e.target.value }))}
                  placeholder="kg / tonnes / birds / head"
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Assumed Selling Price / Unit (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={draft.sellingPricePerUnitZar}
                  onChange={(e) => numField('sellingPricePerUnitZar', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-[#35443B] mb-1">
                  Assumptions & Risk Notes
                </label>
                <textarea
                  rows={2}
                  value={draft.assumptionsNotes}
                  onChange={(e) => setDraft((p) => ({ ...p, assumptionsNotes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right 5 Cols: Cost Breakdown, Resource Requirements, Actuals vs Estimates */}
        <div className="lg:col-span-5 space-y-6">
          {/* Cost Structure Breakdown */}
          <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  Cost Structure Breakdown
                </h2>
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums text-[#4A5A50]">
                Outlay: {formatZar(liveCalc.totalYearOneOutlayZar)}
              </span>
            </div>

            <div className="space-y-3">
              {liveCalc.costBreakdown.map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#17201B]">
                      {item.label}{' '}
                      <span className="text-[#4A5A50]">
                        · {item.categoryType === 'startup_capex' ? 'Capex' : 'Operating'}
                      </span>
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-[#143326]">
                      {formatZar(item.amountZar)} ({item.sharePercent}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#EDF2EC] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.categoryType === 'startup_capex' ? 'bg-[#B07D2B]' : 'bg-[#1B4332]'
                      }`}
                      style={{ width: `${Math.min(100, item.sharePercent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Resource Requirements Summary */}
          <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-[#143326]">
              Estimated Resource Requirements
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-3">
                <p className="text-[11px] text-[#4A5A50]">Land Area</p>
                <p className="font-mono font-bold tabular-nums text-[#143326] mt-0.5">
                  {liveCalc.resourceRequirements.farmSizeHectares} ha
                </p>
              </div>
              <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-3">
                <p className="text-[11px] text-[#4A5A50]">Workforce</p>
                <p className="font-mono font-bold tabular-nums text-[#143326] mt-0.5">
                  {liveCalc.resourceRequirements.labourWorkers} people
                </p>
              </div>
              <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-3">
                <p className="text-[11px] text-[#4A5A50]">Est. Water</p>
                <p className="font-mono font-bold tabular-nums text-[#143326] mt-0.5">
                  {liveCalc.resourceRequirements.waterDemandM3.toLocaleString()} m³
                </p>
              </div>
            </div>
            <p className="text-xs text-[#4A5A50]">{liveCalc.resourceRequirements.summaryText}</p>
          </section>

          {/* Estimated Values vs Actual Recorded Farm Expenses */}
          <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-[#143326]">
              Estimated Budget vs Actual Farm Expenses
            </h2>
            {linkedActualExpense ? (
              <div className="space-y-3">
                <p className="text-xs text-[#4A5A50]">
                  Comparing your <strong>Planning Estimates</strong> against real expenses logged on{' '}
                  <strong className="text-[#143326]">{linkedActualExpense.farmName}</strong>:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-3">
                    <p className="text-[11px] text-[#4A5A50]">Estimated Operating Plan</p>
                    <p className="font-mono text-lg font-bold tabular-nums text-[#143326] mt-0.5">
                      {formatZar(liveCalc.estimatedOperatingCostsZar)}
                    </p>
                    <p className="text-[11px] text-[#4A5A50]">Assumed projection</p>
                  </div>
                  <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl p-3">
                    <p className="text-[11px] text-[#2D6A4F]">Actual Recorded Expenses</p>
                    <p className="font-mono text-lg font-bold tabular-nums text-[#1B4332] mt-0.5">
                      {formatZar(linkedActualExpense.totalActualRecordedExpensesZar)}
                    </p>
                    <p className="text-[11px] text-[#35443B]">Verified farm ledger</p>
                  </div>
                </div>
                <div className="text-xs text-[#4A5A50] space-y-1 font-mono tabular-nums pt-1 border-t border-[#E2E6DF]">
                  <div className="flex justify-between">
                    <span>Mixed Operations Logs:</span>
                    <span>{formatZar(linkedActualExpense.mixedExpensesZar)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Livestock Costs:</span>
                    <span>{formatZar(linkedActualExpense.livestockCostsZar)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Crop Activity Costs:</span>
                    <span>{formatZar(linkedActualExpense.cropActivityCostsZar)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#4A5A50] leading-relaxed">
                {liveCalc.actualExpensesNote} Existing farmers can link a registered farm above to track actual recorded farm expenses alongside estimated budgets.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Multi-Scale Scenario Comparison Chart & Matrix */}
      {comparisonRows.length > 0 && (
        <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  Scale Comparison: Small vs Medium vs Larger Operations ({activeTemplate?.name})
                </h2>
              </div>
              <p className="text-xs text-[#4A5A50] mt-0.5">
                Compare estimated startup capex, seasonal operating costs, and potential revenue across scales.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#35443B]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#B07D2B] inline-block" />
                Startup Capex
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#4A5A50] inline-block" />
                Operating Cost
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#1B4332] inline-block" />
                Potential Revenue
              </span>
            </div>
          </div>

          {/* Interactive SVG Bar Chart */}
          <div className="overflow-x-auto">
            <svg
              viewBox="0 0 760 220"
              className="w-full min-w-[600px] h-56"
              role="img"
              aria-label="Scale comparison financial chart"
            >
              {[0.25, 0.5, 0.75, 1].map((frac) => {
                const y = 175 - frac * 145;
                return (
                  <g key={frac}>
                    <line x1="65" y1={y} x2="740" y2={y} stroke="#E2E6DF" strokeDasharray="3 3" />
                    <text
                      x="58"
                      y={y + 4}
                      textAnchor="end"
                      className="fill-[#4A5A50] text-[10px] font-mono"
                    >
                      R{Math.round((maxChartValue * frac) / 1000)}k
                    </text>
                  </g>
                );
              })}
              <line x1="65" y1="175" x2="740" y2="175" stroke="#CBD4C9" />

              {comparisonRows.map((row, idx) => {
                const groupX = 95 + idx * 165;
                const capH = (row.calc.estimatedStartupCostsZar / maxChartValue) * 145;
                const opH = (row.calc.estimatedOperatingCostsZar / maxChartValue) * 145;
                const revH = (row.calc.estimatedRevenueZar / maxChartValue) * 145;

                return (
                  <g key={row.key}>
                    <rect
                      x={groupX}
                      y={175 - capH}
                      width="28"
                      height={Math.max(2, capH)}
                      rx="3"
                      fill="#B07D2B"
                    >
                      <title>{`Startup Capex: ${formatZar(row.calc.estimatedStartupCostsZar)}`}</title>
                    </rect>
                    <rect
                      x={groupX + 34}
                      y={175 - opH}
                      width="28"
                      height={Math.max(2, opH)}
                      rx="3"
                      fill="#4A5A50"
                    >
                      <title>{`Operating Cost: ${formatZar(row.calc.estimatedOperatingCostsZar)}`}</title>
                    </rect>
                    <rect
                      x={groupX + 68}
                      y={175 - revH}
                      width="28"
                      height={Math.max(2, revH)}
                      rx="3"
                      fill="#1B4332"
                    >
                      <title>{`Est. Revenue: ${formatZar(row.calc.estimatedRevenueZar)}`}</title>
                    </rect>
                    <text
                      x={groupX + 48}
                      y="194"
                      textAnchor="middle"
                      className={`text-[11px] font-sans ${
                        row.isCurrent ? 'fill-[#143326] font-bold' : 'fill-[#35443B]'
                      }`}
                    >
                      {row.label}
                    </text>
                    <text
                      x={groupX + 48}
                      y="208"
                      textAnchor="middle"
                      className="fill-[#4A5A50] text-[10px] font-mono"
                    >
                      {row.ha} ha
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E6DF] text-xs text-[#4A5A50]">
                  <th className="py-2.5 pr-4 font-semibold">Scenario Scale</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Land & Labour</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Est. Startup</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Est. Operating</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Est. Output</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Est. Revenue</th>
                  <th className="py-2.5 font-semibold text-right">Est. Operating P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E6DF]">
                {comparisonRows.map((row) => (
                  <tr key={row.key} className={row.isCurrent ? 'bg-[#F6FAF7]' : ''}>
                    <td className="py-3 pr-4 font-semibold text-[#143326]">{row.label}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-xs text-[#35443B]">
                      {row.ha} ha · {row.workers} workers
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {formatZar(row.calc.estimatedStartupCostsZar)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {formatZar(row.calc.estimatedOperatingCostsZar)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-xs">
                      {row.qty.toLocaleString()} {row.unit}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-[#1B4332]">
                      {formatZar(row.calc.estimatedRevenueZar)}
                    </td>
                    <td
                      className={`py-3 text-right font-mono tabular-nums font-bold ${
                        row.calc.estimatedOperatingProfitLossZar >= 0
                          ? 'text-[#1B4332]'
                          : 'text-[#8E2424]'
                      }`}
                    >
                      {formatZar(row.calc.estimatedOperatingProfitLossZar)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
