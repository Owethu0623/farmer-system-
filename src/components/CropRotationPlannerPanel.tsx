import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  GitCompare,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Satellite,
  Save,
  SlidersHorizontal,
  Sprout,
  Trash2,
} from 'lucide-react';
import {
  analyzeCropRotation,
  deleteSavedRotationPlan,
  fetchCropRotationCatalog,
  fetchRotationPriorities,
  fetchSavedRotationPlans,
  saveRotationPlan,
  simulateCropRotation,
} from '../lib/api';
import {
  CropRotationAnalysisPayload,
  CropRotationCatalogOption,
  FarmerPriorityCode,
  FarmerPriorityOption,
  FarmItem,
  RotationSimulationResponse,
  SavedRotationPlanItem,
  SequenceEvaluationResult,
} from '../types';

export type RotationPanelMode = 'recommendations' | 'simulator' | 'comparisons' | 'plans';

interface CropRotationPlannerPanelProps {
  mode?: RotationPanelMode;
  farms?: FarmItem[];
  selectedFarmId?: string | null;
  onSelectFarm?: (farmId: string) => void;
  farmId?: string | null;
  fieldId?: string | null;
  province?: string;
  waterAvailability?: string;
  soilType?: string;
  soilPh?: number | null;
  farmSizeHectares?: number;
  provinces?: { name: string }[];
  onNavigateTab?: (tab: string) => void;
}

const SOURCE_BADGE_CLASS: Record<string, string> = {
  'NASA Observation': 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]',
  'NASA Model Wetness (GWETROOT/GWETTOP)': 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
  'Farmer-Provided Soil / Field': 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]',
  'Laboratory Soil Report': 'bg-[#ECFDF5] text-[#174C3C] border-[#6EE7B7]',
  'Agronomic Rule Estimate': 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  'Simulated Outcome': 'bg-[#F8FAFC] text-[#334155] border-[#CBD5E1]',
};

export const CropRotationPlannerPanel: React.FC<CropRotationPlannerPanelProps> = ({
  mode: propMode = 'recommendations',
  farms = [],
  selectedFarmId: propSelectedFarmId,
  onSelectFarm,
  farmId: propFarmId,
  fieldId: propFieldId,
  province: propProvince,
  waterAvailability: propWater,
  soilType: propSoilType,
  soilPh: propSoilPh,
  farmSizeHectares: propHa,
  provinces = [],
  onNavigateTab,
}) => {
  const [activeMode, setActiveMode] = useState<RotationPanelMode>(propMode);
  useEffect(() => {
    setActiveMode(propMode);
  }, [propMode]);

  // Resolve active farm & field
  const effectiveFarmId = propFarmId ?? propSelectedFarmId ?? farms[0]?.id ?? null;
  const activeFarm = useMemo(
    () => farms.find((f) => f.id === effectiveFarmId) || null,
    [farms, effectiveFarmId]
  );

  const [selectedFieldId, setSelectedFieldId] = useState<string>(propFieldId || '');
  useEffect(() => {
    if (propFieldId !== undefined) {
      setSelectedFieldId(propFieldId || '');
      return;
    }
    if (activeFarm && activeFarm.fields.length > 0) {
      if (!selectedFieldId || !activeFarm.fields.some((fl) => fl.id === selectedFieldId)) {
        setSelectedFieldId(activeFarm.fields[0].id);
      }
    } else {
      setSelectedFieldId('');
    }
  }, [propFieldId, activeFarm, selectedFieldId]);

  const activeField = useMemo(
    () => activeFarm?.fields.find((fl) => fl.id === selectedFieldId) || activeFarm?.fields[0] || null,
    [activeFarm, selectedFieldId]
  );

  // Catalog & Farmer Priorities
  const [catalog, setCatalog] = useState<CropRotationCatalogOption[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<FarmerPriorityOption[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<FarmerPriorityCode[]>([
    'improve_soil_health',
    'conserve_water',
    'adapt_to_climate',
  ]);
  const [selectedCropIds, setSelectedCropIds] = useState<string[]>([
    'maize',
    'soybeans',
    'dry_beans',
    'sorghum',
    'sunflower',
  ]);

  // Local scenario context (synced from farm/field or site inputs)
  const [province, setProvince] = useState(
    propProvince || activeFarm?.location?.province || 'Free State'
  );
  const [waterAvailability, setWaterAvailability] = useState(
    propWater || activeField?.irrigationType || activeFarm?.waterAvailability || 'Seasonal Rainfall Only (Dryland)'
  );
  const [soilTexture, setSoilTexture] = useState<'Sandy' | 'Loam' | 'Clay Loam' | 'Clay' | 'Unknown'>(
    activeField?.soilTexture || 'Unknown'
  );
  const [organicMatterLevel, setOrganicMatterLevel] = useState<'Low' | 'Medium' | 'High' | 'Unknown'>(
    activeField?.organicMatterLevel || 'Unknown'
  );
  const [soilDrainage, setSoilDrainage] = useState<'Poor' | 'Moderate' | 'Good' | 'Unknown'>(
    activeField?.soilDrainage || 'Unknown'
  );
  const [waterHoldingCharacteristic, setWaterHoldingCharacteristic] = useState<
    'Low' | 'Moderate' | 'High' | 'Unknown'
  >(activeField?.waterHoldingCharacteristic || 'Unknown');
  const [soilPhInput, setSoilPhInput] = useState(
    propSoilPh !== null && propSoilPh !== undefined
      ? String(propSoilPh)
      : activeField?.soilPhMeasured != null
        ? String(activeField.soilPhMeasured)
        : ''
  );
  const [farmSizeHa, setFarmSizeHa] = useState(
    propHa ? String(propHa) : activeField ? String(activeField.areaHectares) : activeFarm ? String(activeFarm.farmSizeHectares) : '5'
  );
  const [previousSeasonCrop, setPreviousSeasonCrop] = useState(activeField?.previousSeasonCrop || '');
  const [twoSeasonsAgoCrop, setTwoSeasonsAgoCrop] = useState(activeField?.twoSeasonsAgoCrop || '');

  useEffect(() => {
    if (propProvince) setProvince(propProvince);
    else if (activeFarm?.location?.province) setProvince(activeFarm.location.province);
  }, [propProvince, activeFarm]);

  useEffect(() => {
    if (propWater) setWaterAvailability(propWater);
    else if (activeField?.irrigationType) setWaterAvailability(activeField.irrigationType);
    else if (activeFarm?.waterAvailability) setWaterAvailability(activeFarm.waterAvailability);
  }, [propWater, activeField, activeFarm]);

  useEffect(() => {
    if (activeField) {
      setSoilTexture(activeField.soilTexture || 'Unknown');
      setOrganicMatterLevel(activeField.organicMatterLevel || 'Unknown');
      setSoilDrainage(activeField.soilDrainage || 'Unknown');
      setWaterHoldingCharacteristic(activeField.waterHoldingCharacteristic || 'Unknown');
      if (activeField.soilPhMeasured != null) setSoilPhInput(String(activeField.soilPhMeasured));
      setPreviousSeasonCrop(activeField.previousSeasonCrop || '');
      setTwoSeasonsAgoCrop(activeField.twoSeasonsAgoCrop || '');
      setFarmSizeHa(String(activeField.areaHectares || activeFarm?.farmSizeHectares || 5));
    } else if (propSoilType) {
      if (
        propSoilType === 'Sandy' ||
        propSoilType === 'Loam' ||
        propSoilType === 'Clay Loam' ||
        propSoilType === 'Clay'
      ) {
        setSoilTexture(propSoilType);
      }
    }
  }, [activeField, activeFarm, propSoilType]);

  useEffect(() => {
    if (propSoilPh !== null && propSoilPh !== undefined) {
      setSoilPhInput(String(propSoilPh));
    }
  }, [propSoilPh]);

  useEffect(() => {
    if (propHa) setFarmSizeHa(String(propHa));
  }, [propHa]);

  // Loading & Response states
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CropRotationAnalysisPayload | null>(null);
  const [expandedBreakdownId, setExpandedBreakdownId] = useState<string | null>(null);
  const [expandedCropDocId, setExpandedCropDocId] = useState<string | null>(null);

  // Interactive 3-Season Simulator state
  const [simCrop1, setSimCrop1] = useState('maize');
  const [simCrop2, setSimCrop2] = useState('soybeans');
  const [simCrop3, setSimCrop3] = useState('sunflower');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<RotationSimulationResponse | null>(null);

  // Saved Rotation Plans state
  const [savedPlans, setSavedPlans] = useState<SavedRotationPlanItem[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [savingPlanKey, setSavingPlanKey] = useState<string | null>(null);
  const [saveSuccessNote, setSaveSuccessNote] = useState<string | null>(null);
  const [customPlanName, setCustomPlanName] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingCatalog(true);
    Promise.all([fetchCropRotationCatalog(), fetchRotationPriorities()])
      .then(([catRows, prioRows]) => {
        if (!active) return;
        setCatalog(catRows);
        setPriorityOptions(prioRows);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load crop rotation catalog.');
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadSavedPlans = useCallback(async () => {
    if (!effectiveFarmId) {
      setSavedPlans([]);
      return;
    }
    setLoadingPlans(true);
    try {
      const list = await fetchSavedRotationPlans(effectiveFarmId);
      setSavedPlans(list);
    } catch {
      // ignore initial plan load error
    } finally {
      setLoadingPlans(false);
    }
  }, [effectiveFarmId]);

  useEffect(() => {
    void loadSavedPlans();
  }, [loadSavedPlans]);

  const togglePriority = (code: FarmerPriorityCode) => {
    setSelectedPriorities((prev) => {
      if (prev.includes(code)) {
        return prev.length > 1 ? prev.filter((p) => p !== code) : prev;
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), code];
      }
      return [...prev, code];
    });
  };

  const toggleCrop = (cropId: string) => {
    setSelectedCropIds((prev) => {
      if (prev.includes(cropId)) {
        return prev.length > 1 ? prev.filter((id) => id !== cropId) : prev;
      }
      if (prev.length >= 6) {
        return [...prev.slice(1), cropId];
      }
      return [...prev, cropId];
    });
  };

  const buildContextPayload = useCallback(() => {
    const parsedPh = soilPhInput.trim() === '' ? undefined : Number(soilPhInput);
    const parsedHa = Number(farmSizeHa);
    return {
      farmId: effectiveFarmId || null,
      fieldId: activeField?.id || null,
      province,
      waterAvailability,
      soilTexture,
      organicMatterLevel,
      soilDrainage,
      waterHoldingCharacteristic,
      soilPh: parsedPh !== undefined && Number.isFinite(parsedPh) ? parsedPh : undefined,
      farmSizeHectares: Number.isFinite(parsedHa) && parsedHa > 0 ? parsedHa : 5,
      previousSeasonCrop: previousSeasonCrop.trim() || undefined,
      twoSeasonsAgoCrop: twoSeasonsAgoCrop.trim() || undefined,
      farmerPriorities: selectedPriorities,
    };
  }, [
    effectiveFarmId,
    activeField?.id,
    province,
    waterAvailability,
    soilTexture,
    organicMatterLevel,
    soilDrainage,
    waterHoldingCharacteristic,
    soilPhInput,
    farmSizeHa,
    previousSeasonCrop,
    twoSeasonsAgoCrop,
    selectedPriorities,
  ]);

  const runAnalysis = useCallback(async () => {
    setError(null);
    setRunning(true);
    try {
      const res = await analyzeCropRotation({
        ...buildContextPayload(),
        selectedCrops: selectedCropIds.slice(0, 6),
      });
      setAnalysis(res);
      const top1 = res.topStrategies?.[0];
      if (top1 && top1.seasons.length === 3) {
        setSimCrop1(top1.seasons[0].cropId);
        setSimCrop2(top1.seasons[1].cropId);
        setSimCrop3(top1.seasons[2].cropId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze rotation strategies.');
    } finally {
      setRunning(false);
    }
  }, [buildContextPayload, selectedCropIds]);

  const runSimulation = useCallback(
    async (c1: string, c2: string, c3: string, label?: string) => {
      if (!c1 || !c2 || !c3) return;
      setSimulating(true);
      setError(null);
      try {
        const res = await simulateCropRotation({
          ...buildContextPayload(),
          season1CropId: c1,
          season2CropId: c2,
          season3CropId: c3,
          strategyName: label || 'Custom Simulated 3-Season Sequence',
        });
        setSimResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to run 3-season simulation.');
      } finally {
        setSimulating(false);
      }
    },
    [buildContextPayload]
  );

  useEffect(() => {
    if (!loadingCatalog && catalog.length > 0) {
      void runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingCatalog, effectiveFarmId, activeField?.id]);

  useEffect(() => {
    if (activeMode === 'simulator' && catalog.length > 0 && simCrop1 && simCrop2 && simCrop3) {
      void runSimulation(simCrop1, simCrop2, simCrop3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, simCrop1, simCrop2, simCrop3, selectedPriorities, soilTexture, soilDrainage, waterAvailability, effectiveFarmId, activeField?.id]);

  const handleLoadStrategyInSimulator = (strategy: SequenceEvaluationResult) => {
    if (strategy.seasons.length === 3) {
      setSimCrop1(strategy.seasons[0].cropId);
      setSimCrop2(strategy.seasons[1].cropId);
      setSimCrop3(strategy.seasons[2].cropId);
    }
    setActiveMode('simulator');
  };

  const handleSaveProposedPlan = async (
    strategy: SequenceEvaluationResult,
    sourceMode: 'recommended' | 'simulated' | 'custom',
    overrideName?: string
  ) => {
    if (!effectiveFarmId) {
      setError('Register or select a farm first to save a proposed rotation plan.');
      return;
    }
    setSavingPlanKey(strategy.sequenceId);
    setSaveSuccessNote(null);
    setError(null);
    try {
      const nameToSave =
        overrideName?.trim() ||
        `${strategy.seasons.map((s) => s.cropName.split(' ')[0]).join(' → ')} (${activeField?.name || activeFarm?.name || 'Farm'})`;
      await saveRotationPlan({
        farmId: effectiveFarmId,
        fieldId: activeField?.id || null,
        planName: nameToSave,
        planSource: sourceMode === 'simulated' ? 'custom_simulation' : 'recommended_strategy',
        selectedPriorities,
        seasons: strategy.seasons.map((s) => ({
          seasonNumber: s.seasonNumber,
          seasonLabel: s.seasonLabel,
          plantingWindow: s.plantingWindow,
          cropId: s.cropId,
          cropName: s.cropName,
          botanicalFamily: s.botanicalFamily,
          nitrogenRole: s.nitrogenRole,
        })),
        decisionSupportScore: strategy.decisionSupportScore,
        summary: strategy.whyRecommended,
        warnings: strategy.warnings,
        tradeOffs: strategy.tradeOffs,
        missingInformation: strategy.missingInformation,
        environmentalSnapshotLabel: `NASA POWER: ${analysis?.climateSource.recentAnnualRainfallMm ?? '—'} mm/yr · GWETROOT ${analysis?.climateSource.gwetRootRecent ?? '—'}`,
        soilSnapshotLabel: analysis?.siteContext.soilDataSource || `${soilTexture} · Drainage ${soilDrainage}`,
      });
      setSaveSuccessNote(
        `Saved "${nameToSave}" as a Proposed Rotation Plan (does not create planted Crop records).`
      );
      setCustomPlanName('');
      await loadSavedPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save proposed rotation plan.');
    } finally {
      setSavingPlanKey(null);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await deleteSavedRotationPlan(planId);
      setSavedPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete rotation plan.');
    }
  };

  const provinceOptions =
    provinces.length > 0
      ? provinces.map((p) => p.name)
      : [
          'Eastern Cape',
          'Free State',
          'Gauteng',
          'KwaZulu-Natal',
          'Limpopo',
          'Mpumalanga',
          'North West',
          'Northern Cape',
          'Western Cape',
        ];

  const topStrategies = analysis?.topStrategies || [];

  return (
    <div className="bg-white border border-[#CBD5E1] rounded-2xl p-5 sm:p-6 space-y-6">
      {/* Header & Mode Navigation */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
            <CalendarRange className="w-4 h-4 shrink-0" />
            <span>NASA-Powered Climate-Adaptive Crop Rotation Decision Support</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1F3A]">
            {activeMode === 'recommendations' && 'Top 3 Ranked 3-Season Crop Rotation Strategies'}
            {activeMode === 'simulator' && 'Interactive 3-Season Crop Rotation Simulator'}
            {activeMode === 'comparisons' && 'Rotation Strategy Comparisons & Crop Knowledge Base'}
            {activeMode === 'plans' && 'Saved Proposed Crop Rotation Plans'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Combines NASA POWER historical climate & model soil wetness (GWETROOT/GWETTOP), local soil/field entries, 2-season crop history, and your selected priorities. Scores are decision-support estimates — never guaranteed yields.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runAnalysis()}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] rounded-xl bg-[#0B1F3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#14345c] disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{running ? 'Recalculating...' : 'Refresh Analysis'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Strip */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'recommendations', label: 'Top 3 Recommendations', icon: <Sprout className="w-4 h-4" /> },
            { id: 'simulator', label: '3-Season Simulator', icon: <SlidersHorizontal className="w-4 h-4" /> },
            { id: 'comparisons', label: 'Comparisons & Crop Guide', icon: <GitCompare className="w-4 h-4" /> },
            {
              id: 'plans',
              label: `Saved Plans (${savedPlans.length})`,
              icon: <BookmarkCheck className="w-4 h-4" />,
            },
          ] as { id: RotationPanelMode; label: string; icon: React.ReactNode }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveMode(tab.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              activeMode === tab.id
                ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                : 'bg-[#F8FAFC] text-[#0B1F3A] border-[#CBD5E1] hover:bg-[#EFF6FF]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Farm / Field / Soil / History / Farmer Priorities Control Panel */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {farms.length > 0 ? (
            <>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Farm</label>
                <select
                  value={effectiveFarmId || ''}
                  onChange={(e) => {
                    onSelectFarm?.(e.target.value);
                    setSelectedFieldId('');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-900"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.location?.province || 'SA'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Field / Camp</label>
                <select
                  value={activeField?.id || ''}
                  onChange={(e) => setSelectedFieldId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-900"
                >
                  {activeFarm?.fields.length ? (
                    activeFarm.fields.map((fl) => (
                      <option key={fl.id} value={fl.id}>
                        {fl.name} ({fl.areaHectares} ha)
                      </option>
                    ))
                  ) : (
                    <option value="">Whole Farm (No Fields Defined)</option>
                  )}
                </select>
              </div>
            </>
          ) : (
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Province</label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-900"
              >
                {provinceOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Water Availability</label>
            <select
              value={waterAvailability}
              onChange={(e) => setWaterAvailability(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-900"
            >
              <option value="Seasonal Rainfall Only (Dryland)">Seasonal Rainfall Only (Dryland)</option>
              <option value="Borehole & Drip Irrigation">Borehole & Drip Irrigation</option>
              <option value="Farm Dam & Gravity Irrigation">Farm Dam & Gravity Irrigation</option>
              <option value="River Abstraction / Pivot Irrigation">River Abstraction / Pivot Irrigation</option>
              <option value="Municipal / Tanker Buffer">Municipal / Tanker Buffer</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Soil Texture · Drainage
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={soilTexture}
                onChange={(e) => setSoilTexture(e.target.value as typeof soilTexture)}
                className="w-full px-2 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900"
              >
                <option value="Unknown">Texture: Unknown</option>
                <option value="Sandy">Sandy</option>
                <option value="Loam">Loam</option>
                <option value="Clay Loam">Clay Loam</option>
                <option value="Clay">Clay</option>
              </select>
              <select
                value={soilDrainage}
                onChange={(e) => setSoilDrainage(e.target.value as typeof soilDrainage)}
                className="w-full px-2 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900"
              >
                <option value="Unknown">Drainage: Unknown</option>
                <option value="Good">Good</option>
                <option value="Moderate">Moderate</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2-Season Crop History & Soil pH Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Previous Season Crop
            </label>
            <input
              type="text"
              value={previousSeasonCrop}
              onChange={(e) => setPreviousSeasonCrop(e.target.value)}
              placeholder="e.g. Maize, Soybeans, Wheat"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              2 Seasons Ago Crop
            </label>
            <input
              type="text"
              value={twoSeasonsAgoCrop}
              onChange={(e) => setTwoSeasonsAgoCrop(e.target.value)}
              placeholder="e.g. Sunflower, Dry Beans"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Organic Matter · Water Holding
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={organicMatterLevel}
                onChange={(e) => setOrganicMatterLevel(e.target.value as typeof organicMatterLevel)}
                className="w-full px-2 py-2 border border-slate-300 rounded-xl text-xs bg-white"
              >
                <option value="Unknown">OM: Unknown</option>
                <option value="Low">OM: Low</option>
                <option value="Medium">OM: Medium</option>
                <option value="High">OM: High</option>
              </select>
              <select
                value={waterHoldingCharacteristic}
                onChange={(e) =>
                  setWaterHoldingCharacteristic(e.target.value as typeof waterHoldingCharacteristic)
                }
                className="w-full px-2 py-2 border border-slate-300 rounded-xl text-xs bg-white"
              >
                <option value="Unknown">WHC: Unknown</option>
                <option value="Low">WHC: Low</option>
                <option value="Moderate">WHC: Moderate</option>
                <option value="High">WHC: High</option>
              </select>
            </div>
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Measured Topsoil pH (Optional)
            </label>
            <input
              type="number"
              step="0.1"
              min="3.5"
              max="9.0"
              placeholder="Blank if untested"
              value={soilPhInput}
              onChange={(e) => setSoilPhInput(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono bg-white"
            />
          </div>
        </div>

        {/* Farmer Priorities Multi-Select (Up to 3) */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
              Farmer Priorities ({selectedPriorities.length}/3 Active — Shapes Rotation Scoring)
            </span>
            <span className="text-[11px] text-slate-500">
              Select up to 3 goals. Rankings and simulator alignment react immediately.
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {priorityOptions.map((prio) => {
              const checked = selectedPriorities.includes(prio.code);
              return (
                <button
                  key={prio.code}
                  type="button"
                  onClick={() => togglePriority(prio.code)}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                    checked
                      ? 'border-[#0B3D91] bg-[#EFF6FF] text-[#0B1F3A]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <span>{prio.label}</span>
                    <span className={checked ? 'text-[#0B3D91] font-bold' : 'text-slate-400'}>
                      {checked ? 'Active' : 'Select'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{prio.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-300 bg-red-50 text-xs sm:text-sm text-red-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccessNote && (
        <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 text-xs sm:text-sm text-emerald-950 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{saveSuccessNote}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveMode('plans')}
            className="text-xs font-bold text-[#0B3D91] underline cursor-pointer"
          >
            View Saved Plans →
          </button>
        </div>
      )}

      {/* NASA & Site Context Grounding Banner */}
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-[#0B1F3A] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#0B3D91]" />
                <span>Site & Field Context: {analysis.siteContext.label}</span>
              </span>
              {analysis.dataConfidence && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    analysis.dataConfidence === 'Moderate-High'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : analysis.dataConfidence === 'Moderate'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-red-50 text-red-900 border-red-200'
                  }`}
                >
                  Data Confidence: {analysis.dataConfidence}
                </span>
              )}
            </div>
            <p className="text-slate-700">
              {analysis.siteContext.province} ({analysis.siteContext.rainfallRegime}) · Texture:{' '}
              {analysis.siteContext.soilTexture || soilTexture} · Drainage:{' '}
              {analysis.siteContext.soilDrainage || soilDrainage} · pH:{' '}
              {analysis.siteContext.soilPhMeasured ?? 'Untested (assumed ~6.1)'}
            </p>
            <p className="text-slate-500">
              History: Prev season "{analysis.siteContext.previousSeasonCrop || 'Unrecorded'}" · 2 seasons ago "
              {analysis.siteContext.twoSeasonsAgoCrop || 'Unrecorded'}" · {analysis.siteContext.soilDataSource}
            </p>
          </div>

          <div className="space-y-1">
            <div className="font-bold text-[#0B1F3A] flex items-center gap-1.5">
              <Satellite className="w-4 h-4 text-[#0B3D91]" />
              <span>NASA POWER & Soil Wetness Signal</span>
            </div>
            <p className="text-slate-700">{analysis.climateSource.note}</p>
            <p className="font-mono text-[11px] text-slate-800">
              Recent rain: {analysis.climateSource.recentAnnualRainfallMm ?? '—'} mm/yr (baseline{' '}
              {analysis.climateSource.baselineAnnualRainfallMm ?? '—'} mm/yr) · Mean Tmax:{' '}
              {analysis.climateSource.avgMaxTempC ?? '—'}°C · Model wetness GWETROOT:{' '}
              {analysis.climateSource.gwetRootRecent ?? '—'} / GWETTOP:{' '}
              {analysis.climateSource.gwetTopRecent ?? '—'}
            </p>
          </div>
        </div>
      )}

      {/* ==================== MODE 1: TOP 3 RECOMMENDATIONS ==================== */}
      {activeMode === 'recommendations' && analysis && (
        <div className="space-y-5">
          <div className="space-y-4">
            {topStrategies.map((strategy, idx) => {
              const isExpanded = expandedBreakdownId === strategy.sequenceId;
              return (
                <article
                  key={strategy.sequenceId}
                  className="border border-[#CBD5E1] rounded-2xl p-5 bg-white space-y-4 shadow-xs"
                >
                  {/* Strategy Header & Weighted Score */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0B1F3A] text-white">
                          Rank #{idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-emerald-800">
                          {strategy.indicators.botanicalDiversityCount} Botanical Families ·{' '}
                          {strategy.indicators.estimatedNitrogenSupport}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-[#0B1F3A] break-words">
                        {strategy.strategyName}
                      </h3>
                      <p className="text-xs text-slate-700 leading-relaxed">{strategy.whyRecommended}</p>
                    </div>

                    <div className="text-right shrink-0 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">
                        Decision-Support Score
                      </div>
                      <div className="font-mono text-2xl font-bold text-[#0B3D91]">
                        {strategy.decisionSupportScore}
                        <span className="text-xs font-normal text-slate-500">/100</span>
                      </div>
                      <div className="text-[10px] text-amber-800 font-medium">Estimate — Not Yield</div>
                    </div>
                  </div>

                  {/* 3-Season Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                    {strategy.seasons.map((s) => (
                      <div
                        key={s.seasonNumber}
                        className="border border-slate-200 rounded-xl bg-[#F8FAFC] p-3.5 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-semibold uppercase text-slate-500">
                              {s.seasonLabel}
                            </div>
                            <div className="text-sm font-bold text-[#0B1F3A] mt-0.5">{s.cropName}</div>
                          </div>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              s.suitabilityLevel === 'Strong Fit'
                                ? 'bg-emerald-100 text-emerald-900'
                                : s.suitabilityLevel === 'Conditional Fit'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-red-100 text-red-900'
                            }`}
                          >
                            {s.suitabilityLevel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">
                          {s.botanicalFamily} · {s.nitrogenRole} · Water: {s.waterNeed} · {s.plantingWindow}
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-700">
                          {s.suitabilityReasons.slice(0, 3).map((r, rIdx) => (
                            <li key={rIdx}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Indicators Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Residue Cover</span>
                      <strong className="text-[#0B1F3A]">{strategy.indicators.residueCoverRating}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Water Resilience</span>
                      <strong className="text-[#0B1F3A]">{strategy.indicators.waterResilienceRating}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Climate Resilience</span>
                      <strong className="text-[#0B1F3A]">{strategy.indicators.climateResilienceRating}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Soil & Moisture Fit</span>
                      <strong className="text-[#0B1F3A]">{strategy.indicators.soilMoistureSuitability}</strong>
                    </div>
                  </div>

                  {/* Transparent 4-Source Influencing Inputs & Warnings / Trade-offs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                      <div className="font-bold text-[#0B1F3A]">Key Influencing Inputs (4 Evidence Streams)</div>
                      <ul className="space-y-1 text-slate-700">
                        <li>
                          <strong>NASA Observations:</strong> {strategy.influencingInputs.nasaObservations[0]}
                        </li>
                        <li>
                          <strong>Soil & Field:</strong> {strategy.influencingInputs.soilAndFieldInputs[0]}
                        </li>
                        <li>
                          <strong>Crop & History:</strong> {strategy.influencingInputs.cropAndHistoryFactors[0]}
                        </li>
                        <li>
                          <strong>Farmer Priorities:</strong>{' '}
                          {strategy.influencingInputs.farmerPriorityFactors.join(', ')}
                        </li>
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1.5">
                      <div className="font-bold text-amber-950">Warnings, Trade-offs & When Alternative Preferred</div>
                      {strategy.warnings.length > 0 && (
                        <ul className="list-disc pl-4 space-y-0.5 text-red-900">
                          {strategy.warnings.map((w, wIdx) => (
                            <li key={wIdx}>{w}</li>
                          ))}
                        </ul>
                      )}
                      {strategy.tradeOffs.map((tr, tIdx) => (
                        <p key={tIdx} className="text-amber-950">
                          <strong>Trade-off:</strong> {tr}
                        </p>
                      ))}
                      <p className="text-slate-800">
                        <strong>When Alternative Preferred:</strong> {strategy.whenAlternativePreferred}
                      </p>
                    </div>
                  </div>

                  {/* Expandable Score Breakdown & Next Steps */}
                  {isExpanded && (
                    <div className="p-4 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 space-y-3 text-xs">
                      <div className="font-bold text-[#0B1F3A]">
                        Transparent Weighted Formula: <span className="font-mono">{strategy.scoreBreakdown.formula}</span>
                      </div>
                      <div className="space-y-2">
                        {strategy.scoreBreakdown.components.map((comp) => (
                          <div key={comp.key} className="bg-white border border-slate-200 rounded-lg p-2.5">
                            <div className="flex items-center justify-between gap-2 font-semibold text-[#0B1F3A]">
                              <span>
                                {comp.label} (Weight {comp.weightPercent}%)
                              </span>
                              <span className="font-mono">
                                {comp.rawScore}/100 → +{comp.weightedPoints} pts
                              </span>
                            </div>
                            <p className="text-slate-600 mt-0.5">{comp.rationale}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div>
                          <div className="font-bold text-[#0B1F3A] mb-1">Missing Information</div>
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                            {strategy.missingInformation.length > 0 ? (
                              strategy.missingInformation.map((m, mIdx) => <li key={mIdx}>{m}</li>)
                            ) : (
                              <li>Key lab soil, crop history, and NASA climate inputs are present.</li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <div className="font-bold text-[#0B1F3A] mb-1">Practical Next Steps</div>
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                            {strategy.nextSteps.map((st, sIdx) => (
                              <li key={sIdx}>{st}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedBreakdownId(isExpanded ? null : strategy.sequenceId)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span>{isExpanded ? 'Hide Score Formula & Next Steps' : 'Inspect Score Formula & Next Steps'}</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadStrategyInSimulator(strategy)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#0B3D91] text-[#0B3D91] hover:bg-[#EFF6FF] text-xs font-semibold cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Simulate / Tweak This Strategy</span>
                      </button>

                      {effectiveFarmId && (
                        <button
                          type="button"
                          disabled={savingPlanKey === strategy.sequenceId}
                          onClick={() => void handleSaveProposedPlan(strategy, 'recommended')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#174C3C] hover:bg-[#113A2E] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>
                            {savingPlanKey === strategy.sequenceId
                              ? 'Saving...'
                              : 'Save as Proposed Plan'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== MODE 2: INTERACTIVE 3-SEASON SIMULATOR ==================== */}
      {activeMode === 'simulator' && (
        <div className="space-y-5">
          <div className="border border-[#BFDBFE] bg-[#EFF6FF]/60 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                  Select Crops Across 3 Growing Seasons to Simulate Soil, Moisture & Climate Effects
                </h3>
                <p className="text-xs text-slate-600">
                  Test consecutive Poaceae vs legume breaks, water-demand clashes, and priority alignment in real time.
                </p>
              </div>
              {simulating && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B3D91]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Simulating...</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'Season 1 Crop', val: simCrop1, setter: setSimCrop1 },
                { label: 'Season 2 Crop', val: simCrop2, setter: setSimCrop2 },
                { label: 'Season 3 Crop', val: simCrop3, setter: setSimCrop3 },
              ].map((sel) => (
                <div key={sel.label}>
                  <label className="block text-xs font-bold text-[#0B1F3A] mb-1">{sel.label}</label>
                  <select
                    value={sel.val}
                    onChange={(e) => sel.setter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-[#0B1F3A]"
                  >
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.botanicalFamily} · Water: {c.waterNeed})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {simResult && (
            <div className="border border-[#CBD5E1] rounded-2xl p-5 bg-white space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-emerald-800 uppercase">
                    Simulated Outcome ({simResult.dataConfidence} Confidence)
                  </div>
                  <h4 className="font-display text-lg font-bold text-[#0B1F3A]">
                    {simResult.simulation.seasons.map((s) => s.cropName.split(' ')[0]).join(' → ')}
                  </h4>
                  <p className="text-xs text-slate-600">{simResult.simulation.scoreBreakdown.statusLabel}</p>
                </div>

                <div className="text-right bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Simulated Score</div>
                  <div className="font-mono text-2xl font-bold text-[#0B3D91]">
                    {simResult.simulation.decisionSupportScore}
                    <span className="text-xs font-normal text-slate-500">/100</span>
                  </div>
                </div>
              </div>

              {/* Indicators Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Families</span>
                  <strong className="text-[#0B1F3A]">
                    {simResult.simulation.indicators.botanicalDiversityCount}/3 Distinct
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Biological N</span>
                  <strong className="text-[#0B1F3A]">
                    {simResult.simulation.indicators.legumeIncluded ? 'Legume Included' : 'None (Needs N)'}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Residue Cover</span>
                  <strong className="text-[#0B1F3A]">
                    {simResult.simulation.indicators.residueCoverRating}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Water Resilience</span>
                  <strong className="text-[#0B1F3A]">
                    {simResult.simulation.indicators.waterResilienceRating}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Climate Fit</span>
                  <strong className="text-[#0B1F3A]">
                    {simResult.simulation.indicators.climateResilienceRating}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Moisture Fit</span>
                  <strong className="text-[#0B1F3A]">
                    {simResult.simulation.indicators.soilMoistureSuitability}
                  </strong>
                </div>
              </div>

              {/* Explicit Source Tags Attribution */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
                  Transparent Evidence & Source Attribution
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {simResult.simulation.sourceTags.map((tag) => (
                    <div
                      key={tag.indicator}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#0B1F3A]">{tag.indicator}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            SOURCE_BADGE_CLASS[tag.sourceCategory] ||
                            'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {tag.sourceCategory}
                        </span>
                      </div>
                      <p className="text-slate-600">{tag.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings & Trade-offs */}
              {(simResult.simulation.warnings.length > 0 || simResult.simulation.tradeOffs.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/70 space-y-1">
                    <div className="font-bold text-red-900">Sequence Warnings & Disease Risks</div>
                    <ul className="list-disc pl-4 space-y-0.5 text-red-950">
                      {simResult.simulation.warnings.length > 0 ? (
                        simResult.simulation.warnings.map((w, i) => <li key={i}>{w}</li>)
                      ) : (
                        <li>No severe botanical family repeat or water-clash warnings triggered.</li>
                      )}
                    </ul>
                  </div>
                  <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 space-y-1">
                    <div className="font-bold text-amber-950">Key Trade-offs</div>
                    <ul className="list-disc pl-4 space-y-0.5 text-amber-950">
                      {simResult.simulation.tradeOffs.map((tr, i) => (
                        <li key={i}>{tr}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Save Simulated Plan Bar */}
              {effectiveFarmId && (
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200">
                  <input
                    type="text"
                    value={customPlanName}
                    onChange={(e) => setCustomPlanName(e.target.value)}
                    placeholder="Optional plan title (e.g. Camp A Drought Buffer Plan)"
                    className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                  <button
                    type="button"
                    disabled={savingPlanKey === simResult.simulation.sequenceId}
                    onClick={() =>
                      void handleSaveProposedPlan(simResult.simulation, 'simulated', customPlanName)
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#174C3C] hover:bg-[#113A2E] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Simulated Proposed Plan</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== MODE 3: COMPARISONS & CROP GUIDE ==================== */}
      {activeMode === 'comparisons' && analysis && (
        <div className="space-y-6">
          {/* Top 3 Strategy Comparison Matrix */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide">
              Side-by-Side Comparison of Top Ranked 3-Season Strategies
            </h3>
            <div className="overflow-x-auto border border-slate-300 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[#0B1F3A] border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Strategy</th>
                    <th className="py-2.5 px-3 font-semibold">3-Season Sequence</th>
                    <th className="py-2.5 px-3 font-semibold">Score</th>
                    <th className="py-2.5 px-3 font-semibold">Families</th>
                    <th className="py-2.5 px-3 font-semibold">N Support</th>
                    <th className="py-2.5 px-3 font-semibold">Residue</th>
                    <th className="py-2.5 px-3 font-semibold">Water Fit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {topStrategies.map((st, idx) => (
                    <tr key={st.sequenceId}>
                      <td className="py-2.5 px-3 font-semibold text-[#0B1F3A]">
                        #{idx + 1} {st.strategyName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {st.seasons.map((s) => s.cropName.split(' ')[0]).join(' → ')}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0B3D91]">
                        {st.decisionSupportScore}/100
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {st.indicators.botanicalDiversityCount}/3
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {st.indicators.legumeIncluded ? 'Legume Fixed' : 'External N'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{st.indicators.residueCoverRating}</td>
                      <td className="py-2.5 px-3 text-slate-700">{st.indicators.waterResilienceRating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Crop Checkboxes & Individual Crop Comparison */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide">
                Compare Up to 6 Individual Crops ({selectedCropIds.length}/6 Selected)
              </h3>
              <button
                type="button"
                onClick={() => void runAnalysis()}
                className="text-xs font-semibold text-[#0B3D91] underline cursor-pointer"
              >
                Update Crop Comparison Table
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {catalog.map((c) => {
                const picked = selectedCropIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCrop(c.id)}
                    className={`p-2 rounded-xl border text-left text-xs cursor-pointer ${
                      picked
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate">{c.name.split(' (')[0]}</div>
                    <div className="text-[10px] text-slate-500">{c.botanicalFamily}</div>
                  </button>
                );
              })}
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[#0B1F3A] border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Crop Option</th>
                    <th className="py-2.5 px-3 font-semibold">Botanical Family</th>
                    <th className="py-2.5 px-3 font-semibold">Water Need</th>
                    <th className="py-2.5 px-3 font-semibold">Target pH</th>
                    <th className="py-2.5 px-3 font-semibold">Site Fit</th>
                    <th className="py-2.5 px-3 font-semibold">Agronomic Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {analysis.comparedCrops.map((row) => (
                    <tr key={row.cropId}>
                      <td className="py-2.5 px-3 font-semibold text-[#0B1F3A] whitespace-nowrap">
                        {row.cropName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {row.botanicalFamily}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{row.waterNeed}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {row.idealPhRange[0]}–{row.idealPhRange[1]}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-bold whitespace-nowrap ${
                          row.suitabilityScoreLabel === 'High Fit'
                            ? 'text-emerald-800'
                            : row.suitabilityScoreLabel === 'Moderate Fit'
                              ? 'text-amber-800'
                              : 'text-red-800'
                        }`}
                      >
                        {row.suitabilityScoreLabel}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 min-w-[260px]">
                        {row.suitabilityReason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* South African Agronomic Crop Knowledge Base */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0B3D91]" />
              <h3 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide">
                South African Crop Agronomic Characteristics ({catalog.length} Species)
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catalog.map((crop) => {
                const open = expandedCropDocId === crop.id;
                return (
                  <div
                    key={crop.id}
                    className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#0B1F3A] text-sm">{crop.name}</div>
                        <div className="text-slate-600">
                          {crop.botanicalFamily} · {crop.preferredSeason} · {crop.nitrogenRole}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedCropDocId(open ? null : crop.id)}
                        className="text-[#0B3D91] font-semibold underline shrink-0 cursor-pointer"
                      >
                        {open ? 'Less' : 'Agronomy Details'}
                      </button>
                    </div>
                    <p className="text-slate-700">{crop.summary}</p>
                    {open && (
                      <div className="pt-2 border-t border-slate-200 space-y-1 text-slate-700">
                        <p>
                          <strong>Water Requirement:</strong> {crop.waterRequirementMmRange || crop.waterNeed}
                        </p>
                        <p>
                          <strong>Temperature Sensitivity:</strong> {crop.temperatureSensitivity}
                        </p>
                        <p>
                          <strong>Soil Preferences:</strong> {crop.soilPreferences}
                        </p>
                        <p>
                          <strong>Nitrogen Role:</strong> {crop.nitrogenCharacteristics}
                        </p>
                        <p>
                          <strong>Rotation & Disease Notes:</strong> {crop.rotationConsiderations}{' '}
                          {crop.diseaseAndPestConsiderations}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">
                          Reference: {crop.agronomicReference}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODE 4: SAVED PROPOSED ROTATION PLANS ==================== */}
      {activeMode === 'plans' && (
        <div className="space-y-4">
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 text-xs text-[#0B1F3A] flex flex-wrap items-center justify-between gap-2">
            <span>
              Saved plans remain strictly <strong>Proposed Plans</strong> for decision support. They do not alter or create active planted Crop records in Farm Operations.
            </span>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('soil')}
                className="font-semibold text-[#0B3D91] underline cursor-pointer"
              >
                Update Field Soil & History →
              </button>
            )}
          </div>

          {!effectiveFarmId ? (
            <div className="p-6 border border-slate-200 rounded-xl text-sm text-slate-600 text-center">
              Register or select a farm to save and inspect proposed 3-season rotation plans.
            </div>
          ) : loadingPlans ? (
            <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading saved rotation plans...</span>
            </div>
          ) : savedPlans.length === 0 ? (
            <div className="p-6 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
              <p className="text-sm font-semibold text-[#0B1F3A]">
                No saved rotation plans for {activeFarm?.name || 'this farm'} yet.
              </p>
              <p className="text-xs text-slate-600">
                Save one of your Top 3 Recommendations or a custom 3-Season Simulator run to compare options later.
              </p>
              <button
                type="button"
                onClick={() => setActiveMode('recommendations')}
                className="px-4 py-2 rounded-xl bg-[#0B3D91] text-white text-xs font-semibold cursor-pointer"
              >
                Explore Top 3 Strategies
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedPlans.map((plan) => (
                <article
                  key={plan.id}
                  className="border border-slate-300 rounded-2xl p-4 bg-white space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                          Proposed Plan — Does Not Create Crop Records
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {new Date(plan.createdAt).toLocaleDateString('en-ZA')} ·{' '}
                          {plan.planSource === 'custom_simulation'
                            ? 'Custom Simulation'
                            : 'Recommended Strategy'}
                        </span>
                      </div>
                      <h4 className="font-display text-base font-bold text-[#0B1F3A]">{plan.planName}</h4>
                      <p className="text-xs text-slate-600">
                        {plan.farmName} {plan.fieldName ? `· Field: ${plan.fieldName}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold text-[#0B3D91]">
                        {plan.decisionSupportScore}/100
                      </div>
                      <div className="text-[10px] text-slate-500">Decision Score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {plan.seasons.map((s) => (
                      <div key={s.seasonNumber} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[11px] text-slate-500">Season {s.seasonNumber}</div>
                        <div className="font-bold text-[#0B1F3A]">{s.cropName}</div>
                        <div className="text-[11px] text-slate-600">
                          {s.botanicalFamily} · {s.plantingWindow}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span>
                      {plan.environmentalSnapshotLabel} · {plan.soilSnapshotLabel}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (plan.seasons.length === 3) {
                            setSimCrop1(plan.seasons[0].cropId);
                            setSimCrop2(plan.seasons[1].cropId);
                            setSimCrop3(plan.seasons[2].cropId);
                            setActiveMode('simulator');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#0B3D91] text-[#0B3D91] font-semibold cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Load in Simulator</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeletePlan(plan.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Explicit Non-Guarantee Scientific Disclaimer */}
      {analysis && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-1.5 text-xs text-amber-950">
          <div className="font-bold flex items-center gap-1.5 text-amber-900">
            <Droplets className="w-4 h-4 shrink-0 text-amber-800" />
            <span>Scientific Transparency, Assumptions & Non-Guarantee Notice</span>
          </div>
          <p className="font-semibold text-red-900">{analysis.disclaimer}</p>
          <p className="text-amber-900">{analysis.climateAndMoistureAlignment}</p>
        </div>
      )}
    </div>
  );
};
